/**
 * 顶部安全区兜底。
 *
 * Android 15 起 WebView 强制 edge-to-edge，页面会铺到状态栏下面，让位靠 CSS 的
 * `env(safe-area-inset-top)`。主流 WebView 会给值，但个别 ROM / 旧内核会返回 0，
 * 那时标题就被状态栏压住。这里实测一次真实值，确认是 0 且确实跑在原生壳里时，
 * 用一个偏保守的常见状态栏高度顶上，宁可多留几像素也不压字。
 */
export function ensureSafeAreaTop() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(probe);
  const measured = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  if (measured >= 1) return;

  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return;

  const fallback = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 47 : 24;
  document.documentElement.style.setProperty('--safe-top', `${fallback}px`);
}
