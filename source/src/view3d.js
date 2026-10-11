/* =========================================================
   3D 보기 (three.js r128) — 확인용
   로봇 좌표 (x, y, z) → three 좌표 (x, z, -y)
   ========================================================= */
const V3 = { ok: false, need: false, cam: { th: 0.62, ph: 1.06, r: 60, tgt: [0, 0, 4] }, anim: null };
const MODCOL = { launcher: 0xe2702a, intake: 0x23946a, brain: 0x7457ea, custom: 0x5a7aa3 };
const t3 = v => new THREE.Vector3(v[0], v[2], -v[1]);

function init3D() {
  const cv = els.cv;
  if (!window.THREE) return no3D('3D 그림 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 2D 도면을 써 주세요.');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); }
  catch (e) { return no3D('이 기기에서는 3D를 그릴 수 없어요. 2D 도면을 써 주세요.'); }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 3000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7d8896, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.58);
  sun.position.set(22, 46, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
  sun.shadow.bias = -0.0008;
  scene.add(sun); scene.add(sun.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const root = new THREE.Group(); scene.add(root);
  const over = new THREE.Group(); scene.add(over);
  Object.assign(V3, { ok: true, renderer, scene, camera, hemi, sun, floor, root, over, grids: null,
    ray: new THREE.Raycaster(), mats: makeMaterials(renderer) });
  applyTheme3D();
  bind3D();
  new ResizeObserver(() => { resize3D(); }).observe(els.pane3d);
  resize3D();
}
function no3D(msg) {
  V3.ok = false;
  const d = document.createElement('div'); d.className = 'nogl'; d.textContent = msg;
  els.pane3d.appendChild(d);
  els.cv.style.display = 'none';
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }
function applyTheme3D() {
  if (!V3.ok) return;
  V3.scene.background = new THREE.Color(cssVar('--scene-bg'));
  if (V3.grids) { V3.grids.forEach(g => { V3.scene.remove(g); g.geometry.dispose(); g.material.dispose(); }); }
  const g1 = new THREE.GridHelper(80, 80, cssVar('--scene-grid'), cssVar('--scene-grid'));
  const g2 = new THREE.GridHelper(80, 16, cssVar('--scene-grid-major'), cssVar('--scene-grid-major'));
  g1.position.y = 0.004; g2.position.y = 0.006;
  V3.scene.add(g1); V3.scene.add(g2); V3.grids = [g1, g2];
  V3.inkColor = new THREE.Color(cssVar('--ink'));
  request3D();
}

/* ---------- 재질 ---------- */
function holeTexture(renderer, bg, ring, hole, r1, r2) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = ring; g.beginPath(); g.arc(32, 32, r1, 0, Math.PI * 2); g.fill();
  g.fillStyle = hole; g.beginPath(); g.arc(32, 32, r2, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
function makeMaterials(renderer) {
  const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.02 }, o));
  const M = {
    beam: std({ map: holeTexture(renderer, '#a9afb7', '#9aa1a9', '#4b525a', 21, 15) }),
    conn: std({ map: holeTexture(renderer, '#f3f4f6', '#e2e5e9', '#2d8ee0', 15, 9), roughness: 0.5 }),
    motor: std({ color: 0xcfd3d8, roughness: 0.5 }),
    cap: std({ color: 0x5e646c, roughness: 0.6 }),
    hub: std({ color: 0x9aa1a8, roughness: 0.45 }),
    roller: std({ color: 0x24272b, roughness: 0.85 }),
    metal: std({ color: 0x8a9199, roughness: 0.35, metalness: 0.55 }),
    collar: std({ color: 0x3a3e44, roughness: 0.7 }),
    band: std({ color: 0xc7903a, roughness: 0.85 }),
    bag: std({ color: 0xefc12b, roughness: 0.95 }),
    string: new THREE.MeshBasicMaterial({ color: 0x2c3036 }),
    mod: {}, edge: {}, sel: null,
  };
  for (const [k, col] of Object.entries(MODCOL)) {
    M.mod[k] = std({ color: col, transparent: true, opacity: 0.46, depthWrite: false, roughness: 0.7 });
    M.edge[k] = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95 });
  }
  M.dash = {};
  for (const [k, col] of Object.entries(MODCOL)) M.dash[k] = new THREE.LineDashedMaterial({ color: col, dashSize: 0.6, gapSize: 0.4 });
  return M;
}
function scaleBoxUV(geo, sx, sy, sz) {
  const uv = geo.attributes.uv, f = [[sy, sz], [sy, sz], [sx, sy], [sx, sy], [sx, sz], [sx, sz]];
  for (let face = 0; face < 6; face++) for (let i = 0; i < 4; i++) {
    const k = face * 4 + i; uv.setXY(k, uv.getX(k) * f[face][0], uv.getY(k) * f[face][1]);
  }
  uv.needsUpdate = true;
}

/* ---------- 부품 → 메시 ---------- */
function place(obj, p) {
  obj.position.copy(t3(p.c));
  obj.rotation.x = (p.rx || 0) * Math.PI / 180;
  return obj;
}
function tagAll(obj, key, noPick) { obj.traverse(o => { o.userData.key = key; if (noPick) o.userData.noPick = true; }); return obj; }
function boxGeo(s, uv) { const g = new THREE.BoxGeometry(s[0], s[2], s[1]); if (uv) scaleBoxUV(g, s[0], s[1], s[2]); return g; }
function cylGeo(p, seg) {
  const g = new THREE.CylinderGeometry(p.r, p.r, p.len, seg || 28);
  if (p.axis === 'x') g.rotateZ(Math.PI / 2); else if (p.axis === 'y') g.rotateX(Math.PI / 2);
  return g;
}
function withEdges(mesh, mat) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), mat);
  mesh.add(e); return mesh;
}
function wheelMesh(p, M) {
  const g = new THREE.Group();
  const R = p.r, w = p.len;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.66, R * 0.66, w * 0.92, 28).rotateZ(Math.PI / 2), M.hub);
  hub.castShadow = true; g.add(hub);
  const rr = Math.max(0.18, R * 0.17), rl = Math.max(0.4, R * 0.42);
  const rg = new THREE.CylinderGeometry(rr, rr, rl, 12);
  for (let row = 0; row < 2; row++) for (let k = 0; k < 8; k++) {
    const a = (k + row * 0.5) / 8 * Math.PI * 2;
    const m = new THREE.Mesh(rg, M.roller);
    m.position.set((row ? 1 : -1) * w * 0.22, (R - rr) * Math.cos(a), (R - rr) * Math.sin(a));
    m.rotation.x = a + Math.PI / 2;
    m.castShadow = true; g.add(m);
  }
  return place(g, p);
}
function motorMesh(p, M, ghostMod) {
  const g = new THREE.Group();
  if (ghostMod) {
    const m = new THREE.Mesh(boxGeo(p.s), M.mod[ghostMod]);
    withEdges(m, M.edge[ghostMod]); g.add(m);
    return place(g, p);
  }
  const cap = Math.min(0.45, p.s[1] * 0.12);
  const body = new THREE.Mesh(boxGeo([p.s[0], p.s[1] - cap * 2, p.s[2]]), M.motor);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(boxGeo([p.s[0] + 0.04, cap, p.s[2] + 0.04]), M.cap);
    c.position.z = -s * (p.s[1] / 2 - cap / 2); c.castShadow = true; g.add(c);
  }
  return place(g, p);
}
function lineMesh(p, mat) {
  const a = t3(p.a), b = t3(p.b), len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(p.w, p.w, Math.max(0.01, len), 6), mat);
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function meshFor(p, M) {
  const vis = (KIND[p.kind] && KIND[p.kind].vis) || 'beam';
  const ghostMod = p.mod || (p.group === 'custom' && p.ph ? 'custom' : null);
  let obj;
  if (p.shape === 'line') obj = lineMesh(p, p.kind === 'band' ? M.band : M.string);
  else if (p.bag) { obj = place(new THREE.Mesh(boxGeo(p.s), M.bag), p); obj.castShadow = true; }
  else if (p.ghost) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo(p.s)), M.dash[p.mod || 'custom']);
    e.computeLineDistances(); obj = place(e, p);
  } else if (ghostMod) {
    if (vis === 'motor') obj = motorMesh(p, M, ghostMod);
    else {
      const geo = p.shape === 'cyl' ? cylGeo(p) : boxGeo(p.s);
      const m = new THREE.Mesh(geo, M.mod[ghostMod]);
      if (p.ph) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), M.dash[ghostMod]);
        e.computeLineDistances(); m.add(e);
      } else withEdges(m, M.edge[ghostMod]);
      obj = place(m, p);
    }
  } else if (p.kind === 'omni' || p.kind === 'cWheel') obj = wheelMesh(p, M);
  else if (vis === 'motor') obj = motorMesh(p, M);
  else if (p.shape === 'cyl') { obj = place(new THREE.Mesh(cylGeo(p), p.kind === 'collar' ? M.collar : M.metal), p); obj.castShadow = true; }
  else {
    const mat = vis === 'conn' ? M.conn : vis === 'shaft' ? M.metal : M.beam;
    obj = place(new THREE.Mesh(boxGeo(p.s, mat.map), mat), p);
    obj.castShadow = true; obj.receiveShadow = true;
  }
  return tagAll(obj, p.key, p.ghost);
}
function disposeTree(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (g.children.length) g.remove(g.children[0]);
}
function fillRobotGroup(group, robot) {
  disposeTree(group);
  for (const p of robot.parts) group.add(meshFor(p, V3.mats));
}

/* ---------- 겹쳐 그리기: 선택·겹침·무게중심·시작 상자·앞 화살표 ---------- */
function outlineFor(p, color, opacity) {
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity || 1, depthTest: false });
  let geo;
  if (p.shape === 'line') {
    const a = t3(p.a), b = t3(p.b);
    geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(geo, mat); l.renderOrder = 10; return l;
  }
  geo = new THREE.EdgesGeometry(boxGeo([p.s[0] + 0.25, p.s[1] + 0.25, p.s[2] + 0.25]));
  const e = new THREE.LineSegments(geo, mat); e.renderOrder = 10;
  return place(e, p);
}
function update3D() {
  if (!V3.ok) return;
  const R = CUR.robot, A = CUR.an;
  if (V3.lastRobot !== R) { fillRobotGroup(V3.root, R); V3.lastRobot = R; }
  const over = V3.over;
  over.children.forEach(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.shared) o.material.dispose && o.material.dispose(); });
  disposeTree(over);
  const ink = V3.inkColor || new THREE.Color(0x222222);
  // 선택
  const u = selUnit();
  if (u) for (const p of R.parts) if (partInUnit(p, u)) over.add(outlineFor(p, 0x1b6dd0));
  // 다른 사람이 고른 부품
  for (const pr of peerSelections()) for (const p of R.parts) if (p.key === pr.key) over.add(outlineFor(p, new THREE.Color(pr.color || '#7a7a7a'), 0.9));
  // 겹침
  for (const k of A.bad) { const p = R.byKey.get(k); if (p) over.add(outlineFor(p, 0xd23b3b)); }
  // 무게중심
  const com = t3(A.com);
  const ballMat = new THREE.MeshBasicMaterial({ color: ink, depthTest: false });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), ballMat); ball.position.copy(com); ball.renderOrder = 11; over.add(ball);
  const lmat = new THREE.LineDashedMaterial({ color: ink, dashSize: 0.4, gapSize: 0.3, depthTest: false });
  const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([com, new THREE.Vector3(com.x, 0.02, com.z)]), lmat);
  drop.computeLineDistances(); drop.renderOrder = 11; over.add(drop);
  if (A.sup) {
    const s = A.sup, pts = [[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1], [s.x0, s.y0]].map(q => new THREE.Vector3(q[0], 0.03, -q[1]));
    const sl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: ink, dashSize: 0.5, gapSize: 0.4, transparent: true, opacity: 0.55 }));
    sl.computeLineDistances(); over.add(sl);
  }
  // 시작 크기 상자
  if (S.prefs.startBox) {
    const cx = (A.bb.min[0] + A.bb.max[0]) / 2, cy = (A.bb.min[1] + A.bb.max[1]) / 2;
    const wide = A.bb.max[0] - A.bb.min[0] > A.bb.max[1] - A.bb.min[1];
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(wide ? LIM.l : LIM.w, LIM.h, wide ? LIM.w : LIM.l));
    const bx = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color: A.warnings.some(w => w.id === 'size') ? 0xd23b3b : 0x1b6dd0, dashSize: 0.8, gapSize: 0.5 }));
    bx.computeLineDistances(); bx.position.set(cx, LIM.h / 2, -cy); over.add(bx);
  }
  // 앞 화살표 (바닥)
  const fy = A.bb.max[1] + 2.2;
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0); shape.lineTo(0.5, 0); shape.lineTo(0.5, 1.6); shape.lineTo(1.4, 1.6); shape.lineTo(0, 3.2); shape.lineTo(-1.4, 1.6); shape.lineTo(-0.5, 1.6); shape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.02, -fy); over.add(arrow);
  V3.anchors = { front: [0, fy + 3.6, 0], com: A.com };
  request3D();
}

/* ---------- 카메라 ---------- */
function camPose(c) {
  const sp = Math.sin(c.ph);
  return [c.tgt[0] + c.r * sp * Math.sin(c.th), c.tgt[1] + c.r * sp * Math.cos(c.th), c.tgt[2] + c.r * Math.cos(c.ph)];
}
function fitR(bb, th, ph, aspect) {
  const c = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2];
  const sp = Math.sin(ph), cp = Math.cos(ph);
  const fwd = [sp * Math.sin(th), sp * Math.cos(th), cp], right = [-Math.cos(th), Math.sin(th), 0];
  const up = [-cp * Math.sin(th), -cp * Math.cos(th), sp];
  const ty = Math.tan(16 * Math.PI / 180), tx = ty * Math.max(0.3, aspect);
  let r = 0;
  for (const X of [bb.min[0], bb.max[0]]) for (const Y of [bb.min[1], bb.max[1]]) for (const Z of [bb.min[2], bb.max[2]]) {
    const d = [X - c[0], Y - c[1], Z - c[2]];
    const x = d[0] * right[0] + d[1] * right[1], y = d[0] * up[0] + d[1] * up[1] + d[2] * up[2], z = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
    r = Math.max(r, z + Math.abs(x) / tx, z + Math.abs(y) / ty);
  }
  return { tgt: c, r: r * 1.1 + 2 };
}
function fitCam(keepAngles, th, ph) {
  if (!CUR.an) return;
  const bb = CUR.an.bb;
  const f = fitR(bb, th == null ? V3.cam.th : th, ph == null ? V3.cam.ph : ph, V3.camera ? V3.camera.aspect : 1);
  if (keepAngles) { V3.cam.tgt = f.tgt; V3.cam.r = f.r; request3D(); }
  return f;
}
function presetCam(name) {
  V3.userMoved = true;
  const P = { iso: [0.62, 1.06], front: [0, 1.32], side: [Math.PI / 2, 1.38], top: [0, 0.03], bottom: [0, Math.PI - 0.04] }[name] || [0.62, 1.06];
  const f = fitCam(false, P[0], P[1]) || { tgt: V3.cam.tgt, r: V3.cam.r };
  animCam({ th: P[0], ph: P[1], r: f.r, tgt: f.tgt });
}
function animCam(to) {
  const from = Object.assign({}, V3.cam, { tgt: V3.cam.tgt.slice() });
  let dth = to.th - from.th; while (dth > Math.PI) dth -= Math.PI * 2; while (dth < -Math.PI) dth += Math.PI * 2;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now(), dur = reduce ? 0 : 320;
  cancelAnimationFrame(V3.anim);
  const step = now => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
    V3.cam.th = from.th + dth * e; V3.cam.ph = from.ph + (to.ph - from.ph) * e; V3.cam.r = from.r + (to.r - from.r) * e;
    V3.cam.tgt = from.tgt.map((v, i) => v + (to.tgt[i] - v) * e);
    request3D();
    if (k < 1) V3.anim = requestAnimationFrame(step);
  };
  V3.anim = requestAnimationFrame(step);
}
function resize3D() {
  if (!V3.ok) return;
  const r = els.pane3d.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  V3.renderer.setSize(r.width, r.height, false);
  V3.camera.aspect = r.width / r.height; V3.camera.updateProjectionMatrix();
  if (!V3.userMoved) fitCam(true);
  request3D();
}
function request3D() {
  if (!V3.ok || V3.need) return;
  V3.need = true;
  requestAnimationFrame(frame3D);
}
function frame3D() {
  V3.need = false;
  if (!V3.ok || els.pane3d.offsetParent === null) return;
  const c = V3.cam, cam = V3.camera, pos = camPose(c);
  cam.position.copy(t3(pos));
  cam.up.set(0, 1, 0);
  cam.lookAt(t3(c.tgt));
  V3.renderer.render(V3.scene, cam);
  drawLabels3D();
}
function project(v) {
  const r = els.pane3d.getBoundingClientRect();
  const p = t3(v).project(V3.camera);
  if (p.z > 1 || p.z < -1) return null;
  return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height];
}
function drawLabels3D() {
  const box = els.labels; if (!box) return;
  const L = [];
  const T = CUR.robot.T;
  if (V3.anchors) {
    const f = project(V3.anchors.front);
    if (f) L.push({ x: f[0], y: f[1], cls: 'lbl front', txt: T.decided ? '앞' : '끝 1 · 임시 앞', fixed: true });
  }
  if (S.prefs.explain) {
    for (const m of Object.keys(MODS)) {
      const ps = CUR.robot.parts.filter(p => p.mod === m && !p.ghost && !p.bag);
      if (!ps.length) continue;
      let x = 0, y = 0, z = -Infinity;
      for (const p of ps) { x += p.c[0]; y += p.c[1]; z = Math.max(z, p.bb.max[2]); }
      const s = project([x / ps.length, y / ps.length, z + 0.8]);
      if (s) L.push({ x: s[0], y: s[1], cls: 'lbl', m, txt: MODS[m].label + (ps[0].ph ? ' · 미정' : '') });
    }
    const c = project(CUR.an.com);
    if (c) L.push({ x: c[0] + 34, y: c[1] + 9, cls: 'lbl com', txt: '무게중심' });
  }
  const placed = [];
  const rect = l => { const w = l.txt.length * 12 + 16; return [l.x - w / 2, l.y - 22, l.x + w / 2, l.y]; };
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (const l of L.sort((a, b) => (b.fixed ? 1 : 0) - (a.fixed ? 1 : 0))) {
    for (let k = 0; k < 6; k++) {
      const r = rect(l), o = placed.find(q => hit(r, q));
      if (!o) break;
      l.y = o[1] - 3;
    }
    placed.push(rect(l));
  }
  box.innerHTML = L.map(l => `<span class="${l.cls}"${l.m ? ` data-m="${l.m}"` : ''} style="left:${Math.round(l.x)}px;top:${Math.round(l.y)}px">${l.txt}</span>`).join('');
}

/* ---------- 손가락·마우스 ---------- */
function bind3D() {
  const cv = els.cv, ptr = new Map();
  let g = null;
  const pt = e => [e.clientX, e.clientY];
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, pt(e));
    cancelAnimationFrame(V3.anim); V3.userMoved = true;
    if (ptr.size === 1) g = { mode: (e.button === 2 || e.shiftKey) ? 'pan' : 'rot', last: pt(e), start: pt(e), t0: performance.now(), moved: false, single: true };
    else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      g = { mode: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r0: V3.cam.r, moved: true, single: false };
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId) || !g) return;
    ptr.set(e.pointerId, pt(e));
    const c = V3.cam;
    if (g.mode === 'pinch' && ptr.size >= 2) {
      const [a, b] = [...ptr.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      c.r = clamp(g.r0 * g.d0 / Math.max(10, d), 6, 500);
      panBy(m[0] - g.m0[0], m[1] - g.m0[1]); g.m0 = m;
    } else if (ptr.size === 1) {
      const p = pt(e), dx = p[0] - g.last[0], dy = p[1] - g.last[1];
      g.last = p;
      if (Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) > 6) g.moved = true;
      if (g.mode === 'pan') panBy(dx, dy);
      else { c.th += dx * 0.009; c.ph = clamp(c.ph - dy * 0.009, 0.03, Math.PI - 0.03); }
    }
    request3D();
  });
  const end = e => {
    if (!ptr.has(e.pointerId)) return;
    const wasTap = g && g.single && !g.moved && performance.now() - g.t0 < 500 && e.type === 'pointerup';
    ptr.delete(e.pointerId);
    if (wasTap) pick3D(e);
    if (ptr.size === 1) { const p = [...ptr.values()][0]; g = { mode: 'rot', last: p, start: p, t0: 0, moved: true, single: false }; }
    else if (ptr.size === 0) g = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => {
    e.preventDefault(); cancelAnimationFrame(V3.anim); V3.userMoved = true;
    V3.cam.r = clamp(V3.cam.r * Math.exp(e.deltaY * 0.0012), 6, 500); request3D();
  }, { passive: false });
  els.camBtns.addEventListener('click', e => { const b = e.target.closest('[data-cam]'); if (b) presetCam(b.dataset.cam); });
}
function panBy(dx, dy) {
  const c = V3.cam, r = els.pane3d.getBoundingClientRect();
  const k = 2 * c.r * Math.tan(16 * Math.PI / 180) / Math.max(1, r.height);
  const right = [-Math.cos(c.th), Math.sin(c.th), 0];
  const fwd = [Math.sin(c.th), Math.cos(c.th), 0];
  const up = [-Math.cos(c.ph) * fwd[0], -Math.cos(c.ph) * fwd[1], Math.sin(c.ph)];
  for (let i = 0; i < 3; i++) c.tgt[i] += -dx * k * right[i] + dy * k * up[i];
}
function pick3D(e) {
  const r = els.cv.getBoundingClientRect();
  const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  V3.ray.setFromCamera(m, V3.camera);
  const hits = V3.ray.intersectObjects(V3.root.children, true).filter(h => h.object.userData.key && !h.object.userData.noPick && h.object.type !== 'LineSegments');
  selectKey(hits.length ? hits[0].object.userData.key : null, 'view');
}

/* ---------- 비교용 정지 그림 ---------- */
let SNAP = null;
function snapshot3D(robot, an) {
  if (!V3.ok) return null;
  try {
    if (!SNAP) {
      const c = document.createElement('canvas');
      const rd = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
      rd.setPixelRatio(1); rd.setSize(560, 420, false);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x7d8896, 0.66));
      const sun = new THREE.DirectionalLight(0xffffff, 0.58); sun.position.set(22, 46, 30); sc.add(sun);
      const cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.5, 3000);
      const grp = new THREE.Group(); sc.add(grp);
      SNAP = { rd, sc, cam, grp, grid: null };
    }
    SNAP.sc.background = new THREE.Color(cssVar('--scene-bg'));
    if (SNAP.grid) SNAP.sc.remove(SNAP.grid);
    SNAP.grid = new THREE.GridHelper(80, 16, cssVar('--scene-grid-major'), cssVar('--scene-grid'));
    SNAP.sc.add(SNAP.grid);
    fillRobotGroup(SNAP.grp, robot);
    const f = fitR(an.bb, 0.62, 1.06, 4 / 3);
    const c = { th: 0.62, ph: 1.06, r: f.r, tgt: f.tgt };
    SNAP.cam.position.copy(t3(camPose(c))); SNAP.cam.lookAt(t3(f.tgt));
    SNAP.rd.render(SNAP.sc, SNAP.cam);
    const url = SNAP.rd.domElement.toDataURL('image/png');
    disposeTree(SNAP.grp);
    return url;
  } catch (e) { return null; }
}
