// عامل خدمة بسيط للعمل كتطبيق ويب (آيفون) — غير مفعّل داخل تطبيق أندرويد
export async function registerSW() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform() || !('serviceWorker' in navigator) || location.protocol !== 'https:') return
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  } catch {}
}
