/* =========================================================
   저장 연결: Firebase (설치형 앱)
   구글 로그인 → Firestore: designs · history · people · presence · meta
   등록된 계정만 읽고 쓸 수 있게 Firestore 보안 규칙으로 막는다.
   ========================================================= */
const BACKEND = {
  kind: 'firebase',
  text: {
    // Firebase 없이 기기마다 따로 쓰는 게 기본이라 안내 띠를 띄우지 않는다
    local: '',
    syncLocal: '이 기기에 저장됨',
    ro: '이 구글 계정은 등록되지 않아서 저장할 수 없어요.',
    roToast: '이 구글 계정은 등록되지 않아서 저장할 수 없어요.',
    quota: '오늘 쓸 수 있는 무료 저장 횟수를 다 썼어요. 내일 다시 저장돼요.',
  },
  onReadError(e) {
    if (e && e.code === 'permission-denied') return notMember();
    setSync('error'); toast('불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
  },
  onDesigns(snap) { maybeImportSeed(snap); },
  saveNick(id, v) { return S.db.doc('people/' + id).update({ nick: v, ts: Date.now() }); },
  accountHtml() {
    if (!FBS.user) return '';
    return `<section class="sec"><div class="nick"><span>로그인한 계정: <b>${esc(FBS.user.email || '')}</b></span><button class="btn sm" type="button" data-act="logout">로그아웃</button></div></section>`;
  },
  login() { login(); },
  logout() { if (FBS.auth) FBS.auth.signOut(); },
};
const FBS = { auth: null, fs: null, user: null, off: null, presOff: null, pres: [], peerSig: '', hb: null, imported: false };

/* Claude 쪽 db와 같은 모양으로 감싼다. update는 하위 객체까지 합치는 set(merge)로.
   Firestore는 undefined 값을 받지 않아서 JSON으로 한 번 걸러서 보낸다. */
const fbClean = d => JSON.parse(JSON.stringify(d));
function fbAdapter(fs) {
  const wrap = r => ({
    id: r.id, path: r.path,
    get: () => r.get(),
    set: d => r.set(fbClean(d)),
    update: d => r.set(fbClean(d), { merge: true }),
    delete: () => r.delete(),
    onSnapshot: (n, e) => r.onSnapshot(n, e),
  });
  return { doc: p => wrap(fs.doc(p)), collection: p => fs.collection(p) };
}

function initBackend() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !window.firebase) return startLocal();
  try {
    firebase.initializeApp(cfg);
    FBS.auth = firebase.auth();
    FBS.fs = firebase.firestore();
    const p = FBS.fs.enablePersistence && FBS.fs.enablePersistence({ synchronizeTabs: true });
    if (p && p.catch) p.catch(() => {});
  } catch (e) { console.error(e); return startLocal(); }
  bindGate();
  FBS.auth.getRedirectResult().catch(e => { if (!FBS.user) authError(e); });
  FBS.auth.onAuthStateChanged(u => (u ? signedIn(u) : signedOut()));
}

/* ---------- 로그인 화면 ---------- */
function bindGate() {
  if (!els.gate || els.gate.dataset.bound) return;
  els.gate.dataset.bound = '1';
  els.gateLogin.addEventListener('click', login);
  // 구글 계정 고르는 창이 뜨니 로그아웃 없이 바로 연다 (팝업이 막히지 않게 누른 순간 연다)
  els.gateOut.addEventListener('click', login);
}
function showGate(msg, opts) {
  if (!els.gate) return;
  opts = opts || {};
  els.gateMsg.textContent = msg || '지안이와 같이 쓰는 로봇 설계 앱이에요. 구글 계정으로 로그인해 주세요.';
  els.gateLogin.hidden = !!opts.other;
  els.gateLogin.disabled = !!opts.busy;
  els.gateLogin.textContent = opts.busy ? '로그인 창을 여는 중…' : '구글 계정으로 로그인';
  els.gateOut.hidden = !opts.other;
  els.gate.hidden = false;
}
function hideGate() { if (els.gate) els.gate.hidden = true; }
function login() {
  const p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  showGate('', { busy: true });
  FBS.auth.signInWithPopup(p).catch(e => {
    const c = e && e.code;
    if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') return FBS.auth.signInWithRedirect(p).catch(authError);
    authError(e);
  });
}
function authError(e) {
  if (!e) return;
  const c = e.code || '';
  const msg = c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' ? '로그인 창이 닫혔어요. 다시 눌러 주세요.'
    : c === 'auth/unauthorized-domain' ? '이 주소가 Firebase에 아직 등록되지 않았어요. Firebase의 Authentication 설정에서 승인된 도메인에 이 주소를 추가해 주세요.'
    : c === 'auth/network-request-failed' ? '인터넷 연결을 확인해 주세요.'
    : '로그인하지 못했어요. 설치한 앱에서 안 되면 크롬에서 이 주소를 열어 로그인한 뒤 앱을 다시 열어 보세요.';
  showGate(msg);
}
function notMember() {
  S.readonly = true; setSync('ro'); renderChrome();
  showGate(`${(FBS.user && FBS.user.email) || '이 계정'}은 등록되지 않은 계정이에요. 등록된 구글 계정으로 다시 로그인해 주세요.`, { other: true });
}

/* ---------- 로그인 상태 ---------- */
function signedIn(u) {
  if (FBS.user && FBS.user.uid !== u.uid) resetShared();
  FBS.user = u;
  hideGate();
  S.meId = u.uid; S.readonly = false;
  S.db = fbAdapter(FBS.fs); S.mode = 'shared';
  S.people[u.uid] = Object.assign({}, S.people[u.uid], { name: u.displayName || '', photo: u.photoURL || '' });
  setSync('saved'); renderChrome();
  S.db.doc('people/' + u.uid).update({ name: u.displayName || '', photo: u.photoURL || '', email: u.email || '', seen: Date.now() }).catch(() => {});
  if (FBS.off) FBS.off();
  FBS.off = subscribeShared(S.db);
  startPresence();
  refresh();
}
function resetShared() {
  if (FBS.off) { FBS.off(); FBS.off = null; }
  if (FBS.presOff) { FBS.presOff(); FBS.presOff = null; }
  Object.assign(S, { mode: 'loading', db: null, meId: null, readonly: false, designs: {}, history: [], people: {}, peers: [],
    curId: null, sel: null, preview: null, firstSnap: false, histReady: false, fitted: false });
  FBS.imported = false; FBS.peerSig = ''; FBS.pres = [];
}
function signedOut() {
  FBS.user = null;
  resetShared();
  setSync('loading'); renderPeers(); refresh();
  showGate();
}

/* ---------- 이름 (people 문서에 이름·사진이 있다) ---------- */
function resolveNames() {}

/* ---------- 같이 보는 사람: presence/<uid> ---------- */
let presTimer = null;
function pushPresence() {
  if (!FBS.fs || !S.meId || S.mode !== 'shared' || S.readonly) return;
  clearTimeout(presTimer);
  presTimer = setTimeout(() => {
    if (!S.db || !S.meId) return;
    S.db.doc('presence/' + S.meId).update({ d: S.curId || null, sel: (S.sel && S.sel.key) || null, ts: Date.now(), on: document.visibilityState === 'visible' }).catch(() => {});
  }, 500);
}
function startPresence() {
  if (FBS.presOff) FBS.presOff();
  FBS.presOff = FBS.fs.collection('presence').onSnapshot(snap => {
    FBS.pres = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    updatePeers();
  }, () => {});
  pushPresence();
  if (!FBS.hb) {
    FBS.hb = setInterval(() => { if (document.visibilityState === 'visible') pushPresence(); updatePeers(); }, 30000);
    document.addEventListener('visibilitychange', pushPresence);
    window.addEventListener('pagehide', () => {
      if (S.db && S.meId) S.db.doc('presence/' + S.meId).update({ on: false, ts: Date.now() }).catch(() => {});
    });
  }
}
function updatePeers() {
  const now = Date.now();
  const list = (FBS.pres || []).filter(p => p.id !== S.meId && p.on && now - (p.ts || 0) < 75000)
    .map(p => ({ peer: p.id, by: p.id, isMe: false, kind: 'viewer', presence: { d: p.d || null, sel: p.sel || null, me: p.id } }));
  const sig = JSON.stringify(list.map(p => [p.by, p.presence.d, p.presence.sel]));
  if (sig === FBS.peerSig) return;
  FBS.peerSig = sig; S.peers = list;
  renderPeers(); refresh({ panel: false });
}

/* ---------- Claude 앱에서 만든 구상안·기록 처음 한 번 가져오기 ----------
   저장소가 비어 있고 아직 가져온 적이 없을 때만. 기기 캐시가 아니라 서버에 물어보고 정한다. */
function maybeImportSeed(snap) {
  if (FBS.imported || !window.SEED || !snap.empty || S.readonly) return;
  FBS.imported = true;
  const server = { source: 'server' };
  FBS.fs.doc('meta/import').get(server).then(m => {
    if (m.exists) return;
    return FBS.fs.collection('designs').limit(1).get(server).then(q => {
      if (!q.empty) return;
      const ops = [];
      for (const [id, d] of Object.entries(SEED.designs || {})) ops.push(['designs/' + id, d]);
      for (const e of SEED.history || []) { const body = Object.assign({}, e); delete body.id; ops.push(['history/' + e.id, body]); }
      for (const [id, p] of Object.entries(SEED.people || {})) ops.push(['people/' + id, p, true]);
      const chunks = [];
      for (let i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
      return chunks.reduce((pr, ch) => pr.then(() => {
        const b = FBS.fs.batch();
        for (const [path, data, merge] of ch) b.set(FBS.fs.doc(path), fbClean(data), merge ? { merge: true } : {});
        return b.commit();
      }), Promise.resolve())
        .then(() => FBS.fs.doc('meta/import').set({ at: Date.now(), by: S.meId, from: 'claude-artifact' }))
        .then(() => toast('Claude 앱에서 만든 구상안과 기록을 가져왔어요'));
    });
  }).catch(e => {
    FBS.imported = false;   // 인터넷이 다시 되면 다음에 다시 시도
    if (e && e.code === 'permission-denied') notMember();
  });
}
