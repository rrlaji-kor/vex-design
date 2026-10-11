'use strict';
/* =========================================================
   VEX IQ 로봇 설계 — 데이터(옵션·부품 설명·규칙)
   단위: 1칸 = VEX IQ 구멍 간격 12.7mm = 0.5in
   ========================================================= */
const MM_PER = 12.7;
const IN_PER = 0.5;
const LIM = { w: 22, l: 40, h: 30, expL: 48 };   // 칸 (11in × 20in × 15in, 확장 24in)
const ZTOP = 3.5;                                 // 프레임 윗면 높이(칸)
const AXLE_Z = 2.5;                               // 바퀴 축 높이(칸)

const MODS = {
  launcher: { label: '발사부', cls: 'launcher' },
  intake:   { label: '인테이커', cls: 'intake' },
  brain:    { label: '브레인', cls: 'brain' },
};
const GROUP_LABEL = { drive: '드라이빙보드', launcher: '발사부', intake: '인테이커', brain: '브레인', custom: '추가한 부품' };

/* ---------- 옵션 ---------- */
const OPTS = {
  launch: {
    title: '발사 방식', step: '02',
    choices: [
      { v: 'sling_back', name: '새총 · 뒤로 당김', short: '새총(뒤로 당김)',
        desc: '포켓을 레일을 따라 뒤로 당겼다가 놓으면 고무줄 힘으로 튀어 나가요. 레일 각도가 곧 발사 각도예요.',
        pros: ['각도를 정해 두면 매번 비슷하게 날아가요', '레일 각도로 거리를 맞추기 쉬워요'],
        cons: ['레일이 길어서 위쪽 공간을 많이 써요', '당기는 장치가 큰 힘을 내야 해요'] },
      { v: 'sling_down', name: '새총 · 아래로 당김', short: '새총(아래로 당김)',
        desc: '높은 틀에 건 고무줄을 아래로 끌어 내렸다가 놓아서 위쪽으로 쏴요.',
        pros: ['가파르게 올라가서 높은 골에 떨어뜨리기 좋아요', '로봇 길이를 적게 차지해요'],
        cons: ['틀이 높아져서 시작 높이 15in를 넘지 않게 주의', '무게중심이 높아져요'] },
      { v: 'catapult', name: '투석기 팔', short: '투석기 팔',
        desc: '고무줄로 당긴 팔이 휘둘러 올라가다가 멈춤대에 부딪혀 멈추면 빈백이 날아가요.',
        pros: ['구조가 단순하고 빨리 다시 쏠 수 있어요', '캠(크랭크)으로 당기면 걸쇠가 필요 없어요'],
        cons: ['새총보다 거리·각도를 맞추기 어려워요', '멈출 때 충격이 커서 부품이 헐거워지기 쉬워요'] },
      { v: 'lift', name: '들어 올려 넣기', short: '들어 올려 넣기',
        desc: '쏘지 않고 빈백을 들어 올려서 골에 직접 내려놓아요.',
        pros: ['가장 정확해요', '빈백이 경기장 밖으로 날아갈 일이 없어요'],
        cons: ['골 바로 앞까지 가야 해서 느려요', '높은 골에 닿으려면 리프트가 길어야 해요'] },
    ]
  },
  dir: {
    title: '발사 방향', step: '03',
    choices: [
      { v: 'front', name: '앞', short: '앞',
        desc: '인테이커가 있는 앞쪽으로 쏴요.',
        pros: ['줍고 바로 쏘니 운전이 쉬워요'],
        cons: ['빈백이 인테이커 위를 넘어가야 해요'] },
      { v: 'back', name: '뒤', short: '뒤',
        desc: '인테이커 반대쪽인 뒤쪽으로 쏴요.',
        pros: ['포켓이 인테이커 가까이 와서 빈백 옮기기가 쉬워요'],
        cons: ['쏠 때마다 로봇을 돌려야 해서 운전이 헷갈릴 수 있어요'] },
    ]
  },
  intake: {
    title: '인테이커', step: '04',
    choices: [
      { v: 'roller', name: '롤러', short: '롤러',
        desc: '앞에서 돌아가는 롤러가 바닥의 빈백을 빨아들여요.',
        pros: ['빠르고, 대충 맞춰도 들어와요', '말랑한 빈백에 잘 맞아요'],
        cons: ['모터가 하나 더 필요해요', '두 개를 한꺼번에 빨아들이면 규칙 위반'] },
      { v: 'claw', name: '집게', short: '집게',
        desc: '손가락 두 개로 빈백을 집어요.',
        pros: ['딱 1개만 잡아서 규칙에 안전해요', '들어 올려 넣기와 잘 맞아요'],
        cons: ['느리고, 위치를 정확히 맞춰야 해요'] },
      { v: 'conveyor', name: '컨베이어', short: '컨베이어',
        desc: '비스듬한 벨트가 빈백을 바닥에서 위로 실어 날라요.',
        pros: ['바닥에서 발사부까지 한 번에 올려 줘요'],
        cons: ['부품이 많고 무거워요', '벨트 위에 빈백이 2개 이상 있으면 규칙 위반'] },
    ]
  },
  brain: {
    title: '브레인 위치', step: '05',
    choices: [
      { v: 'side', name: '옆면', short: '옆면',
        desc: '로봇 오른쪽 옆면에 세워서 달아요.',
        pros: ['화면과 포트가 잘 보여요', '위쪽 공간을 발사부에 양보해요'],
        cons: ['무게가 한쪽으로 쏠려요', '옆에서 부딪히면 다칠 수 있어요'] },
      { v: 'back', name: '뒤쪽', short: '뒤쪽',
        desc: '로봇 뒤 끝에 세워서 달아요.',
        pros: ['앞쪽 인테이커 무게와 균형이 맞아요', '선 정리가 쉬워요'],
        cons: ['로봇이 길어져요', '뒤로 쏘면 발사 길을 막을 수 있어요'] },
      { v: 'top', name: '위쪽', short: '위쪽',
        desc: '로봇 위에 눕혀서 달아요.',
        pros: ['가운데라 균형이 좋고 화면이 잘 보여요'],
        cons: ['발사부와 자리를 다퉈요', '무게중심이 높아져요'] },
    ]
  },
  pull: {
    title: '당기는 장치',
    choices: [
      { v: 'winch', name: '윈치', short: '윈치',
        desc: '모터가 로프를 감아서 포켓을 당겨요. 로프는 VEX IQ 윈치·로프 팩에 든 것만 쓸 수 있어요.',
        pros: ['당기는 길이를 자유롭게 정해요', '부품이 적어요'],
        cons: ['로프가 엉킬 수 있어요', '걸쇠와, 그 걸쇠를 풀 방법이 따로 필요해요 (모터는 6개까지)'] },
      { v: 'rack', name: '랙기어', short: '랙기어',
        desc: '톱니가 일자로 붙은 막대(랙)를 모터 기어가 밀고 당겨요. 랙은 VEX IQ 리니어 모션 팩(따로 사는 부품)에 들어 있어요.',
        pros: ['튼튼하고 위치를 정확히 맞춰요'],
        cons: ['랙 길이만큼 공간이 필요해요', '걸쇠와, 그 걸쇠를 풀 방법이 따로 필요해요 (모터는 6개까지)'] },
      { v: 'slip', name: '캠 · 돌다가 놓기', short: '캠(크랭크)',
        desc: '모터에 단 크랭크 팔이 돌면서 포켓을 끌고 가다가, 끝에서 빠져나가며 저절로 놓아줘요. 기어 이를 깎은 슬립기어는 부품 개조라 대회에서 안 돼서 이 방식을 써요.',
        pros: ['걸쇠가 필요 없어요', '모터를 한 방향으로 돌리기만 하면 장전·발사가 반복돼요'],
        cons: ['당기는 거리가 크랭크 팔 길이로 정해져요', '고무줄이 세면 기어로 힘을 키워야 해요 (12T → 36T)'] },
    ]
  },
};
const SLIDERS = {
  bands: { label: '고무줄 개수', min: 1, max: 8, step: 1, unit: '개',
    desc: '많을수록 세게(멀리) 날아가요. 대신 당기는 장치와 틀이 더 큰 힘을 버텨야 해요. 고무줄은 VEX IQ 실리콘 고무줄이나 길이 7.5인치·폭 0.25인치 이하만 쓸 수 있어요(규칙 R14).' },
  rail: { label: '레일 각도', min: 15, max: 85, step: 1, unit: '°',
    desc: '레일이 바닥과 이루는 각도가 곧 발사 각도예요. 45° 근처가 가장 멀리 가고, 더 세우면 높이 올라가요.' },
  railCat: { label: '발사 각도(멈춤대)', desc: '멈춤대 위치가 발사 각도를 정해요. 팔이 멈추는 순간 빈백이 팔과 직각 방향으로 날아가요.' },
};
const SLING = v => v === 'sling_back' || v === 'sling_down';
const optName = (k, v) => { if (v == null) return '미정'; const c = OPTS[k].choices.find(c => c.v === v); return c ? c.short : String(v); };

/* ---------- 부품 설명 ---------- */
const KIND = {
  omni:      { name: '옴니휠', role: '바퀴', vis: 'wheel',
    text: '바퀴 둘레에 작은 롤러가 달린 바퀴예요. 앞뒤로는 보통 바퀴처럼 구르고, 옆으로는 롤러가 굴러서 미끄러져요. 그래서 제자리 회전이 부드러워요. 지름 약 5칸(64mm), 한 바퀴 돌면 약 200mm 가요.' },
  motor:     { name: 'IQ 스마트 모터', role: '바퀴나 장치를 돌리는 힘', vis: 'motor',
    text: '브레인과 선으로 연결하는 모터예요. 안에 각도 센서가 있어서 얼마나 돌았는지 정확히 알아요. 이 드라이빙보드는 바퀴마다 1개씩, 모두 4개를 써요.' },
  shaft:     { name: '축', role: '모터 힘을 바퀴로 전달', vis: 'shaft',
    text: '네모난 금속 막대예요. 네모 구멍(모터, 바퀴)에 끼우면 같이 돌고, 빔의 둥근 구멍에서는 헛돌면서 받쳐져요. 끼우는 순서: 모터 → 축 → 안쪽 빔 → 스페이서 → 바퀴 → 스페이서 → 바깥 빔 → 칼라.' },
  collar:    { name: '칼라', role: '축이 빠지지 않게 잡기', vis: 'shaft',
    text: '축 끝에 끼우는 고리예요. 축이 옆으로 빠지지 않게 잡아 줘요. 너무 꽉 밀어 조이면 바퀴가 뻑뻑해져요.' },
  wallOuter: { name: '바깥 빔', role: '프레임 옆 테두리', vis: 'wall',
    text: '프레임 바깥 테두리예요. 바퀴 축의 바깥쪽 끝을 받쳐서 축이 양쪽에서 지지돼요.' },
  wallInner: { name: '안쪽 빔', role: '바퀴 안쪽 지지', vis: 'wall',
    text: '바퀴 안쪽을 받치는 빔이에요. 바퀴가 안쪽 빔과 바깥 빔 사이에 끼어 있어서 축이 휘지 않아요. 모터가 이 빔 바로 안쪽에 붙어 있어요.' },
  wallEnd:   { name: '끝 빔', role: '프레임 앞뒤 테두리', vis: 'wall',
    text: '프레임 양쪽 끝을 막는 빔이에요. 옆 빔들을 이어서 네모 틀을 만들어요.' },
  cornerConn:{ name: '모서리 코너 연결부', role: '빔끼리 직각으로 연결', vis: 'conn',
    text: '모서리에서 바깥 빔·안쪽 빔·끝 빔을 이어 주는 흰색 연결 부품이에요. 파란 핀으로 고정해요.' },
  connBlock: { name: '흰 연결 블록', role: '판과 빔을 직각으로 연결', vis: 'conn',
    text: '흰색 코너 커넥터예요. 판과 빔을 직각으로 이어 줘요. 파란 핀으로 고정해요.' },
  centerBeam:{ name: '가운데 세로 빔', role: '로봇 가운데 뼈대', vis: 'beam',
    text: '로봇 가운데를 길게 지나는 빔이에요. 가로 연결판들이 여기에 붙어서 프레임이 비틀리지 않게 잡아 줘요.' },
  crossPlate:{ name: '가로 연결판', role: '가운데 빔과 연결 블록 잇기', vis: 'plate',
    text: '가운데 세로 빔과 양옆 흰 연결 블록을 잇는 작은 판이에요.' },
  widePlate: { name: '넓은 판', role: '양쪽 안쪽 빔 잇기', vis: 'plate',
    text: 'B면 가운데를 가로로 지나는 판이에요. 양쪽 안쪽 빔을 이어서 프레임을 단단하게 해요.' },
  smallPlate:{ name: '작은 판', role: '끝 1 쪽 보강', vis: 'plate',
    text: 'B면에서 끝 1 쪽을 가로지르는 작은 판이에요. A면의 흰 연결 블록과 같이 이 부분을 단단하게 잡아요.' },
  // 발사부
  basePlate: { name: '발사부 받침판', role: '발사부를 프레임에 고정', vis: 'plate', text: '발사부 부품들을 프레임 위에 고정하는 판이에요.' },
  slingFrame:{ name: '새총 틀', role: '고무줄을 거는 기둥', vis: 'beam', text: '고무줄을 거는 양쪽 기둥이에요. 높을수록 고무줄을 길게 당길 수 있어요.' },
  band:      { name: '고무줄', role: '튕기는 힘', vis: 'band', text: '늘어났다 돌아오는 힘으로 포켓이나 팔을 튕겨요. 개수가 많을수록 세져요.' },
  pocket:    { name: '포켓', role: '빈백 1개 받침', vis: 'plate', text: '빈백 1개를 담는 받침이에요. 규칙상 로봇은 한 번에 빈백 1개만 가질 수 있어서 1개용으로 만들어요.' },
  rail:      { name: '레일', role: '포켓이 미끄러지는 길', vis: 'beam', text: '포켓이 미끄러지는 길이에요. 레일 각도가 곧 발사 각도예요.' },
  railSup:   { name: '레일 받침', role: '레일 아래쪽 지지', vis: 'beam', text: '레일 아래쪽 끝을 받쳐 주는 블록이에요.' },
  winch:     { name: '윈치(줄 감개)', role: '줄을 감아 당기기', vis: 'shaft', text: '모터 축에 달린 실패예요. 줄을 감아서 포켓을 당겨요.' },
  string:    { name: '줄', role: '윈치와 포켓 연결', vis: 'string', text: '윈치가 감는 줄이에요. 걸쇠가 놓아주면 포켓이 튀어 나가요.' },
  rack:      { name: '랙기어', role: '일자 톱니 막대', vis: 'beam', text: '톱니가 일자로 붙은 막대예요. 모터에 달린 작은 기어(피니언)가 돌면서 밀고 당겨요.' },
  pinion:    { name: '피니언 기어', role: '랙을 움직이는 작은 기어', vis: 'shaft', text: '모터 축에 달린 작은 기어예요. 랙의 톱니와 맞물려 돌아요.' },
  slipGear:  { name: '크랭크(캠)', role: '당기다가 저절로 놓아주기', vis: 'shaft', text: '모터가 돌리는 크랭크 팔이에요. 돌면서 포켓(팔)을 끌고 가다가 끝에서 빠져나가며 저절로 놓아줘서 걸쇠가 필요 없어요. 기어 이를 깎은 슬립기어는 대회 규칙상 안 돼요(부품 개조 금지).' },
  latch:     { name: '걸쇠', role: '당긴 포켓 붙잡기', vis: 'conn', text: '당긴 포켓을 붙잡아 두었다가 놓아주는 고리예요. 래칫과 폴(윈치·로프 팩)로 만들 수 있어요. 캠(크랭크) 방식이면 필요 없어요.' },
  launchMotor:{ name: '발사부 모터', role: '당기는 장치를 돌림', vis: 'motor', text: '당기는 장치(윈치·랙기어·캠)를 돌리는 모터예요.' },
  arm:       { name: '투석기 팔', role: '휘둘러 던지는 팔', vis: 'beam', text: '한쪽 끝이 회전축에 고정된 팔이에요. 끝의 컵에 빈백을 담고 휘둘러 던져요.' },
  armStop:   { name: '팔이 멈춘 위치', role: '참고용 그림', vis: 'ghost', text: '팔이 멈춤대에 닿았을 때의 위치예요. 이때 빈백이 날아가요.' },
  cup:       { name: '컵', role: '빈백을 담는 곳', vis: 'plate', text: '팔 끝에서 빈백을 담는 받침이에요.' },
  pivot:     { name: '회전축', role: '팔이 도는 축', vis: 'shaft', text: '투석기 팔이 도는 축이에요.' },
  pivotTower:{ name: '축 받침대', role: '회전축을 받치는 기둥', vis: 'beam', text: '회전축을 양쪽에서 받치는 기둥이에요.' },
  stopper:   { name: '멈춤대', role: '팔을 정해진 각도에서 멈춤', vis: 'beam', text: '팔이 정해진 각도에서 멈추게 하는 막대예요. 팔이 멈추는 순간 빈백이 날아가요. 멈춤대 위치가 발사 각도를 정해요.' },
  stopPost:  { name: '멈춤대 기둥', role: '멈춤대 받침', vis: 'beam', text: '멈춤대를 받치는 기둥이에요.' },
  bandAnchor:{ name: '고무줄 고리', role: '고무줄 한쪽 끝을 거는 곳', vis: 'beam', text: '고무줄 한쪽 끝을 거는 곳이에요.' },
  liftTower: { name: '리프트 기둥', role: '캐리지가 오르내리는 길', vis: 'beam', text: '캐리지가 오르내리는 길이에요. 경기 시작 후에는 높이 제한이 없어서 위로 더 늘릴 수 있어요.' },
  carriage:  { name: '캐리지', role: '리프트를 타고 오르내리는 판', vis: 'plate', text: '리프트 기둥을 타고 오르내리는 판이에요.' },
  tray:      { name: '받침', role: '빈백을 올려 두는 곳', vis: 'plate', text: '빈백을 올려 두는 곳이에요. 골 위에서 기울여 내려놓아요.' },
  liftMotor: { name: '리프트 모터', role: '캐리지를 올리고 내림', vis: 'motor', text: '줄이나 체인으로 캐리지를 올리고 내리는 모터예요.' },
  // 인테이커
  roller:    { name: '롤러', role: '빈백을 빨아들이는 막대', vis: 'shaft', text: '돌아가면서 바닥의 빈백을 안쪽으로 빨아들이는 막대예요.' },
  intakeArm: { name: '롤러 팔', role: '롤러를 잡아 주는 판', vis: 'plate', text: '롤러를 양쪽에서 잡아 주는 판이에요.' },
  intakeMotor:{ name: '인테이크 모터', role: '인테이커를 돌림', vis: 'motor', text: '롤러·집게·벨트를 움직이는 모터예요.' },
  clawArm:   { name: '집게 팔', role: '집게를 앞으로 내밀기', vis: 'beam', text: '집게를 앞으로 내밀어 주는 팔이에요.' },
  wrist:     { name: '손목 판', role: '손가락을 다는 곳', vis: 'plate', text: '집게 손가락이 달리는 판이에요.' },
  finger:    { name: '집게 손가락', role: '빈백을 잡는 손가락', vis: 'beam', text: '빈백을 양쪽에서 집는 손가락이에요.' },
  belt:      { name: '컨베이어 벨트', role: '빈백을 위로 실어 나름', vis: 'plate', text: '비스듬히 놓인 벨트예요. 돌면서 빈백을 위로 실어 날라요.' },
  guide:     { name: '옆 가이드', role: '빈백이 떨어지지 않게 막기', vis: 'plate', text: '벨트 양옆을 막아서 빈백이 떨어지지 않게 해요.' },
  leg:       { name: '받침 다리', role: '벨트 위쪽 지지', vis: 'beam', text: '컨베이어 위쪽을 받쳐 주는 다리예요.' },
  // 브레인
  brain:     { name: 'IQ 브레인', role: '로봇의 두뇌', vis: 'brain', text: '로봇의 두뇌예요. 모터·센서를 꽂는 포트가 12개 있고, 컨트롤러 신호를 받아 모터를 움직여요.' },
  battery:   { name: 'IQ 배터리', role: '전기를 공급', vis: 'battery', text: '브레인 뒤쪽 홈에 끼워 쓰는 충전 배터리예요. 브레인과 함께 움직이고, 무거운 편이라 위치가 무게중심에 영향을 줘요.' },
  // 미정 상자
  phLauncher:{ name: '발사부 자리', role: '아직 안 정함', vis: 'ph', text: '발사 방식을 아직 안 골랐어요. 조합 탭에서 고르면 이 상자가 그 모양으로 바뀌어요.' },
  phIntake:  { name: '인테이커 자리', role: '아직 안 정함', vis: 'ph', text: '인테이커를 아직 안 골랐어요. 조합 탭에서 고르면 이 상자가 바뀌어요.' },
  phBrain:   { name: '브레인·배터리 자리', role: '아직 안 정함', vis: 'ph', text: '브레인 위치를 아직 안 정했어요. 브레인과 배터리가 들어갈 크기의 상자예요.' },
  bag:       { name: '빈백 (크기 비교용)', role: '득점 물체 · 로봇 부품 아님', vis: 'bag', text: '득점 물체예요. 크기는 약 2인치(4칸)로 잡았어요(실측 필요). 로봇 부품이 아니라서 무게·크기 계산에서 빠져요.' },
  // 추가 부품
  cBeam:     { name: '빔', role: '추가한 부품', vis: 'beam', text: '직접 추가한 빔이에요. 위치와 크기를 칸 단위로 맞출 수 있어요.' },
  cPlate:    { name: '판', role: '추가한 부품', vis: 'plate', text: '직접 추가한 판이에요.' },
  cMotor:    { name: '모터', role: '추가한 부품', vis: 'motor', text: '직접 추가한 IQ 스마트 모터예요.' },
  cConn:     { name: '연결 블록', role: '추가한 부품', vis: 'conn', text: '직접 추가한 연결 블록이에요.' },
  cWheel:    { name: '바퀴', role: '추가한 부품', vis: 'wheel', text: '직접 추가한 바퀴예요.' },
  cBox:      { name: '임시 상자', role: '추가한 부품', vis: 'ph', text: '아직 모양을 정하지 않은 부품 자리를 잡아 두는 상자예요.' },
};
const ADDABLE = [
  { kind: 'cBeam', label: '빔', s: [1, 10, 0.5], mass: 0 },
  { kind: 'cPlate', label: '판', s: [4, 8, 0.5], mass: 0 },
  { kind: 'cMotor', label: '모터', s: [3.5, 4.5, 2], mass: 75 },
  { kind: 'cConn', label: '연결 블록', s: [1.75, 1.75, 1.5], mass: 3 },
  { kind: 'cWheel', label: '바퀴', s: [2.2, 5, 5], mass: 40, cyl: true },
  { kind: 'cBox', label: '임시 상자', s: [4, 4, 4], mass: 40 },
];

/* ---------- 경기 규칙 요약 ---------- */
const RULES = [
  ['시작 크기', '폭 11 × 길이 20 × 높이 15in 안에 들어가야 해요 (SG1·R3).'],
  ['시작 후', '길이 24in까지 늘어날 수 있고 폭은 11in 그대로, 높이는 제한 없어요 (SG2·SG3).'],
  ['빈백 보유', '한 번에 1개만 가질 수 있어요 (SG6).'],
  ['밖으로 나간 빈백', '경기장 밖으로 나가면 다시 못 써요 (SG4).'],
  ['L4 골', '노란 빈백만 점수가 돼요 (SC5).'],
  ['점수', '바닥 골 1 · L1 3 · L2 6 · L3 12 · L4 16점.'],
];

/* ---------- 아이콘(32×32, 선) ---------- */
const ICON = {
  sling_back: '<path d="M9 27V17M9 17L4 8M9 17l5-9"/><path d="M4 8l17 7M14 8l7 7" opacity=".55"/><rect x="20" y="12.5" width="5" height="5" rx="1"/><path d="M28 24h-8m0 0l3-2.5M20 24l3 2.5"/>',
  sling_down: '<path d="M6 27V5M26 27V5"/><path d="M6 6l10 13M26 6L16 19" opacity=".55"/><rect x="13" y="18" width="6" height="4" rx="1"/><path d="M16 24v5m0 0l-2.5-2.5M16 29l2.5-2.5"/>',
  catapult: '<path d="M3 28h26M12 28l4-9 4 9"/><path d="M16 19L5 13"/><path d="M3 10.5c.5 3 3 4 5 3.5"/><path d="M22 6a12 12 0 0 1 6 9" stroke-dasharray="2 2"/>',
  lift: '<path d="M8 28V4M22 28V4"/><rect x="9" y="13" width="12" height="4" rx="1"/><path d="M21 15h6"/><path d="M15 9V3m0 0l-2.5 2.5M15 3l2.5 2.5"/>',
  front: '<rect x="9" y="11" width="14" height="17" rx="2"/><path d="M16 9V2m0 0l-3 3m3-3l3 3"/>',
  back: '<rect x="9" y="4" width="14" height="17" rx="2"/><path d="M16 23v7m0 0l-3-3m3 3l3-3"/>',
  roller: '<circle cx="16" cy="13" r="7"/><path d="M16 6a7 7 0 0 1 7 7" stroke-dasharray="0"/><path d="M23 13l-2-2.5M23 13l2-2.5"/><rect x="11" y="23" width="10" height="5" rx="2"/>',
  claw: '<path d="M16 3v9M10 12h12M10 12l-2 9 3 4M22 12l2 9-3 4"/><rect x="13" y="20" width="6" height="5" rx="1.5"/>',
  conveyor: '<path d="M4 26L26 8"/><path d="M6 29L28 11"/><circle cx="5" cy="27.5" r="2"/><circle cx="27" cy="9.5" r="2"/><rect x="12" y="15" width="5" height="4" rx="1" transform="rotate(-39 14.5 17)"/>',
  side: '<rect x="7" y="5" width="13" height="22" rx="2"/><rect x="22" y="10" width="5" height="12" rx="1" fill="currentColor"/>',
  bback: '<rect x="9" y="3" width="14" height="19" rx="2"/><rect x="11" y="24" width="10" height="5" rx="1" fill="currentColor"/>',
  top: '<rect x="7" y="5" width="18" height="22" rx="2"/><rect x="11" y="10" width="10" height="12" rx="1" fill="currentColor"/>',
  winch: '<circle cx="11" cy="16" r="6"/><circle cx="11" cy="16" r="2"/><path d="M11 10h17"/><rect x="25" y="7" width="4" height="6" rx="1"/>',
  rack: '<path d="M3 22h26M4 22v-3h2v3M9 22v-3h2v3M14 22v-3h2v3M19 22v-3h2v3M24 22v-3h2v3"/><circle cx="16" cy="11" r="5"/>',
  slip: '<circle cx="16" cy="16" r="9"/><path d="M16 4v3M24.5 7.5l-2 2M28 16h-3M7.5 7.5l2 2M4 16h3"/><path d="M8 23l16-0" stroke-dasharray="1.5 2"/>',
  none: '<rect x="6" y="6" width="20" height="20" rx="3" stroke-dasharray="3 3"/><path d="M13 13.5a3 3 0 1 1 4 2.8c-.8.4-1 1-1 1.7M16 21v.5"/>',
};
const OPT_ICON = { sling_back: 'sling_back', sling_down: 'sling_down', catapult: 'catapult', lift: 'lift',
  front: 'front', back: 'back', roller: 'roller', claw: 'claw', conveyor: 'conveyor',
  side: 'side', bback: 'bback', top: 'top', winch: 'winch', rack: 'rack', slip: 'slip' };
function iconSvg(name) {
  return `<svg class="ic" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.none}</svg>`;
}
