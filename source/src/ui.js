/* =========================================================
   화면: 패널(조합·부품·경고·구상안·기록) · 선택 카드 · 머리줄 · 비교 · 알림
   ========================================================= */
const els = {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = ts => {
  if (!ts) return '';
  const s = (Date.now() - ts) / 1000;
  if (s < 50) return '방금';
  if (s < 3600) return Math.round(s / 60) + '분 전';
  if (s < 86400) return Math.round(s / 3600) + '시간 전';
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const isWide = () => window.innerWidth >= 1100;
const isPhone = () => window.innerWidth < 760;

function cacheEls() {
  for (const id of ['app', 'views', 'pane2d', 'pane3d', 'cv', 'labels', 'camBtns', 'pick', 'panel', 'ptabs', 'pbody', 'svgTop', 'svgSide',
    'sync', 'peers', 'explainToggle', 'designPick', 'designPickName', 'banner', 'viewSeg', 'sideSeg', 'startBoxBtn', 'bigBtn',
    'sheet', 'sheetBody', 'sheetClose', 'toasts', 'installBtn', 'gate', 'gateMsg', 'gateLogin', 'gateOut']) els[id] = document.getElementById(id);
}

/* ---------- 새로 그리기 ---------- */
function refresh(opt) {
  opt = opt || {};
  CUR.robot = buildRobot(viewDesign(), S.drag);
  CUR.an = analyze(CUR.robot);
  validateSel();
  render2D(); update3D(); renderPick(); renderTabBadges(); renderChrome();
  if (opt.panel !== false) renderPanelSafe();
}
function refreshSel() { render2D(); update3D(); renderPick(); if (S.tab === 'parts') renderPanelSafe(); }
function refreshHistoryUI() { if (S.tab === 'hist' || S.tab === 'designs') renderPanelSafe(); }

/* ---------- 선택 ---------- */
function selUnit() {
  if (!S.sel || !CUR.robot) return null;
  const p = CUR.robot.byKey.get(S.sel.key);
  if (p) return unitOfPart(p);
  const h = CUR.robot.hidden.find(x => x.key === S.sel.key);
  return h ? { type: 'drive', key: h.key, id: 'd:' + h.key, hidden: true } : null;
}
function validateSel() {
  if (!S.sel) return;
  const R = CUR.robot;
  if (R.byKey.has(S.sel.key) || R.hidden.some(h => h.key === S.sel.key)) return;
  const pre = S.sel.key.slice(0, 2);
  const mod = { 'L:': 'launcher', 'I:': 'intake', 'B:': 'brain' }[pre];
  const alt = mod && R.parts.find(p => p.mod === mod && !p.ghost && !p.bag);
  S.sel = alt ? { key: alt.key } : null;
}
function selectKey(key, src) {
  if (key && CUR.robot && !(CUR.robot.byKey.has(key) || CUR.robot.hidden.some(h => h.key === key))) key = null;
  S.sel = key ? { key } : null;
  S.pickOpen = !!key && (src === 'view' || src === '2d');
  pushPresence();
  if (src !== 'silent') refreshSel();
}
function renderPick() {
  const box = els.pick, u = selUnit();
  if (!u || !S.pickOpen) { box.hidden = true; box.innerHTML = ''; return; }
  const R = CUR.robot, p = R.byKey.get(S.sel.key);
  const kind = p ? p.kind : (R.hidden.find(h => h.key === S.sel.key) || {}).kind;
  const info = KIND[kind] || { name: kind, role: '', text: '' };
  const g = u.type === 'mod' ? u.mod : u.type === 'custom' ? 'custom' : 'drive';
  const nm = p ? partName(p, R.T) : unitName(u, R);
  box.innerHTML = `<h4>${esc(nm)} <span class="chip g-${g}${p && p.ph ? ' ghost' : ''}">${GROUP_LABEL[g]}${p && p.ph ? ' · 임시 상자' : ''}</span></h4>
    <div class="acts"><button class="btn sm" type="button" data-act="go" data-tab="parts">${S.readonly ? '자세히' : '조절하기'}</button><button class="x" type="button" data-act="pickClose" aria-label="닫기">×</button></div>
    <p class="ex-only"><b>${esc(info.role)}</b> · ${esc(info.text)}</p>`;
  box.hidden = false;
}

/* ---------- 머리줄 · 보기 방식 ---------- */
function setSync(s) {
  S.sync = s;
  if (!els.sync) return;
  els.sync.dataset.s = s;
  els.sync.querySelector('span').textContent = { loading: '불러오는 중', saved: '저장됨', saving: '저장 중', error: '저장 안 됨', ro: '보기 전용', local: BACKEND.text.syncLocal || '이 기기에만 저장' }[s] || '';
}
function effView() {
  let v = S.prefs.view || (isWide() ? 'split' : '3d');
  if (v === 'split' && !isWide()) v = '3d';
  return v;
}
function renderChrome() {
  const app = els.app;
  app.classList.toggle('noex', !S.prefs.explain);
  app.classList.toggle('big', !!S.prefs.big && isPhone());
  app.classList.toggle('ro', !!S.readonly);
  els.explainToggle.checked = !!S.prefs.explain;
  const d = curDesign();
  els.designPickName.textContent = d ? d.name : (S.mode === 'loading' ? '불러오는 중' : '구상안 없음');
  const v = effView();
  if (els.views.dataset.v !== v) { els.views.dataset.v = v; requestAnimationFrame(() => { resize3D(); render2D(); }); }
  const modes = isWide() ? [['split', '나란히'], ['3d', '3D'], ['2d', '2D']] : [['3d', '3D'], ['2d', '2D 도면']];
  const segHtml = modes.map(([k, l]) => `<button type="button" data-view="${k}" class="${k === v ? 'on' : ''}" aria-pressed="${k === v}">${l}</button>`).join('');
  if (els.viewSeg.innerHTML !== segHtml) els.viewSeg.innerHTML = segHtml;
  const narrow2d = v === '2d' && !isWide();
  els.sideSeg.hidden = !narrow2d;
  els.pane2d.dataset.only = narrow2d ? S.prefs.sv : '';
  els.sideSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sv === S.prefs.sv));
  els.startBoxBtn.classList.toggle('on', !!S.prefs.startBox);
  els.startBoxBtn.setAttribute('aria-pressed', !!S.prefs.startBox);
  els.bigBtn.classList.toggle('on', !!S.prefs.big);
  els.bigBtn.textContent = S.prefs.big ? '작게' : '크게';
  // 안내 띠
  let bn = '', k = '';
  if (S.incoming) {
    const nm = esc(S.incoming.name);
    bn = S.incomingUrl ? `받은 구상안 "${nm}"이에요. 카톡 안에서는 앱에 저장되지 않아요. <button class="btn sm pri" type="button" data-act="openExternal">브라우저에서 열기</button>`
      : `받은 구상안 "${nm}"을 내 구상안에 추가할까요? <button class="btn sm pri" type="button" data-act="acceptIncoming">추가</button> <button class="btn sm" type="button" data-act="dismissIncoming">닫기</button>`;
    k = 'in';
  } else if (S.updateReady) { bn = '새 버전이 나왔어요. <button class="btn sm pri" type="button" data-act="reload">지금 적용</button>'; k = 'upd'; }
  else if (S.mode === 'local') { bn = esc(BACKEND.text.local); k = 'local'; }
  else if (S.readonly) { bn = esc(BACKEND.text.ro); k = 'ro'; }
  else if (S.mode === 'shared' && S.firstSnap && !liveDesigns().length) { bn = '구상안이 아직 없어요. <button class="btn sm pri" type="button" data-act="newDesign">첫 구상안 만들기</button>'; k = 'empty'; }
  if (els.banner.dataset.html !== bn) { els.banner.innerHTML = bn; els.banner.dataset.html = bn; els.banner.dataset.k = k; }
  els.banner.hidden = !bn;
}
function renderPeers() {
  const seen = new Set(), out = [];
  for (const p of S.peers) {
    const id = p.by || (p.presence && p.presence.me) || p.peer;
    if (seen.has(id)) continue; seen.add(id);
    const nm = personName(id) || '함께 보는 사람';
    const d = p.presence && p.presence.d && S.designs[p.presence.d];
    out.push(`<span class="peer" title="${esc(nm)} · 지금 보는 중${d ? ' · ' + esc(d.name) : ''}">${avatarHtml(id)}<span class="pn">${esc(nm)}</span></span>`);
  }
  els.peers.innerHTML = out.slice(0, 3).join('');
}
function renderTabBadges() {
  const n = CUR.an.nDanger + CUR.an.nWarn;
  els.ptabs.querySelectorAll('.ptab').forEach(b => {
    const t = b.dataset.tab;
    b.classList.toggle('on', t === S.tab);
    b.setAttribute('aria-selected', t === S.tab);
    if (t === 'warn') b.innerHTML = '경고' + (n ? `<span class="n ${CUR.an.nDanger ? '' : 'w'}">${n}</span>` : '');
  });
}

/* ---------- 패널 ---------- */
let panelDirty = false;
function renderPanelSafe() {
  const a = document.activeElement;
  if (a && els.pbody.contains(a) && (a.tagName === 'INPUT' && a.type === 'text')) { panelDirty = true; return; }
  renderPanel();
}
function renderPanel() {
  panelDirty = false;
  const t = S.tab;
  els.pbody.innerHTML = t === 'combo' ? htmlCombo() : t === 'parts' ? htmlParts() : t === 'warn' ? htmlWarn() : t === 'designs' ? htmlDesigns() : htmlHist();
  renderTabBadges();
}
function setTab(t, scroll) {
  S.tab = t; renderPanel();
  if (scroll === false) return;
  if (isPhone()) {
    const top = els.panel.getBoundingClientRect().top + window.scrollY - els.views.getBoundingClientRect().height;
    if (window.scrollY > top || scroll === true) window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else els.panel.scrollTop = 0;
}

/* --- 조합 탭 --- */
function cardHtml(k, c, on) {
  const ic = k === 'brain' ? { side: 'side', back: 'bback', top: 'top' }[c.v] : c.v;
  return `<button type="button" class="card${on ? ' on' : ''}" data-act="opt" data-k="${k}" data-v="${c.v}" aria-pressed="${on}">
    ${iconSvg(OPT_ICON[ic] || ic)}<span class="nm">${esc(c.name)}</span>
    <span class="ds ex-only">${esc(c.desc)}</span>
    <span class="pc ex-only"><span class="col">${c.pros.map(x => `<span class="li p">${esc(x)}</span>`).join('')}</span><span class="col">${c.cons.map(x => `<span class="li m">${esc(x)}</span>`).join('')}</span></span>
  </button>`;
}
function secCards(k, cur, allowNone, title) {
  const g = OPTS[k];
  return `<section class="sec" id="sec-${k}">
    <div class="sec-h"><span class="num">${g.step}</span><h3>${esc(title || g.title)}</h3><span class="aside">${esc(optName(k, cur))}</span></div>
    <div class="cards" style="--n:${g.choices.length}">${g.choices.map(c => cardHtml(k, c, cur === c.v)).join('')}</div>
    ${allowNone ? `<button type="button" class="undec${cur == null ? ' on' : ''}" data-act="opt" data-k="${k}" data-v="" aria-pressed="${cur == null}">아직 안 정함 · 임시 상자로 두기</button>` : ''}
  </section>`;
}
function secOrient(d, T) {
  const o = d.orient || {}, decided = !!(o.top && o.front);
  const open = S.ui.orientOpen == null ? !decided : S.ui.orientOpen;
  const st = decided ? '<span class="lv lv-ok">정함</span>' : '<span class="lv lv-warn">아직 안 정함</span>';
  let h = `<section class="sec" id="sec-orient"><div class="sec-h"><span class="num">01</span><h3>앞·위 정하기</h3><span class="aside">${st}</span></div>`;
  if (!open) {
    return h + `<div class="stat"><span>위: <b>${o.top}면</b> · 앞: <b>끝 ${o.front === 'end1' ? 1 : 2}</b></span><button class="btn sm" type="button" data-act="orientEdit">바꾸기</button></div></section>`;
  }
  h += `<p class="hint ex-only">드라이빙보드는 양쪽 면이 다르게 생겼어요. 어느 면을 <b>위</b>로 둘지, 어느 끝을 <b>앞</b>(인테이커 쪽)으로 할지 정하면 부품 이름도 "앞 왼쪽 모터"처럼 바뀌어요.</p>
  <div class="oq">어느 면을 위로 둘까요?</div>
  <div class="orient">
    ${['A', 'B'].map(f => `<button type="button" class="oc${o.top === f ? ' on' : ''}" data-act="orient" data-k="top" data-v="${f}" aria-pressed="${o.top === f}">
      <span class="ph"><img src="${faceImg(f)}" alt="${f}면 ${FACE_PHOTOS ? '사진' : '그림'}"><span class="end t">끝 1</span><span class="end b">끝 2</span></span>
      <span class="nm">${f}면</span><span class="ds">${f === 'A' ? '가운데 세로 빔과 흰 연결 블록이 보이는 면' : '넓은 판 2개가 가로로 지나가는 면'}</span></button>`).join('')}
  </div>
  <div class="oq">어느 끝을 앞으로 할까요?</div>
  <div class="cards" style="--n:2">
    ${[['end1', '끝 1', 'A면: 흰 연결 블록이 한 줄로 있는 쪽 · B면: 작은 판 2개가 있는 쪽'], ['end2', '끝 2', '모터 바깥쪽이 비어 있고, 가운데 세로 빔이 일찍 끝나는 쪽']].map(([v, n, ds]) =>
      `<button type="button" class="card${o.front === v ? ' on' : ''}" data-act="orient" data-k="front" data-v="${v}" aria-pressed="${o.front === v}">${iconSvg('front')}<span class="nm">${n}</span><span class="ds">${ds}</span></button>`).join('')}
  </div>
  ${decided ? '<button class="btn sm" type="button" data-act="orientDone" style="margin-top:10px">접기</button>' : '<p class="hint" style="margin-top:10px">정하기 전에는 A면을 위, 끝 1을 앞으로 임시로 그려요.</p>'}
  </section>`;
  return h;
}
function secFine(d) {
  const o = d.opts, L = o.launch, cat = L === 'catapult', off = !L || L === 'lift';
  const why = !L ? '발사 방식을 고르면 조절할 수 있어요.' : L === 'lift' ? '들어 올려 넣기는 고무줄과 레일을 쓰지 않아요.' : '';
  const railL = cat ? SLIDERS.railCat.label : SLIDERS.rail.label, railD = cat ? SLIDERS.railCat.desc : SLIDERS.rail.desc;
  let h = `<section class="sec" id="sec-fine"><div class="sec-h"><span class="num">06</span><h3>세부 조절</h3></div>${why ? `<p class="hint">${why}</p>` : ''}
  <div class="slider${off ? ' off' : ''}"><label for="sl-bands">${SLIDERS.bands.label}</label><output id="out-bands" class="mono">${o.bands}개</output>
    <input type="range" id="sl-bands" data-sl="bands" min="1" max="8" step="1" value="${o.bands}" ${off ? 'disabled' : ''}>
    <span class="ds ex-only">${SLIDERS.bands.desc}</span></div>
  <div class="slider${off ? ' off' : ''}"><label for="sl-rail">${railL}</label><output id="out-rail" class="mono">${o.rail}°</output>
    <input type="range" id="sl-rail" data-sl="rail" min="15" max="85" step="1" value="${o.rail}" ${off ? 'disabled' : ''}>
    <span class="ds ex-only">${railD}</span></div>`;
  if (SLING(L)) {
    h += `<div class="oq" style="margin-top:16px">당기는 장치</div><div class="cards" style="--n:3">${OPTS.pull.choices.map(c => cardHtml('pull', c, (o.pull || 'winch') === c.v)).join('')}</div>`;
  }
  return h + '</section>';
}
function htmlCombo() {
  const d = viewDesign(), T = CUR.robot.T, o = d.opts;
  let h = '';
  if (!curDesign() && S.mode === 'shared' && S.firstSnap) h += `<section class="sec"><div class="empty">구상안이 아직 없어요. 사진으로 만든 드라이빙보드에서 시작해요.<br><br><button class="btn pri" type="button" data-act="newDesign">첫 구상안 만들기</button></div></section>`;
  if (S.mode === 'loading') h += `<section class="sec"><p class="hint">저장된 구상안을 불러오는 중이에요. 그동안 사진으로 만든 드라이빙보드를 보여 줘요.</p></section>`;
  h += secOrient(d, T);
  h += secCards('launch', o.launch, true);
  h += secCards('dir', o.dir, false, o.launch === 'lift' ? '넣는 방향' : null);
  h += secCards('intake', o.intake, true);
  h += secCards('brain', o.brain, true);
  h += secFine(d);
  return h;
}

/* 면 그림: 사진이 없는 빌드(공개 앱)에서는 모델로 그린 위쪽 도면을 쓴다 */
const FACE_CACHE = {};
function faceImg(f) {
  if (FACE_PHOTOS && FACE_PHOTOS[f]) return FACE_PHOTOS[f];
  const fr = viewDesign().frame, key = f + fr.w + 'x' + fr.l;
  if (FACE_CACHE[key]) return FACE_CACHE[key];
  const d = defaultDesign(); d.frame = { w: fr.w, l: fr.l }; d.orient = { top: f, front: 'end1' };
  const R = buildRobot(d), ps = R.parts.filter(p => p.group === 'drive');
  const b = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
  for (const p of ps) for (let i = 0; i < 2; i++) { b.min[i] = Math.min(b.min[i], p.bb.min[i]); b.max[i] = Math.max(b.max[i], p.bb.max[i]); }
  const m = 1.2, w0 = b.max[0] - b.min[0] + 2 * m, h0 = b.max[1] - b.min[1] + 2 * m, asp = 240 / 280;
  const W = Math.max(w0, h0 * asp), H = W / asp, x0 = (b.min[0] + b.max[0]) / 2 - W / 2, y0 = -((b.min[1] + b.max[1]) / 2) - H / 2;
  const col = { wheel: ['#2a2e33', '#5d646c'], motor: ['#d3d7dc', '#7f8892'], conn: ['#fbfcfd', '#8d96a0'], shaft: ['#8a9199', '#5d646c'] };
  const rects = ps.sort((a, q) => a.bb.max[2] - q.bb.max[2]).map(p => {
    const v = (KIND[p.kind] || {}).vis, c = col[v] || ['#bfc5cc', '#7f8892'];
    const rr = v === 'wheel' ? 0.6 : v === 'motor' ? 0.35 : 0.1;
    return `<rect x="${f2(p.bb.min[0])}" y="${f2(-p.bb.max[1])}" width="${f2(p.bb.max[0] - p.bb.min[0])}" height="${f2(p.bb.max[1] - p.bb.min[1])}" rx="${rr}" fill="${c[0]}" stroke="${c[1]}" stroke-width="0.08"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f2(x0)} ${f2(y0)} ${f2(W)} ${f2(H)}"><rect x="${f2(x0)}" y="${f2(y0)}" width="${f2(W)}" height="${f2(H)}" fill="#e9edf1"/>${rects}</svg>`;
  return (FACE_CACHE[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}

/* --- 부품 탭 --- */
const DRIVE_ORDER = ['omni', 'motor', 'wallOuter', 'wallInner', 'wallEnd', 'cornerConn', 'centerBeam', 'crossPlate', 'connBlock', 'widePlate', 'smallPlate', 'shaft', 'collar'];
function selBoxHtml(u) {
  const R = CUR.robot, T = R.T, d = viewDesign();
  const p = R.byKey.get(S.sel.key);
  const hid = !p && u.type === 'drive' ? R.hidden.find(x => x.key === u.key) : null;
  const kind = p ? p.kind : hid ? hid.kind : '';
  const info = KIND[kind] || { name: kind, role: '', text: '' };
  const g = u.type === 'mod' ? u.mod : u.type === 'custom' ? 'custom' : 'drive';
  const nm = p ? partName(p, T) : unitName(u, R);
  const ro = S.readonly;
  let h = `<div class="selbox"><h4>${esc(nm)} <span class="chip g-${g}${p && p.ph ? ' ghost' : ''}">${GROUP_LABEL[g]}${p && p.ph ? ' · 임시 상자' : ''}</span></h4>
    <p class="role">${esc(info.role)}</p><p class="txt ex-only">${esc(info.text)}</p>`;
  if (hid) {
    return h + `<p class="hint">이 부품은 빼 둔 상태예요.</p><div class="btnrow"><button class="btn" type="button" data-act="unhide" ${ro ? 'disabled' : ''}>다시 넣기</button></div></div>`;
  }
  if (p.bag) return h + '</div>';
  let off = null;
  if (u.type === 'mod') { const m = d.mods[u.mod] || {}; off = [m.dx || 0, m.dy || 0, m.dz || 0]; }
  else if (u.type === 'drive') { const e = d.edits[u.key] || {}; off = T.inv(e.dx || 0, e.dy || 0, e.dz || 0); }
  const dims = p.shape === 'cyl' && p.axis === 'x' ? `두께 ${fmtN(p.len)} · 지름 ${fmtN(p.r * 2)}칸` : p.shape === 'line' ? '' : `${fmtN(p.s[0])} × ${fmtN(p.s[1])} × ${fmtN(p.s[2])}칸`;
  const dimsMm = p.shape === 'cyl' && p.axis === 'x' ? `${mm(p.len)} · ${mm(p.r * 2)}mm` : p.shape === 'line' ? '' : `${mm(p.s[0])} × ${mm(p.s[1])} × ${mm(p.s[2])}mm`;
  let mass = p.mass;
  if (u.type === 'mod') mass = R.parts.filter(q => q.mod === u.mod).reduce((s, q) => s + (q.ghost || q.bag ? 0 : q.mass || 0), 0);
  h += `<dl class="kv">${off ? `<dt>원래 자리에서</dt><dd>${vecWords(off)}</dd>` : `<dt>위치</dt><dd>x ${fmtN(p.c[0])} · y ${fmtN(p.c[1])} · z ${fmtN(p.c[2])}</dd>`}
    ${dims ? `<dt>크기</dt><dd>${dims}<br><span style="color:var(--faint)">${dimsMm}</span></dd>` : ''}
    <dt>무게(추정)</dt><dd>${Math.round(mass)} g${u.type === 'mod' ? ` · ${MODS[u.mod].label} 전체` : ''}</dd></dl>`;
  if (u.type === 'mod') h += `<p class="hint">옮기면 <b>${MODS[u.mod].label} 전체</b>가 같이 움직여요.</p>`;
  if (ro) return h + '</div>';
  const st = S.prefs.step, sl = st === 1 ? '1칸' : '½칸';
  h += `<div class="mover">
    <div class="pad" role="group" aria-label="칸 단위로 옮기기">
      <span></span><button type="button" data-act="move" data-x="0" data-y="1" data-z="0" aria-label="앞으로">앞<br>↑</button><span></span>
      <button type="button" data-act="move" data-x="-1" data-y="0" data-z="0" aria-label="왼쪽으로">← 왼</button>
      <button type="button" class="c" data-act="stepToggle" aria-label="이동 단위 바꾸기">${sl}</button>
      <button type="button" data-act="move" data-x="1" data-y="0" data-z="0" aria-label="오른쪽으로">오른 →</button>
      <span></span><button type="button" data-act="move" data-x="0" data-y="-1" data-z="0" aria-label="뒤로">↓<br>뒤</button><span></span>
    </div>
    <div class="zcol">
      <div class="zbtn"><button type="button" data-act="move" data-x="0" data-y="0" data-z="1">↥ 위로</button><button type="button" data-act="move" data-x="0" data-y="0" data-z="-1">↧ 아래로</button></div>
      <div class="step">단위 <button type="button" class="${st === 1 ? 'on' : ''}" data-act="step" data-v="1">1칸</button><button type="button" class="${st === 0.5 ? 'on' : ''}" data-act="step" data-v="0.5">½칸</button></div>
      ${off && (off[0] || off[1] || off[2]) ? '<button class="btn sm" type="button" data-act="resetPos">원래 자리로</button>' : ''}
    </div></div>
    <p class="hint ex-only" style="margin:0">맥북: 방향키로 앞뒤·좌우, Shift+↑↓로 위아래. 2D 도면에서 끌어서 옮겨도 돼요.</p>`;
  if (u.type === 'drive' || u.type === 'custom') {
    const axes = p.shape === 'cyl' ? [['두께', 0, p.len], ['지름', 1, p.r * 2]] : [['가로', 0, p.s[0]], ['세로', 1, p.s[1]], ['높이', 2, p.s[2]]];
    h += `<div><div class="oq" style="margin:4px 0 6px">크기</div><div class="sz">${axes.map(([l, ax, v]) =>
      `<span>${l}</span><button type="button" data-act="size" data-ax="${ax}" data-sg="-1" aria-label="${l} 줄이기">−</button><output>${fmtN(v)}칸</output><button type="button" data-act="size" data-ax="${ax}" data-sg="1" aria-label="${l} 늘리기">+</button>`).join('')}</div></div>`;
    h += `<div class="btnrow">${u.type === 'drive' ? '<button class="btn dng" type="button" data-act="hide">이 부품 빼기</button>' :
      '<button class="btn" type="button" data-act="dupCustom">복제</button><button class="btn dng" type="button" data-act="delCustom">삭제</button>'}</div>`;
  }
  return h + '</div>';
}
function htmlParts() {
  const R = CUR.robot, T = R.T, d = viewDesign(), u = selUnit(), ro = S.readonly;
  let h = `<section class="sec">${u ? selBoxHtml(u) : '<div class="empty">3D나 도면에서 부품을 누르거나, 아래 목록에서 고르세요.<span class="ex-only"><br>고른 부품은 칸 단위로 옮길 수 있어요.</span></div>'}</section>`;
  // 목록
  const item = (p, hidden) => {
    const on = S.sel && S.sel.key === p.key;
    const col = p.mod ? `var(--c-${{ launcher: 'launch', intake: 'intake', brain: 'brain' }[p.mod]})` : p.group === 'custom' ? 'var(--c-custom)' :
      ({ wheel: 'var(--p-wheel)', motor: 'var(--p-motor)', conn: 'var(--p-conn)', shaft: 'var(--p-shaft)' }[(KIND[p.kind] || {}).vis] || 'var(--p-beam)');
    return `<button type="button" class="pitem${on ? ' on' : ''}${hidden ? ' hid' : ''}" data-act="sel" data-key="${p.key}"><span class="dot" style="background:${col}"></span>${esc(partName(p, T))}${p.edited ? '<span class="m">수정됨</span>' : hidden ? '<span class="m">빠짐</span>' : ''}</button>`;
  };
  const drive = R.parts.filter(p => p.group === 'drive').sort((a, b) => DRIVE_ORDER.indexOf(a.kind) - DRIVE_ORDER.indexOf(b.kind));
  const hid = R.hidden.map(x => Object.assign({ c: [0, 0, 0], group: 'drive' }, x));
  const grp = (title, list, open, extra) => list.length || extra ? `<details class="pgrp"${open ? ' open' : ''}><summary>${title}<span class="cnt">${list.length}</span></summary>${list.join('')}${extra || ''}</details>` : '';
  const selIn = g => S.sel && R.byKey.get(S.sel.key) && R.byKey.get(S.sel.key).group === g;
  h += `<section class="sec"><div class="sec-h"><h3>부품 목록</h3><span class="aside">${R.parts.filter(p => !p.ghost && !p.bag && p.shape !== 'line').length}개</span></div><div class="plist">`;
  h += grp('드라이빙보드', drive.map(p => item(p)).concat(hid.map(p => item(p, true))), selIn('drive') || (S.sel && hid.some(x => x.key === S.sel.key)));
  for (const m of Object.keys(MODS)) {
    const list = R.parts.filter(p => p.mod === m && p.shape !== 'line' && !p.ghost);
    const bands = R.parts.filter(p => p.mod === m && p.kind === 'band').length;
    h += grp(MODS[m].label + (list[0] && list[0].ph ? ' · 미정' : ''), list.map(p => item(p)), selIn(m), bands ? `<div class="pitem" style="color:var(--muted)">고무줄 ${bands}개</div>` : '');
  }
  h += grp('추가한 부품', R.parts.filter(p => p.group === 'custom').map(p => item(p)), selIn('custom'));
  h += '</div></section>';
  // 프레임 크기
  h += `<section class="sec"><div class="sec-h"><h3>프레임 칸 수</h3><span class="aside mono">${d.frame.w} × ${d.frame.l}칸 · ${mm(d.frame.w)} × ${mm(d.frame.l)}mm</span></div>
    <p class="hint">사진으로 추정한 값이에요. <b>지안이가 정확한 칸 수를 확인</b>해서 맞춰 주세요. 바꾸면 바퀴·모터·빔 자리가 같이 맞춰져요.</p>
    <div class="frame sz" style="grid-template-columns:auto 34px 54px 34px auto 34px 54px 34px">
      <span>가로</span><button type="button" data-act="frame" data-ax="w" data-sg="-1" ${ro ? 'disabled' : ''} aria-label="가로 줄이기">−</button><output>${d.frame.w}칸</output><button type="button" data-act="frame" data-ax="w" data-sg="1" ${ro ? 'disabled' : ''} aria-label="가로 늘리기">+</button>
      <span>세로</span><button type="button" data-act="frame" data-ax="l" data-sg="-1" ${ro ? 'disabled' : ''} aria-label="세로 줄이기">−</button><output>${d.frame.l}칸</output><button type="button" data-act="frame" data-ax="l" data-sg="1" ${ro ? 'disabled' : ''} aria-label="세로 늘리기">+</button>
    </div></section>`;
  if (!ro) {
    h += `<section class="sec"><div class="sec-h"><h3>부품 추가</h3></div><p class="hint ex-only">사진에 없는 부품이나 새로 달 부품 자리를 잡아요. 로봇 위쪽에 생기면 칸 단위로 옮겨 주세요.</p>
      <div class="addgrid">${ADDABLE.map(a => `<button class="btn" type="button" data-act="add" data-kind="${a.kind}">+ ${a.label}</button>`).join('')}</div></section>`;
    const nEd = Object.values(d.edits || {}).filter(Boolean).length;
    if (nEd) h += `<section class="sec"><div class="sec-h"><h3>드라이빙보드 되돌리기</h3><span class="aside">${nEd}개 고침</span></div><button class="btn" type="button" data-act="resetDrive">사진대로 되돌리기</button></section>`;
  }
  return h;
}

/* --- 경고 탭 --- */
function metric(k, val, lim, unit, bad) {
  const pct = Math.min(100, val / lim * 100);
  return `<div class="met${bad ? ' bad' : ''}"><div class="k">${k}</div><div class="v">${val.toFixed(1)}<small> / ${lim}${unit}</small></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}
function warnCard(w) {
  const btns = [];
  if (w.keys && w.keys.length) btns.push(`<button class="btn sm" type="button" data-act="warnSel" data-key="${esc(w.keys[0])}">해당 부품 보기</button>`);
  if (w.tool === 'startBox' && !S.prefs.startBox) btns.push('<button class="btn sm" type="button" data-act="tool" data-tool="startBox">시작 크기 상자 보기</button>');
  if (w.go === 'orient') btns.push('<button class="btn sm" type="button" data-act="goOrient">정하러 가기</button>');
  const lv = { danger: ['lv-danger', '경고'], warn: ['lv-warn', '주의'], info: ['lv-info', '참고'] }[w.level];
  return `<div class="w ${w.level}"><h5><span class="lv ${lv[0]}">${lv[1]}</span>${esc(w.title)}</h5><p class="ex-only">${esc(w.detail)}</p>${btns.length ? `<div class="btnrow">${btns.join('')}</div>` : ''}</div>`;
}
function htmlWarn() {
  const A = CUR.an, r = A.ratio;
  const short = A.short * IN_PER, long = A.long * IN_PER, hh = A.dims.h * IN_PER;
  let h = `<section class="sec"><div class="sec-h"><h3>시작 크기</h3><span class="aside">폭 11 × 길이 20 × 높이 15in</span></div>
    <div class="metrics">${metric('폭(좁은 쪽)', short, 11, 'in', short > 11)}${metric('길이(긴 쪽)', long, 20, 'in', long > 20)}${metric('높이', hh, 15, 'in', hh > 15)}</div>
    <div class="metrics" style="margin-top:8px">
      <div class="met"><div class="k">무게(추정)</div><div class="v">${(A.M / 1000).toFixed(2)}<small> kg</small></div></div>
      <div class="met${r && Math.abs(r.x) >= 0.4 ? ' bad' : ''}"><div class="k">좌우 쏠림</div><div class="v">${r ? Math.round(Math.abs(r.x) * 100) + '%' : '-'}<small> ${r && Math.abs(r.x) >= 0.05 ? (r.x > 0 ? '오른쪽' : '왼쪽') : ''}</small></div></div>
      <div class="met${r && Math.abs(r.y) >= 0.45 ? ' bad' : ''}"><div class="k">앞뒤 쏠림</div><div class="v">${r ? Math.round(Math.abs(r.y) * 100) + '%' : '-'}<small> ${r && Math.abs(r.y) >= 0.05 ? (r.y > 0 ? '앞' : '뒤') : ''}</small></div></div>
    </div><p class="hint ex-only" style="margin-top:8px">무게는 부품 종류로 어림한 값이에요. 쏠림은 무게중심이 바퀴 사이 가운데에서 얼마나 벗어났는지(바퀴까지 거리 대비)예요.</p></section>`;
  const main = A.warnings.filter(w => w.level !== 'info'), info = A.warnings.filter(w => w.level === 'info');
  h += `<section class="sec"><div class="sec-h"><h3>자동 경고</h3><span class="aside">${main.length ? main.length + '개' : ''}</span></div>`;
  h += main.length ? `<div class="wlist">${main.map(warnCard).join('')}</div>` : '<div class="empty">겹침·무게중심·시작 크기·옵션 조합에서 문제를 찾지 못했어요.</div>';
  h += '</section>';
  if (info.length) h += `<section class="sec"><div class="sec-h"><h3>참고</h3></div><div class="wlist">${info.map(warnCard).join('')}</div></section>`;
  h += `<section class="sec"><div class="sec-h"><h3>Level Up 규칙 요약</h3></div><ul class="rules">${RULES.map(([k, v]) => `<li><b>${k}</b> · ${v}</li>`).join('')}</ul>
    <p class="src">현재 매뉴얼은 v2.1이에요(기획서의 v1.1은 지난 버전). 골 높이·빈백 크기는 실측 전 추정값이라 경고에 쓰지 않았어요. <a href="https://manuals.vex.com/" target="_blank" rel="noopener">VEX 매뉴얼</a></p></section>`;
  return h;
}

/* --- 구상안 탭 --- */
function designSummary(d) {
  const o = normDesign(d).opts;
  return [optName('launch', o.launch), optName('intake', o.intake), '브레인 ' + optName('brain', o.brain)].join(' · ');
}
function htmlDesigns() {
  const live = liveDesigns(), dead = Object.entries(S.designs).filter(([, d]) => d && d.deleted);
  const ro = S.readonly, cmp = S.ui.cmp.filter(id => S.designs[id] && !S.designs[id].deleted);
  S.ui.cmp = cmp;
  const canShare = typeof shareDesign === 'function';
  let h = `<section class="sec"><div class="sec-h"><h3>구상안</h3><span class="aside">${live.length}개</span></div>
    <p class="hint ex-only">여러 구도를 따로 저장해 두고, 2~3개를 골라 나란히 비교해요. 체크한 구상안이 비교에 들어가요.${canShare ? ' <b>보내기</b>를 누르면 링크가 만들어져요. 카톡으로 보내면 받은 사람이 눌러서 자기 앱에 추가해요. 나에게 보내 두면 백업도 돼요.' : ''}</p><div class="dlist">`;
  for (const d of live) {
    const R = buildRobot(d), A = analyze(R), n = A.nDanger + A.nWarn;
    const cur = d.id === S.curId;
    h += `<div class="drow${cur ? ' cur' : ''}">
      <input type="checkbox" data-act="cmpPick" data-id="${d.id}" ${cmp.includes(d.id) ? 'checked' : ''} aria-label="${esc(d.name)} 비교에 넣기">
      <span class="nm">${esc(d.name)}${cur ? ' <span class="chip">보는 중</span>' : ''}</span>
      <span class="lv ${A.nDanger ? 'lv-danger' : n ? 'lv-warn' : 'lv-ok'}">${n ? '경고 ' + n : '문제 없음'}</span>
      <span class="meta">${esc(designSummary(d))}<br>${esc(whoName(d.updatedBy || d.createdBy))} · ${ago(d.updatedAt || d.createdAt)}</span>`;
    if (S.ui.renaming === d.id) {
      h += `<span class="rename"><input type="text" id="rn-${d.id}" value="${esc(d.name)}" maxlength="40" aria-label="새 이름"><button class="btn sm pri" type="button" data-act="renameSave" data-id="${d.id}">저장</button><button class="btn sm" type="button" data-act="renameCancel">취소</button></span>`;
    } else if (S.ui.confirmDel === d.id) {
      h += `<span class="confirm">"${esc(d.name)}"을 지울까요? 기록에서 되돌릴 수 있어요. <button class="btn sm dng" type="button" data-act="delYes" data-id="${d.id}">지우기</button><button class="btn sm" type="button" data-act="delNo">취소</button></span>`;
    } else {
      h += `<span class="acts">${cur ? '' : `<button class="btn sm" type="button" data-act="openDesign" data-id="${d.id}">열기</button>`}
        ${canShare ? `<button class="btn sm" type="button" data-act="shareDesign" data-id="${d.id}">보내기</button>` : ''}
        ${ro ? '' :`<button class="btn sm" type="button" data-act="renameStart" data-id="${d.id}">이름 바꾸기</button><button class="btn sm" type="button" data-act="dupDesign" data-id="${d.id}">복제</button>${live.length > 1 ? `<button class="btn sm dng" type="button" data-act="delAsk" data-id="${d.id}">삭제</button>` : ''}`}</span>`;
    }
    h += '</div>';
  }
  if (!live.length) h += '<div class="empty">저장된 구상안이 없어요.</div>';
  h += `</div><div class="btnrow" style="margin-top:12px">
    ${ro ? '' : '<button class="btn pri" type="button" data-act="newDesign">+ 새 구상안</button>'}
    ${ro || !curDesign() ? '' : '<button class="btn" type="button" data-act="dupDesign">지금 구상안 복제</button>'}
    <button class="btn" type="button" data-act="compare" ${cmp.length < 2 ? 'disabled' : ''}>나란히 비교 (${cmp.length})</button></div>
    ${cmp.length < 2 ? '<p class="hint" style="margin-top:8px">비교하려면 2~3개를 체크하세요.</p>' : ''}</section>`;
  if (canShare && S.ui.shareUrl) h += `<section class="sec"><div class="sec-h"><h3>보낼 링크</h3></div>
    <p class="hint">자동으로 복사하지 못했어요. 아래 칸을 길게 눌러 복사해서 보내세요.</p>
    <input class="linkbox" type="text" readonly value="${esc(S.ui.shareUrl)}" onfocus="this.select()"></section>`;
  if (canShare && !ro) h += `<section class="sec"><div class="sec-h"><h3>받은 구상안 넣기</h3></div>
    <p class="hint ex-only">받은 링크를 눌러서 열면 바로 추가할 수 있어요. 카톡 안에서 열리거나 잘 안 되면 링크를 복사해서 여기에 붙여 넣으세요.</p>
    <div class="paste"><input type="url" id="pasteIn" placeholder="받은 링크 붙여 넣기" autocomplete="off" aria-label="받은 구상안 링크"><button class="btn sm pri" type="button" data-act="pasteImport">추가</button></div></section>`;
  if (dead.length && !ro) h += `<section class="sec"><div class="sec-h"><h3>지운 구상안</h3></div><div class="dlist">${dead.map(([id, d]) =>
    `<div class="drow"><span></span><span class="nm">${esc(d.name)}</span><button class="btn sm" type="button" data-act="restoreDesign" data-id="${id}">되살리기</button></div>`).join('')}</div></section>`;
  return h;
}

/* --- 기록 탭 --- */
function htmlHist() {
  const all = S.ui.histAll, d = curDesign();
  const list = S.history.filter(e => all || e.designId === S.curId).slice(0, 120);
  const can = !S.readonly && d && undoTarget(S.curId);
  let h = `<section class="sec"><div class="sec-h"><h3>수정 기록</h3><span class="aside">${all ? '모든 구상안' : esc(d ? d.name : '')}</span></div>
    <p class="hint ex-only">${S.mode === 'local' ? '무엇을 언제 바꿨는지 보여요. 이 기기에서 바꾼 것만 남고, 최근 150개까지 보관해요.' : '누가, 무엇을, 언제 바꿨는지 보여요. 지안이가 바꾼 것도 바로 여기에 떠요. 최근 300개까지 남아요.'}</p>
    <div class="btnrow" style="margin-bottom:10px"><button class="btn" type="button" data-act="undo" ${can ? '' : 'disabled'}>↶ 마지막 변경 되돌리기</button>
    <span class="seg"><button type="button" class="${all ? '' : 'on'}" data-act="histAll" data-v="0">이 구상안</button><button type="button" class="${all ? 'on' : ''}" data-act="histAll" data-v="1">전체</button></span></div>`;
  if (!list.length) h += `<div class="empty">${S.mode === 'loading' ? '기록을 불러오는 중이에요.' : '아직 바뀐 게 없어요. 옵션을 고르거나 부품을 옮기면 여기에 남아요.'}</div>`;
  else {
    h += '<div class="hlist">';
    for (const e of list) {
      const dn = all && S.designs[e.designId] ? ' · ' + esc(S.designs[e.designId].name) : '';
      const canR = !S.readonly && e.before && !e.undone;
      h += `<div class="hrow${e.undone ? ' undone' : ''}">${avatarHtml(e.by)}<span class="t"><b>${esc(whoName(e.by))}</b> · ${esc(e.label)}</span>
        <span class="m">${ago(e.ts)}${dn}${e.undone ? ' · 되돌려짐' : ''}</span>${canR ? `<button class="btn sm" type="button" data-act="restore" data-id="${e.id}" title="이 변경을 하기 전 상태로 돌아가요">이 변경 전으로</button>` : ''}</div>`;
    }
    h += '</div>';
  }
  h += '</section>';
  if (BACKEND.accountHtml) h += BACKEND.accountHtml();
  if (S.mode === 'shared' && S.meId && S.meId !== 'anon' && !S.readonly) {
    h += `<section class="sec"><div class="nick"><span>기록에 보일 내 이름</span><input type="text" id="nickIn" maxlength="16" value="${esc((S.people[S.meId] && S.people[S.meId].nick) || '')}" placeholder="${esc(myLabel() || '예: 지안')}"><button class="btn sm" type="button" data-act="nickSave">저장</button></div></section>`;
  }
  return h;
}

/* ---------- 동작 ---------- */
function setOpt(k, v) {
  if (!canEditNow()) return;
  const d = curDesign(), old = d.opts[k] == null ? null : d.opts[k];
  if (old === v) return;
  const patch = { opts: { [k]: v } }; let note = '';
  if (k === 'launch') {
    if (v === 'sling_down' && d.opts.rail < 55) { patch.opts.rail = 70; note = ' (레일 70°)'; }
    if (v === 'sling_back' && d.opts.rail > 65) { patch.opts.rail = 40; note = ' (레일 40°)'; }
  }
  const title = k === 'dir' && d.opts.launch === 'lift' ? '넣는 방향' : OPTS[k].title;
  commit(patch, { label: `${title}: ${optName(k, old)} → ${optName(k, v)}${note}`, kind: 'opt' });
  if (note) toast(`레일 각도를 ${patch.opts.rail}°로 맞췄어요`);
}
function setOrient(k, v) {
  if (!canEditNow()) return;
  const d = curDesign(), o = d.orient || {};
  if (o[k] === v) return;
  const nm = k === 'top' ? `위 면: ${v}면` : `앞: 끝 ${v === 'end1' ? 1 : 2}`;
  commit({ orient: { [k]: v } }, { label: (o[k] ? '바꿈 · ' : '정함 · ') + nm, kind: 'orient' });
  const n = curDesign().orient;
  if (n.top && n.front && !(o.top && o.front)) { S.ui.orientOpen = false; renderPanel(); toast('앞·위를 정했어요. 부품 이름이 "앞 왼쪽"처럼 바뀌었어요'); }
}
function commitMove(u, vec) {
  if (!u || !canEditNow()) return;
  if (u.hidden) return toast('빼 둔 부품은 옮길 수 없어요');
  const d = curDesign(), T = orientT(normDesign(d)), R = CUR.robot;
  const name = unitName(u, R);
  let patch;
  if (u.type === 'mod') {
    const m = (d.mods && d.mods[u.mod]) || {};
    patch = { mods: { [u.mod]: { dx: r2((m.dx || 0) + vec[0]), dy: r2((m.dy || 0) + vec[1]), dz: r2((m.dz || 0) + vec[2]) } } };
  } else if (u.type === 'drive') {
    const e = (d.edits && d.edits[u.key]) || {}, pv = T.inv(vec[0], vec[1], vec[2]);
    patch = { edits: { [u.key]: Object.assign({}, e, { dx: r2((e.dx || 0) + pv[0]), dy: r2((e.dy || 0) + pv[1]), dz: r2((e.dz || 0) + pv[2]), hidden: false }) } };
  } else {
    const a = d.added[u.cid]; if (!a) return;
    patch = { added: { [u.cid]: Object.assign({}, a, { c: [r2(a.c[0] + vec[0]), r2(a.c[1] + vec[1]), r2(a.c[2] + vec[2])] }) } };
  }
  commit(patch, { ckey: 'mv:' + u.id, vec, labelFn: acc => `${name} 이동 · ${vecWords(acc)}` });
}
function moveSel(vec) { commitMove(selUnit(), vec); }
function resetPos() {
  const u = selUnit(); if (!u || !canEditNow()) return;
  const d = curDesign(), name = unitName(u, CUR.robot);
  if (u.type === 'mod') commit({ mods: { [u.mod]: { dx: 0, dy: 0, dz: 0 } } }, { label: `${name} 원래 자리로` });
  else if (u.type === 'drive') commit({ edits: { [u.key]: Object.assign({}, d.edits[u.key] || {}, { dx: 0, dy: 0, dz: 0 }) } }, { label: `${name} 원래 자리로` });
}
function resizeSel(ax, sg) {
  const u = selUnit(); if (!u || !canEditNow()) return;
  const d = curDesign(), R = CUR.robot, p = R.byKey.get(S.sel.key), st = S.prefs.step;
  if (!p) return;
  const axName = p.shape === 'cyl' ? ['두께', '지름'][ax] : ['가로', '세로', '높이'][ax];
  const cur = p.shape === 'cyl' ? (ax === 0 ? p.len : p.r * 2) : p.s[ax];
  const nv = r2(cur + sg * st);
  if (nv < 0.5) return toast('더 줄일 수 없어요');
  const name = unitName(u, R), lf = (f, t) => `${name} ${axName} ${fmtN(f)} → ${fmtN(t)}칸`;
  if (u.type === 'drive') {
    const e = d.edits[u.key] || {}, f = ['dw', 'dl', 'dh'][ax];
    commit({ edits: { [u.key]: Object.assign({}, e, { [f]: r2((e[f] || 0) + sg * st) }) } }, { ckey: 'sz:' + u.id + ax, from: cur, to: nv, labelFn: lf });
  } else if (u.type === 'custom') {
    const a = d.added[u.cid], s = a.s.slice();
    if (p.shape === 'cyl' && ax === 1) { s[1] = nv; s[2] = nv; } else s[ax] = nv;
    commit({ added: { [u.cid]: Object.assign({}, a, { s }) } }, { ckey: 'sz:' + u.id + ax, from: cur, to: nv, labelFn: lf });
  }
}
function addPart(kind) {
  if (!canEditNow()) return;
  const def = ADDABLE.find(a => a.kind === kind); if (!def) return;
  const d = curDesign(), n = Object.values(d.added || {}).filter(a => a && a.kind === kind).length + 1;
  const id = newId('p'), name = `${def.label} ${n}`;
  const z = r2(CUR.an.bb.max[2] + def.s[2] / 2 + 1);
  commit({ added: { [id]: { kind, name, c: [0, 0, z], s: def.s.slice() } } }, { label: `${name} 추가` });
  selectKey('C:' + id, 'list');
}
function frameStep(ax, sg) {
  if (!canEditNow()) return;
  const d = curDesign(), f = d.frame, lim = ax === 'w' ? [14, 24] : [19, 32];
  const nv = clamp(f[ax] + sg, lim[0], lim[1]);
  if (nv === f[ax]) return toast(ax === 'w' ? '가로는 14~24칸까지 바꿀 수 있어요' : '세로는 19~32칸까지 바꿀 수 있어요');
  const nf = Object.assign({}, f, { [ax]: nv });
  commit({ frame: { [ax]: nv } }, { ckey: 'frame', from: `${f.w}×${f.l}`, to: `${nf.w}×${nf.l}`, labelFn: (a, b) => `프레임 칸 수 ${a} → ${b}칸` });
}
function onPanelClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act, d = curDesign();
  switch (a) {
    case 'opt': setOpt(b.dataset.k, b.dataset.v === '' ? null : b.dataset.v); break;
    case 'orient': setOrient(b.dataset.k, b.dataset.v); break;
    case 'orientEdit': S.ui.orientOpen = true; renderPanel(); break;
    case 'orientDone': S.ui.orientOpen = false; renderPanel(); break;
    case 'goOrient': S.ui.orientOpen = true; setTab('combo', true); break;
    case 'sel': selectKey(b.dataset.key, 'list'); break;
    case 'move': moveSel([+b.dataset.x, +b.dataset.y, +b.dataset.z].map(v => v * S.prefs.step)); break;
    case 'step': S.prefs.step = +b.dataset.v; savePrefs(); renderPanel(); break;
    case 'stepToggle': S.prefs.step = S.prefs.step === 1 ? 0.5 : 1; savePrefs(); renderPanel(); break;
    case 'resetPos': resetPos(); break;
    case 'size': resizeSel(+b.dataset.ax, +b.dataset.sg); break;
    case 'hide': { const u = selUnit(); if (!u || !canEditNow()) break; commit({ edits: { [u.key]: Object.assign({}, d.edits[u.key] || {}, { hidden: true }) } }, { label: `${unitName(u, CUR.robot)} 뺌` }); break; }
    case 'unhide': { const u = selUnit(); if (!u || !canEditNow()) break; commit({ edits: { [u.key]: Object.assign({}, d.edits[u.key] || {}, { hidden: false }) } }, { label: `${unitName(u, CUR.robot)} 다시 넣음` }); break; }
    case 'delCustom': { const u = selUnit(); if (!u || !canEditNow()) break; const nm = unitName(u, CUR.robot); commit({ added: { [u.cid]: null } }, { label: `${nm} 삭제` }); selectKey(null, 'list'); break; }
    case 'dupCustom': { const u = selUnit(); if (!u || !canEditNow()) break; const a = d.added[u.cid], id = newId('p'); const nm = a.name + ' 복사';
      commit({ added: { [id]: Object.assign(clone(a), { name: nm, c: [r2(a.c[0] + 1), a.c[1], a.c[2]] }) } }, { label: `${nm} 추가` }); selectKey('C:' + id, 'list'); break; }
    case 'add': addPart(b.dataset.kind); break;
    case 'frame': frameStep(b.dataset.ax, +b.dataset.sg); break;
    case 'resetDrive': { if (!canEditNow()) break; const ed = {}; Object.keys(d.edits || {}).forEach(k => { ed[k] = null; }); commit({ edits: ed }, { label: '드라이빙보드를 사진대로 되돌림' }); break; }
    case 'go': setTab(b.dataset.tab, true); break;
    case 'pickClose': S.pickOpen = false; renderPick(); break;
    case 'warnSel': selectKey(b.dataset.key, 'list'); S.pickOpen = true; renderPick(); if (isPhone()) window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'tool': if (b.dataset.tool === 'startBox') { S.prefs.startBox = true; savePrefs(); refresh(); } break;
    case 'newDesign': createDesign(null); break;
    case 'dupDesign': createDesign(b.dataset.id || S.curId); break;
    case 'openDesign': openDesign(b.dataset.id); toast(`"${S.designs[b.dataset.id].name}"을 열었어요`); break;
    case 'renameStart': S.ui.renaming = b.dataset.id; S.ui.confirmDel = null; renderPanel(); { const i = document.getElementById('rn-' + b.dataset.id); if (i) { i.focus(); i.select(); } } break;
    case 'renameSave': saveRename(b.dataset.id); break;
    case 'renameCancel': S.ui.renaming = null; renderPanel(); break;
    case 'delAsk': S.ui.confirmDel = b.dataset.id; S.ui.renaming = null; renderPanel(); break;
    case 'delNo': S.ui.confirmDel = null; renderPanel(); break;
    case 'delYes': { const id = b.dataset.id, nm = S.designs[id] && S.designs[id].name; S.ui.confirmDel = null; designPatch(id, { deleted: true }, `구상안 삭제 · ${nm}`); toast(`"${nm}"을 지웠어요. 기록에서 되돌릴 수 있어요`); break; }
    case 'restoreDesign': { const id = b.dataset.id, nm = S.designs[id] && S.designs[id].name; designPatch(id, { deleted: false }, `구상안 되살림 · ${nm}`); break; }
    case 'compare': openCompare(); break;
    case 'undo': undoLast(); break;
    case 'restore': { const en = S.history.find(x => x.id === b.dataset.id); if (en) restoreEntry(en, true); break; }
    case 'histAll': S.ui.histAll = b.dataset.v === '1'; renderPanel(); break;
    case 'nickSave': saveNick(); break;
    case 'logout': if (BACKEND.logout) BACKEND.logout(); break;
    case 'login': if (BACKEND.login) BACKEND.login(); break;
    case 'reload': location.reload(); break;
    case 'shareDesign': shareDesign(b.dataset.id); break;
    case 'pasteImport': pasteImport(); break;
    case 'acceptIncoming': acceptIncoming(); break;
    case 'dismissIncoming': dismissIncoming(); break;
    case 'openExternal': openExternal(); break;
  }
}
function saveRename(id) {
  const i = document.getElementById('rn-' + id); if (!i) return;
  const v = i.value.trim().slice(0, 40), old = S.designs[id] && S.designs[id].name;
  S.ui.renaming = null;
  if (v && v !== old) designPatch(id, { name: v }, `이름 바꿈 · ${old} → ${v}`); else renderPanel();
}
function saveNick() {
  const i = document.getElementById('nickIn'); if (!i || !S.db || !S.meId) return;
  const v = i.value.trim().slice(0, 16);
  S.people[S.meId] = Object.assign({}, S.people[S.meId], { nick: v });
  track(enqueue('people/' + S.meId, () => BACKEND.saveNick(S.meId, v)));
  i.blur(); renderPanel(); toast(v ? `기록에 "${v}"로 보여요` : '이름을 지웠어요');
}
function onPanelInput(e) {
  const t = e.target;
  if (t.matches('input[type=range][data-sl]')) {
    const k = t.dataset.sl, v = +t.value;
    S.preview = { opts: { [k]: v } };
    const out = document.getElementById('out-' + k);
    if (out) out.textContent = v + (k === 'bands' ? '개' : '°');
    refresh({ panel: false });
  }
}
function onPanelChange(e) {
  const t = e.target;
  if (t.matches('input[type=range][data-sl]')) {
    const k = t.dataset.sl, v = +t.value;
    S.preview = null;
    const d = curDesign();
    if (!d || !canEditNow()) { refresh(); return; }
    const old = d.opts[k];
    if (old === v) { refresh(); return; }
    const L = d.opts.launch;
    const nm = k === 'bands' ? '고무줄' : L === 'catapult' ? '발사 각도' : '레일 각도', u = k === 'bands' ? '개' : '°';
    commit({ opts: { [k]: v } }, { ckey: 'opt:' + k, from: old, to: v, labelFn: (a, b) => `${nm} ${a}${u} → ${b}${u}` });
  } else if (t.matches('input[type=checkbox][data-act="cmpPick"]')) {
    const id = t.dataset.id;
    S.ui.cmp = S.ui.cmp.filter(x => x !== id);
    if (t.checked) { S.ui.cmp.push(id); if (S.ui.cmp.length > 3) S.ui.cmp.shift(); }
    renderPanel();
  }
}
function onPanelKey(e) {
  if (e.key === 'Enter' && e.target.id && e.target.id.startsWith('rn-')) { e.preventDefault(); saveRename(e.target.id.slice(3)); }
  if (e.key === 'Escape' && e.target.id && e.target.id.startsWith('rn-')) { S.ui.renaming = null; renderPanel(); }
  if (e.key === 'Enter' && e.target.id === 'nickIn') { e.preventDefault(); saveNick(); }
  if (e.key === 'Enter' && e.target.id === 'pasteIn') { e.preventDefault(); pasteImport(); }
}

/* ---------- 나란히 비교 ---------- */
function miniTop(R) {
  const bb = allBB(R), m = 1.5;
  const vb = [bb.min[0] - m, -(bb.max[1] + m), bb.max[0] - bb.min[0] + 2 * m, bb.max[1] - bb.min[1] + 2 * m];
  const parts = R.parts.slice().sort((a, b) => a.bb.max[2] - b.bb.max[2]).filter(p => p.shape !== 'line' && !p.ghost)
    .map(p => `<rect class="pt ${visCls(p)}" x="${f2(p.bb.min[0])}" y="${f2(-p.bb.max[1])}" width="${f2(p.bb.max[0] - p.bb.min[0])}" height="${f2(p.bb.max[1] - p.bb.min[1])}"/>`).join('');
  return `<svg class="d2" viewBox="${vb.map(f2).join(' ')}" style="width:100%;height:100%;background:var(--paper)">${parts}</svg>`;
}
function openCompare() {
  const ids = S.ui.cmp.filter(id => S.designs[id] && !S.designs[id].deleted);
  if (ids.length < 2) return toast('비교할 구상안을 2개 이상 체크하세요');
  const cols = ids.map(id => { const d = S.designs[id], R = buildRobot(d), A = analyze(R); return { id, d: normDesign(d), R, A }; });
  const rows = [
    ['발사 방식', c => optName('launch', c.d.opts.launch)],
    ['발사 방향', c => optName('dir', c.d.opts.dir)],
    ['인테이커', c => optName('intake', c.d.opts.intake)],
    ['브레인', c => optName('brain', c.d.opts.brain)],
    ['고무줄', c => c.d.opts.launch && c.d.opts.launch !== 'lift' ? c.d.opts.bands + '개' : '-'],
    ['각도', c => c.d.opts.launch && c.d.opts.launch !== 'lift' ? c.d.opts.rail + '°' : '-'],
    ['당기는 장치', c => SLING(c.d.opts.launch) ? optName('pull', c.d.opts.pull) : '-'],
    ['앞·위', c => c.d.orient.top && c.d.orient.front ? `${c.d.orient.top}면 위 · 끝 ${c.d.orient.front === 'end1' ? 1 : 2} 앞` : '미정'],
    ['프레임', c => `${c.d.frame.w}×${c.d.frame.l}칸`],
    ['크기 (폭×길이×높이)', c => `${inch(c.A.short)} × ${inch(c.A.long)} × ${inch(c.A.dims.h)}in`, true],
    ['무게(추정)', c => (c.A.M / 1000).toFixed(2) + 'kg', true],
    ['무게중심 쏠림', c => c.A.ratio ? `좌우 ${Math.round(Math.abs(c.A.ratio.x) * 100)}% · 앞뒤 ${Math.round(Math.abs(c.A.ratio.y) * 100)}%` : '-', true],
    ['경고', c => (c.A.nDanger + c.A.nWarn) ? c.A.warnings.filter(w => w.level !== 'info').map(w => w.title).join(' / ') : '없음'],
  ];
  let h = `<div class="cmp"><div class="cmp-cols">${cols.map(c => `<div class="cmp-col"><h4>${esc(c.d.name)}</h4><div class="img" data-img="${c.id}">${miniTop(c.R)}</div></div>`).join('')}</div>
    <div class="cmp-tab"><table><tbody>${rows.map(([k, f, mono]) => {
      const vals = cols.map(f), diff = new Set(vals).size > 1;
      return `<tr class="${diff ? 'diff' : ''}"><th>${k}</th>${vals.map(v => `<td class="${mono ? 'mono' : ''}">${esc(v)}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>
    <p class="hint">파란 줄은 구상안끼리 다른 항목이에요.</p>
    <div class="btnrow">${cols.map(c => `<button class="btn sm" type="button" data-act="openFromCmp" data-id="${c.id}">${esc(c.d.name)} 열기</button>`).join('')}</div></div>`;
  els.sheetBody.innerHTML = h;
  els.sheet.hidden = false;
  els.sheetClose.focus();
  requestAnimationFrame(() => {
    for (const c of cols) {
      const url = snapshot3D(c.R, c.A);
      const box = els.sheetBody.querySelector(`[data-img="${c.id}"]`);
      if (url && box) box.innerHTML = `<img src="${url}" alt="${esc(c.d.name)} 3D 모습">`;
    }
  });
}
function closeCompare() { els.sheet.hidden = true; els.sheetBody.innerHTML = ''; }

/* ---------- 알림 ---------- */
function toast(msg, html) {
  const t = document.createElement('div'); t.className = 'toast';
  if (html) t.innerHTML = msg; else t.textContent = msg;
  els.toasts.appendChild(t);
  while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
  setTimeout(() => t.remove(), 3400);
}
