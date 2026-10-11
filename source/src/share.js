/* =========================================================
   구상안 보내기 · 받기 (링크로, 계정·서버 없이)
   링크 모양: <앱 주소>?d=<압축한 구상안>
   ========================================================= */
const SHARE_KEY = 'd';
const b64u = {
  enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; },
};
async function zipBytes(bytes, pack) {
  const st = new Blob([bytes]).stream().pipeThrough(pack ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
/* 받은 자료는 믿지 않는다: 아는 칸만, 정해진 범위 안의 값만 남긴다 */
function cleanDesign(src) {
  const num = (v, lo, hi, def) => (v != null && v !== '' && Number.isFinite(+v) ? clamp(+v, lo, hi) : def);
  const str = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const pick = (v, list) => (list.includes(v) ? v : null);
  const ch = k => OPTS[k].choices.map(c => c.v);
  const s = src && typeof src === 'object' ? src : {}, o = s.opts || {}, f = s.frame || {}, r = s.orient || {};
  const d = {
    name: str(s.name, 40) || '받은 구상안',
    frame: { w: Math.round(num(f.w, 14, 24, 16)), l: Math.round(num(f.l, 19, 32, 20)) },
    orient: { top: pick(r.top, ['A', 'B']), front: pick(r.front, ['end1', 'end2']) },
    opts: {
      launch: pick(o.launch, ch('launch')), dir: pick(o.dir, ch('dir')) || 'front', intake: pick(o.intake, ch('intake')),
      brain: pick(o.brain, ch('brain')), bands: Math.round(num(o.bands, 1, 8, 4)), rail: Math.round(num(o.rail, 15, 85, 40)),
      pull: pick(o.pull, ch('pull')) || 'winch',
    },
    mods: {}, edits: {}, added: {}, notes: str(s.notes, 2000),
  };
  for (const [k, m] of Object.entries(s.mods || {})) {
    if (MODS[k] && m && typeof m === 'object') d.mods[k] = { dx: num(m.dx, -60, 60, 0), dy: num(m.dy, -60, 60, 0), dz: num(m.dz, -60, 60, 0) };
  }
  for (const [k, e] of Object.entries(s.edits || {})) {
    if (!/^[\w:.-]{1,40}$/.test(k) || !e || typeof e !== 'object') continue;
    const x = {};
    for (const q of ['dx', 'dy', 'dz', 'dw', 'dl', 'dh']) if (e[q] != null) x[q] = num(e[q], -60, 60, 0);
    if (e.hidden != null) x.hidden = !!e.hidden;
    d.edits[k] = x;
  }
  const kinds = ADDABLE.map(a => a.kind);
  for (const [k, a] of Object.entries(s.added || {})) {
    if (!/^[\w-]{1,40}$/.test(k) || !a || !kinds.includes(a.kind) || !Array.isArray(a.c) || !Array.isArray(a.s)) continue;
    d.added[k] = {
      kind: a.kind, name: str(a.name, 40) || ADDABLE.find(x => x.kind === a.kind).label,
      c: [0, 1, 2].map(i => num(a.c[i], -80, 80, 0)), s: [0, 1, 2].map(i => num(a.s[i], 0.5, 80, 1)),
    };
  }
  return d;
}
async function packDesign(d) {
  const raw = new TextEncoder().encode(JSON.stringify({ v: 1, d: cleanDesign(d) }));
  if (window.CompressionStream) return 'z' + b64u.enc(await zipBytes(raw, true));
  return 'j' + b64u.enc(raw);
}
async function unpackDesign(code) {
  code = String(code || '').trim();
  let raw = b64u.dec(code.slice(1));
  if (code[0] === 'z') raw = await zipBytes(raw, false);
  else if (code[0] !== 'j') throw new Error('bad code');
  const o = JSON.parse(new TextDecoder().decode(raw));
  if (!o || o.v !== 1 || !o.d || typeof o.d !== 'object') throw new Error('bad data');
  return cleanDesign(o.d);
}
function shareCodeOf(text) {
  text = String(text || '').trim();
  if (/^[zj][\w-]{8,}$/.test(text)) return text;
  try {
    const u = new URL(text, location.href);
    const h = u.hash.startsWith('#' + SHARE_KEY + '=') ? u.hash.slice(SHARE_KEY.length + 2) : null;
    return u.searchParams.get(SHARE_KEY) || h;
  } catch (e) { return null; }
}
const inKakao = () => /KAKAOTALK/i.test(navigator.userAgent);
const coarsePointer = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

/* ---------- 보내기 ---------- */
async function shareDesign(id) {
  const d = S.designs[id]; if (!d) return;
  let url;
  try { url = location.origin + location.pathname + '?' + SHARE_KEY + '=' + await packDesign(d); }
  catch (e) { return toast('링크를 만들지 못했어요'); }
  const title = `VEX 구상안 · ${d.name}`;
  S.ui.shareUrl = null;
  if (navigator.share && coarsePointer()) {
    try { await navigator.share({ title, text: title, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 카톡에 붙여 넣어 보내세요'); }
  catch (e) { S.ui.shareUrl = url; renderPanel(); }
}

/* ---------- 받기: 링크로 열었을 때 ---------- */
async function checkIncoming() {
  const href = location.href, code = shareCodeOf(href);
  if (!code) return;
  history.replaceState(null, '', location.pathname);
  // 카톡 안 브라우저는 저장 공간이 앱과 따로라서 바깥 브라우저(설치한 앱)로 넘긴다
  if (inKakao()) { S.incomingUrl = href; openExternal(); }
  try { S.incoming = await unpackDesign(code); }
  catch (e) { S.incoming = null; toast('받은 링크가 망가졌어요. 다시 보내 달라고 해 주세요'); }
  renderChrome();
}
function openExternal() {
  if (S.incomingUrl) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(S.incomingUrl);
}
function acceptIncoming() {
  const d = S.incoming; S.incoming = null; S.incomingUrl = null;
  if (d) importDesign(d); else renderChrome();
}
function dismissIncoming() { S.incoming = null; S.incomingUrl = null; renderChrome(); }
async function pasteImport() {
  const i = document.getElementById('pasteIn'); if (!i) return;
  const code = shareCodeOf(i.value);
  if (!code) return toast('구상안 링크가 아니에요. 받은 링크를 통째로 붙여 넣어 주세요');
  try { const d = await unpackDesign(code); i.value = ''; importDesign(d); }
  catch (e) { toast('링크가 망가졌어요. 다시 보내 달라고 해 주세요'); }
}
window.addEventListener('hashchange', () => { if (S.mode !== 'loading') checkIncoming(); });
