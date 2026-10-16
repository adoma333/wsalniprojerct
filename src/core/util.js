import { BRAND } from './config.js'

// ===== اللغة =====
export const LANG = (() => { try { return localStorage.getItem('w_lang') || 'ar' } catch { return 'ar' } })()
export const isAr = LANG === 'ar'
export const tr = (ar, en) => (isAr || en == null ? ar : en)
export function setLang(l) { localStorage.setItem('w_lang', l); location.reload() }
export function applyDocLang() {
  document.documentElement.lang = LANG
  document.documentElement.dir = isAr ? 'rtl' : 'ltr'
}

// ===== السمة =====
export function getTheme() { try { return localStorage.getItem('w_theme') || 'auto' } catch { return 'auto' } }
export function applyTheme(t = getTheme()) {
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  return dark
}
export function setTheme(t) { localStorage.setItem('w_theme', t); applyTheme(t); window.dispatchEvent(new Event('w-theme')) }
export const isDark = () => document.documentElement.dataset.theme === 'dark'

// ===== أرقام ومال =====
const nf = new Intl.NumberFormat(isAr ? 'ar-LY' : 'en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
const nfEn = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
export const num = (n) => nfEn.format(Number(n) || 0)
export const money = (n) => `${nfEn.format(Math.round((Number(n) || 0) * 100) / 100)} ${isAr ? BRAND.currency : BRAND.currencyEn}`
export const cur = () => (isAr ? BRAND.currency : BRAND.currencyEn)
export const roundTo = (n, step = 0.5) => Math.round(n / step) * step
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function km(d) { return d < 1 ? `${Math.round(d * 1000)} ${tr('م', 'm')}` : `${d.toFixed(1)} ${tr('كم', 'km')}` }
export function mins(m) {
  m = Math.max(1, Math.round(m))
  if (m < 60) return `${m} ${tr('د', 'min')}`
  return `${Math.floor(m / 60)}${tr('س', 'h')} ${m % 60}${tr('د', 'm')}`
}
export function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return tr('الآن', 'now')
  if (s < 3600) return tr(`منذ ${Math.floor(s / 60)} د`, `${Math.floor(s / 60)}m ago`)
  if (s < 86400) return tr(`منذ ${Math.floor(s / 3600)} س`, `${Math.floor(s / 3600)}h ago`)
  return tr(`منذ ${Math.floor(s / 86400)} يوم`, `${Math.floor(s / 86400)}d ago`)
}
export function dateTime(t) {
  return new Date(t).toLocaleString(isAr ? 'ar-LY' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function compact(n) {
  n = Number(n) || 0
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// ===== جغرافيا =====
export function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
export function bearing(a, b) {
  const rad = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * rad) * Math.cos(b[1] * rad)
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad) - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((b[0] - a[0]) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}
export function lineLength(coords) {
  let d = 0
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i])
  return d
}
// نقطة على المسار عند نسبة t (0..1) مع الاتجاه
export function along(coords, t) {
  if (!coords?.length) return null
  if (coords.length === 1) return { p: coords[0], h: 0 }
  const total = lineLength(coords)
  let target = clamp(t, 0, 1) * total
  for (let i = 1; i < coords.length; i++) {
    const seg = haversine(coords[i - 1], coords[i])
    if (target <= seg || i === coords.length - 1) {
      const f = seg ? clamp(target / seg, 0, 1) : 0
      const a = coords[i - 1], b = coords[i]
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], h: bearing(a, b) }
    }
    target -= seg
  }
  return { p: coords[coords.length - 1], h: 0 }
}
export function offsetPoint([lng, lat], kmN, kmE) {
  return [lng + kmE / (111.32 * Math.cos((lat * Math.PI) / 180)), lat + kmN / 110.57]
}

// ===== متفرقات =====
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const shortId = (n = 6) => Math.random().toString(36).slice(2, 2 + n).toUpperCase()
export function seeded(seed) {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => (w.startsWith('ال') && w.length > 2 ? w[2] : w[0])).join(' ').toUpperCase() || 'و'
}
export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return tr('صباح الخير', 'Good morning')
  if (h < 18) return tr('مساء الخير', 'Good afternoon')
  return tr('مساء الخير', 'Good evening')
}
export function haptic(type = 'light') {
  import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
    Haptics.impact({ style: type === 'heavy' ? ImpactStyle.Heavy : type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => navigator.vibrate?.(10))
  }).catch(() => navigator.vibrate?.(10))
}
export async function shareLink({ title, text, url }) {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, url })
      return true
    }
  } catch {}
  if (navigator.share) { try { await navigator.share({ title, text, url }); return true } catch { return false } }
  try { await navigator.clipboard.writeText(`${text} ${url || ''}`.trim()); return 'copied' } catch { return false }
}
export async function copy(text) { try { await navigator.clipboard.writeText(text); return true } catch { return false } }

// تصغير صورة لملف base64 صغير (المستندات والصور الشخصية)
export function compressImage(file, max = 900, q = 0.72) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL('image/jpeg', q))
      }
      img.onerror = rej
      img.src = r.result
    }
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export function forceHttps() {
  if (location.protocol === 'http:' && /surge\.sh$/.test(location.hostname)) location.replace('https://' + location.host + location.pathname + location.search + location.hash)
}
