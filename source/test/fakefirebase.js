/* 테스트용 가짜 Firebase compat (app · auth · firestore)
   - 같은 브라우저 컨텍스트의 탭끼리 localStorage + BroadcastChannel로 저장소를 나눠 쓴다
   - 보안 규칙: 허용 이메일만 읽기/쓰기, 아니면 permission-denied
   - Firestore처럼: undefined·중첩 배열은 바로 오류, merge는 하위 맵까지 합치고 빈 맵은 덮어씀,
     바뀐 게 없으면 쿼리 리스너를 부르지 않음 */
(() => {
  const SKEY = 'fakefs-store', AKEY = 'fakeauth-user';
  const qs = new URLSearchParams(location.search);
  const LAT = +(qs.get('lat') || 15);
  const ALLOW = ['owner@test.com', 'jian@test.com'];
  const USERS = {
    owner: { uid: 'uid_owner', email: 'owner@test.com', displayName: '테스트 보호자', photoURL: '', emailVerified: true },
    jian: { uid: 'uid_jian', email: 'jian@test.com', displayName: '지안', photoURL: '', emailVerified: true },
    x: { uid: 'uid_x', email: 'x@test.com', displayName: '모르는 사람', photoURL: '', emailVerified: true },
  };
  window.__as = qs.get('as') || 'owner';
  const ch = new BroadcastChannel('fakefs');
  let store = {};
  try { store = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) {}
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  const later = fn => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, LAT));
  const ferr = (code, msg) => Object.assign(new Error(msg || code), { code, name: 'FirebaseError' });
  window.__fs = () => store;
  window.__fsLog = [];
  window.__popupCalls = 0;

  /* ---------- auth ---------- */
  let cur = null;
  try { cur = JSON.parse(sessionStorage.getItem(AKEY) || 'null'); } catch (e) {}
  const authL = new Set();
  const fireAuth = () => authL.forEach(cb => { try { cb(cur ? Object.assign({}, cur) : null); } catch (e) { console.error(e); } });
  function GoogleAuthProvider() { this.params = {}; }
  GoogleAuthProvider.prototype.setCustomParameters = function (p) { this.params = p; return this; };
  const auth = {
    get currentUser() { return cur; },
    onAuthStateChanged(cb) { authL.add(cb); setTimeout(() => { if (authL.has(cb)) cb(cur ? Object.assign({}, cur) : null); }, LAT); return () => authL.delete(cb); },
    getRedirectResult: () => Promise.resolve({ user: null, credential: null }),
    signInWithPopup(p) {
      window.__popupCalls++;
      if (window.__popupFail) return Promise.reject(ferr(window.__popupFail, 'popup failed'));
      return new Promise(r => setTimeout(r, 60)).then(() => {
        cur = Object.assign({}, USERS[window.__as]);
        sessionStorage.setItem(AKEY, JSON.stringify(cur));
        fireAuth(); restartListeners();
        return { user: cur };
      });
    },
    signInWithRedirect() { window.__redirectCalls = (window.__redirectCalls || 0) + 1; return new Promise(() => {}); },
    signOut() {
      cur = null; sessionStorage.removeItem(AKEY);
      return new Promise(r => setTimeout(r, 10)).then(() => { fireAuth(); restartListeners(); });
    },
  };

  /* ---------- firestore ---------- */
  const allowed = () => !!(cur && cur.emailVerified && ALLOW.includes(cur.email));
  const denied = () => ferr('permission-denied', 'Missing or insufficient permissions.');
  const listeners = new Set();
  const notify = () => listeners.forEach(l => { try { l.fire(); } catch (e) { console.error(e); } });
  const restartListeners = () => setTimeout(notify, LAT * 2);
  ch.onmessage = e => { store = e.data; notify(); };
  function persist() {
    try { localStorage.setItem(SKEY, JSON.stringify(store)); } catch (e) {}
    ch.postMessage(store); setTimeout(notify, 0);
  }
  function validate(v, path, inArray) {
    if (v === undefined) throw ferr('invalid-argument', `Function DocumentReference.set() called with invalid data. Unsupported field value: undefined (found in field ${path})`);
    if (typeof v === 'function') throw ferr('invalid-argument', `Unsupported field value: a function (found in field ${path})`);
    if (Array.isArray(v)) {
      if (inArray) throw ferr('invalid-argument', `Nested arrays are not supported (found in field ${path})`);
      v.forEach((x, i) => validate(x, path, true));
      return;
    }
    if (isObj(v)) {
      for (const k of Object.keys(v)) {
        if (!k) throw ferr('invalid-argument', 'Field name must not be empty');
        if (/^__.*__$/.test(k)) throw ferr('invalid-argument', `Field name ${k} is reserved`);
        validate(v[k], path ? path + '.' + k : k, false);
      }
    }
  }
  function fsMerge(t, p) {
    for (const k of Object.keys(p)) {
      const v = p[k];
      if (isObj(v) && Object.keys(v).length && isObj(t[k])) fsMerge(t[k], v);
      else t[k] = clone(v);
    }
    return t;
  }
  function applySet(path, data, opts) {
    if (opts && opts.merge) store[path] = fsMerge(isObj(store[path]) ? clone(store[path]) : {}, data);
    else store[path] = clone(data);
    window.__fsLog.push(['set', path, !!(opts && opts.merge)]);
  }
  const autoId = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  const docSnap = path => {
    const d = store[path];
    return { id: path.split('/').pop(), ref: docRef(path), exists: d !== undefined, data: () => clone(d), get: f => (d ? clone(d[f]) : undefined),
      metadata: { fromCache: false, hasPendingWrites: false } };
  };
  function docRef(path) {
    const parts = path.split('/');
    if (parts.length % 2) throw ferr('invalid-argument', 'Invalid document reference. Document references must have an even number of segments, but ' + path + ' has ' + parts.length);
    return {
      id: parts[parts.length - 1], path,
      get: () => later(() => { if (!allowed()) throw denied(); return docSnap(path); }),
      set(d, opts) {
        if (!isObj(d)) throw ferr('invalid-argument', 'Function DocumentReference.set() called with invalid data. Data must be an object');
        validate(d, '', false);
        const data = clone(d);
        return later(() => { if (!allowed()) throw denied(); applySet(path, data, opts); persist(); });
      },
      update(d) {
        validate(d, '', false);
        const data = clone(d);
        return later(() => {
          if (!allowed()) throw denied();
          if (store[path] === undefined) throw ferr('not-found', 'No document to update: ' + path);
          // 진짜 update는 최상위 키를 경로로 보고 그 값을 통째로 바꾼다
          const t = clone(store[path]); for (const k of Object.keys(data)) t[k] = data[k]; store[path] = t; persist();
        });
      },
      delete: () => later(() => { if (!allowed()) throw denied(); delete store[path]; window.__fsLog.push(['delete', path]); persist(); }),
      onSnapshot(next, error) {
        let prev, dead = false;
        const l = { fire() {
          if (dead) return;
          if (!allowed()) { dead = true; listeners.delete(l); if (error) error(denied()); return; }
          const j = JSON.stringify(store[path]);
          if (j === prev) return; prev = j; next(docSnap(path));
        } };
        listeners.add(l); setTimeout(() => l.fire(), LAT);
        return () => { dead = true; listeners.delete(l); };
      },
      collection: p => colRef(path + '/' + p, {}),
    };
  }
  function qdocs(path, q) {
    const pre = path + '/';
    let docs = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map(docSnap);
    if (q.ob) {
      const [f, dir] = q.ob;
      docs = docs.filter(d => d.data()[f] !== undefined);
      docs.sort((a, b) => ((a.data()[f] > b.data()[f]) - (a.data()[f] < b.data()[f])) * (dir === 'desc' ? -1 : 1) || (a.id < b.id ? -1 : 1));
    } else docs.sort((a, b) => (a.id < b.id ? -1 : 1));
    if (q.lim) docs = docs.slice(0, q.lim);
    return docs;
  }
  const qsnap = (docs, changes) => ({ docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f),
    docChanges: () => changes || docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })),
    metadata: { fromCache: false, hasPendingWrites: false } });
  function colRef(path, q) {
    return {
      id: path.split('/').pop(), path,
      doc: id => docRef(path + '/' + (id || autoId())),
      add: d => { const r = docRef(path + '/' + autoId()); return r.set(d).then(() => r); },
      where: () => colRef(path, q),
      orderBy: (f, dir) => colRef(path, Object.assign({}, q, { ob: [f, dir || 'asc'] })),
      limit: n => colRef(path, Object.assign({}, q, { lim: n })),
      get: () => later(() => { if (!allowed()) throw denied(); return qsnap(qdocs(path, q)); }),
      onSnapshot(next, error) {
        let prev = null, dead = false;
        const l = { fire() {
          if (dead) return;
          if (!allowed()) { dead = true; listeners.delete(l); if (error) error(denied()); return; }
          const docs = qdocs(path, q), changes = [], pm = prev || new Map();
          docs.forEach((d, i) => {
            const j = JSON.stringify(d.data());
            if (!pm.has(d.id)) changes.push({ type: 'added', doc: d, oldIndex: -1, newIndex: i });
            else if (pm.get(d.id) !== j) changes.push({ type: 'modified', doc: d, newIndex: i });
          });
          const ids = new Set(docs.map(d => d.id));
          for (const [id, j] of pm) if (!ids.has(id)) changes.push({ type: 'removed', doc: { id, exists: false, data: () => JSON.parse(j) }, newIndex: -1 });
          if (prev && !changes.length) return;
          prev = new Map(docs.map(d => [d.id, JSON.stringify(d.data())]));
          next(qsnap(docs, changes));
        } };
        listeners.add(l); setTimeout(() => l.fire(), LAT);
        return () => { dead = true; listeners.delete(l); };
      },
    };
  }
  const fs = {
    doc: docRef,
    collection: p => colRef(p, {}),
    enablePersistence: () => Promise.resolve(),
    settings: () => {},
    batch() {
      const ops = [];
      return {
        set(ref, d, opts) { if (!isObj(d)) throw ferr('invalid-argument', 'batch set data must be object'); validate(d, '', false); ops.push(['set', ref.path, clone(d), opts]); return this; },
        delete(ref) { ops.push(['delete', ref.path]); return this; },
        commit: () => later(() => {
          if (!allowed()) throw denied();
          if (ops.length > 500) throw ferr('invalid-argument', 'A write batch can contain at most 500 operations.');
          for (const [op, path, d, opts] of ops) { if (op === 'set') applySet(path, d, opts); else delete store[path]; }
          window.__fsLog.push(['batch', ops.length]); persist();
        }),
      };
    },
  };
  const authFn = () => auth;
  authFn.GoogleAuthProvider = GoogleAuthProvider;
  window.firebase = {
    initializeApp: cfg => { if (!cfg || !cfg.apiKey) throw ferr('app/no-options', 'no options'); window.__fbCfg = cfg; return {}; },
    auth: authFn,
    firestore: () => fs,
  };
})();
