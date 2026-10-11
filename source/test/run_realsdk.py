"""진짜 Firebase SDK(compat 12.19.0)로 로그인 화면까지: API 이름이 맞는지 확인 (인터넷 없이)"""
import asyncio
from playwright.async_api import async_playwright
BASE = 'http://127.0.0.1:8766/'
CFG = "window.FIREBASE_CONFIG = {apiKey:'AIzaSyFakeKeyForSmokeTest0000000000', authDomain:'vex-test.firebaseapp.com', projectId:'vex-test', storageBucket:'vex-test.appspot.com', messagingSenderId:'1', appId:'1:1:web:1'};"
errs = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        async def route(r):
            u = r.request.url.split('?')[0]
            if u.endswith('/config.js'): await r.fulfill(status=200, content_type='application/javascript', body=CFG)
            elif u.startswith(BASE): await r.continue_()
            else: errs.append('외부 요청: ' + u); await r.abort()
        await ctx.route('**/*', route)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        await pg.goto(BASE); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""() => ({
          sdk: firebase.SDK_VERSION, apps: firebase.apps.length,
          gate: !document.getElementById('gate').hidden, msg: document.getElementById('gateMsg').textContent,
          provider: typeof firebase.auth.GoogleAuthProvider, setParams: typeof new firebase.auth.GoogleAuthProvider().setCustomParameters,
          popup: typeof FBS.auth.signInWithPopup, redirect: typeof FBS.auth.signInWithRedirect,
          batch: typeof FBS.fs.batch, docSet: typeof FBS.fs.doc('designs/x').set, q: typeof FBS.fs.collection('history').orderBy('ts','desc').limit(3).onSnapshot,
          mode: S.mode })""")
        print(r)
        await b.close()
    print('\n'.join(errs) if errs else 'NO ERRORS')
asyncio.run(main())
