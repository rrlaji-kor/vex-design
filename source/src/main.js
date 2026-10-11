/* =========================================================
   시작 · 이벤트 연결
   ========================================================= */
let BOOTED = false;
function boot(hotData) {
  if (BOOTED) return; BOOTED = true;
  cacheEls();
  S.prefs = loadPrefs();
  hotData = hotData || {};
  if (hotData.tab) S.tab = hotData.tab;
  if (hotData.curId) S.prefs.lastDesign = hotData.curId;
  setSync('loading');
  init3D();
  bindUI();
  refresh();
  if (hotData.cam) Object.assign(V3.cam, hotData.cam); else fitCam(true);
  try {
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ curId: S.curId, tab: S.tab, cam: Object.assign({}, V3.cam, { tgt: V3.cam.tgt.slice() }) }));
  } catch (e) {}
  initBackend();
  if (typeof checkIncoming === 'function') checkIncoming();
}
function bindUI() {
  els.pbody.addEventListener('click', onPanelClick);
  els.pbody.addEventListener('input', onPanelInput);
  els.pbody.addEventListener('change', onPanelChange);
  els.pbody.addEventListener('keydown', onPanelKey);
  els.pbody.addEventListener('focusout', () => setTimeout(() => { if (panelDirty) renderPanelSafe(); }, 0));
  els.pick.addEventListener('click', onPanelClick);
  els.banner.addEventListener('click', onPanelClick);
  els.ptabs.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab, false); });
  els.explainToggle.addEventListener('change', () => { S.prefs.explain = els.explainToggle.checked; savePrefs(); renderChrome(); render2D(); request3D(); });
  els.designPick.addEventListener('click', () => setTab('designs', true));
  els.viewSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    S.prefs.view = b.dataset.view; savePrefs(); renderChrome();
    requestAnimationFrame(() => { resize3D(); render2D(); });
  });
  els.sideSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-sv]'); if (!b) return;
    S.prefs.sv = b.dataset.sv; savePrefs(); renderChrome(); requestAnimationFrame(render2D);
  });
  els.startBoxBtn.addEventListener('click', () => { S.prefs.startBox = !S.prefs.startBox; savePrefs(); refresh({ panel: false }); });
  els.bigBtn.addEventListener('click', () => { S.prefs.big = !S.prefs.big; savePrefs(); renderChrome(); requestAnimationFrame(() => { resize3D(); render2D(); }); });
  bind2D(els.svgTop, 'top');
  bind2D(els.svgSide, 'side');
  els.sheetClose.addEventListener('click', closeCompare);
  els.sheet.addEventListener('click', e => {
    if (e.target === els.sheet) return closeCompare();
    const b = e.target.closest('[data-act="openFromCmp"]');
    if (b) { closeCompare(); openDesign(b.dataset.id); toast(`"${S.designs[b.dataset.id].name}"을 열었어요`); }
  });
  document.addEventListener('keydown', onKey);
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, cross = [760, 1100].some(bp => (lastW < bp) !== (w < bp));
    lastW = w;
    if (cross) renderChrome();
    requestAnimationFrame(() => { resize3D(); render2D(); });
  });
  const mq = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { applyTheme3D(); refresh({ panel: false }); });
  new MutationObserver(() => { applyTheme3D(); refresh({ panel: false }); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  setInterval(() => { if (S.tab === 'hist' || S.tab === 'designs') renderPanelSafe(); }, 60000);
}
function onKey(e) {
  const t = e.target, tag = (t && t.tagName || '').toLowerCase();
  if (!els.sheet.hidden) { if (e.key === 'Escape') closeCompare(); return; }
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLast(); return; }
  if (e.key === 'Escape') { selectKey(null, 'view'); return; }
  if (!S.sel) return;
  const st = S.prefs.step; let v = null;
  if (e.key === 'ArrowUp') v = e.shiftKey ? [0, 0, st] : [0, st, 0];
  else if (e.key === 'ArrowDown') v = e.shiftKey ? [0, 0, -st] : [0, -st, 0];
  else if (e.key === 'ArrowLeft') v = [-st, 0, 0];
  else if (e.key === 'ArrowRight') v = [st, 0, 0];
  else if (e.key === 'PageUp') v = [0, 0, st];
  else if (e.key === 'PageDown') v = [0, 0, -st];
  if (v) { e.preventDefault(); moveSel(v); }
}
(function start() {
  const go = () => {
    const hot = window.claude && window.claude.hot;
    try {
      if (hot && typeof hot.ready === 'function') { hot.ready(boot); setTimeout(() => boot((hot && hot.data) || {}), 1500); return; }
    } catch (e) {}
    boot((hot && hot.data) || {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
