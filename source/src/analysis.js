/* =========================================================
   자동 검사: 겹침 · 무게중심 · 시작 크기 · 옵션 조합 · 바닥
   ========================================================= */
function rectYZ(p, eps) {
  const t = (p.rx || 0) * Math.PI / 180;
  return { u: [Math.cos(t), Math.sin(t)], v: [-Math.sin(t), Math.cos(t)],
    hy: Math.max(0, p.s[1] / 2 - eps), hz: Math.max(0, p.s[2] / 2 - eps) };
}
/* 모든 회전이 x축 기준이라 x 구간 + y-z 평면 사각형 겹침으로 충분하다 */
function obbOverlap(a, b, eps) {
  eps = eps == null ? 0.03 : eps;
  if (Math.abs(a.c[0] - b.c[0]) >= (a.s[0] / 2 - eps) + (b.s[0] / 2 - eps)) return false;
  const ra = rectYZ(a, eps), rb = rectYZ(b, eps);
  const dy = b.c[1] - a.c[1], dz = b.c[2] - a.c[2];
  for (const ax of [ra.u, ra.v, rb.u, rb.v]) {
    const d = Math.abs(dy * ax[0] + dz * ax[1]);
    const pa = ra.hy * Math.abs(ra.u[0] * ax[0] + ra.u[1] * ax[1]) + ra.hz * Math.abs(ra.v[0] * ax[0] + ra.v[1] * ax[1]);
    const pb = rb.hy * Math.abs(rb.u[0] * ax[0] + rb.u[1] * ax[1]) + rb.hz * Math.abs(rb.v[0] * ax[0] + rb.v[1] * ax[1]);
    if (d >= pa + pb) return false;
  }
  return true;
}
function bbOverlap(a, b) {
  for (let i = 0; i < 3; i++) if (a.max[i] <= b.min[i] || b.max[i] <= a.min[i]) return false;
  return true;
}

const COMBOS = [
  { id: 'conv1', level: 'warn', when: o => o.intake === 'conveyor',
    title: '컨베이어: 빈백 2개를 한꺼번에 가질 위험',
    detail: '벨트 위에 빈백이 2개 이상 올라가면 "한 번에 1개" 규칙(SG6) 위반이에요. 입구에서 하나만 들어오게 막는 장치가 필요해요.' },
  { id: 'claw2', level: 'warn', when: o => o.intake === 'claw' && ['sling_back', 'sling_down', 'catapult'].includes(o.launch),
    title: '집게 → 발사부로 옮기는 동작이 하나 더 필요',
    detail: '집게로 잡은 빈백을 포켓이나 컵까지 옮겨 줄 회전 동작이 필요해요. 그만큼 느려지고 모터도 더 써요.' },
  { id: 'catBand', level: 'warn', when: o => o.launch === 'catapult' && o.bands >= 6,
    title: '투석기에 고무줄이 많아요',
    detail: '고무줄이 많으면 팔이 멈춤대에 세게 부딪혀 부품이 휘거나 빠질 수 있어요. 멈춤대에 고무 같은 완충재를 붙이거나 고무줄을 줄여요.' },
  { id: 'slipBand', level: 'warn', when: o => SLING(o.launch) && o.pull === 'slip' && o.bands >= 6,
    title: '슬립기어 + 고무줄 많음',
    detail: '고무줄 힘이 세면 슬립기어 이빨이 미끄러지거나 모터가 멈출 수 있어요. 고무줄을 줄이거나 다른 당기는 장치를 써요.' },
  { id: 'brainTop', level: 'warn', when: o => o.brain === 'top' && !!o.launch,
    title: '브레인을 위에 두면 발사부와 자리를 다퉈요',
    detail: '발사부가 쓰는 윗면을 브레인이 차지하고, 무게중심도 높아져요. 옆면이나 뒤쪽을 먼저 검토해 보세요.' },
  { id: 'brainBack', level: 'warn', when: o => o.brain === 'back' && o.dir === 'back' && o.launch && o.launch !== 'lift',
    title: '뒤로 쏘는데 브레인이 뒤에 있어요',
    detail: '날아가는 빈백이나 튕기는 고무줄이 브레인에 걸릴 수 있어요. 브레인을 옆면으로 옮기거나 앞으로 쏘게 바꿔요.' },
  { id: 'downFlat', level: 'info', when: o => o.launch === 'sling_down' && o.rail < 55,
    title: '아래로 당기는데 레일이 눕혀져 있어요',
    detail: '이 각도면 "뒤로 당김"에 가까워요. 아래로 당기는 새총은 보통 55° 이상으로 세워요.' },
  { id: 'backSteep', level: 'info', when: o => o.launch === 'sling_back' && o.rail > 65,
    title: '뒤로 당기는데 레일이 많이 서 있어요',
    detail: '높이는 올라가지만 거리가 짧아져요. 가장 멀리 가는 각도는 약 45°예요.' },
  { id: 'roller1', level: 'info', when: o => o.intake === 'roller' && o.launch && o.launch !== 'lift',
    title: '롤러는 포켓이 차면 멈춰야 해요',
    detail: '포켓에 빈백이 있는데 롤러가 하나 더 빨아들이면 규칙 위반(한 번에 1개)이에요. 포켓이 차면 롤러를 멈추게 코드를 짜요.' },
  { id: 'liftRoller', level: 'info', when: o => o.launch === 'lift' && o.intake === 'roller',
    title: '롤러 → 리프트 받침으로 넘겨 줄 길이 필요해요',
    detail: '롤러로 빨아들인 빈백이 리프트 받침 위로 올라가도록 경사판이 필요해요.' },
];

function analyze(robot) {
  const d = robot.design, o = d.opts, T = robot.T;
  const solid = robot.parts.filter(p => !p.ghost && !p.bag);
  const W = [];
  const bb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const p of solid) for (let i = 0; i < 3; i++) { bb.min[i] = Math.min(bb.min[i], p.bb.min[i]); bb.max[i] = Math.max(bb.max[i], p.bb.max[i]); }
  const dims = { w: bb.max[0] - bb.min[0], l: bb.max[1] - bb.min[1], h: bb.max[2] - Math.min(0, bb.min[2]) };
  const short = Math.min(dims.w, dims.l), long = Math.max(dims.w, dims.l);

  // 무게·무게중심
  let M = 0; const s = [0, 0, 0];
  for (const p of solid) { const m = p.mass || 0; M += m; for (let i = 0; i < 3; i++) s[i] += m * p.c[i]; }
  const com = M > 0 ? s.map(v => v / M) : [0, 0, 0];

  // 바퀴 접지
  const wheels = solid.filter(p => p.kind === 'omni' || p.kind === 'cWheel');
  const bottoms = wheels.map(p => p.c[2] - (p.r || p.s[2] / 2));
  const lowB = bottoms.length ? Math.min(...bottoms) : 0;
  const touching = wheels.filter((p, i) => bottoms[i] <= lowB + 0.25);
  let sup = null, ratio = null;
  if (touching.length >= 3) {
    const xs = touching.map(p => p.c[0]), ys = touching.map(p => p.c[1]);
    sup = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const hx = (sup.x1 - sup.x0) / 2, hy = (sup.y1 - sup.y0) / 2;
    const cx = (sup.x0 + sup.x1) / 2, cy = (sup.y0 + sup.y1) / 2;
    const dx = com[0] - cx, dy = com[1] - cy;
    ratio = { x: hx > 0 ? dx / hx : 0, y: hy > 0 ? dy / hy : 0, dx, dy, hx, hy };
    const minArm = Math.min(hx - Math.abs(dx), hy - Math.abs(dy));
    const zc = Math.max(0.5, com[2] - lowB);
    ratio.tip = minArm > 0 ? Math.atan2(minArm, zc) * 180 / Math.PI : 0;
  }

  // 겹침
  const col = solid.filter(p => p.collide !== false && p.shape !== 'line');
  const groups = new Map(), bad = new Set();
  for (let i = 0; i < col.length; i++) for (let j = i + 1; j < col.length; j++) {
    const a = col[i], b = col[j];
    if (a.mod && a.mod === b.mod) continue;
    if (!bbOverlap(a.bb, b.bb) || !obbOverlap(a, b)) continue;
    const la = a.mod ? MODS[a.mod].label : partName(a, T), lb = b.mod ? MODS[b.mod].label : partName(b, T);
    const key = [la, lb].sort().join('|');
    if (!groups.has(key)) groups.set(key, { la, lb, parts: [], keys: new Set(), ph: true });
    const g = groups.get(key);
    if (!a.ph && !b.ph) g.ph = false;
    g.parts.push([partName(a, T), partName(b, T)]);
    g.keys.add(a.key); g.keys.add(b.key); if (!a.ph && !b.ph) { bad.add(a.key); bad.add(b.key); }
  }
  for (const g of groups.values()) {
    const ex = g.parts.slice(0, 3).map(([x, y]) => (x === g.la && y === g.lb) ? null : `${x} ↔ ${y}`).filter(Boolean);
    if (g.ph) W.push({ id: 'ov:' + g.la + g.lb, level: 'warn', title: `자리 겹침: ${g.la} ↔ ${g.lb}`,
      detail: '아직 정하지 않은 부품의 임시 상자와 겹쳐요. 그 부품을 고르면 실제로 겹치는지 다시 확인할 수 있어요.', keys: [...g.keys] });
    else W.push({ id: 'ov:' + g.la + g.lb, level: 'danger', title: `겹침: ${g.la} ↔ ${g.lb}`,
      detail: (ex.length ? ex.join(', ') + '. ' : '') + '같은 자리에 두 부품이 있을 수 없어요. 한쪽을 칸 단위로 옮기거나 옵션을 바꿔 보세요.',
      keys: [...g.keys] });
  }

  // 시작 크기
  const over = [];
  if (short > LIM.w + 1e-6) over.push(`폭 ${inch(short)}in (11in까지)`);
  if (long > LIM.l + 1e-6) over.push(`길이 ${inch(long)}in (20in까지)`);
  if (dims.h > LIM.h + 1e-6) over.push(`높이 ${inch(dims.h)}in (15in까지)`);
  if (over.length) W.push({ id: 'size', level: 'danger', title: '시작 크기 초과: ' + over.join(', '),
    detail: '경기 시작 때 폭 11 × 길이 20 × 높이 15in 상자 안에 들어가야 해요. 접어 두었다가 시작 후 펼치는 구조(길이 24in까지, 높이는 제한 없음)를 생각해 보세요.', tool: 'startBox' });

  // 무게중심
  if (ratio) {
    const rx = Math.abs(ratio.x), ry = Math.abs(ratio.y);
    if (rx >= 1 || ry >= 1) {
      W.push({ id: 'comOut', level: 'danger', title: '무게중심이 바퀴 밖으로 나갔어요',
        detail: '이대로면 로봇이 넘어져요. 무거운 부품(브레인·배터리·모터)을 바퀴 안쪽으로 옮겨 주세요.', com: true });
    } else {
      if (rx >= 0.4) W.push({ id: 'comX', level: rx >= 0.7 ? 'danger' : 'warn',
        title: `무게중심이 ${ratio.x > 0 ? '오른쪽' : '왼쪽'}으로 쏠렸어요 (바퀴 폭의 ${Math.round(rx * 100)}%)`,
        detail: '돌 때 한쪽으로 끌리고, 옆에서 부딪히면 넘어지기 쉬워요. 무거운 부품을 반대쪽이나 가운데로 옮겨 보세요.', com: true });
      if (ry >= 0.45) W.push({ id: 'comY', level: ry >= 0.75 ? 'danger' : 'warn',
        title: `무게중심이 ${ratio.y > 0 ? '앞' : '뒤'}쪽으로 쏠렸어요 (바퀴 사이 거리의 ${Math.round(ry * 100)}%)`,
        detail: ratio.y > 0 ? '급하게 멈추거나 빈백을 들 때 앞으로 넘어질 수 있어요. 무거운 부품을 뒤쪽으로 옮겨 보세요.'
          : '급하게 출발할 때 앞바퀴가 뜨거나 뒤로 넘어질 수 있어요. 무거운 부품을 앞쪽으로 옮겨 보세요.', com: true });
      if (ratio.tip < 30) W.push({ id: 'comZ', level: 'warn', title: '무게중심이 높아요',
        detail: `무게중심 높이 ${inch(com[2])}in. 급정지나 충돌 때 넘어지기 쉬워요. 무거운 부품을 낮게 달아 보세요.`, com: true });
    }
  }

  // 바닥
  const under = solid.filter(p => p.bb.min[2] < -0.05);
  if (under.length) W.push({ id: 'under', level: 'danger', title: '바닥 아래로 내려간 부품이 있어요',
    detail: under.slice(0, 4).map(p => partName(p, T)).join(', ') + '. 위로 올려 주세요.', keys: under.map(p => p.key) });
  const drag = solid.filter(p => p.bb.min[2] >= -0.05 && p.bb.min[2] < lowB + 0.15 && !(p.kind === 'omni' || p.kind === 'cWheel'));
  if (drag.length) W.push({ id: 'drag', level: 'warn', title: '바닥에 끌릴 수 있는 부품이 있어요',
    detail: drag.slice(0, 4).map(p => partName(p, T)).join(', ') + '. 바퀴보다 조금 높게 올려 주세요.', keys: drag.map(p => p.key) });
  const air = wheels.filter((p, i) => bottoms[i] > lowB + 0.25);
  if (air.length) W.push({ id: 'air', level: 'warn', title: `바닥에 안 닿는 바퀴가 ${air.length}개 있어요`,
    detail: air.map(p => partName(p, T)).join(', ') + '. 바퀴 높이를 다른 바퀴와 맞춰 주세요.', keys: air.map(p => p.key) });

  // 옵션 조합
  for (const c of COMBOS) if (c.when(o)) W.push({ id: c.id, level: c.level, title: c.title, detail: c.detail, combo: true });

  // 앞·위
  if (!T.decided) W.push({ id: 'orient', level: 'info', title: '앞·위를 아직 안 정했어요',
    detail: '임시로 A면을 위로, 끝 1을 앞으로 놓고 그렸어요. 조합 탭 첫 단계에서 정할 수 있어요.', go: 'orient' });

  const order = { danger: 0, warn: 1, info: 2 };
  W.sort((a, b) => order[a.level] - order[b.level]);
  return { warnings: W, bad, bb, dims, short, long, M, com, sup, ratio,
    nDanger: W.filter(w => w.level === 'danger').length, nWarn: W.filter(w => w.level === 'warn').length };
}
