import asyncio, json, sys, os
from playwright.async_api import async_playwright
APP = 'http://127.0.0.1:8765/preview.html'
THREE = open('/home/claude/vexapp/testenv/node_modules/three/build/three.min.js').read()
FAKE = open('fakeclaude.js').read()
OUT = 'shots'; os.makedirs(OUT, exist_ok=True)
errors = []
async def setup(ctx, fake=True):
    async def route(r):
        u = r.request.url
        if 'cdnjs.cloudflare.com' in u: await r.fulfill(status=200, content_type='application/javascript', body=THREE)
        elif 'fonts.g' in u: await r.fulfill(status=200, content_type='text/css', body='')
        else: await r.continue_()
    await ctx.route('**/*', route)
    if fake: await ctx.add_init_script(FAKE)
def watch(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] PAGEERROR: {e}'))
async def store(page): return await page.evaluate('window.__fakeStore()')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await setup(ctx)
        me = await ctx.new_page(); watch(me, 'me')
        await me.goto(APP + '?u=u_me'); await me.wait_for_timeout(1200)
        print('sync:', await me.inner_text('#sync'), '| banner:', await me.inner_text('#banner'))
        await me.screenshot(path=f'{OUT}/01_empty_phone.png')
        # 첫 구상안 만들기
        await me.click('#banner [data-act=newDesign]'); await me.wait_for_timeout(500)
        st = await store(me); ds = [k for k in st if k.startswith('designs/')]
        print('designs:', ds, '| hist:', len([k for k in st if k.startswith('history/')]))
        await me.screenshot(path=f'{OUT}/02_design1_phone.png')
        # 옵션 고르기
        for k, v in [('launch','sling_back'),('intake','roller'),('brain','back')]:
            await me.click(f'.card[data-k={k}][data-v={v}]'); await me.wait_for_timeout(250)
        await me.click('.oc[data-k=top][data-v=A]'); await me.wait_for_timeout(200)
        await me.click('.card[data-k=front][data-v=end1]'); await me.wait_for_timeout(300)
        st = await store(me); d = st[ds[0]]
        print('opts:', d['opts'], '| orient:', d['orient'])
        print('warn badge:', await me.inner_text('.ptab[data-tab=warn]'))
        await me.evaluate('window.scrollTo(0,0)'); await me.wait_for_timeout(300)
        await me.screenshot(path=f'{OUT}/03_combo_phone.png')
        # 3D 탭해서 부품 고르기 (가운데)
        box = await me.locator('#cv').bounding_box()
        await me.mouse.click(box['x'] + box['width']*0.5, box['y'] + box['height']*0.52); await me.wait_for_timeout(300)
        print('pick:', (await me.inner_text('#pick')).replace('\n',' | ')[:160] if await me.is_visible('#pick') else 'none')
        # 부품 탭: 발사부 고르고 앞으로 2칸
        await me.click('.ptab[data-tab=parts]'); await me.wait_for_timeout(200)
        await me.evaluate("document.querySelectorAll('.pgrp').forEach(d=>d.open=true)"); await me.wait_for_timeout(150)
        await me.click('.pitem[data-key="L:rail"]', timeout=5000); await me.wait_for_timeout(200)
        print('selbox:', (await me.inner_text('.selbox h4')))
        await me.click('.pad [data-y="1"]'); await me.wait_for_timeout(150); await me.click('.pad [data-y="1"]'); await me.wait_for_timeout(300)
        st = await store(me); d = st[ds[0]]; hs = sorted([v for k,v in st.items() if k.startswith('history/')], key=lambda e: -e['ts'])
        print('mods:', d.get('mods'), '| last hist:', hs[0]['label'], '| n hist:', len(hs))
        await me.screenshot(path=f'{OUT}/04_parts_phone.png', full_page=False)
        # 모터 옮기기 (드라이빙보드 부품)
        await me.evaluate("document.querySelectorAll('.pgrp').forEach(d=>d.open=true)"); await me.wait_for_timeout(150)
        await me.click('.pitem[data-key="motor_1L"]', timeout=5000); await me.wait_for_timeout(150)
        await me.click('.pad [data-x="1"]'); await me.wait_for_timeout(300)
        st = await store(me); d = st[ds[0]]
        print('edits motor_1L:', d['edits'].get('motor_1L'), '| warn badge:', await me.inner_text('.ptab[data-tab=warn]'))
        # 되돌리기
        await me.click('.ptab[data-tab=hist]'); await me.wait_for_timeout(200)
        print('hist rows:', await me.locator('.hrow').count())
        await me.click('[data-act=undo]'); await me.wait_for_timeout(400)
        st = await store(me); d = st[ds[0]]
        print('after undo motor_1L:', d['edits'].get('motor_1L'), '| mods:', d.get('mods'))
        await me.screenshot(path=f'{OUT}/05_hist_phone.png')
        # 지안이 페이지 (같은 저장소)
        jian = await ctx.new_page(); watch(jian, 'jian')
        await jian.goto(APP + '?u=u_jian'); await jian.wait_for_timeout(1200)
        print('jian sees design:', await jian.inner_text('#designPickName'), '| jian peers:', await jian.inner_text('#peers'))
        await jian.click('.card[data-k=launch][data-v=catapult]'); await jian.wait_for_timeout(600)
        print('me sees launch:', (await store(me))[ds[0]]['opts']['launch'], '| me toast:', await me.inner_text('#toasts'))
        await me.wait_for_timeout(300)
        print('me hist first row:', (await me.locator('.hrow').first.inner_text()).replace('\n',' '))
        await me.screenshot(path=f'{OUT}/06_me_after_jian.png')
        # 설명 끄기 (지안)
        await jian.click('label.switch'); await jian.wait_for_timeout(200)
        await jian.click('.ptab[data-tab=combo]'); await jian.wait_for_timeout(200)
        await jian.evaluate('window.scrollTo(0,0)')
        await jian.screenshot(path=f'{OUT}/07_jian_noexplain.png')
        # 구상안 2 만들고 비교
        await me.click('.ptab[data-tab=designs]'); await me.wait_for_timeout(200)
        await me.click('[data-act=dupDesign]:not([data-id])'); await me.wait_for_timeout(400)
        await me.click('.card[data-k=launch][data-v=sling_down]') if await me.locator('.card[data-k=launch][data-v=sling_down]').count() else None
        await me.click('.ptab[data-tab=combo]'); await me.wait_for_timeout(150)
        await me.click('.card[data-k=launch][data-v=sling_down]'); await me.wait_for_timeout(200)
        await me.click('.card[data-k=brain][data-v=side]'); await me.wait_for_timeout(200)
        await me.click('.ptab[data-tab=designs]'); await me.wait_for_timeout(200)
        cbs = me.locator('input[data-act=cmpPick]')
        print('design rows:', await cbs.count())
        for i in range(await cbs.count()): await cbs.nth(i).check(); await me.wait_for_timeout(100)
        await me.click('[data-act=compare]'); await me.wait_for_timeout(1200)
        await me.screenshot(path=f'{OUT}/08_compare_phone.png')
        await me.click('#sheetClose'); await me.wait_for_timeout(200)
        # 경고 탭
        await me.click('.ptab[data-tab=warn]'); await me.wait_for_timeout(200)
        await me.screenshot(path=f'{OUT}/09_warn_phone.png')
        # 2D 보기
        await me.evaluate('window.scrollTo(0,0)')
        await me.click('#viewSeg [data-view="2d"]'); await me.wait_for_timeout(400)
        await me.screenshot(path=f'{OUT}/10_2d_phone.png')
        await me.click('#sideSeg [data-sv=side]'); await me.wait_for_timeout(300)
        await me.screenshot(path=f'{OUT}/11_2d_side_phone.png')
        # 맥북 화면
        ctx2 = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        await setup(ctx2)
        mac = await ctx2.new_page(); watch(mac, 'mac')
        await mac.goto(APP + '?u=u_jian'); await mac.wait_for_timeout(600)
        await mac.evaluate(f"localStorage.setItem('fakedb-store', {json.dumps(json.dumps(await store(me)))})")
        await mac.reload(); await mac.wait_for_timeout(1500)
        await mac.screenshot(path=f'{OUT}/12_mac_split.png')
        # 2D 도면에서 발사부 끌기
        el = mac.locator('#svgTop [data-key="L:base"]')
        if await el.count():
            bb = await el.bounding_box()
            await mac.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); await mac.mouse.down()
            await mac.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2 - 60, steps=8); await mac.mouse.up(); await mac.wait_for_timeout(400)
            st2 = await mac.evaluate('window.__fakeStore()')
            cur = await mac.evaluate('S.curId')
            print('mac drag -> mods:', st2['designs/'+cur].get('mods'))
            await mac.keyboard.press('ArrowRight'); await mac.wait_for_timeout(300)
            st2 = await mac.evaluate('window.__fakeStore()')
            print('mac arrow -> mods:', st2['designs/'+cur].get('mods'))
        await mac.screenshot(path=f'{OUT}/13_mac_after_drag.png')
        await mac.emulate_media(color_scheme='dark'); await mac.wait_for_timeout(500)
        await mac.screenshot(path=f'{OUT}/14_mac_dark.png')
        # 공유 저장 없는 화면(로컬 모드)
        ctx3 = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        await setup(ctx3, fake=False)
        loc = await ctx3.new_page(); watch(loc, 'local')
        await loc.goto(APP); await loc.wait_for_timeout(1200)
        print('local sync:', await loc.inner_text('#sync'), '| banner:', await loc.inner_text('#banner'))
        await loc.emulate_media(color_scheme='dark'); await loc.wait_for_timeout(300)
        await loc.screenshot(path=f'{OUT}/15_local_dark_phone.png')
        # 가로 넘침 확인
        for pg, nm in [(me,'me'),(loc,'local'),(mac,'mac')]:
            ov = await pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            print('overflow', nm, ov)
        await b.close()
    print('\n'.join(errors) if errors else 'NO CONSOLE ERRORS')
asyncio.run(main())
