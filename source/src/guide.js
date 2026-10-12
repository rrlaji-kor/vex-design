/* =========================================================
   만드는 법: 고른 옵션대로 조립 순서 · 부품 · 요령 · 규칙
   - 칸 수는 앱 모델 크기로 어림한 값 (1칸 = 구멍 간격 12.7mm)
   - 부품 이름은 VEX IQ (2nd gen) 키트 이름 + 영어 이름(부품 포스터용)
   - 규칙은 VIQRC 2026-27 Level Up 매뉴얼 R 규칙 기준
   ========================================================= */
const HERO = {
  i3d: 'https://link.vex.com/docs/26-27/viqrc/hero-robot-instructions',
  pdf: 'https://link.vex.com/docs/26-27/viqrc/hero-robot-instructions-pdf',
  parts: 'https://docs.google.com/spreadsheets/d/134rXfE9KyW5ffhzk2MDPSEsMF4Amvvg5eddhcFC66zA/edit?usp=sharing',
  lab: 'https://education.vex.com/stemlabs/iq/competition-101-vex-iq-level-up',
};
const BEAM1 = [2, 4, 5, 6, 8, 10, 12, 16];
function beamName(n) {
  const k = Math.max(2, Math.round(n));
  const b = BEAM1.find(x => x >= k);
  return b ? `1x${b} 빔` : `2x${k <= 18 ? 18 : 20} 빔`;
}
const beamEn = n => beamName(n).replace(' 빔', ' Beam');
const pt = (n, q, en) => ({ n, q, en: en || '' });
const MOTOR_KINDS = ['motor', 'launchMotor', 'liftMotor', 'intakeMotor', 'cMotor'];
/* 예상 시간(분): VEX IQ를 어느 정도 해 본 아이 + 돕는 어른 한 명 기준 어림 */
const EST = {
  prep: [20, 30], drive: [10, 15],
  'brain-side': [15, 25], 'brain-back': [15, 25], 'brain-top': [20, 30],
  'roller-arm': [15, 20], 'roller-bar': [20, 30], 'roller-motor': [15, 20], 'roller-test': [15, 30],
  'claw-base': [15, 20], 'claw-finger': [30, 40], 'claw-motor': [10, 15], 'claw-test': [15, 20],
  'conv-guide': [25, 35], 'conv-belt': [45, 60], 'conv-motor': [15, 20], 'conv-test': [20, 30],
  'sl-base': [15, 20], 'sl-rail': [30, 45], 'sl-post': [20, 30], 'sl-pocket': [20, 30], 'sl-band': [10, 15],
  'sl-winch': [100, 160], 'sl-rack': [100, 160], 'sl-cam': [30, 45], 'sl-test': [30, 60],
  'ca-base': [15, 20], 'ca-pivot': [20, 30], 'ca-arm': [30, 40], 'ca-stop': [20, 30], 'ca-band': [10, 15], 'ca-cam': [30, 45], 'ca-test': [30, 60],
  'li-tower': [30, 45], 'li-carriage': [30, 45], 'li-motor': [45, 60], 'li-test': [30, 45],
  wire: [20, 30],
};
const SPEEDS = [['first', '처음', 1.6], ['normal', '보통', 1], ['skilled', '익숙함', 0.6], ['mine', '우리 기록', null]];
function buildRecords() {   // 모든 구상안에서 적어 둔 실제 시간 ÷ 예상 시간
  const out = [];
  for (const m of Object.values(S.prefs.buildTime || {})) for (const r of Object.values(m || {})) if (r && r.m > 0 && r.e > 0) out.push(r.m / r.e);
  return out.sort((a, b) => a - b);
}
function speedFactor() {
  const sp = S.prefs.buildSpeed || 'normal';
  if (sp === 'mine') {
    const r = buildRecords();
    if (!r.length) return 1;
    const med = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2;
    return clamp(med, 0.3, 3);
  }
  const s = SPEEDS.find(x => x[0] === sp);
  return s && s[2] ? s[2] : 1;
}
const r5 = n => Math.max(5, Math.round(n / 5) * 5);
const hHalf = n => Math.max(0.5, Math.round(n / 30) / 2);
function fmtDur(lo, hi) {
  lo = r5(lo); hi = Math.max(lo, r5(hi));
  if (hi < 60) return lo === hi ? `${lo}분` : `${lo}~${hi}분`;
  if (lo < 60) return `${lo}분~${hHalf(hi)}시간`;
  const a = hHalf(lo), b = hHalf(hi);
  return a === b ? `${a}시간` : `${a}~${b}시간`;
}
const RULE_BAND = '고무줄은 VEX IQ 실리콘 고무줄이나, 길이 7.5인치·폭 0.25인치 이하 고무줄만 쓸 수 있어요(R14).';
const RULE_MOD = '부품을 자르거나 깎거나 붙이면 안 돼요. 금속 축 자르기, 고무줄·로프 매듭은 괜찮아요(R17).';

function guideMotors(R) {
  const m = R.parts.filter(p => MOTOR_KINDS.includes(p.kind));
  return { all: m, drive: m.filter(p => p.kind === 'motor').length, intake: m.some(p => p.kind === 'intakeMotor'),
    launch: m.some(p => p.kind === 'launchMotor' || p.kind === 'liftMotor'), custom: m.filter(p => p.kind === 'cMotor').length };
}

/* 단계 목록: [{ id, title, steps: [{ id, title, keys, parts, how, tip, rule, warn, pick }] }] */
function buildGuide(design, R) {
  const d = normDesign(design), o = d.opts, W = d.frame.w, L = d.frame.l;
  const keys = (...ks) => ks.flat().filter(k => R.byKey.has(k));
  const sz = (k, i) => { const p = R.byKey.get(k); return p ? p.s[i] : 0; };
  const bands = R.parts.filter(p => p.kind === 'band').map(p => p.key);
  const M = guideMotors(R), nM = M.all.length;
  const G = [];
  const pick = (what, k) => ({ id: 'pick-' + k, title: `${what} 고르기`, keys: keys(k === 'launch' ? 'L:ph' : k === 'intake' ? 'I:ph' : 'B:ph'),
    parts: [], how: [`아직 ${what}를 안 골랐어요. 조합 탭에서 고르면 여기에 만드는 순서가 나와요.`], pick: true });

  /* ---------- 준비 ---------- */
  const mBits = [`바퀴 ${M.drive}개`];
  if (M.intake) mBits.push('인테이커 1개');
  if (M.launch) mBits.push(o.launch === 'lift' ? '들어 올리는 장치 1개' : '발사부 1개');
  if (M.custom) mBits.push(`직접 추가 ${M.custom}개`);
  G.push({ id: 'g-prep', title: '준비', steps: [
    { id: 'prep', title: '시작 전에 준비하기', keys: [],
      parts: [pt('핀 도구', 1, 'Pin Tool')],
      how: [
        '부품을 종류별로 나눠 두세요: 빔, 판, 핀, 축·칼라, 기어, 전기 부품. VEX IQ 부품 포스터(영어 이름)를 옆에 두면 찾기 쉬워요.',
        '핀은 손으로 꾹 눌러 끼우고, 뺄 때는 **핀 도구**를 써요.',
        `이 구상안은 스마트 모터를 **${nM}개** 써요: ${mBits.join(' + ')}. 대회 규칙상 모터는 6개까지예요(R9).`,
      ],
      warn: nM > 6 ? `모터가 ${nM}개라 규칙(6개까지)을 넘어요. 바퀴 모터를 2개로 줄이거나(체인·기어로 앞뒤 바퀴 묶기) 장치를 합쳐야 해요.` : '',
      tip: '처음이라면 아래 공식 로봇 Flop 설명서를 한 번 따라 해 보세요. 부품이 어떻게 이어지는지 금방 익혀요.',
      rule: '대회 로봇은 VEX IQ 부품으로만 만들어요(R12). ' + RULE_MOD },
    { id: 'drive', title: '드라이빙보드 점검', keys: R.parts.filter(p => p.group === 'drive' && (p.kind === 'omni' || p.kind === 'motor')).map(p => p.key),
      parts: [],
      how: [
        '바퀴 4개를 손으로 밀어 부드럽게 굴러가는지 봐요. 뻑뻑하면 칼라가 너무 꽉 조였거나 바퀴가 빔에 닿는 거예요.',
        `모터 ${M.drive}개의 선(스마트 케이블)을 브레인 몇 번 포트에 꽂을지 정해서 종이에 적어 둬요. 코딩할 때 필요해요.`,
        `프레임 위에서 발사부·브레인을 핀으로 고정할 빈 구멍 줄을 찾아 둬요. 이 구상안 프레임은 가로 ${W}칸 × 세로 ${L}칸이에요.`,
      ],
      tip: '실제 프레임 칸 수가 다르면 부품 탭의 "프레임 칸 수"부터 고쳐요. 그래야 아래 부품 길이가 맞게 나와요.' },
  ] });

  /* ---------- 브레인 ---------- */
  if (!o.brain) G.push({ id: 'g-brain', title: '브레인', steps: [pick('브레인 위치', 'brain')] });
  else {
    const where = {
      side: ['로봇 오른쪽 옆면에 2x 빔을 세로로 세워 받침을 만들고, 브레인 둘레의 핀 구멍과 핀으로 이어요.', '옆면'],
      back: ['로봇 뒤쪽 끝에 세로 받침 빔 두 개를 세우고 브레인을 세워서 붙여요.', '뒤쪽'],
      top: ['프레임 위에 2x 스탠드오프 4개를 세우고 그 위에 빔 두 줄을 깔아 브레인을 눕혀 붙여요. 아래로 선이 지나갈 틈이 생겨요.', '위쪽'],
    }[o.brain];
    G.push({ id: 'g-brain', title: '브레인', steps: [
      { id: 'brain-' + o.brain, title: `브레인·배터리 달기 (${where[1]})`, keys: keys('B:brain', 'B:battery'),
        parts: [pt('브레인 (2세대)', 1, 'Robot Brain'), pt('배터리 (2세대)', 1, 'Robot Battery'), pt('2x8 빔', 2, '2x8 Beam'),
          pt('2x 스탠드오프', o.brain === 'top' ? 4 : 2, '2x Pitch Standoff'), pt('1x2 커넥터 핀', 6, '1x2 Connector Pin')],
        how: ['배터리를 브레인 뒤쪽 배터리 칸에 끼워요.', where[0],
          '화면과 전원 버튼이 보이고, 배터리를 분해하지 않고 뺄 수 있게 달아요(R7 권장).'],
        tip: '브레인은 배터리까지 합치면 무거워서 무게중심을 많이 바꿔요. 다 달고 나면 경고 탭에서 무게중심을 확인하세요.',
        rule: '브레인은 1개, 배터리는 VEX IQ 배터리 1개만 쓸 수 있어요(R6·R10).' },
    ] });
  }

  /* ---------- 인테이커 ---------- */
  const span = Math.max(4, Math.round(W - 7));
  if (!o.intake) G.push({ id: 'g-intake', title: '인테이커', steps: [pick('인테이커', 'intake')] });
  else if (o.intake === 'roller') G.push({ id: 'g-intake', title: '인테이커 (롤러)', steps: [
    { id: 'roller-arm', title: '롤러를 걸 팔 두 개', keys: keys('I:armL', 'I:armR'),
      parts: [pt(beamName(5), 2, beamEn(5)), pt('1x2 커넥터 핀', 4, '1x2 Connector Pin'), pt('3x5 직각 빔', 2, '3x5 Right Angle Beam')],
      how: ['프레임 앞쪽 양 모서리에 빔을 붙여 앞으로 약 4칸 튀어나온 팔 두 개를 만들어요.',
        '두 팔의 축 구멍이 정확히 마주 봐야 롤러 축이 꼬이지 않아요. 축을 끼워 보고 손으로 돌려 확인해요.'] },
    { id: 'roller-bar', title: '롤러 만들기', keys: keys('I:roller'),
      parts: [pt(`금속 축 (약 ${span + 2}칸)`, 1, 'Pitch Shaft'), pt('인테이크 플랩', 6, 'Intake Flap'), pt('고무 축 칼라', 2, 'Rubber Shaft Collar'), pt('0.25x 축 스페이서', 4, 'Shaft Spacer')],
      how: [`두 팔 사이(약 ${span}칸)를 가로지르는 금속 축에 **인테이크 플랩**이나 트랙션 링크를 끼워 롤러를 만들어요. 날개가 빈백을 긁어서 안으로 밀어 넣어요.`,
        '롤러 높이는 바닥에서 빈백 높이의 절반쯤이 잘 빨려 들어와요.',
        '축 양끝은 고무 축 칼라로 막아 빠지지 않게 해요.'],
      tip: '맞는 길이의 축이 없으면 긴 금속 축을 잘라 써도 돼요(R17 허용). V5용 ⅛인치 금속 축도 쓸 수 있어요(R14).' },
    { id: 'roller-motor', title: '롤러 모터 달기', keys: keys('I:motor'),
      parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('36T 기어', 1, '36 Tooth Gear'), pt('12T 기어', 1, '12 Tooth Gear'), pt('모터 축', 1, 'Motor Shaft'), pt('스마트 케이블', 1, 'Smart Cable')],
      how: ['모터를 한쪽 팔 바깥에 붙이고, 모터 축에 36T 기어, 롤러 축에 12T 기어를 끼워 맞물려요. 롤러가 모터보다 3배 빨리 돌아요.',
        '두 기어가 딱 맞물리는 구멍 간격을 찾아 끼워요. 너무 붙거나 떨어지면 이가 튀어요.'] },
    { id: 'roller-test', title: '빨아들이기 시험', keys: keys('I:roller', 'I:armL', 'I:armR'),
      parts: [],
      how: ['빈백을 앞에 두고 모터를 돌려 보세요. 잘 안 들어오면 롤러를 1칸 낮추거나 날개를 더 달아요.',
        '빈백 두 개가 한꺼번에 들어오면 규칙 위반이에요(한 번에 1개). 입구 폭을 빈백 1개만큼으로 좁혀요.'] },
  ] });
  else if (o.intake === 'claw') G.push({ id: 'g-intake', title: '인테이커 (집게)', steps: [
    { id: 'claw-base', title: '집게 받침 만들기', keys: keys('I:mount', 'I:arm', 'I:wrist'),
      parts: [pt('2x6 빔', 2, '2x6 Beam'), pt(beamName(4), 2, beamEn(4)), pt('1x2 커넥터 핀', 6, '1x2 Connector Pin')],
      how: ['프레임 앞에 가로 빔을 대고, 그 위에 앞으로 약 3칸 뻗는 팔을 달아 집게를 받칠 손목을 만들어요.'] },
    { id: 'claw-finger', title: '손가락 두 개', keys: keys('I:fingerL', 'I:fingerR'),
      parts: [pt('36T 기어', 2, '36 Tooth Gear'), pt(beamName(6), 2, beamEn(6)), pt('트랙션 링크', 4, 'Traction Link'), pt('고무 축 칼라', 4, 'Rubber Shaft Collar')],
      how: ['같은 크기 기어 두 개를 맞물리고 각 기어에 손가락 빔을 붙여요. 한쪽이 돌면 다른 쪽이 반대로 돌아서 같이 오므려요.',
        '손가락 안쪽에 트랙션 링크를 붙이면 빈백이 덜 미끄러져요.'] },
    { id: 'claw-motor', title: '집게 모터 달기', keys: keys('I:motor'),
      parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('모터 축', 1, 'Motor Shaft'), pt('스마트 케이블', 1, 'Smart Cable')],
      how: ['모터 축을 한쪽 손가락 기어에 바로 끼워요.'],
      tip: '빈백을 꽉 쥔 채 오래 있으면 모터가 뜨거워져요. 코드에서 잡는 힘(토크)을 줄여요.' },
    { id: 'claw-test', title: '집기 시험', keys: keys('I:fingerL', 'I:fingerR'),
      parts: [],
      how: ['빈백을 집어 들고 로봇을 흔들어도 안 떨어지는지 봐요. 빈백이 말랑해서 손가락을 너무 벌리면 놓쳐요.'] },
  ] });
  else G.push({ id: 'g-intake', title: '인테이커 (컨베이어)', steps: [
    { id: 'conv-guide', title: '비스듬한 가이드', keys: keys('I:guideL', 'I:guideR', 'I:legL', 'I:legR'),
      parts: [pt('2x12 빔', 2, '2x12 Beam'), pt('45° 각도 빔', 2, '45° Angle Beam'), pt(beamName(5), 2, beamEn(5)), pt('1x2 커넥터 핀', 8, '1x2 Connector Pin')],
      how: ['앞 바닥에서 뒤쪽 위로 올라가는 비스듬한 가이드 두 개를 세우고, 다리 빔으로 받쳐 각도를 고정해요.'] },
    { id: 'conv-belt', title: '벨트 걸기', keys: keys('I:belt'),
      parts: [pt('16T 스프로킷', 4, '16 Tooth Sprocket'), pt('금속 축', 2, 'Pitch Shaft'), pt('체인 링크', '약 60', 'Chain Link'), pt('트랙션 링크·인테이크 플랩', 6, 'Traction Link / Intake Flap')],
      how: ['위·아래 축에 스프로킷을 두 개씩 끼우고, 체인 링크를 이어 벨트 두 줄을 걸어요. 체인 한 줄 길이는 위아래 축 거리의 두 배보다 조금 길게요.',
        '체인 사이사이에 트랙션 링크나 플랩을 끼우면 빈백을 실어 올려요.'] },
    { id: 'conv-motor', title: '컨베이어 모터 달기', keys: keys('I:motor'),
      parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('모터 축', 1, 'Motor Shaft'), pt('스마트 케이블', 1, 'Smart Cable')],
      how: ['위쪽 축에 모터를 연결해요. 벨트가 너무 느리면 기어로 속도를 올려요.'] },
    { id: 'conv-test', title: '실어 올리기 시험', keys: keys('I:belt'),
      parts: [],
      how: ['빈백을 앞에 두고 돌려서 위까지 올라가는지 봐요.',
        '벨트 위에 빈백이 2개 이상 올라가면 규칙 위반이에요(한 번에 1개). 입구에서 하나씩만 들어오게 막는 문을 달아요.'] },
  ] });

  /* ---------- 발사부 · 들어 올리는 장치 ---------- */
  if (!o.launch) G.push({ id: 'g-launch', title: '발사부', steps: [pick('발사 방식', 'launch')] });
  else if (SLING(o.launch)) {
    const down = o.launch === 'sling_down';
    const railLen = sz('L:rail', 1) || (down ? 9.5 : 11), postH = sz('L:postL', 2) || 9;
    const ang = [30, 45, 60].reduce((a, b) => (Math.abs(b - o.rail) < Math.abs(a - o.rail) ? b : a));
    const steps = [
      { id: 'sl-base', title: '발사부 받침판', keys: keys('L:base'),
        parts: [pt('4x8 판', 2, '4x8 Plate'), pt('2x 스탠드오프', 4, '2x Pitch Standoff'), pt('1x1 커넥터 핀', 8, '1x1 Connector Pin')],
        how: ['프레임 가운데 위에 판을 깔아 발사부 바닥을 만들어요. 바퀴 모터와 닿지 않게 스탠드오프로 살짝 띄워요.'] },
      { id: 'sl-rail', title: `레일 (${o.rail}°)`, keys: keys('L:rail', 'L:railsup'),
        parts: [pt(beamName(railLen), 2, beamEn(railLen)), pt(`${ang}° 각도 빔`, 2, `${ang}° Angle Beam`), pt('2x 스탠드오프', 2, '2x Pitch Standoff')],
        how: [`빔 두 개를 나란히 놓아 포켓이 미끄러질 레일을 만들어요(길이 약 ${Math.round(railLen)}칸).`,
          `레일을 바닥에서 **${o.rail}°** 세워요. 30°·45°·60° 각도 빔을 쓰면 각도 맞추기가 쉬워요.`,
          '레일 아래쪽 끝은 스탠드오프로 받쳐 흔들리지 않게 해요.'] },
      { id: 'sl-post', title: '새총 틀 (기둥 두 개)', keys: keys('L:postL', 'L:postR'),
        parts: [pt(beamName(postH), 2, beamEn(postH)), pt(beamName(6), 1, beamEn(6)), pt('1x2 커넥터 핀', 6, '1x2 Connector Pin')],
        how: ['레일 앞쪽 양옆에 기둥 두 개를 세워요.', '고무줄이 세게 당기니 기둥 꼭대기를 가로 빔으로 서로 묶어야 안 휘어요.'] },
      { id: 'sl-pocket', title: '포켓 (빈백 1개 자리)', keys: keys('L:pocket', 'L:bag'),
        parts: [pt('4x4 판', 1, '4x4 Plate'), pt(beamName(4), 2, beamEn(4)), pt('1x1 커넥터 핀', 6, '1x1 Connector Pin')],
        how: ['빈백 1개가 딱 들어가는 판에 낮은 벽을 둘러 포켓을 만들어요. 규칙상 빈백은 한 번에 1개만 가질 수 있어요.',
          '포켓이 레일 위를 걸림 없이 미끄러지는지 손으로 밀어 봐요. 꽉 끼면 안 날아가요.'] },
      { id: 'sl-band', title: `고무줄 ${o.bands}개 걸기`, keys: keys(bands, 'L:postL', 'L:postR'),
        parts: [pt('고무줄', o.bands, 'Silicone Rubber Band'), pt('고무줄 앵커', 2, 'Rubber Band Anchor')],
        how: [`틀 꼭대기 양쪽과 포켓 뒤쪽 사이에 고무줄 ${o.bands}개를 걸어요.`, '고무줄 앵커나 스탠드오프 끝에 걸면 잘 안 빠져요.'],
        rule: RULE_BAND },
    ];
    const free = '걸쇠를 풀 방법도 정해야 해요. 모터가 6개로 꽉 차면(바퀴 4 + 인테이커 1 + 발사부 1) 따로 풀 모터가 없어요. ① 같은 발사부 모터로 풀리게 하는 장치를 만들거나, ② VEX IQ 공압 키트의 피스톤으로 풀거나(공압 펌프는 모터 6개 제한에 안 들어가요. 공압 규칙은 R16), ③ 걸쇠가 필요 없는 캠(크랭크) 방식으로 바꿔요. 처음이라면 ③이 가장 쉬워요.';
    if (o.pull === 'rack') steps.push({ id: 'sl-rack', title: '랙기어로 당기기', keys: keys('L:rack', 'L:pinion', 'L:motor', 'L:latch'),
      parts: [pt('랙기어 1x20', 1, 'Linear Motion Rack Gear'), pt('리니어 모션 브래킷', 4, 'Linear Motion Bracket'), pt('12T 기어', 1, '12 Tooth Gear'), pt('스마트 모터', 1, 'Smart Motor'), pt('스마트 케이블', 1, 'Smart Cable')],
      how: ['랙기어는 VEX IQ **리니어 모션 팩**(따로 사는 부품)에 들어 있어요.',
        '레일 옆에 랙을 달고, 모터 축의 12T 기어가 랙 톱니에 맞물려 포켓을 밀고 당기게 해요.', free] });
    else if (o.pull === 'slip') steps.push({ id: 'sl-cam', title: '캠(크랭크)으로 당겼다 놓기', keys: keys('L:slip', 'L:motor'),
      parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('12T 기어', 1, '12 Tooth Gear'), pt('36T 기어', 1, '36 Tooth Gear'), pt('크랭크 팔', 1, 'Crank Arm with 23 Tooth Gear'), pt('1x 스탠드오프', 1, '1x Pitch Standoff'), pt('스마트 케이블', 1, 'Smart Cable')],
      how: ['모터 축에 12T, 크랭크 축에 36T 기어를 맞물려 힘을 3배로 키워요.',
        '크랭크 축에 크랭크 팔(또는 짧은 빔)을 달고, 끝에 스탠드오프를 세워 걸이를 만들어요.',
        '크랭크가 돌면 걸이가 포켓 뒤 고리를 끌고 가다가, 맨 끝을 지나면 고리에서 빠져 포켓이 튀어 나가요. 모터를 한 방향으로 계속 돌리면 다시 걸어서 당겨요.'],
      tip: '크랭크 팔 길이가 당기는 거리를 정해요. 길수록 멀리 당기지만 힘이 더 들어요.',
      rule: '기어 이를 깎아 만드는 슬립기어는 부품 개조라 대회에서 안 돼요(R17). 크랭크 방식은 개조 없이 같은 일을 해요.' });
    else steps.push({ id: 'sl-winch', title: '윈치로 당기기', keys: keys('L:motor', 'L:winch', 'L:string', 'L:latch'),
      parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('스풀', 1, '1x Wide Spool'), pt('로프', 1, 'Pitch Rope'), pt('래칫 + 폴', 1, 'Ratchet + Pawl'), pt('스마트 케이블', 1, 'Smart Cable')],
      how: ['모터 축에 **스풀**을 끼우고 VEX IQ 로프를 감아 포켓 뒤에 묶어요. 매듭은 규칙상 괜찮아요.',
        '포켓을 끝까지 당겼을 때 붙잡아 둘 걸쇠가 필요해요. 래칫과 폴을 쓰면 감긴 로프가 풀리지 않게 잡아 줘요.', free],
      rule: '로프는 VEX IQ 윈치·로프 팩에 든 것만 쓸 수 있어요. 일반 실이나 끈은 안 돼요(R12).' });
    steps.push({ id: 'sl-test', title: '발사 시험', keys: keys('L:pocket', 'L:bag'),
      parts: [],
      how: ['처음엔 고무줄 1~2개로 시작해서 하나씩 늘려요.', '쏘기 전에는 포켓 앞에 손이 없게 하고, 시험할 땐 보안경을 쓰면 더 안전해요.',
        '고무줄 개수마다 얼마나 날아갔는지 적어 두세요. 2차 시뮬레이션에서 실측 보정에 써요.'] });
    G.push({ id: 'g-launch', title: down ? '발사부 (새총 · 아래로 당김)' : '발사부 (새총 · 뒤로 당김)', steps });
  } else if (o.launch === 'catapult') {
    const towerH = sz('L:towerL', 2) || 4;
    G.push({ id: 'g-launch', title: '발사부 (투석기)', steps: [
      { id: 'ca-base', title: '발사부 받침판', keys: keys('L:base'),
        parts: [pt('4x8 판', 2, '4x8 Plate'), pt('2x 스탠드오프', 4, '2x Pitch Standoff'), pt('1x1 커넥터 핀', 8, '1x1 Connector Pin')],
        how: ['프레임 가운데 위에 판을 깔아 발사부 바닥을 만들어요. 바퀴 모터와 닿지 않게 스탠드오프로 살짝 띄워요.'] },
      { id: 'ca-pivot', title: '팔이 도는 축 (기둥 두 개)', keys: keys('L:towerL', 'L:towerR', 'L:pivot'),
        parts: [pt(beamName(towerH), 2, beamEn(towerH)), pt('금속 축 (약 8칸)', 1, 'Pitch Shaft'), pt('고무 축 칼라', 2, 'Rubber Shaft Collar')],
        how: ['받침판 위 양옆에 짧은 기둥 두 개를 세우고, 꼭대기 구멍에 축을 가로질러 끼워요.', '축이 양쪽 기둥에 모두 걸려야 안 휘어요.'] },
      { id: 'ca-arm', title: '팔과 컵', keys: keys('L:arm', 'L:cup', 'L:bag'),
        parts: [pt(beamName(10), 2, beamEn(10)), pt('4x4 판', 1, '4x4 Plate'), pt(beamName(4), 2, beamEn(4)), pt('1x1 커넥터 핀', 8, '1x1 Connector Pin')],
        how: ['빔 두 개(약 10칸)를 나란히 놓고 구멍에 축을 끼우면, 팔이 축을 중심으로 자유롭게 돌아요.',
          '팔 끝에 빈백 1개용 컵(판 + 낮은 벽)을 달아요.'] },
      { id: 'ca-stop', title: `멈춤대 (발사 각도 ${o.rail}°)`, keys: keys('L:stop', 'L:stopL', 'L:stopR', 'L:armStop'),
        parts: [pt(beamName(6), 1, beamEn(6)), pt(beamName(5), 2, beamEn(5)), pt('트랙션 링크', 2, 'Traction Link')],
        how: ['팔이 멈출 가로 막대를 세워요. 멈춤대 위치가 발사 각도를 정해요.', '팔이 부딪히는 자리에 트랙션 링크를 대면 충격이 줄어요.'] },
      { id: 'ca-band', title: `고무줄 ${o.bands}개 걸기`, keys: keys(bands, 'L:anchor'),
        parts: [pt('고무줄', o.bands, 'Silicone Rubber Band'), pt('고무줄 앵커', 2, 'Rubber Band Anchor')],
        how: ['팔 아래쪽과 앞쪽 앵커 사이에 고무줄을 걸어 팔이 위로 튕기게 해요.'],
        rule: RULE_BAND },
      { id: 'ca-cam', title: '캠(크랭크)으로 팔 당겼다 놓기', keys: keys('L:motor', 'L:slip'),
        parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('12T 기어', 1, '12 Tooth Gear'), pt('36T 기어', 1, '36 Tooth Gear'), pt('크랭크 팔', 1, 'Crank Arm with 23 Tooth Gear'), pt('스마트 케이블', 1, 'Smart Cable')],
        how: ['모터 축에 12T, 크랭크 축에 36T 기어를 맞물려 힘을 3배로 키워요.',
          '크랭크가 돌면서 팔을 끌어내리다가, 맨 끝을 지나면 놓아줘서 팔이 튀어 올라요. 모터를 한 방향으로 계속 돌리면 다시 끌어내려요.'],
        rule: '기어 이를 깎아 만드는 슬립기어는 부품 개조라 대회에서 안 돼요(R17).' },
      { id: 'ca-test', title: '발사 시험', keys: keys('L:arm', 'L:cup'),
        parts: [],
        how: ['처음엔 고무줄 1~2개로 시작해서 하나씩 늘려요. 팔이 도는 길에 손이 없게 해요.',
          '고무줄 개수마다 얼마나 날아갔는지 적어 두세요. 2차 시뮬레이션에서 실측 보정에 써요.'] },
    ] });
  } else {
    const towerH = sz('L:towerL', 2) || 13;
    G.push({ id: 'g-launch', title: '들어 올려 넣는 장치', steps: [
      { id: 'li-tower', title: '세로 기둥 두 개', keys: keys('L:towerL', 'L:towerR'),
        parts: [pt(beamName(Math.min(towerH, 16)), 4, beamEn(Math.min(towerH, 16))), pt('리니어 모션 빔·브래킷', '여러 개', 'Linear Motion Beam / Bracket'), pt('1x2 커넥터 핀', 8, '1x2 Connector Pin')],
        how: [`앞쪽 양옆에 높이 약 ${Math.round(towerH)}칸 기둥을 세워요. 빔을 두 겹으로 붙이면 덜 흔들려요.`,
          'VEX IQ 리니어 모션 팩(따로 사는 부품)의 빔과 브래킷을 쓰면 위아래로 부드럽게 미끄러져요.'] },
      { id: 'li-carriage', title: '캐리지와 받침', keys: keys('L:carriage', 'L:tray', 'L:bag'),
        parts: [pt('4x8 판', 1, '4x8 Plate'), pt('4x4 판', 1, '4x4 Plate'), pt(beamName(4), 2, beamEn(4))],
        how: ['기둥을 타고 오르내릴 판(캐리지)을 만들고, 앞에 빈백 받침을 달아요.', '받침을 살짝 뒤로 기울이면 빈백이 덜 미끄러져요.'] },
      { id: 'li-motor', title: '올리는 모터', keys: keys('L:motor'),
        parts: [pt('스마트 모터', 1, 'Smart Motor'), pt('16T 스프로킷', 2, '16 Tooth Sprocket'), pt('체인 링크', '약 40', 'Chain Link'), pt('12T 기어', 1, '12 Tooth Gear'), pt('36T 기어', 1, '36 Tooth Gear'), pt('스마트 케이블', 1, 'Smart Cable')],
        how: ['모터로 체인(스프로킷 + 체인 링크)이나 로프(스풀)를 감아 캐리지를 끌어올려요.', '무게가 꽤 나가니 모터 쪽 12T → 36T 기어로 힘을 3배로 키워요.'],
        tip: '공식 로봇 Flop도 인테이커 + 팔로 들어 올리는 방식이에요. Flop 설명서의 팔 부분이 그대로 참고가 돼요.' },
      { id: 'li-test', title: '올리기 시험', keys: keys('L:carriage', 'L:tray'),
        parts: [],
        how: ['L4 골(약 24인치)까지 올라가는지 봐요.', '끝까지 올렸을 때 로봇이 앞으로 넘어지지 않는지 확인해요. 넘어지면 무거운 부품을 뒤로 옮겨요.'] },
    ] });
  }

  /* ---------- 마무리 ---------- */
  const fin = [];
  const custom = R.parts.filter(p => p.group === 'custom');
  if (custom.length) fin.push({ id: 'custom', title: '직접 추가한 부품', keys: custom.map(p => p.key),
    parts: custom.map(p => pt(p.name, 1)),
    how: [`부품 탭에서 직접 추가한 ${custom.length}개예요: ${custom.map(p => p.name).join(', ')}. 3D에서 자리를 확인하고 달아요.`] });
  fin.push({ id: 'wire', title: '선 연결과 마지막 점검', keys: keys('B:brain', M.all.map(p => p.key)),
    parts: [pt('스마트 케이블', '모터 수만큼', 'Smart Cable')],
    how: ['모터마다 스마트 케이블로 브레인 포트에 연결하고, 포트 번호를 적어 둬요.',
      '선이 바퀴·기어·고무줄에 끼지 않게 정리해요. 묶을 땐 고무줄을 써요.',
      '위 "시작 크기" 버튼으로 11 × 20 × 15인치 상자 안에 들어가는지 보고, 줄자로도 재 봐요.',
      '경기가 끝나면 전원 없이 빈백을 꺼낼 수 있어야 해요(R5).'],
    rule: '케이블 타이는 쓸 수 없고, 테이프는 모터·브레인 이름표로만 돼요(R12·R14).',
    tip: '다 만들면 사진을 찍어 두세요. 나중에 진단 탭에서 쓸 수 있어요.' });
  G.push({ id: 'g-fin', title: '마무리', steps: fin });
  for (const g of G) for (const s of g.steps) {
    s.est = s.pick ? [0, 0] : s.id === 'custom' ? [10 * Math.min(custom.length, 12), 20 * Math.min(custom.length, 12)] : (EST[s.id] || [10, 20]);
    if (s.id === 'sl-winch' || s.id === 'sl-rack') s.timeNote = '걸쇠를 풀 장치를 궁리하는 시간(1~2시간)까지 넣은 값이에요.';
    if (/-test$/.test(s.id)) s.timeNote = '시험과 조정은 팀마다 가장 크게 달라요. 넉넉히 잡으세요.';
  }
  return G;
}

/* ---------- 상태 ---------- */
function guideState() {
  const d = curDesign();
  if (!d || !CUR.robot) return null;
  const G = buildGuide(d, CUR.robot), flat = G.flatMap(g => g.steps);
  const done = ((S.prefs.buildDone || {})[S.curId]) || {};
  return { G, flat, done, open: flat.find(s => s.id === S.ui.buildOpen) || null };
}
/* refresh 때 불러서, 펼친 단계의 부품을 2D·3D에서 강조한다 */
function applyBuildFocus() {
  if (S.tab !== 'build' || !S.ui.buildOpen || !CUR.robot) { S.buildFocus = null; return; }
  const st = guideState();
  S.buildFocus = st && st.open && st.open.keys.length ? st.open.keys : null;
}
function openBuildStep(id, scroll) {
  S.ui.buildOpen = S.ui.buildOpen === id ? null : id;
  applyBuildFocus();
  render2D(); update3D(); renderPanel();
  if (S.buildFocus) focusCam(S.buildFocus); else viewAll();
  if (scroll && S.ui.buildOpen) {
    const el = document.querySelector(`.bstep[data-id="${CSS.escape(S.ui.buildOpen)}"]`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
function stepBuild(dir) {
  const st = guideState(); if (!st) return;
  const i = st.flat.findIndex(s => s.id === S.ui.buildOpen);
  const n = st.flat[Math.max(0, Math.min(st.flat.length - 1, i + dir))];
  if (n && n.id !== S.ui.buildOpen) { S.ui.buildOpen = null; openBuildStep(n.id, true); }
}
function setBuildDone(id, v) {
  const all = S.prefs.buildDone || (S.prefs.buildDone = {});
  const m = all[S.curId] || (all[S.curId] = {});
  if (v) m[id] = Date.now(); else delete m[id];
  savePrefs(); renderPanel();
}
function setBuildTime(id, val) {
  const st = guideState(); if (!st) return;
  const s = st.flat.find(x => x.id === id); if (!s || s.pick) return;
  const all = S.prefs.buildTime || (S.prefs.buildTime = {});
  const m = all[S.curId] || (all[S.curId] = {});
  const v = Math.round(Number(val));
  if (val === '' || val == null || !isFinite(v) || v <= 0) delete m[id];
  else m[id] = { m: Math.min(v, 1440), e: (s.est[0] + s.est[1]) / 2, ts: Date.now() };
  savePrefs(); renderPanel();
}
function setBuildSpeed(v) {
  if (v === 'mine' && !buildRecords().length) return toast('단계에 걸린 시간을 하나 이상 적으면 켜져요');
  S.prefs.buildSpeed = v; savePrefs(); renderPanel();
}
function viewAll() {
  if (typeof fitCam !== 'function' || !V3.ok) return;
  const f = fitCam(false);
  if (f) animCam({ th: V3.cam.th, ph: V3.cam.ph, r: f.r, tgt: f.tgt });
}

/* ---------- 화면 ---------- */
const mdLite = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function partsSummary(flat) {
  const m = new Map();
  for (const s of flat) for (const p of s.parts || []) {
    const k = p.n, cur = m.get(k);
    if (!cur) m.set(k, Object.assign({}, p));
    else cur.q = typeof cur.q === 'number' && typeof p.q === 'number' ? cur.q + p.q : '여러 개';
  }
  return [...m.values()];
}
function htmlBuild() {
  const st = guideState();
  if (!st) return '<div class="empty">구상안을 먼저 만들어 주세요.</div>';
  const { G, flat, done, open } = st;
  const real = flat.filter(s => !s.pick), nDone = real.filter(s => done[s.id]).length;
  const pct = real.length ? Math.round(nDone / real.length * 100) : 0;
  const nRec = buildRecords().length, recs = (S.prefs.buildTime || {})[S.curId] || {};
  const d = curDesign(), f = speedFactor(), sp = S.prefs.buildSpeed === 'mine' && !nRec ? 'normal' : (S.prefs.buildSpeed || 'normal');
  const sumEst = list => list.reduce((a, s) => [a[0] + s.est[0] * f, a[1] + s.est[1] * f], [0, 0]);
  const left = sumEst(real.filter(s => !done[s.id])), all = sumEst(real);
  const ses = [Math.max(1, Math.ceil(left[0] / 120)), Math.max(1, Math.ceil(left[1] / 120))];
  const tline = !real.length ? '' : nDone === real.length ? '<b>다 만들었어요.</b> 시험해 보고 고칠 곳을 찾아보세요.'
    : `<b>남은 시간 약 ${fmtDur(left[0], left[1])}</b> · 2시간씩 ${ses[0] === ses[1] ? ses[0] : `${ses[0]}~${ses[1]}`}번${nDone ? ` <span class="muted">(전체 약 ${fmtDur(all[0], all[1])})</span>` : ''}`;
  let h = `<section class="sec"><div class="sec-h"><h3>만드는 법</h3><span class="aside">${nDone}/${real.length} 단계</span></div>
    <p class="hint">${esc(designSummary(d))}</p>
    <div class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    ${tline ? `<p class="tline">${tline}</p>` : ''}
    <div class="speed"><span>우리 팀 속도</span><span class="seg">${SPEEDS.map(([k, l]) => `<button type="button" data-act="buildSpeed" data-v="${k}" class="${k === sp ? 'on' : ''}" aria-pressed="${k === sp}"${k === 'mine' && !nRec ? ' aria-disabled="true" title="단계에 걸린 시간을 적으면 켜져요"' : ''}>${l}</button>`).join('')}</span>
      ${sp === 'mine' && nRec ? `<span class="muted">기록 ${nRec}개 · 예상의 ${Math.round(f * 100)}%</span>` : ''}</div>
    <p class="hint ex-only">시간은 VEX IQ를 어느 정도 해 본 아이와 돕는 어른 한 명 기준 어림이에요. 처음이면 "처음", 손에 익었으면 "익숙함"을 고르세요. 단계마다 실제 걸린 시간을 적으면 "우리 기록"으로 우리 팀에 맞춰져요.</p>
    <p class="hint ex-only">고른 옵션대로 만드는 순서예요. 단계를 누르면 3D와 도면에서 그 부분이 초록색으로 보여요. 칸 수와 개수는 이 구상안 크기로 어림한 값이라, 실제 부품을 대 보며 맞춰요.</p></section>`;
  h += `<section class="sec hero"><div class="sec-h"><h3>처음이라면: 공식 로봇 Flop</h3></div>
    <p class="hint">VEX가 이번 시즌(Level Up)용으로 낸 로봇이에요. 인테이커로 빈백을 잡고 팔로 들어 올려요. 3D 설명서를 따라 한 번 만들어 보면 부품이 어떻게 이어지는지 익힐 수 있어요.</p>
    <div class="btnrow"><a class="btn sm" href="${HERO.i3d}" target="_blank" rel="noopener">3D 설명서</a><a class="btn sm" href="${HERO.pdf}" target="_blank" rel="noopener">PDF 설명서</a><a class="btn sm" href="${HERO.parts}" target="_blank" rel="noopener">부품 목록</a><a class="btn sm" href="${HERO.lab}" target="_blank" rel="noopener">첫 로봇 수업</a></div></section>`;
  const sum = partsSummary(real);
  if (sum.length) h += `<section class="sec"><details class="plist"><summary><b>준비물</b> · 부품 ${sum.length}가지 (어림)</summary><ul>${sum.map(p =>
    `<li><span class="q">${esc(p.q)}</span><span>${esc(p.n)}${p.en ? ` <small>${esc(p.en)}</small>` : ''}</span></li>`).join('')}</ul></details></section>`;
  let no = 0;
  for (const g of G) {
    const gt = sumEst(g.steps.filter(s => !s.pick));
    h += `<section class="sec"><div class="sec-h"><h3>${esc(g.title)}</h3>${gt[1] > 0 ? `<span class="aside">약 ${fmtDur(gt[0], gt[1])}</span>` : ''}</div><div class="blist">`;
    for (const s of g.steps) {
      const isOpen = open && open.id === s.id, isDone = !!done[s.id];
      if (!s.pick) no++;
      h += `<div class="bstep${isOpen ? ' open' : ''}${isDone ? ' done' : ''}${s.pick ? ' pick' : ''}" data-id="${esc(s.id)}">
        <button class="bs-h" type="button" data-act="buildStep" data-id="${esc(s.id)}" aria-expanded="${!!isOpen}">
          <span class="no">${s.pick ? '?' : isDone ? '✓' : no}</span><span class="tt">${esc(s.title)}${s.pick ? '' : `<small class="tm">약 ${fmtDur(s.est[0] * f, s.est[1] * f)}${recs[s.id] ? ` · 실제 ${recs[s.id].m}분` : ''}</small>`}</span>${s.keys.length ? '<span class="eye" aria-hidden="true">보기</span>' : ''}</button>`;
      if (isOpen) {
        h += '<div class="bs-b">';
        if (s.parts.length) h += `<div class="chips">${s.parts.map(p => `<span class="pchip" title="${esc(p.en)}"><b>${esc(p.q)}</b> ${esc(p.n)}</span>`).join('')}</div>`;
        h += `<ol class="how">${s.how.map(x => `<li>${mdLite(x)}</li>`).join('')}</ol>`;
        if (s.warn) h += `<p class="bnote w"><b>주의</b> ${mdLite(s.warn)}</p>`;
        if (s.rule) h += `<p class="bnote r"><b>규칙</b> ${mdLite(s.rule)}</p>`;
        if (s.tip) h += `<p class="bnote t"><b>요령</b> ${mdLite(s.tip)}</p>`;
        h += '<div class="bs-f">';
        if (s.pick) h += '<button class="btn sm pri" type="button" data-act="go" data-tab="combo">조합 탭으로</button>';
        else h += `<label class="donebox"><input type="checkbox" data-act="buildDone" data-id="${esc(s.id)}" ${isDone ? 'checked' : ''}> 다 했어요</label>`;
        h += `<span class="grow"></span><button class="btn sm" type="button" data-act="buildPrev">이전</button><button class="btn sm pri" type="button" data-act="buildNext">다음</button></div>`;
        if (!s.pick) h += `<div class="trec"><label for="bt-${esc(s.id)}">걸린 시간</label><input type="number" id="bt-${esc(s.id)}" inputmode="numeric" min="1" max="1440" step="5" data-act="buildTime" data-id="${esc(s.id)}" value="${recs[s.id] ? recs[s.id].m : ''}" placeholder="${Math.round((s.est[0] + s.est[1]) / 2)}" aria-label="이 단계에 실제로 걸린 시간(분)"><span>분</span>
          <span class="hint">예상 약 ${fmtDur(s.est[0] * f, s.est[1] * f)}.${s.timeNote ? ' ' + esc(s.timeNote) : ''} 실제 시간을 적어 두면 "우리 기록" 속도에 쓰여요.</span></div>`;
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div></section>';
  }
  h += `<section class="sec"><p class="hint">규칙은 VEX IQ 대회 2026-27 Level Up 매뉴얼의 R 규칙 기준이에요. 매뉴얼이 바뀔 수 있으니 대회 전에 한 번 더 확인하세요.</p>
    ${open ? '<button class="btn sm" type="button" data-act="buildAll">단계 닫고 전체 보기</button>' : ''}</section>`;
  return h;
}
