/* =========================================================
   저장 연결: Claude 아티팩트 (db · user · room)
   ========================================================= */
const BACKEND = {
  kind: 'claude',
  text: {
    local: '공유 저장을 쓸 수 없는 화면이에요. 바꾼 내용은 이 기기에만 남아요.',
    ro: '보기 전용이에요. 같이 고치려면 소유자가 공유 메뉴에서 편집자로 초대해야 해요.',
    roToast: '이 계정은 보기만 할 수 있어요. 소유자가 편집자로 초대해야 저장돼요.',
    quota: '저장 공간이 가득 찼어요. 안 쓰는 구상안을 지워 주세요.',
  },
  onReadError(e) { setSync('error'); if (e && e.code !== 'revoked') toast('구상안을 불러오지 못했어요. 페이지를 다시 열어 주세요.'); },
  saveNick(id, v) { return S.db.doc('people/' + id).set({ nick: v, ts: Date.now() }); },
};
async function initBackend() {
  const cl = window.claude;
  if (!cl || typeof cl.use !== 'function') return startLocal();
  let db = null, user = null;
  try { [db, user] = await Promise.all([cl.use('db').catch(() => null), cl.use('user').catch(() => null)]); } catch (e) {}
  S.user = user;
  if (user) {
    try { S.meId = await user.id(); } catch (e) {}
    try { const can = await user.can('data.write'); if (can === false) S.readonly = true; } catch (e) {}
  }
  if (!db) return startLocal();
  S.db = db; S.mode = 'shared';
  if (!S.meId) S.meId = 'anon';
  setSync(S.readonly ? 'ro' : 'saved'); renderChrome();
  subscribeShared(db);
  cl.use('room').then(initRoom).catch(() => {});
  if (S.meId && S.meId !== 'anon') resolveNames([S.meId]);
}
let nameTimer = null;
function resolveNames(ids) {
  if (!S.user || !S.user.profiles) return;
  const want = [...new Set(ids.filter(x => x && x !== 'claude'))].filter(x => !S.profiles[x]);
  if (!want.length) return;
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => {
    S.user.profiles(want).then(ps => { Object.assign(S.profiles, ps || {}); renderPeers(); refreshHistoryUI(); }).catch(() => {});
  }, 60);
}
function initRoom(room) {
  if (!room) return;
  S.room = room;
  room.onPeers(ch => {
    S.peers = ch.peers.filter(p => !p.isMe && p.kind === 'viewer');
    resolveNames(S.peers.map(p => p.by || (p.presence && p.presence.me)).filter(Boolean));
    renderPeers(); refresh({ panel: false });
  }, () => {});
  pushPresence();
}
function pushPresence() {
  if (!S.room) return;
  S.room.presence({ d: S.curId || null, sel: (S.sel && S.sel.key) || null, me: S.meId || null }).catch(() => {});
}
