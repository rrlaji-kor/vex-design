(() => {
  const KEY = 'fakedb-store', ch = new BroadcastChannel('fakedb');
  let store = JSON.parse(localStorage.getItem(KEY) || '{}');
  const listeners = new Set();
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  const merge = (t, p) => { for (const k of Object.keys(p)) { if (isObj(p[k]) && isObj(t[k])) merge(t[k], p[k]); else t[k] = clone(p[k]); } return t; };
  const notify = () => listeners.forEach(l => l.fire());
  ch.onmessage = e => { store = e.data; notify(); };
  window.__fakeStore = () => store;
  window.__writes = 0;
  function write(path, data) {
    window.__writes++;
    if (data === undefined) delete store[path]; else store[path] = data;
    localStorage.setItem(KEY, JSON.stringify(store)); ch.postMessage(store); setTimeout(notify, 0);
  }
  const snap = path => { const d = store[path]; return { id: path.split('/').pop(), exists: d !== undefined, data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } }; };
  function doc(path) {
    if (path.split('/').length % 2) throw new TypeError('bad doc path ' + path);
    return { id: path.split('/').pop(), path,
      get: async () => snap(path),
      set: async d => { if (!isObj(d)) throw { code: 'invalid_argument', message: 'not obj' }; write(path, clone(d)); },
      update: async d => { if (!(path in store)) throw { code: 'invalid_argument', message: 'missing ' + path }; write(path, merge(clone(store[path]), d)); },
      delete: async () => write(path, undefined),
      onSnapshot(cb) { const l = { fire: () => cb(snap(path)) }; listeners.add(l); setTimeout(l.fire, 5); return () => listeners.delete(l); },
      collection: p => query(path + '/' + p, {}) };
  }
  function qdocs(path, q) {
    const pre = path + '/';
    let ids = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/'));
    let docs = ids.map(k => snap(k));
    if (q.ob) { const [f, dir] = q.ob; docs.sort((a, b) => ((a.data()[f] ?? 0) - (b.data()[f] ?? 0)) * (dir === 'desc' ? -1 : 1)); }
    else docs.sort((a, b) => a.id < b.id ? -1 : 1);
    if (q.lim) docs = docs.slice(0, q.lim);
    return docs;
  }
  function query(path, q) {
    return { path,
      where: () => query(path, q), orderBy: (f, dir) => query(path, Object.assign({}, q, { ob: [f, dir || 'asc'] })), limit: n => query(path, Object.assign({}, q, { lim: n })),
      doc: id => doc(path + '/' + (id || ('x' + Math.random().toString(36).slice(2)))),
      add: async d => { const r = doc(path + '/' + ('x' + Math.random().toString(36).slice(2))); await r.set(d); return r; },
      get: async () => { const docs = qdocs(path, q); return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map(d => ({ type: 'added', doc: d })), metadata: {} }; },
      onSnapshot(cb) {
        let prev = new Map();
        const l = { fire: () => {
          const docs = qdocs(path, q), ch = [];
          for (const d of docs) { const j = JSON.stringify(d.data()); if (!prev.has(d.id)) ch.push({ type: 'added', doc: d }); else if (prev.get(d.id) !== j) ch.push({ type: 'modified', doc: d }); }
          prev = new Map(docs.map(d => [d.id, JSON.stringify(d.data())]));
          cb({ docs, size: docs.length, empty: !docs.length, docChanges: () => ch, metadata: { fromCache: false, hasPendingWrites: false } });
        } };
        listeners.add(l); setTimeout(l.fire, 5); return () => listeners.delete(l);
      } };
  }
  const db = { doc, collection: p => query(p, {}) };
  const uid = new URLSearchParams(location.search).get('u') || 'u_me';
  const names = { u_me: '테스트사용자', u_jian: '지안' };
  const prof = id => ({ id, name: names[id] || '', avatarUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22%3E%3Ccircle cx=%2210%22 cy=%2210%22 r=%2210%22 fill=%22%23e2702a%22/%3E%3C/svg%3E', color: id === 'u_jian' ? '#e2702a' : '#1b6dd0', email: null, isMe: id === uid, guest: false });
  const user = { id: async () => uid, can: async () => true, isOwner: async () => uid === 'u_me', canEdit: async () => true,
    profiles: async ids => Object.fromEntries([].concat(ids).map(id => [id, prof(id)])), me: async () => prof(uid) };
  let peersCb = null; const pres = {};
  const rch = new BroadcastChannel('fakeroom');
  rch.onmessage = e => { pres[e.data.by] = e.data.p; fire(); };
  function fire() { if (!peersCb) return; const peers = Object.entries(pres).filter(([b]) => b !== uid).map(([b, p]) => ({ peer: 'p_' + b, by: b, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: p, updatedAt: Date.now() })); peersCb({ peers, joined: peers, left: [], updated: [] }); }
  const room = { presence: async p => { rch.postMessage({ by: uid, p }); }, onPeers: cb => { peersCb = cb; setTimeout(fire, 30); return () => { peersCb = null; }; } };
  window.claude = { use: async name => { await new Promise(r => setTimeout(r, 40)); return name === 'db' ? db : name === 'user' ? user : name === 'room' ? room : null; } };
})();
