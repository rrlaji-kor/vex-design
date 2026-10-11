/* =========================================================
   상태 · 저장 · 기록 · 되돌리기 · 실시간
   공유 저장(db): designs/<id>, history/<id>, people/<id>
   ========================================================= */
const S = {
  mode: 'loading',          // loading | shared | local
  readonly: false,
  db: null, user: null, room: null,
  meId: null,
  designs: {}, history: [], people: {}, profiles: {},
  curId: null, sel: null, drag: null, preview: null,
  tab: 'combo', ui: { orientOpen: null, renaming: null, confirmDel: null, histAll: false, cmp: [] },
  peers: [], firstSnap: false, histReady: false, bootTs: Date.now(),
  prefs: null, sync: 'loading',
};
const CUR = { robot: null, an: null };
const PREF_KEY = 'vexiq-design-prefs-v1', LOCAL_KEY = 'vexiq-design-local-v1';

function loadPrefs() {
  const def = { explain: true, view: null, sv: 'top', step: 1, startBox: false, big: false, lastDesign: null };
  try { const v = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); return Object.assign(def, v || {}); } catch (e) { return def; }
}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(S.prefs)); } catch (e) {} }
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- 현재 구상안 ---------- */
function liveDesigns() {
  return Object.entries(S.designs).filter(([, d]) => d && !d.deleted)
    .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0)).map(([id, d]) => Object.assign({ id }, d));
}
function curDesign() {
  const d = S.curId && S.designs[S.curId];
  return d || null;
}
function viewDesign() {
  const d = curDesign() || S.placeholder || (S.placeholder = defaultDesign('구상안 1'));
  if (!S.preview) return d;
  return deepMerge(clone(d), S.preview);
}
function ensureCur() {
  const live = liveDesigns();
  if (S.curId && S.designs[S.curId] && !S.designs[S.curId].deleted) return;
  const want = S.prefs.lastDesign && S.designs[S.prefs.lastDesign] && !S.designs[S.prefs.lastDesign].deleted ? S.prefs.lastDesign : null;
  const prev = S.curId;
  S.curId = want || (live[0] && live[0].id) || null;
  if (prev && prev !== S.curId && S.designs[prev] && S.designs[prev].deleted && S.firstSnap) toast('보던 구상안이 삭제돼서 다른 구상안을 열었어요');
}

/* ---------- 권한 ---------- */
function canEditNow(quiet) {
  if (S.mode === 'loading') { if (!quiet) toast('아직 불러오는 중이에요'); return false; }
  if (S.readonly) { if (!quiet) toast('보기 전용이라 바꿀 수 없어요'); return false; }
  if (!curDesign()) { if (!quiet) toast('먼저 구상안을 만들어 주세요'); return false; }
  return true;
}

/* ---------- 쓰기 대기열 (문서마다 한 번에 하나) ---------- */
const QUEUE = new Map();
function enqueue(path, fn) {
  const prev = QUEUE.get(path) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => runWrite(fn));
  QUEUE.set(path, next);
  return next;
}
async function runWrite(fn) {
  try { return await fn(); }
  catch (e) {
    const code = e && e.code;
    if (code === 'unavailable') { await new Promise(r => setTimeout(r, 500 + Math.random() * 600)); return await fn(); }
    throw e;
  }
}
let pendingWrites = 0;
function track(p) {
  pendingWrites++; setSync('saving');
  return p.then(v => { pendingWrites--; if (!pendingWrites) setSync('saved'); return v; },
    e => { pendingWrites--; onWriteError(e); });
}
function onWriteError(e) {
  const code = e && e.code;
  if (code === 'invalid_argument' || code === 'permission-denied') {
    S.readonly = true; setSync('ro'); renderChrome(); refresh();
    toast(BACKEND.text.roToast);
  } else if (code === 'quota_exceeded' || code === 'resource-exhausted') {
    setSync('error'); toast(BACKEND.text.quota);
  } else if (code === 'revoked' || code === 'not_granted' || code === 'unauthenticated') {
    setSync('error'); toast('저장 권한이 없어졌어요. 앱을 다시 열어 주세요.');
  } else { setSync('error'); toast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); }
}
function persistLocal() {
  if (S.mode !== 'local') return;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ designs: S.designs, history: S.history.slice(0, 150), people: S.people })); } catch (e) {}
}

/* ---------- 바꾸기 (+기록) ----------
   h: { label } 또는 { ckey, vec, labelFn } 또는 { ckey, from, to, labelFn } */
function commit(patch, h) {
  if (!canEditNow()) return;
  const id = S.curId, d0 = S.designs[id];
  const before = clone(d0);
  const meta = { updatedAt: Date.now(), updatedBy: S.meId || null };
  S.designs[id] = Object.assign(deepMerge(clone(d0), patch), meta);
  refresh();
  if (S.mode === 'shared') track(enqueue('designs/' + id, () => S.db.doc('designs/' + id).update(Object.assign(clone(patch), meta))));
  recordHistory(id, before, h || {});
  persistLocal();
}
function recordHistory(designId, before, h) {
  const now = Date.now();
  if (h.ckey) {
    const last = S.history.find(e => e.designId === designId && !e.isUndo);
    if (last && last.ckey === h.ckey && last.by === S.meId && !last.undone && now - last.ts < 30000) {
      const upd = { ts: now };
      if (h.vec) { upd.acc = add3(last.acc || [0, 0, 0], h.vec).map(r2); upd.label = h.labelFn(upd.acc); }
      else { upd.to = h.to; upd.label = h.labelFn(last.from, h.to); }
      Object.assign(last, upd);
      if (S.mode === 'shared') track(enqueue('history/' + last.id, () => S.db.doc('history/' + last.id).update(upd)));
      persistLocal(); refreshHistoryUI();
      return;
    }
  }
  const e = { id: newId('h'), designId, ts: now, by: S.meId || null, before, ckey: h.ckey || null, kind: h.kind || 'edit',
    label: h.label || (h.vec ? h.labelFn(h.vec) : h.labelFn ? h.labelFn(h.from, h.to) : '수정'),
    acc: h.vec ? h.vec.map(r2) : null, from: h.from == null ? null : h.from, to: h.to == null ? null : h.to,
    isUndo: !!h.isUndo, undone: false };
  S.history.unshift(e);
  if (S.mode === 'shared') {
    const body = clone(e); delete body.id;
    track(enqueue('history/' + e.id, () => S.db.doc('history/' + e.id).set(body)));
  }
  persistLocal(); refreshHistoryUI();
}

/* ---------- 되돌리기 ---------- */
function undoTarget(designId) { return S.history.find(e => e.designId === designId && !e.undone && !e.isUndo && e.before); }
function undoLast() {
  if (!canEditNow()) return;
  const e = undoTarget(S.curId);
  if (!e) return toast('되돌릴 변경이 없어요');
  restoreEntry(e, false);
}
function restoreEntry(e, cascade) {
  if (S.readonly || S.mode === 'loading') return canEditNow();
  const id = e.designId, cur = clone(S.designs[id] || Object.assign(defaultDesign(), { deleted: true }));
  const target = Object.assign(clone(e.before), { updatedAt: Date.now(), updatedBy: S.meId || null });
  S.designs[id] = target;
  const affected = cascade ? S.history.filter(x => x.designId === id && x.ts >= e.ts && !x.undone && !x.isUndo) : [e];
  affected.forEach(x => { x.undone = true; });
  if (S.mode === 'shared') {
    track(enqueue('designs/' + id, () => S.db.doc('designs/' + id).set(target)));
    for (const x of affected.slice(0, 40)) track(enqueue('history/' + x.id, () => S.db.doc('history/' + x.id).update({ undone: true })));
  }
  recordHistory(id, cur, { label: (cascade ? '이 시점 전으로 돌아감 · ' : '되돌림 · ') + e.label, isUndo: true, kind: 'undo' });
  if (target.deleted && S.curId === id) { S.curId = null; ensureCur(); }
  else if (!target.deleted && !curDesign()) S.curId = id;
  persistLocal(); refresh();
  toast((cascade ? '그 변경 전으로 돌아갔어요' : '되돌렸어요') + ' · ' + e.label);
}

/* ---------- 구상안 ---------- */
function createDesign(fromId) {
  if (S.readonly || S.mode === 'loading') return canEditNow();
  const n = Object.keys(S.designs).length + 1;
  let d;
  if (fromId && S.designs[fromId]) { d = clone(S.designs[fromId]); d.name = (d.name || '구상안') + ' 복사'; }
  else d = defaultDesign('구상안 ' + n);
  Object.assign(d, { deleted: false, createdAt: Date.now(), createdBy: S.meId || null, updatedAt: Date.now(), updatedBy: S.meId || null });
  const id = newId('d');
  S.designs[id] = d; S.curId = id; S.prefs.lastDesign = id; savePrefs();
  if (S.mode === 'shared') track(enqueue('designs/' + id, () => S.db.doc('designs/' + id).set(clone(d))));
  recordHistory(id, Object.assign(clone(d), { deleted: true }), { label: fromId ? `구상안 복제 · ${d.name}` : `새 구상안 · ${d.name}`, kind: 'create' });
  persistLocal(); selectKey(null, 'silent'); refresh(); pushPresence();
  toast(`"${d.name}"을 만들었어요`);
}
/* 받은 구상안(링크)을 새 구상안으로 넣는다. src는 cleanDesign으로 거른 것 */
function importDesign(src) {
  if (S.readonly || S.mode === 'loading') return canEditNow();
  const names = new Set(liveDesigns().map(x => x.name));
  let name = src.name || '받은 구상안';
  if (names.has(name)) { let n = 2; while (names.has(`${name} (${n})`)) n++; name = `${name} (${n})`; }
  const now = Date.now();
  const d = Object.assign(clone(src), { name, deleted: false, createdAt: now, createdBy: S.meId || null, updatedAt: now, updatedBy: S.meId || null });
  const id = newId('d');
  S.designs[id] = d; S.curId = id; S.prefs.lastDesign = id; savePrefs();
  if (S.mode === 'shared') track(enqueue('designs/' + id, () => S.db.doc('designs/' + id).set(clone(d))));
  recordHistory(id, Object.assign(clone(d), { deleted: true }), { label: `받은 구상안 추가 · ${name}`, kind: 'create' });
  persistLocal(); selectKey(null, 'silent'); refresh(); pushPresence(); fitCam(true);
  toast(`"${name}"을 추가했어요`);
}
function openDesign(id) {
  if (!S.designs[id] || S.designs[id].deleted) return;
  S.curId = id; S.prefs.lastDesign = id; savePrefs(); S.preview = null;
  selectKey(null, 'silent'); refresh(); pushPresence(); fitCam(true);
}
function designPatch(id, patch, label) {
  if (S.readonly || S.mode === 'loading') return canEditNow();
  const d0 = S.designs[id]; if (!d0) return;
  const before = clone(d0), meta = { updatedAt: Date.now(), updatedBy: S.meId || null };
  S.designs[id] = Object.assign(deepMerge(clone(d0), patch), meta);
  if (S.mode === 'shared') track(enqueue('designs/' + id, () => S.db.doc('designs/' + id).update(Object.assign(clone(patch), meta))));
  recordHistory(id, before, { label, kind: 'design' });
  if (S.designs[id].deleted && S.curId === id) { S.curId = null; ensureCur(); }
  persistLocal(); refresh();
}

/* ---------- 이름 ---------- */
function personName(id) {
  const p = S.profiles[id]; if (p && p.name) return p.name;
  const q = S.people[id]; return (q && (q.nick || q.name)) || '';
}
function whoName(id) {
  if (!id) return '누군가';
  if (id === 'claude') return 'Claude';
  if (id === S.meId) return '나';
  return personName(id) || '함께 만드는 사람';
}
function myLabel() {
  const q = S.people[S.meId], p = S.meId && S.profiles[S.meId];
  return (q && (q.nick || q.name)) || (p && p.name) || '';
}
function hashColor(id) {
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 62%, 48%)`;
}
function peerColor(id) { const p = S.profiles[id]; return (p && p.color) || hashColor(id); }
function avatarHtml(id) {
  const p = S.profiles[id], q = S.people[id];
  const url = (p && p.avatarUrl) || (q && q.photo);
  if (url) return `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">`;
  const nm = whoName(id), ch = id === 'claude' ? 'C' : (nm[0] || '?');
  return `<span class="av" style="background:${id === 'claude' ? '#c96442' : hashColor(id)}">${esc(ch)}</span>`;
}

/* ---------- 실시간: 같이 보는 사람 (pushPresence는 저장 연결 파일에) ---------- */
function peerSelections() {
  const out = [];
  for (const p of S.peers) {
    const pr = p.presence || {};
    if (pr.d && pr.d === S.curId && pr.sel) out.push({ key: pr.sel, color: peerColor(p.by || pr.me || p.peer) });
  }
  return out;
}

/* ---------- 공유 저장 구독 (두 저장 연결이 같이 씀) ---------- */
function subscribeShared(db) {
  const off = [];
  off.push(db.collection('designs').onSnapshot(snap => {
    const next = {};
    snap.docs.forEach(doc => { if (doc.exists) next[doc.id] = clone(doc.data()); });
    S.designs = next; S.firstSnap = true;
    if (BACKEND.onDesigns) BACKEND.onDesigns(snap);
    ensureCur(); refresh({ keepCam: true });
    if (!S.fitted && curDesign()) { S.fitted = true; fitCam(true); }
  }, e => BACKEND.onReadError(e)));
  off.push(db.collection('history').orderBy('ts', 'desc').limit(HIST_KEEP).onSnapshot(snap => {
    if (!S.pruned && snap.size >= HIST_KEEP && !S.readonly) { S.pruned = true; pruneHistory(snap.docs[snap.docs.length - 1].data().ts); }
    if (S.histReady) {
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed') continue;
        const e = ch.doc.data();
        if (e && e.by !== S.meId && e.ts > S.bootTs - 2000) foreignToast(ch.doc.id, e);
      }
    }
    S.history = snap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));
    S.histReady = true;
    resolveNames(S.history.map(e => e.by));
    refreshHistoryUI();
  }, () => {}));
  off.push(db.collection('people').onSnapshot(snap => {
    const m = {}; snap.docs.forEach(doc => { m[doc.id] = doc.data(); }); S.people = m; refreshHistoryUI(); renderPeers();
  }, () => {}));
  return () => off.forEach(f => { try { f && f(); } catch (e) {} });
}
const HIST_KEEP = 300;
function pruneHistory(oldestKept) {
  S.db.collection('history').orderBy('ts', 'asc').limit(80).get().then(q => {
    for (const doc of q.docs) {
      const e = doc.data();
      if (e && e.ts < oldestKept) track(enqueue('history/' + doc.id, () => S.db.doc('history/' + doc.id).delete()));
    }
  }).catch(() => {});
}
const lastToast = new Map();
function foreignToast(id, e) {
  const t = lastToast.get(id) || 0;
  if (Date.now() - t < 5000) return;
  lastToast.set(id, Date.now());
  const d = S.designs[e.designId];
  const where = e.designId !== S.curId && d ? ` (${d.name})` : '';
  toast(`<b>${esc(whoName(e.by))}</b> · ${esc(e.label)}${esc(where)}`, true);
}
const SEEDED_KEY = 'vexiq-design-seeded-v1';
function startLocal() {
  S.mode = 'local'; S.meId = 'local';
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    if (v && v.designs) { S.designs = v.designs; S.history = v.history || []; S.people = v.people || {}; }
  } catch (e) {}
  // Claude 앱에서 만든 구상안·기록을 이 기기에 처음 한 번 넣는다 (이미 있는 건 그대로)
  let seeded = false;
  try { seeded = !!localStorage.getItem(SEEDED_KEY); } catch (e) {}
  const seed = window.SEED;
  if (!seeded && seed && seed.designs) {
    for (const [id, d] of Object.entries(seed.designs)) if (!S.designs[id]) S.designs[id] = clone(d);
    const have = new Set(S.history.map(e => e.id));
    S.history = S.history.concat((seed.history || []).filter(e => e && e.id && !have.has(e.id)).map(clone)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    S.people = Object.assign({}, seed.people || {}, S.people);
    try { localStorage.setItem(SEEDED_KEY, String(Date.now())); } catch (e) {}
    persistLocal();
  }
  if (!liveDesigns().length) {
    const d = defaultDesign('구상안 1'); const id = newId('d');
    S.designs[id] = d;
  }
  // 브라우저가 저장 공간을 함부로 비우지 않게 부탁해 둔다
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  S.firstSnap = true; S.histReady = true;
  ensureCur(); setSync('local'); renderChrome(); refresh(); fitCam(true);
}
