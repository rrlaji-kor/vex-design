/* =========================================================
   2D 도면 — 편집용 (위에서 본 모습 · 옆에서 본 모습)
   SVG 단위 = 칸. 위에서: X=x, Y=-y(앞이 위). 옆에서: X=y(앞이 오른쪽), Y=-z
   ========================================================= */
const V2 = { drag: null, vb: {} };
const f2 = n => (Math.round(n * 1000) / 1000);
function visCls(p) {
  const vis = (KIND[p.kind] && KIND[p.kind].vis) || 'beam';
  if (p.bag) return 'k-bag';
  if (p.kind === 'band') return 'k-band';
  if (p.kind === 'string') return 'k-string';
  if (p.ghost) return 'ghost m-' + (p.mod || 'custom');
  if (p.mod) return 'm-' + p.mod + (p.ph ? ' ph-box' : '');
  if (p.group === 'custom' && p.ph) return 'm-custom ph-box';
  return 'k-' + ({ wall: 'wall', beam: 'beam', plate: 'plate', conn: 'conn', motor: 'motor', wheel: 'wheel', shaft: 'shaft' }[vis] || 'beam');
}
function partClass(p, ctx) {
  let c = 'pt ' + visCls(p);
  if (ctx.sel && partInUnit(p, ctx.sel)) c += ' sel';
  else if (ctx.bad.has(p.key)) c += ' bad';
  else if (ctx.peer.has(p.key)) c += ' peer';
  return c;
}
function allBB(R) {
  const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const p of R.parts) for (let i = 0; i < 3; i++) { b.min[i] = Math.min(b.min[i], p.bb.min[i]); b.max[i] = Math.max(b.max[i], p.bb.max[i]); }
  return b;
}
function render2D() {
  if (!CUR.robot || els.pane2d.offsetParent === null) return;
  const R = CUR.robot, A = CUR.an, bb = allBB(R);
  const peerMap = new Map(peerSelections().map(x => [x.key, x.color]));
  const ctx = { sel: selUnit(), bad: A.bad, peer: peerMap };
  const fs = 1.15;
  drawTop(R, A, bb, ctx, fs);
  drawSide(R, A, bb, ctx, fs);
}
function gridDefs(id) {
  return `<defs><pattern id="g1${id}" width="1" height="1" patternUnits="userSpaceOnUse"><path class="gminor" d="M1 0H0V1"/></pattern>` +
    `<pattern id="g5${id}" width="5" height="5" patternUnits="userSpaceOnUse"><path class="gmajor" d="M5 0H0V5"/></pattern></defs>`;
}
function comSym(x, y) {
  return `<g class="com" transform="translate(${f2(x)} ${f2(y)})"><circle r="0.62"/><path class="q" d="M0 0H0.62A0.62 0.62 0 0 1 0 0.62ZM0 0H-0.62A0.62 0.62 0 0 1 0 -0.62Z"/></g>`;
}
function modLabels(R, axisX, axisY, fs) {
  if (!S.prefs.explain) return '';
  let s = '';
  for (const m of Object.keys(MODS)) {
    const ps = R.parts.filter(p => p.mod === m && !p.ghost && !p.bag);
    if (!ps.length) continue;
    const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const p of ps) for (let i = 0; i < 3; i++) { b.min[i] = Math.min(b.min[i], p.bb.min[i]); b.max[i] = Math.max(b.max[i], p.bb.max[i]); }
    const x = (b.min[axisX] + b.max[axisX]) / 2, y = (b.min[axisY] + b.max[axisY]) / 2;
    s += `<text class="mtxt ${m}" x="${f2(x)}" y="${f2(-y)}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle">${MODS[m].label}${ps[0].ph ? ' (미정)' : ''}</text>`;
  }
  return s;
}
function drawTop(R, A, bb, ctx, fs) {
  const svg = els.svgTop, m = 2.4;
  let x0 = bb.min[0] - m, x1 = bb.max[0] + m, y0 = bb.min[1] - m - 1.2, y1 = bb.max[1] + m + 2.4;
  const cx = (A.bb.min[0] + A.bb.max[0]) / 2, cy = (A.bb.min[1] + A.bb.max[1]) / 2;
  const wide = A.bb.max[0] - A.bb.min[0] > A.bb.max[1] - A.bb.min[1];
  const sw = wide ? LIM.l : LIM.w, sl = wide ? LIM.w : LIM.l;
  if (S.prefs.startBox) { x0 = Math.min(x0, cx - sw / 2 - 1); x1 = Math.max(x1, cx + sw / 2 + 1); y0 = Math.min(y0, cy - sl / 2 - 1); y1 = Math.max(y1, cy + sl / 2 + 2.4); }
  let vb = [x0, -y1, x1 - x0, y1 - y0];
  if (V2.drag && V2.vb.top) vb = V2.vb.top; else V2.vb.top = vb;
  const o = [gridDefs('t'), `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#g1t)"/><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#g5t)"/>`];
  if (A.sup) o.push(`<rect class="sup" x="${f2(A.sup.x0)}" y="${f2(-A.sup.y1)}" width="${f2(A.sup.x1 - A.sup.x0)}" height="${f2(A.sup.y1 - A.sup.y0)}"/>`);
  const order = R.parts.slice().sort((a, b) => (a.shape === 'line') - (b.shape === 'line') || a.bb.max[2] - b.bb.max[2]);
  for (const p of order) {
    const cls = partClass(p, ctx), st = ctx.peer.has(p.key) && !cls.includes(' sel') ? ` style="stroke:${ctx.peer.get(p.key)}"` : '';
    if (p.shape === 'line') { o.push(`<line class="${cls}" data-key="${p.key}" x1="${f2(p.a[0])}" y1="${f2(-p.a[1])}" x2="${f2(p.b[0])}" y2="${f2(-p.b[1])}"${st}/>`); continue; }
    const b = p.bb, vis = (KIND[p.kind] && KIND[p.kind].vis) || '';
    const rr = vis === 'motor' ? 0.35 : vis === 'wheel' ? 0.6 : p.bag ? 0.8 : 0.1;
    o.push(`<rect class="${cls}" data-key="${p.key}" x="${f2(b.min[0])}" y="${f2(-b.max[1])}" width="${f2(b.max[0] - b.min[0])}" height="${f2(b.max[1] - b.min[1])}" rx="${rr}"${st}/>`);
  }
  if (S.prefs.startBox) o.push(`<rect class="lim" x="${f2(cx - sw / 2)}" y="${f2(-(cy + sl / 2))}" width="${sw}" height="${sl}"/><text class="gtxt" x="${f2(cx - sw / 2 + 0.4)}" y="${f2(-(cy + sl / 2) - 0.5)}" font-size="${fs * 0.85}">시작 크기 11 × 20in</text>`);
  o.push(comSym(A.com[0], -A.com[1]));
  o.push(modLabels(R, 0, 1, fs));
  const T = R.T, fy = bb.max[1] + 0.9;
  o.push(`<path class="arrow" d="M${-0.9} ${f2(-fy)}L0 ${f2(-fy - 1.4)}L0.9 ${f2(-fy)}Z"/>`);
  o.push(`<text class="ftxt" x="0" y="${f2(-fy - 1.9)}" font-size="${fs}" text-anchor="middle">${T.decided ? '앞' : '끝 1 · 임시 앞'}</text>`);
  o.push(`<text class="gtxt" x="0" y="${f2(-(bb.min[1] - 1.6))}" font-size="${fs * 0.9}" text-anchor="middle">${T.decided ? '뒤' : '끝 2'}</text>`);
  svg.setAttribute('viewBox', vb.map(f2).join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = o.join('');
}
function sidePoly(p) {
  const t = (p.rx || 0) * Math.PI / 180, u = [Math.cos(t), Math.sin(t)], n = [-Math.sin(t), Math.cos(t)];
  const hy = p.s[1] / 2, hz = p.s[2] / 2, c = [p.c[1], p.c[2]];
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [c[0] + a * hy * u[0] + b * hz * n[0], c[1] + a * hy * u[1] + b * hz * n[1]])
    .map(q => `${f2(q[0])},${f2(-q[1])}`).join(' ');
}
function drawSide(R, A, bb, ctx, fs) {
  const svg = els.svgSide, m = 2.2;
  let x0 = bb.min[1] - m, x1 = bb.max[1] + m, zTop = Math.max(bb.max[2] + 2.6, 10), zBot = -1.6;
  const cy = (A.bb.min[1] + A.bb.max[1]) / 2;
  const wide = A.bb.max[0] - A.bb.min[0] > A.bb.max[1] - A.bb.min[1];
  const sl = wide ? LIM.w : LIM.l;
  const showLim = S.prefs.startBox || A.bb.max[2] > 24;
  if (S.prefs.startBox) { x0 = Math.min(x0, cy - sl / 2 - 1); x1 = Math.max(x1, cy + sl / 2 + 1); }
  if (showLim) zTop = Math.max(zTop, LIM.h + 2.6);
  let vb = [x0, -zTop, x1 - x0, zTop - zBot];
  if (V2.drag && V2.vb.side) vb = V2.vb.side; else V2.vb.side = vb;
  const o = [gridDefs('s'), `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#g1s)"/><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#g5s)"/>`];
  o.push(`<rect x="${f2(vb[0])}" y="0" width="${f2(vb[2])}" height="${f2(-zBot + 1)}" fill="var(--surface-2)" opacity=".7"/>`);
  o.push(`<line class="floor" x1="${f2(vb[0])}" y1="0" x2="${f2(vb[0] + vb[2])}" y2="0"/>`);
  if (showLim) o.push(`<line class="lim" x1="${f2(vb[0])}" y1="${-LIM.h}" x2="${f2(vb[0] + vb[2])}" y2="${-LIM.h}"/><text class="gtxt" x="${f2(vb[0] + 0.5)}" y="${-LIM.h - 0.5}" font-size="${fs * 0.85}">시작 높이 15in</text>`);
  if (S.prefs.startBox) o.push(`<rect class="lim" x="${f2(cy - sl / 2)}" y="${-LIM.h}" width="${sl}" height="${LIM.h}"/>`);
  const order = R.parts.slice().sort((a, b) => (a.shape === 'line') - (b.shape === 'line') || a.c[0] - b.c[0]);
  for (const p of order) {
    const cls = partClass(p, ctx) + (p.group === 'drive' ? ' xr' : ''), st = ctx.peer.has(p.key) && !cls.includes(' sel') ? ` style="stroke:${ctx.peer.get(p.key)}"` : '';
    if (p.shape === 'line') { o.push(`<line class="${cls}" data-key="${p.key}" x1="${f2(p.a[1])}" y1="${f2(-p.a[2])}" x2="${f2(p.b[1])}" y2="${f2(-p.b[2])}"${st}/>`); continue; }
    if (p.shape === 'cyl' && p.axis === 'x') { o.push(`<circle class="${cls}" data-key="${p.key}" cx="${f2(p.c[1])}" cy="${f2(-p.c[2])}" r="${f2(p.r)}"${st}/>`); continue; }
    if (!p.rx) { const b = p.bb; o.push(`<rect class="${cls}" data-key="${p.key}" x="${f2(b.min[1])}" y="${f2(-b.max[2])}" width="${f2(b.max[1] - b.min[1])}" height="${f2(b.max[2] - b.min[2])}" rx="0.1"${st}/>`); continue; }
    o.push(`<polygon class="${cls}" data-key="${p.key}" points="${sidePoly(p)}"${st}/>`);
  }
  o.push(comSym(A.com[1], -A.com[2]));
  o.push(modLabels(R, 1, 2, fs));
  const T = R.T;
  o.push(`<text class="ftxt" x="${f2(vb[0] + vb[2] - 0.5)}" y="${f2(vb[1] + 1.6)}" font-size="${fs}" text-anchor="end">${T.decided ? '앞 →' : '끝 1 →'}</text>`);
  o.push(`<text class="gtxt" x="${f2(vb[0] + 0.5)}" y="${f2(vb[1] + 1.6)}" font-size="${fs * 0.9}">← ${T.decided ? '뒤' : '끝 2'}</text>`);
  svg.setAttribute('viewBox', vb.map(f2).join(' '));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = o.join('');
}

/* ---------- 끌어서 옮기기 ---------- */
function svgPt(svg, e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}
function bind2D(svg, view) {
  let bgTap = null;
  svg.addEventListener('pointerdown', e => {
    const t = e.target.closest('[data-key]');
    if (!t) { bgTap = [e.clientX, e.clientY]; return; }
    bgTap = null;
    selectKey(t.getAttribute('data-key'), '2d');
    const u = selUnit();
    if (!u || !canEditNow(true)) return;
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    V2.drag = { view, unit: u, p0: svgPt(svg, e), c0: [e.clientX, e.clientY], moved: false, delta: [0, 0, 0], id: e.pointerId };
    e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    const D = V2.drag; if (!D || D.id !== e.pointerId) return;
    if (!D.moved && Math.hypot(e.clientX - D.c0[0], e.clientY - D.c0[1]) < 5) return;
    D.moved = true;
    const p = svgPt(svg, e), st = S.prefs.step;
    const du = Math.round((p.x - D.p0.x) / st) * st, dv = Math.round((p.y - D.p0.y) / st) * st;
    const delta = view === 'top' ? [du, -dv, 0] : [0, du, -dv];
    if (delta.join() !== D.delta.join()) { D.delta = delta; S.drag = { unit: D.unit, delta }; refresh({ panel: false }); }
  });
  const end = e => {
    const D = V2.drag;
    if (!D || D.id !== e.pointerId) {
      if (e.type === 'pointerup' && bgTap && Math.hypot(e.clientX - bgTap[0], e.clientY - bgTap[1]) < 6) selectKey(null, '2d');
      bgTap = null; return;
    }
    V2.drag = null; S.drag = null;
    if (D.moved && (D.delta[0] || D.delta[1] || D.delta[2])) commitMove(D.unit, D.delta);
    else refresh({ panel: false });
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}
