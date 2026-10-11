"""만들기 탭 테스트: 옵션별 단계 · 3D/2D 강조 · 다 했어요 · 규칙 경고"""
import asyncio, os
from playwright.async_api import async_playwright
BASE = 'http://127.0.0.1:8766/'
OUT = 'shots_build'; os.makedirs(OUT, exist_ok=True)
errors, fails = [], []
def check(c, m):
    print(('  ok   ' if c else '  FAIL ') + m)
    if not c: fails.append(m)
async def setup(ctx):
    async def route(r):
        if 'fonts.g' in r.request.url: await r.fulfill(status=200, content_type='text/css', body='')
        else: await r.continue_()
    await ctx.route('**/*', route)
def watch(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] {m.type}: {m.text}') if m.type in ('error', 'warning') and 'Service Worker registration blocked' not in m.text else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] PAGEERROR: {e}'))
LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
STEPS_JS = "guideState().flat.map(s => s.id)"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=LAUNCH)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        await setup(ctx)
        me = await ctx.new_page(); watch(me, 'phone')
        await me.goto(BASE); await me.wait_for_timeout(900)
        tabs = await me.eval_on_selector_all('.ptab', 'b => b.map(x => x.textContent.trim())')
        check(tabs[:2] == ['조합', '만들기'] and len(tabs) == 6, f'탭 6개: {tabs}')
        print('— 옵션을 안 골랐을 때')
        await me.click('.ptab[data-tab=build]'); await me.wait_for_timeout(300)
        ids = await me.evaluate(STEPS_JS)
        check('pick-launch' in ids and 'pick-intake' in ids and 'pick-brain' in ids, f'안 고른 것은 "고르기" 단계: {ids}')
        await me.evaluate('window.scrollTo(0,0)')
        await me.screenshot(path=f'{OUT}/b01_empty_phone.png', full_page=True)
        print('— 새총(뒤로·윈치) + 롤러 + 브레인 뒤쪽')
        await me.click('.ptab[data-tab=combo]'); await me.wait_for_timeout(200)
        for k, v in [('launch', 'sling_back'), ('intake', 'roller'), ('brain', 'back')]:
            await me.click(f'.card[data-k={k}][data-v={v}]'); await me.wait_for_timeout(200)
        await me.click('.ptab[data-tab=build]'); await me.wait_for_timeout(300)
        ids = await me.evaluate(STEPS_JS)
        check(ids == ['prep', 'drive', 'brain-back', 'roller-arm', 'roller-bar', 'roller-motor', 'roller-test', 'sl-base', 'sl-rail', 'sl-post', 'sl-pocket', 'sl-band', 'sl-winch', 'sl-test', 'wire'], f'단계 순서: {ids}')
        empty = await me.evaluate("guideState().flat.filter(s => !s.keys.length && !['prep'].includes(s.id)).map(s => s.id)")
        check(empty == [], f'강조할 부품이 없는 단계 없음: {empty}')
        await me.click('.bstep[data-id=sl-rail] .bs-h'); await me.wait_for_timeout(700)
        check(await me.evaluate('JSON.stringify(S.buildFocus)') == '["L:rail","L:railsup"]', f'레일 단계 강조: {await me.evaluate("S.buildFocus")}')
        txt = await me.inner_text('.bstep.open')
        check('1x12 빔' in txt and '각도 빔' in txt and '40°' in txt, f'레일 부품·각도: {txt[:80]!r}')
        await me.evaluate('window.scrollTo(0,0)')
        await me.screenshot(path=f'{OUT}/b02_rail_focus_phone.png')
        await me.screenshot(path=f'{OUT}/b03_rail_focus_full.png', full_page=True)
        await me.click('.bstep.open [data-act=buildNext]'); await me.wait_for_timeout(600)
        check(await me.evaluate('S.ui.buildOpen') == 'sl-post', '다음 → 새총 틀')
        await me.click('.bstep.open .donebox'); await me.wait_for_timeout(300)
        check('1/15' in await me.inner_text('#pbody'), '다 했어요 → 1/15 단계')
        print('— 윈치: 걸쇠 경고와 로프 규칙')
        await me.click('.bstep[data-id=sl-winch] .bs-h'); await me.wait_for_timeout(500)
        txt = await me.inner_text('.bstep.open')
        check('윈치·로프 팩' in txt and '공압' in txt and '캠(크랭크)' in txt, '윈치: 로프 규칙 + 걸쇠 푸는 방법 3가지')
        warns = await me.evaluate("CUR.an.warnings.map(w => w.id)")
        check('latchFree' in warns, f'걸쇠 경고: {warns}')
        await me.reload(); await me.wait_for_timeout(900)
        await me.click('.ptab[data-tab=build]'); await me.wait_for_timeout(300)
        check('1/15' in await me.inner_text('#pbody') and await me.evaluate("!!S.prefs.buildDone[S.curId]['sl-post']"), '다시 열어도 진행 상황 남음')
        print('— 캠(크랭크)으로 바꾸기')
        await me.click('.ptab[data-tab=combo]'); await me.wait_for_timeout(200)
        await me.evaluate("document.querySelector('.card[data-k=pull][data-v=slip]').scrollIntoView()")
        await me.click('.card[data-k=pull][data-v=slip]'); await me.wait_for_timeout(300)
        card = await me.inner_text('.card[data-k=pull][data-v=slip]')
        check('캠' in card and '슬립기어' not in card.split('\n')[0], f'옵션 이름 바뀜: {card.splitlines()[0]!r}')
        warns = await me.evaluate("CUR.an.warnings.map(w => w.id)")
        check('latchFree' not in warns, '캠이면 걸쇠 경고 없음')
        await me.click('.ptab[data-tab=build]'); await me.wait_for_timeout(300)
        await me.click('.bstep[data-id=sl-cam] .bs-h'); await me.wait_for_timeout(500)
        txt = await me.inner_text('.bstep.open')
        check('R17' in txt and '크랭크' in txt, '캠 단계에 규칙(R17)')
        check(await me.evaluate('JSON.stringify(S.buildFocus)') == '["L:slip","L:motor"]', '캠 단계 강조')
        print('— 탭을 나가면 강조 끄기')
        await me.click('.ptab[data-tab=warn]'); await me.wait_for_timeout(300)
        check(await me.evaluate('S.buildFocus') is None and await me.evaluate("document.querySelectorAll('#svgTop .pt.focus, #svgTop .pt.dim').length") == 0, '경고 탭에서는 강조 없음')
        await me.click('.ptab[data-tab=build]'); await me.wait_for_timeout(300)
        check(await me.evaluate('JSON.stringify(S.buildFocus)') == '["L:slip","L:motor"]', '다시 오면 강조 되살림')
        print('— 모터 7개 경고')
        await me.click('.ptab[data-tab=parts]'); await me.wait_for_timeout(200)
        await me.evaluate("document.querySelectorAll('.pgrp').forEach(d=>d.open=true)")
        await me.click('[data-act=add][data-kind=cMotor]'); await me.wait_for_timeout(300)
        warns = await me.evaluate("CUR.an.warnings.map(w => w.id + ':' + w.level)")
        check('motors:danger' in warns, f'모터 7개 위험 경고: {warns[:4]}')
        await me.click('.ptab[data-tab=build]'); await me.wait_for_timeout(300)
        await me.click('.bstep[data-id=prep] .bs-h'); await me.wait_for_timeout(300)
        txt = await me.inner_text('.bstep.open')
        check('7개' in txt and '주의' in txt, '준비 단계에 모터 7개 주의')
        ids = await me.evaluate(STEPS_JS)
        check('custom' in ids, '직접 추가한 부품 단계')
        await me.evaluate('undoLast()'); await me.wait_for_timeout(300)
        print('— 모든 조합에서 단계 만들기')
        bad = await me.evaluate("""() => {
          const out = [];
          for (const L of [null, 'sling_back', 'sling_down', 'catapult', 'lift']) for (const I of [null, 'roller', 'claw', 'conveyor'])
            for (const Bn of [null, 'side', 'back', 'top']) for (const P of ['winch', 'rack', 'slip']) {
              const d = Object.assign(clone(curDesign()), { opts: Object.assign({}, curDesign().opts, { launch: L, intake: I, brain: Bn, pull: P }) });
              try {
                const R = buildRobot(d), G = buildGuide(d, R), flat = G.flatMap(g => g.steps);
                const ids = new Set();
                for (const s of flat) {
                  if (ids.has(s.id)) out.push('dup ' + s.id); ids.add(s.id);
                  if (!s.keys.length && s.id !== 'prep') out.push(`nokeys ${L}/${I}/${Bn}/${P}: ${s.id}`);
                  for (const k of s.keys) if (!R.byKey.has(k)) out.push('missing ' + k);
                  if (!s.how.length) out.push('nohow ' + s.id);
                }
              } catch (e) { out.push(`${L}/${I}/${Bn}/${P}: ${e.message}`); }
            }
          return [...new Set(out)];
        }""")
        check(bad == [], f'240가지 조합 모두 문제 없음: {bad[:6]}')
        print('— 맥북 화면')
        ctx2 = await b.new_context(viewport={'width': 1440, 'height': 900}, service_workers='block')
        await setup(ctx2)
        mac = await ctx2.new_page(); watch(mac, 'mac')
        await mac.goto(BASE); await mac.wait_for_timeout(900)
        await mac.click('.card[data-k=launch][data-v=catapult]'); await mac.wait_for_timeout(200)
        await mac.click('.card[data-k=intake][data-v=claw]'); await mac.wait_for_timeout(200)
        await mac.click('.ptab[data-tab=build]'); await mac.wait_for_timeout(300)
        await mac.click('.bstep[data-id=ca-arm] .bs-h'); await mac.wait_for_timeout(900)
        n2 = await mac.evaluate("document.querySelectorAll('#svgTop .pt.focus, #svgSide .pt.focus').length")
        nd = await mac.evaluate("document.querySelectorAll('#svgTop .pt.dim').length")
        check(n2 >= 2 and nd > 10, f'2D 도면 강조 {n2} · 흐리게 {nd}')
        await mac.screenshot(path=f'{OUT}/b04_mac_catapult_arm.png')
        await mac.emulate_media(color_scheme='dark'); await mac.wait_for_timeout(400)
        await mac.click('.bstep.open [data-act=buildNext]'); await mac.wait_for_timeout(900)
        await mac.screenshot(path=f'{OUT}/b05_mac_dark_stop.png')
        for pg, nm in [(me, 'phone'), (mac, 'mac')]:
            ov = await pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov == 0, f'가로 넘침 없음 ({nm}: {ov})')
        await b.close()
    print('\n'.join(errors) if errors else 'NO CONSOLE ERRORS')
    print(f'\n{len(fails)} FAIL' if fails else '\nALL PASS')
asyncio.run(main())
