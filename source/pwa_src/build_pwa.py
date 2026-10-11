#!/usr/bin/env python3
"""설치형 앱(PWA) 만들기: src/* + pwa_src/* → pwa/"""
import hashlib, json, pathlib, re, shutil, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, PS, OUT, NM = ROOT / 'src', ROOT / 'pwa_src', ROOT / 'pwa', ROOT / 'testenv' / 'node_modules'
OWNER = 'rrlaji-kor'
JS = ['data.js', 'model.js', 'analysis.js', 'view3d.js', 'view2d.js', 'store.js', 'backend_fb.js', 'ui.js', 'share.js', 'pwa.js', 'main.js']
if OUT.exists(): shutil.rmtree(OUT)
(OUT / 'vendor').mkdir(parents=True)
strip = lambda t: re.sub(r'\n?//# sourceMappingURL=\S+\s*$', '\n', t)
shutil.copy(NM / 'three' / 'build' / 'three.min.js', OUT / 'vendor' / 'three.min.js')
cfg = json.loads((PS / 'config.json').read_text()) if (PS / 'config.json').exists() else None
FB = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'] if cfg else []
for f in FB:
    (OUT / 'vendor' / f).write_text(strip((NM / 'firebase' / f).read_text()))
subprocess.run([sys.executable, str(PS / 'make_icons.py'), str(OUT / 'icons')], check=True)
(OUT / 'config.js').write_text('/* Firebase 웹 앱 설정. 공개돼도 괜찮은 값이에요(접근은 보안 규칙이 막아요). */\nwindow.FIREBASE_CONFIG = '
                              + (json.dumps(cfg, ensure_ascii=False, indent=2) if cfg else 'null') + ';\n')
seed = (PS / 'seed.json').read_text() if (PS / 'seed.json').exists() else 'null'
(OUT / 'seed.js').write_text('/* Claude 앱에서 옮겨 온 첫 구상안·기록. 새 앱을 처음 열 때 한 번만 가져와요. */\nwindow.SEED = ' + seed + ';\n')
reset = (':root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
         'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}')
css = (SRC / 'styles.css').read_text() + '\n' + (SRC / 'pwa.css').read_text()
js = 'const FACE_PHOTOS = null;\n' + '\n'.join((SRC / f).read_text() for f in JS)
html = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>VEX IQ 로봇 설계</title>
<meta name="description" content="VEX IQ Level Up 로봇 구도를 옵션으로 조합하고 2D 도면·3D로 확인하며 같이 고치는 앱">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#192028" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="VEX 설계">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>{reset}
{css}</style>
</head>
<body>
{(SRC / 'body.html').read_text()}
{(SRC / 'pwa_extra.html').read_text()}
<script src="vendor/three.min.js"></script>
{''.join(f'<script src="vendor/{f}"></script>' + chr(10) for f in FB)}<script src="config.js"></script>
<script src="seed.js"></script>
<script>
{js}
</script>
</body>
</html>
'''
(OUT / 'index.html').write_text(html)
manifest = {
  'name': 'VEX IQ 로봇 설계', 'short_name': 'VEX 설계', 'id': './', 'lang': 'ko',
  'description': 'VEX IQ Level Up 로봇 구도를 같이 잡는 설계 스케치북',
  'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any',
  'background_color': '#e7ebef', 'theme_color': '#ffffff',
  'icons': [
    {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
    {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
    {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
  ],
}
(OUT / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
files = ['./', './index.html', './config.js', './seed.js', './manifest.webmanifest'] + \
        ['./vendor/' + p.name for p in sorted((OUT / 'vendor').iterdir())] + ['./icons/' + p.name for p in sorted((OUT / 'icons').iterdir())]
h = hashlib.sha256()
for p in sorted(OUT.rglob('*')):
    if p.is_file(): h.update(p.read_bytes())
sw = (PS / 'sw.js').read_text().replace('__VERSION__', h.hexdigest()[:10]).replace('__FILES__', json.dumps(files))
(OUT / 'sw.js').write_text(sw)
emails = json.loads((PS / 'emails.json').read_text()) if (PS / 'emails.json').exists() else []  # 이메일 목록은 공개 저장소에 두지 않는다 (pwa_src/emails.json은 올리지 않음)
PRIV = ROOT / 'private'; PRIV.mkdir(exist_ok=True)
(PRIV / 'firestore.rules').write_text((PS / 'firestore.rules.tmpl').read_text().replace('__EMAILS__', ',\n          '.join(json.dumps(e) for e in emails)))
(OUT / 'README.md').write_text((PS / 'README.md').read_text().replace('__OWNER__', OWNER))
(OUT / '.nojekyll').write_text('')
total = sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())
print('pwa built:', OUT, f'{total/1024:.0f} KB', 'version', h.hexdigest()[:10], 'config' if cfg else 'NO CONFIG')
