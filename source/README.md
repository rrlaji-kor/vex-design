# 앱 원본 코드

`index.html`은 이 폴더의 코드를 합쳐서 만든 결과물이에요. 고칠 때는 이 폴더를 고친 뒤 다시 만들어요.

## 다시 만들기
1. 이 `source/` 폴더를 작업 폴더(예: `vexapp/`)로 복사
2. 3D·Firebase 도구 받기: `npm install --prefix testenv three@0.128.0 firebase@12.19.0`
3. `python3 pwa_src/build_pwa.py` → `pwa/`에 앱이 만들어짐 → 저장소 맨 위로 복사해서 올리기

## 폴더
| 폴더 | 내용 |
|---|---|
| `src/` | 앱 화면·동작 (설계 탭, 3D·2D 보기, 저장, 보내기·받기) |
| `pwa_src/` | 설치형 앱 만들기 (빌드, 오프라인 캐시, 아이콘, 처음 자료) |
| `build.py` | 예전 Claude 앱용 한 파일 빌드 (로봇 사진은 공개하지 않아서 `assets/`가 없음) |
| `test/` | 자동 테스트 (Playwright) |

## 메모
- 지금은 Firebase 없이 기기마다 저장해요. 나중에 같이 쓰려면 `pwa_src/config.json`(Firebase 웹 앱 설정)을 넣고 다시 만들면 구글 로그인과 공유 저장이 켜져요. 이메일 목록과 설정 파일은 공개 저장소에 올리지 않아요.
