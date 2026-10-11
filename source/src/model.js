/* =========================================================
   로봇 모델: 설계 문서 → 부품 목록
   좌표(칸): x = 오른쪽+, y = 앞+, z = 위+, 바닥 z=0, 로봇 가운데 x=y=0
   드라이빙보드는 "사진 좌표"(u: A면 사진 왼→오, v: 끝1→끝2, zf: B면→A면)로
   만든 뒤 앞·위 선택에 맞춰 뒤집어 놓는다.
   ========================================================= */
const r2 = n => Math.round(n * 2) / 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
function deepMerge(t, p) {
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (isObj(v) && isObj(t[k])) deepMerge(t[k], v);
    else t[k] = clone(v);
  }
  return t;
}
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function defaultDesign(name) {
  const now = Date.now();
  return {
    name: name || '구상안 1', deleted: false,
    frame: { w: 16, l: 20 },
    orient: { top: null, front: null },
    opts: { launch: null, dir: 'front', intake: null, brain: null, bands: 4, rail: 40, pull: 'winch' },
    mods: {}, edits: {}, added: {}, notes: '',
    createdAt: now, createdBy: null, updatedAt: now, updatedBy: null,
  };
}
function normDesign(d) {
  const def = defaultDesign();
  const o = Object.assign({}, def, d || {});
  o.frame = Object.assign({}, def.frame, (d && d.frame) || {});
  o.frame.w = clamp(Number(o.frame.w) || 16, 14, 24);
  o.frame.l = clamp(Number(o.frame.l) || 20, 19, 32);
  o.orient = Object.assign({}, def.orient, (d && d.orient) || {});
  o.opts = Object.assign({}, def.opts, (d && d.opts) || {});
  o.opts.bands = clamp(Math.round(Number(o.opts.bands) || 4), 1, 8);
  o.opts.rail = clamp(Math.round(Number(o.opts.rail) || 40), 15, 85);
  o.mods = Object.assign({}, (d && d.mods) || {});
  o.edits = Object.assign({}, (d && d.edits) || {});
  o.added = Object.assign({}, (d && d.added) || {});
  return o;
}

/* ---------- 방향 변환 ---------- */
function orientT(d) {
  const W = d.frame.w, L = d.frame.l;
  const top = (d.orient && d.orient.top) || 'A';
  const front = (d.orient && d.orient.front) || 'end1';
  const sx = ((top === 'A') === (front === 'end1')) ? 1 : -1;
  const sy = front === 'end1' ? -1 : 1;
  const zf = top === 'B';
  return {
    W, L, sx, sy, zf, top, front,
    decided: !!(d.orient && d.orient.top && d.orient.front),
    p: (u, v, z) => [sx * (u - W / 2), sy * (v - L / 2), zf ? 2 * AXLE_Z - z : z],
    inv: (dx, dy, dz) => [sx * dx, sy * dy, zf ? -dz : dz],
  };
}

/* ---------- 부품 만들기 도우미 ---------- */
function P_box(key, kind, c, s, o) { return Object.assign({ key, kind, shape: 'box', c, s, rx: 0, collide: true }, o || {}); }
function P_rng(key, kind, x0, x1, y0, y1, z0, z1, o) {
  return P_box(key, kind, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], o);
}
function P_cyl(key, kind, c, axis, r, len, o) {
  const s = axis === 'x' ? [len, 2 * r, 2 * r] : axis === 'y' ? [2 * r, len, 2 * r] : [2 * r, 2 * r, len];
  return Object.assign({ key, kind, shape: 'cyl', c, axis, r, len, s, rx: 0, collide: true }, o || {});
}
function P_line(key, kind, a, b, w, o) {
  return Object.assign({ key, kind, shape: 'line', a, b, w: w || 0.07,
    c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [0, 0, 0], rx: 0, collide: false }, o || {});
}
/* y-z 평면에서 p0→p1 방향으로 기울어진 상자 (x는 cx 중심) */
function P_pitch(key, kind, cx, p0, p1, w, thick, nOff, o) {
  const dy = p1[0] - p0[0], dz = p1[1] - p0[1];
  const len = Math.hypot(dy, dz);
  let ang = Math.atan2(dz, dy) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
  const t = ang * Math.PI / 180, n = [-Math.sin(t), Math.cos(t)];
  const c = [cx, (p0[0] + p1[0]) / 2 + n[0] * (nOff || 0), (p0[1] + p1[1]) / 2 + n[1] * (nOff || 0)];
  return P_box(key, kind, c, [w, len, thick], Object.assign({ rx: ang }, o || {}));
}
function aabb(p) {
  if (p.shape === 'line') {
    const r = p.w || 0.07;
    return { min: [0, 1, 2].map(i => Math.min(p.a[i], p.b[i]) - r), max: [0, 1, 2].map(i => Math.max(p.a[i], p.b[i]) + r) };
  }
  const t = (p.rx || 0) * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  const hx = p.s[0] / 2, hy = c * p.s[1] / 2 + s * p.s[2] / 2, hz = s * p.s[1] / 2 + c * p.s[2] / 2;
  return { min: [p.c[0] - hx, p.c[1] - hy, p.c[2] - hz], max: [p.c[0] + hx, p.c[1] + hy, p.c[2] + hz] };
}
const KMASS = { omni: 40, motor: 75, shaft: 3, collar: 1, cornerConn: 4, connBlock: 3, launchMotor: 75, intakeMotor: 75,
  liftMotor: 75, brain: 190, battery: 110, band: 1.5, string: 0.5, bag: 0, armStop: 0, cMotor: 75, cWheel: 40, cConn: 3 };
function massFor(p) {
  if (p.mass != null) return p.mass;
  if (KMASS[p.kind] != null) return KMASS[p.kind];
  if (p.ph) { const v = p.s[0] * p.s[1] * p.s[2]; return Math.round(v * 0.5); }
  const a = [...p.s].sort((x, y) => x - y);
  return Math.round(0.45 * a[1] * a[2] * 10) / 10;
}

/* ---------- 드라이빙보드 (사진으로 잡은 구도) ---------- */
function driveSpecs(W, L) {
  const S = [];
  const R = (key, kind, u0, u1, v0, v1, z0, z1, t) => S.push({ key, kind, shape: 'box', u0, u1, v0, v1, z0, z1, t: t || {} });
  const C = (key, kind, uc, vc, zc, r, len, t) => S.push({ key, kind, shape: 'cyl', uc, vc, zc, r, len, t: t || {} });
  R('wallL', 'wallOuter', 0, 0.5, 0.5, L - 0.5, 1.5, 3.5, { side: 'L', face: 'frame' });
  R('wallR', 'wallOuter', W - 0.5, W, 0.5, L - 0.5, 1.5, 3.5, { side: 'R', face: 'frame' });
  R('wallE1', 'wallEnd', 0, W, 0, 0.5, 1.5, 3.5, { end: '1', face: 'frame' });
  R('wallE2', 'wallEnd', 0, W, L - 0.5, L, 1.5, 3.5, { end: '2', face: 'frame' });
  R('innerL', 'wallInner', 3.0, 3.5, 0.5, L - 0.5, 1.5, 3.5, { side: 'L', face: 'frame' });
  R('innerR', 'wallInner', W - 3.5, W - 3.0, 0.5, L - 0.5, 1.5, 3.5, { side: 'R', face: 'frame' });
  for (const e of ['1', '2']) {
    const cv0 = e === '1' ? 0.5 : L - 1.75, cv1 = e === '1' ? 1.75 : L - 0.5;
    const wv = e === '1' ? 4.5 : L - 4.5;
    const mv0 = e === '1' ? 3.0 : L - 7.5, mv1 = e === '1' ? 7.5 : L - 3.0;
    for (const s of ['L', 'R']) {
      const t = { end: e, side: s, face: 'frame' }, id = e + s, Lf = s === 'L';
      R('cc_' + id, 'cornerConn', Lf ? 0.5 : W - 3.0, Lf ? 3.0 : W - 0.5, cv0, cv1, 1.5, 3.5, t);
      C('wheel_' + id, 'omni', Lf ? 1.75 : W - 1.75, wv, AXLE_Z, 2.5, 2.2, t);
      R('shaft_' + id, 'shaft', Lf ? -0.35 : W - 5.0, Lf ? 5.0 : W + 0.35, wv - 0.13, wv + 0.13, AXLE_Z - 0.13, AXLE_Z + 0.13, Object.assign({ nc: true }, t));
      C('collar_' + id, 'collar', Lf ? -0.175 : W + 0.175, wv, AXLE_Z, 0.45, 0.35, t);
      R('motor_' + id, 'motor', Lf ? 3.5 : W - 7.0, Lf ? 7.0 : W - 3.5, mv0, mv1, 1.5, 3.5, t);
    }
  }
  // A면: 가운데 세로 빔 + 흰 연결 블록 줄(끝1 쪽 1줄, 가운데 2줄)
  R('beamC', 'centerBeam', W / 2 - 1, W / 2 + 1, 1.75, L - 3.75, 3.0, 3.5, { face: 'A' });
  const mc = clamp(L / 2 + 0.5, 9.3, L - 9.3);
  const rows = [['T', 1.25, 3.0, '1'], ['M1', mc - 1.75, mc, null], ['M2', mc, mc + 1.75, null]];
  for (const [r, v0, v1, e] of rows) {
    R(`r${r}_cL`, 'connBlock', 3.5, 5.25, v0, v1, 2.0, 3.5, { face: 'A', side: 'L', end: e, row: r });
    R(`r${r}_pL`, 'crossPlate', 5.25, W / 2 - 1, v0, v1, 3.0, 3.5, { face: 'A', side: 'L', end: e, row: r });
    R(`r${r}_pR`, 'crossPlate', W / 2 + 1, W - 5.25, v0, v1, 3.0, 3.5, { face: 'A', side: 'R', end: e, row: r });
    R(`r${r}_cR`, 'connBlock', W - 5.25, W - 3.5, v0, v1, 2.0, 3.5, { face: 'A', side: 'R', end: e, row: r });
  }
  // B면: 넓은 판 2개(가운데), 작은 판 2개(끝1 쪽)
  R('wideB1', 'widePlate', 3.5, W - 3.5, mc - 1.75, mc, 1.5, 2.0, { face: 'B', row: 'M1' });
  R('wideB2', 'widePlate', 3.5, W - 3.5, mc, mc + 1.75, 1.5, 2.0, { face: 'B', row: 'M2' });
  R('smallBL', 'smallPlate', 3.5, W / 2, 1.0, 3.0, 1.5, 2.0, { face: 'B', side: 'L', end: '1' });
  R('smallBR', 'smallPlate', W / 2, W - 3.5, 1.0, 3.0, 1.5, 2.0, { face: 'B', side: 'R', end: '1' });
  return S;
}

function buildDrive(d, T, out, hidden) {
  for (const sp of driveSpecs(T.W, T.L)) {
    const ed = (d.edits && d.edits[sp.key]) || null;
    if (ed && ed.hidden) { hidden.push({ key: sp.key, kind: sp.kind, tags: sp.t, group: 'drive' }); continue; }
    const dx = (ed && ed.dx) || 0, dy = (ed && ed.dy) || 0, dz = (ed && ed.dz) || 0;
    const dw = (ed && ed.dw) || 0, dl = (ed && ed.dl) || 0, dh = (ed && ed.dh) || 0;
    let p;
    if (sp.shape === 'cyl') {
      p = P_cyl(sp.key, sp.kind, T.p(sp.uc + dx, sp.vc + dy, sp.zc + dz), 'x', Math.max(0.2, sp.r + dl / 2), Math.max(0.25, sp.len + dw));
    } else {
      p = P_box(sp.key, sp.kind,
        T.p((sp.u0 + sp.u1) / 2 + dx, (sp.v0 + sp.v1) / 2 + dy, (sp.z0 + sp.z1) / 2 + dz),
        [Math.max(0.25, sp.u1 - sp.u0 + dw), Math.max(0.25, sp.v1 - sp.v0 + dl), Math.max(0.25, sp.z1 - sp.z0 + dh)]);
    }
    p.group = 'drive'; p.mod = null; p.tags = sp.t; p.collide = !sp.t.nc;
    p.edited = !!(dx || dy || dz || dw || dl || dh);
    out.push(p);
  }
}

/* ---------- 발사부 ---------- */
function mirrorY(p) { p.c[1] = -p.c[1]; p.rx = -(p.rx || 0); if (p.a) { p.a[1] = -p.a[1]; p.b[1] = -p.b[1]; } }
function shiftPart(p, v) { p.c = add3(p.c, v); if (p.a) { p.a = add3(p.a, v); p.b = add3(p.b, v); } }
function finishMod(P, d, mod, mirror) {
  for (const p of P) { p.mod = mod; p.group = mod; }
  if (mirror) P.forEach(mirrorY);
  const m = d.mods && d.mods[mod];
  if (m && (m.dx || m.dy || m.dz)) P.forEach(p => shiftPart(p, [m.dx || 0, m.dy || 0, m.dz || 0]));
  return P;
}
function bagPart(key, c, rx) { return P_box(key, 'bag', c, [3.8, 3.8, 1.6], { rx: rx || 0, bag: true, collide: false, mass: 0 }); }

function buildLauncher(d, T) {
  const o = d.opts, hw = T.W / 2, iw = hw - 3.5, z0 = ZTOP, P = [];
  const add = p => (P.push(p), p);
  if (!o.launch) {
    add(P_rng('L:ph', 'phLauncher', -iw + 0.5, iw - 0.5, -6, 4, z0, z0 + 7, { ph: true, mass: 250 }));
    return finishMod(P, d, 'launcher', o.dir === 'back');
  }
  const N = clamp(o.bands | 0, 1, 8);
  const awayFromPosts = (cy, half, yT) => (cy + half > yT - 0.6 && cy - half < yT + 0.6) ? yT - 0.6 - half : cy;
  if (SLING(o.launch)) {
    const down = o.launch === 'sling_down';
    const thd = clamp(o.rail, 15, 85), th = thd * Math.PI / 180;
    const Lr = down ? 9.5 : 11, yT = down ? 1.5 : 3.0, zB = z0 + 1.2;
    const u = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)];
    const B = [yT - Lr * u[0], zB], Tp = [yT, zB + Lr * u[1]];
    add(P_rng('L:base', 'basePlate', -4, 4, Math.min(-7, B[0] - 1), 5, z0, z0 + 0.5, { mass: 30 }));
    add(P_pitch('L:rail', 'rail', 0, B, Tp, 2.4, 0.4, 0, { mass: 20 }));
    add(P_rng('L:railsup', 'railSup', -1.2, 1.2, B[0] - 0.5, B[0] + 0.5, z0 + 0.5, zB - 0.3, { mass: 4 }));
    const postTop = Tp[1] + 1.2;
    add(P_rng('L:postL', 'slingFrame', -3.1, -2.4, yT - 0.5, yT + 0.5, z0 + 0.5, postTop, { mass: 12 }));
    add(P_rng('L:postR', 'slingFrame', 2.4, 3.1, yT - 0.5, yT + 0.5, z0 + 0.5, postTop, { mass: 12 }));
    const dc = down ? 5.5 : 6.5;
    const Pc = [Tp[0] - u[0] * dc + n[0] * 0.6, Tp[1] - u[1] * dc + n[1] * 0.6];
    add(P_box('L:pocket', 'pocket', [0, Pc[0], Pc[1]], [4.0, 3.0, 0.8], { rx: thd, mass: 8 }));
    add(bagPart('L:bag', [0, Pc[0] + n[0] * 1.2, Pc[1] + n[1] * 1.2], thd));
    const bk = [Pc[0] - u[0] * 1.3 + n[0] * 0.2, Pc[1] - u[1] * 1.3 + n[1] * 0.2];
    for (let i = 0; i < N; i++) {
      const sd = i % 2 === 0 ? -1 : 1, k = Math.floor(i / 2);
      add(P_line('L:band' + i, 'band', [sd * 2.75, yT, postTop - 0.4 - k * 0.3], [sd * 1.8, bk[0], bk[1] - k * 0.1], 0.07));
    }
    const mzc = z0 + 0.5, mzt = z0 + 4.0;
    if (o.pull === 'winch' || !o.pull) {
      const cy = awayFromPosts(B[0] + 1.5, 2.25, yT);
      add(P_rng('L:motor', 'launchMotor', 2.5, 4.5, cy - 2.25, cy + 2.25, mzc, mzt));
      add(P_cyl('L:winch', 'winch', [1.6, cy, z0 + 1.6], 'x', 0.8, 1.6, { mass: 6 }));
      add(P_line('L:string', 'string', [1.0, cy, z0 + 2.4], [0, bk[0], bk[1]], 0.04));
      add(P_box('L:latch', 'latch', [0, Pc[0] - u[0] * 1.9 - n[0] * 0.55, Pc[1] - u[1] * 1.9 - n[1] * 0.55], [1.2, 0.8, 0.8], { rx: thd, mass: 4 }));
    } else if (o.pull === 'rack') {
      const mid = [(B[0] + Tp[0]) / 2, (B[1] + Tp[1]) / 2];
      add(P_box('L:rack', 'rack', [0, mid[0] - n[0] * 0.55, mid[1] - n[1] * 0.55], [0.5, Lr - 2, 0.5], { rx: thd, mass: 12 }));
      add(P_cyl('L:pinion', 'pinion', [0.9, mid[0] - n[0] * 1.25, mid[1] - n[1] * 1.25], 'x', 0.9, 0.5, { mass: 4 }));
      const cy = awayFromPosts(mid[0], 2.25, yT);
      add(P_rng('L:motor', 'launchMotor', 2.5, 4.5, cy - 2.25, cy + 2.25, mzc, mzt));
      add(P_box('L:latch', 'latch', [0, Pc[0] - u[0] * 1.9 - n[0] * 0.55, Pc[1] - u[1] * 1.9 - n[1] * 0.55], [1.2, 0.8, 0.8], { rx: thd, mass: 4 }));
    } else {
      const gz = Math.max(z0 + 2.1, Pc[1] - 1.6);
      add(P_cyl('L:slip', 'slipGear', [2.3, Pc[0], gz], 'x', 1.5, 0.5, { mass: 8 }));
      const cy = awayFromPosts(Pc[0], 2.25, yT);
      add(P_rng('L:motor', 'launchMotor', 2.6, 4.6, cy - 2.25, cy + 2.25, mzc, mzt));
    }
  } else if (o.launch === 'catapult') {
    add(P_rng('L:base', 'basePlate', -4, 4, -7, 5, z0, z0 + 0.5, { mass: 30 }));
    const Py = 3.0, Pz = z0 + 3.0, La = 10;
    add(P_rng('L:towerL', 'pivotTower', -3.1, -2.4, Py - 0.5, Py + 0.5, z0 + 0.5, Pz + 0.6, { mass: 6 }));
    add(P_rng('L:towerR', 'pivotTower', 2.4, 3.1, Py - 0.5, Py + 0.5, z0 + 0.5, Pz + 0.6, { mass: 6 }));
    add(P_cyl('L:pivot', 'pivot', [0, Py, Pz], 'x', 0.22, 6.6, { collide: false, mass: 4 }));
    const bc = -12 * Math.PI / 180, a = [-Math.cos(bc), Math.sin(bc)];
    const A0 = [Py, Pz], A1 = [Py + a[0] * La, Pz + a[1] * La];
    const arm = add(P_pitch('L:arm', 'arm', 0, A0, A1, 1.0, 0.6, 0, { mass: 20 }));
    const ft = arm.rx * Math.PI / 180, an = [-Math.sin(ft), Math.cos(ft)];
    const cupC = [Py + a[0] * (La - 1.6) + an[0] * 0.75, Pz + a[1] * (La - 1.6) + an[1] * 0.75];
    add(P_box('L:cup', 'cup', [0, cupC[0], cupC[1]], [4.0, 3.2, 1.0], { rx: arm.rx, mass: 8 }));
    add(bagPart('L:bag', [0, cupC[0] + an[0] * 1.3, cupC[1] + an[1] * 1.3], arm.rx));
    const bs = (90 - clamp(o.rail, 15, 85)) * Math.PI / 180;
    const as = [-Math.cos(bs), Math.sin(bs)], tv = [Math.sin(bs), Math.cos(bs)];
    const Sp = [Py + as[0] * 6 + tv[0] * 0.75, Pz + as[1] * 6 + tv[1] * 0.75];
    add(P_rng('L:stop', 'stopper', -3.0, 3.0, Sp[0] - 0.4, Sp[0] + 0.4, Sp[1] - 0.4, Sp[1] + 0.4, { mass: 8 }));
    add(P_rng('L:stopL', 'stopPost', -3.0, -2.55, Sp[0] - 0.3, Sp[0] + 0.3, z0 + 0.5, Sp[1] - 0.4, { mass: 4 }));
    add(P_rng('L:stopR', 'stopPost', 2.55, 3.0, Sp[0] - 0.3, Sp[0] + 0.3, z0 + 0.5, Sp[1] - 0.4, { mass: 4 }));
    add(P_pitch('L:armStop', 'armStop', 0, A0, [Py + as[0] * La, Pz + as[1] * La], 1.0, 0.6, 0, { ghost: true, collide: false, mass: 0 }));
    add(P_rng('L:anchor', 'bandAnchor', -2.2, 2.2, 4.4, 5.0, z0 + 0.5, z0 + 1.6, { mass: 6 }));
    const Ab = [Py + a[0] * 2.8, Pz + a[1] * 2.8];
    for (let i = 0; i < N; i++) {
      const sd = i % 2 === 0 ? -1 : 1, k = Math.floor(i / 2);
      add(P_line('L:band' + i, 'band', [sd * (0.35 + k * 0.12), Ab[0], Ab[1] - 0.3], [sd * (1.2 + k * 0.25), 4.7, z0 + 1.4], 0.07));
    }
    add(P_rng('L:motor', 'launchMotor', 2.5, 4.5, -3.0, 1.5, z0 + 0.5, z0 + 4.0));
    add(P_cyl('L:slip', 'slipGear', [2.2, -0.75, z0 + 2.4], 'x', 1.5, 0.5, { mass: 8 }));
  } else { // lift
    add(P_rng('L:towerL', 'liftTower', -3.4, -2.6, 4.0, 5.0, z0, z0 + 13, { mass: 15 }));
    add(P_rng('L:towerR', 'liftTower', 2.6, 3.4, 4.0, 5.0, z0, z0 + 13, { mass: 15 }));
    add(P_rng('L:carriage', 'carriage', -2.6, 2.6, 5.0, 5.8, z0 + 2.0, z0 + 6.0, { mass: 10 }));
    add(P_rng('L:tray', 'tray', -2.2, 2.2, 5.8, 9.4, z0 + 2.0, z0 + 2.6, { mass: 8 }));
    add(bagPart('L:bag', [0, 7.6, z0 + 2.6 + 0.85], 0));
    add(P_rng('L:motor', 'liftMotor', -1.0, 1.0, -0.5, 4.0, z0, z0 + 3.5));
  }
  return finishMod(P, d, 'launcher', o.dir === 'back');
}

/* ---------- 인테이커 (항상 앞쪽) ---------- */
function buildIntake(d, T) {
  const o = d.opts, hl = T.L / 2, hw = T.W / 2, iw = hw - 3.5, P = [];
  const add = p => (P.push(p), p);
  if (!o.intake) {
    add(P_rng('I:ph', 'phIntake', -iw, iw, hl, hl + 4.0, 0.4, 4.4, { ph: true, mass: 120 }));
  } else if (o.intake === 'roller') {
    add(P_rng('I:armL', 'intakeArm', -4.6, -4.0, hl, hl + 3.6, 0.8, 4.3, { mass: 6 }));
    add(P_rng('I:armR', 'intakeArm', 4.0, 4.6, hl, hl + 3.6, 0.8, 4.3, { mass: 6 }));
    add(P_cyl('I:roller', 'roller', [0, hl + 2.6, 1.5], 'x', 1.2, 8.0, { mass: 15 }));
    add(P_rng('I:motor', 'intakeMotor', 4.6, 6.6, hl, hl + 4.5, 0.8, 4.3));
  } else if (o.intake === 'claw') {
    add(P_rng('I:mount', 'wrist', -2.8, 2.8, hl, hl + 0.6, 1.0, 4.4, { mass: 6 }));
    add(P_rng('I:arm', 'clawArm', -0.8, 0.8, hl + 0.6, hl + 3.4, 3.4, 4.2, { mass: 8 }));
    add(P_rng('I:wrist', 'wrist', -2.6, 2.6, hl + 3.4, hl + 4.0, 1.0, 4.2, { mass: 6 }));
    add(P_rng('I:fingerL', 'finger', -2.6, -2.0, hl + 4.0, hl + 6.4, 0.4, 2.6, { mass: 4 }));
    add(P_rng('I:fingerR', 'finger', 2.0, 2.6, hl + 4.0, hl + 6.4, 0.4, 2.6, { mass: 4 }));
    add(P_rng('I:motor', 'intakeMotor', 2.8, 4.8, hl, hl + 4.5, 0.8, 4.3));
  } else { // conveyor
    const F = [hl + 3.4, 0.7], K = [hl - 3.6, 8.6];
    add(P_pitch('I:belt', 'belt', 0, F, K, 5.0, 0.6, 0, { mass: 25 }));
    add(P_pitch('I:guideL', 'guide', -2.75, F, K, 0.5, 1.4, 0.9, { mass: 6 }));
    add(P_pitch('I:guideR', 'guide', 2.75, F, K, 0.5, 1.4, 0.9, { mass: 6 }));
    const ly = hl - 2.2, lz = F[1] + (F[0] - ly) / (F[0] - K[0]) * (K[1] - F[1]) - 0.5;
    add(P_rng('I:legL', 'leg', -2.95, -2.45, ly - 0.25, ly + 0.25, ZTOP, lz, { mass: 3 }));
    add(P_rng('I:legR', 'leg', 2.45, 2.95, ly - 0.25, ly + 0.25, ZTOP, lz, { mass: 3 }));
    add(P_rng('I:motor', 'intakeMotor', -5.0, -3.0, K[0] - 2.25, K[0] + 2.25, K[1] - 1.75, K[1] + 1.75));
  }
  return finishMod(P, d, 'intake', false);
}

/* ---------- 브레인 + 배터리 ---------- */
function buildBrain(d, T) {
  const o = d.opts, hl = T.L / 2, hw = T.W / 2, P = [];
  const add = p => (P.push(p), p);
  if (!o.brain) {
    add(P_rng('B:ph', 'phBrain', -4.5, 4.5, -(hl + 3.6), -(hl + 0.5), 1.4, 7.4, { ph: true, mass: 300 }));
  } else if (o.brain === 'side') {
    add(P_rng('B:battery', 'battery', hw + 0.5, hw + 1.7, -2.5, 2.5, 2.0, 5.2));
    add(P_rng('B:brain', 'brain', hw + 1.7, hw + 4.1, -4.5, 4.5, 1.4, 7.4));
  } else if (o.brain === 'back') {
    add(P_rng('B:battery', 'battery', -2.5, 2.5, -(hl + 1.7), -(hl + 0.5), 2.0, 5.2));
    add(P_rng('B:brain', 'brain', -4.5, 4.5, -(hl + 4.1), -(hl + 1.7), 1.4, 7.4));
  } else {
    add(P_rng('B:battery', 'battery', -1.6, 1.6, -8.5, -3.5, ZTOP, ZTOP + 1.2));
    add(P_rng('B:brain', 'brain', -3.0, 3.0, -9.5, -0.7, ZTOP + 1.2, ZTOP + 3.6));
  }
  return finishMod(P, d, 'brain', false);
}

/* ---------- 직접 추가한 부품 ---------- */
function buildCustom(d) {
  const out = [];
  for (const id of Object.keys(d.added || {})) {
    const a = d.added[id];
    if (!a || !a.c || !a.s) continue;
    const def = ADDABLE.find(x => x.kind === a.kind) || ADDABLE[ADDABLE.length - 1];
    let p;
    if (def.cyl) p = P_cyl('C:' + id, a.kind, a.c.slice(), 'x', Math.max(0.2, a.s[1] / 2), Math.max(0.25, a.s[0]));
    else p = P_box('C:' + id, a.kind, a.c.slice(), a.s.map(v => Math.max(0.25, v)));
    p.group = 'custom'; p.mod = null; p.cid = id; p.name = a.name || KIND[a.kind].name;
    p.ph = a.kind === 'cBox';
    if (def.mass) p.mass = def.mass;
    out.push(p);
  }
  return out;
}

/* ---------- 조립 ---------- */
function unitOfPart(p) {
  if (!p) return null;
  if (p.mod) return { type: 'mod', mod: p.mod, id: 'mod:' + p.mod };
  if (p.group === 'custom') return { type: 'custom', cid: p.cid, id: 'c:' + p.cid };
  return { type: 'drive', key: p.key, id: 'd:' + p.key };
}
function partInUnit(p, u) {
  if (!u) return false;
  if (u.type === 'mod') return p.mod === u.mod;
  if (u.type === 'custom') return p.cid === u.cid;
  return p.key === u.key;
}
function buildRobot(design, drag) {
  const d = normDesign(design);
  const T = orientT(d);
  const parts = [], hidden = [];
  buildDrive(d, T, parts, hidden);
  parts.push(...buildLauncher(d, T), ...buildIntake(d, T), ...buildBrain(d, T), ...buildCustom(d));
  if (drag && drag.unit && (drag.delta[0] || drag.delta[1] || drag.delta[2])) {
    for (const p of parts) if (partInUnit(p, drag.unit)) shiftPart(p, drag.delta);
  }
  for (const p of parts) { p.mass = massFor(p); p.bb = aabb(p); }
  return { parts, hidden, T, design: d, byKey: new Map(parts.map(p => [p.key, p])) };
}

/* ---------- 이름 ---------- */
function faceWord(face, T) {
  if (face !== 'A' && face !== 'B') return '';
  if (T.decided) return face === T.top ? '윗면' : '밑면';
  return face + '면';
}
function partName(p, T) {
  if (!p) return '';
  if (p.group === 'custom') return p.name || KIND[p.kind].name;
  const base = (KIND[p.kind] && KIND[p.kind].name) || p.kind;
  if (p.group !== 'drive') {
    if (['slingFrame', 'pivotTower', 'liftTower', 'intakeArm', 'finger', 'guide', 'stopPost', 'leg'].includes(p.kind))
      return base + (p.c[0] < 0 ? ' (왼쪽)' : ' (오른쪽)');
    return base;
  }
  const t = p.tags || {}, bits = [];
  if (t.row === 'M1' || t.row === 'M2') {
    if (T.decided) bits.push(p.c[1] >= 0 ? '가운데 앞줄' : '가운데 뒷줄');
    else bits.push('가운데 ' + (t.row === 'M1' ? '1' : '2') + '줄');
  } else if (t.end) {
    if (T.decided) bits.push(p.c[1] > 0 ? '앞' : '뒤');
    else bits.push('끝' + t.end);
  }
  if (t.side) {
    if (T.decided) bits.push(p.c[0] < 0 ? '왼쪽' : '오른쪽');
    else bits.push(t.side === 'L' ? '왼쪽' : '오른쪽');
  }
  const f = faceWord(t.face, T);
  if (f && p.kind !== 'centerBeam') bits.unshift(f);
  if (p.kind === 'centerBeam' && f) bits.push(f);
  return bits.length ? `${base} (${bits.join(' · ')})` : base;
}
function unitName(u, robot) {
  if (!u) return '';
  if (u.type === 'mod') return MODS[u.mod].label;
  if (u.type === 'custom') { const p = robot.parts.find(q => q.cid === u.cid); return p ? p.name : '추가한 부품'; }
  const p = robot.byKey.get(u.key);
  if (p) return partName(p, robot.T);
  const h = robot.hidden.find(x => x.key === u.key);
  return h ? partName(Object.assign({ c: [0, 0, 0], group: 'drive' }, h), robot.T) : u.key;
}

/* ---------- 말로 된 방향 ---------- */
const fmtN = n => { const v = Math.round(n * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); };
function vecWords(v) {
  const w = [];
  if (v[1]) w.push((v[1] > 0 ? '앞 ' : '뒤 ') + fmtN(Math.abs(v[1])) + '칸');
  if (v[0]) w.push((v[0] > 0 ? '오른쪽 ' : '왼쪽 ') + fmtN(Math.abs(v[0])) + '칸');
  if (v[2]) w.push((v[2] > 0 ? '위 ' : '아래 ') + fmtN(Math.abs(v[2])) + '칸');
  return w.join(' · ') || '제자리';
}
const inch = k => fmtN(k * IN_PER);
const mm = k => Math.round(k * MM_PER);
