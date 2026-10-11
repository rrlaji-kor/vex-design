"""오프라인 캐시 · 새 버전 알림 · Firebase 설정 전(이 기기에만 저장) 화면 테스트 (진짜 파일, 가짜 없음)"""
import asyncio, os, re, shutil, subprocess, time
from playwright.async_api import async_playwright
SRC, DST, PORT = '/home/claude/vexapp/pwa', os.path.abspath('pwa_serve'), 8767
BASE = f'http://127.0.0.1:{PORT}/'
OUT = 'shots_pwa'; os.makedirs(OUT, exist_ok=True)
errors, fails = [], []
def check(c, m):
    print(('  ok   ' if c else '  FAIL ') + m)
    if not c: fails.append(m)
def watch(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] PAGEERROR: {e}'))
def edit(path, fn):
    p = os.path.join(DST, path); t = open(p).read(); open(p, 'w').write(fn(t))

async def main():
    if os.path.exists(DST): shutil.rmtree(DST)
    shutil.copytree(SRC, DST)
    # 이 상자에서는 구글 글꼴 서버에 못 가니 글꼴 줄만 뺀다
    edit('index.html', lambda t: re.sub(r'<link rel="(preconnect|stylesheet)" href="https://fonts[^>]*>\n', '', t))
    srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=DST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); watch(pg, 'sw')
            await pg.goto(BASE); await pg.wait_for_timeout(800)
            print('— Firebase 설정 전')
            check(await pg.evaluate('S.mode') == 'local', '설정 없으면 이 기기 저장 모드')
            check(await pg.evaluate('els.banner.hidden') and await pg.evaluate('els.sync.textContent') == '이 기기에 저장됨', '경고 띠 없이 이 기기에 저장')
            check(await pg.evaluate('S.curId') == 'd1', 'Claude 앱 구상안 가져옴')
            check(await pg.evaluate("document.getElementById('gate').hidden"), '로그인 화면 안 뜸')
            ok = await pg.evaluate("navigator.serviceWorker.ready.then(() => true)")
            await pg.wait_for_timeout(500)
            keys = await pg.evaluate("caches.keys()")
            check(ok and any(k.startswith('core-') for k in keys), f'오프라인 캐시 준비: {keys}')
            n = await pg.evaluate("caches.keys().then(k => caches.open(k.find(x => x.startsWith('core-')))).then(c => c.keys()).then(r => r.length)")
            check(n >= 11, f'앱 파일 {n}개 저장')
            await pg.click('.card[data-k=launch][data-v=catapult]'); await pg.wait_for_timeout(300)
            await pg.reload(); await pg.wait_for_timeout(1000)
            check(await pg.evaluate('!!navigator.serviceWorker.controller'), '다시 열면 캐시가 화면을 맡음')
            check(await pg.evaluate('curDesign().opts.launch') == 'catapult', '이 기기 저장: 다시 열어도 남음')
            print('— 인터넷 끊고 열기')
            await ctx.set_offline(True)
            await pg.reload(); await pg.wait_for_timeout(1500)
            check(await pg.evaluate("typeof S === 'object' && S.mode") == 'local', '인터넷 없이도 앱이 열림')
            check(await pg.evaluate('typeof THREE') == 'object', '3D 도구도 캐시에서')
            await pg.evaluate('window.scrollTo(0,0)')
            await pg.screenshot(path=f'{OUT}/s01_offline_phone.png')
            await ctx.set_offline(False)
            print('— 새 버전 알림')
            edit('sw.js', lambda t: re.sub(r"const VERSION = '[^']*'", "const VERSION = 'test-new'", t))
            edit('index.html', lambda t: t.replace('<title>VEX IQ 로봇 설계</title>', '<title>VEX IQ 로봇 설계</title><meta name="x-ver" content="new">'))
            await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
            await pg.wait_for_timeout(2500)
            bn = await pg.inner_text('#banner')
            check('새 버전' in bn, f'새 버전 안내 띠: {bn!r}')
            await pg.evaluate('window.scrollTo(0,0)')
            await pg.screenshot(path=f'{OUT}/s02_update_banner.png')
            await pg.click('#banner [data-act=reload]'); await pg.wait_for_timeout(1500)
            check(await pg.evaluate("!!document.querySelector('meta[name=x-ver]')"), '"지금 적용"을 누르면 새 화면')
            keys = await pg.evaluate("caches.keys()")
            check('core-test-new' in keys and len([k for k in keys if k.startswith('core-')]) == 1, f'옛 캐시 지움: {keys}')
            mf = await pg.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
            check(mf['display'] == 'standalone' and mf['short_name'] == 'VEX 설계', '설치 정보(manifest)')
            await b.close()
    finally:
        srv.terminate()
    errs = [e for e in errors if 'net::ERR_INTERNET_DISCONNECTED' not in e]
    print('\n'.join(errs) if errs else 'NO CONSOLE ERRORS')
    print(f'\n{len(fails)} FAIL' if fails else '\nALL PASS')
asyncio.run(main())
