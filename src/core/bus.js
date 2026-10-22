// تتبّع الحافلات: الخطوط (محطات + مسار)، مواقع الحافلات (حقيقية من سائقي الحافلات أو محاكاة حسب جدول الخط)،
// وحساب وقت وصول كل حافلة لكل محطة ووقت المشي للمحطة الأقرب.
import { haversine, bearing, offsetPoint } from './util.js'
import { route } from './geo.js'
import { store } from './store.js'

// ===== هندسة المسار =====
export function measure(path) {
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]))
  return { path, cum, len: cum[cum.length - 1] || 0 }
}
// نقطة على بعد d كم من بداية المسار + الاتجاه
export function pointAt(m, d) {
  const { path, cum, len } = m
  if (!path.length) return null
  d = Math.max(0, Math.min(len, d))
  let i = 1
  while (i < cum.length - 1 && cum[i] < d) i++
  const a = path[i - 1], b = path[i] || a, seg = cum[i] - cum[i - 1] || 1
  const f = (d - cum[i - 1]) / seg
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], h: bearing(a, b) }
}
// إسقاط نقطة على المسار: المسافة على المسار + البعد عنه
export function project(m, pt) {
  const { path, cum } = m
  let best = { d: 0, off: Infinity }
  const kx = 111.32 * Math.cos((pt[1] * Math.PI) / 180), ky = 110.57
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]
    const ax = (a[0] - pt[0]) * kx, ay = (a[1] - pt[1]) * ky, bx = (b[0] - pt[0]) * kx, by = (b[1] - pt[1]) * ky
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
    const px = ax + dx * t, py = ay + dy * t, off = Math.hypot(px, py)
    if (off < best.off) best = { d: cum[i - 1] + (cum[i] - cum[i - 1]) * t, off }
  }
  return best
}

// ===== المسار الحقيقي على الطرقات (مخزّن في الذاكرة) =====
const pathCache = new Map()
export async function linePath(line) {
  if (line.path?.length > 1) return line.path
  const key = line.id + ':' + (line.stops || []).map((s) => s.coords.join()).join('|')
  if (pathCache.has(key)) return pathCache.get(key)
  const pts = (line.stops || []).map((s) => s.coords)
  if (pts.length < 2) return pts
  const r = await route(pts).catch(() => null)
  const p = r?.coords?.length > 1 ? r.coords : pts
  pathCache.set(key, p)
  return p
}

// ===== التوقيت =====
const toMin = (hhmm, def) => { const [h, m] = String(hhmm || def).split(':').map(Number); return (h || 0) * 60 + (m || 0) }
export function inService(line, now = new Date()) {
  const t = now.getHours() * 60 + now.getMinutes()
  const a = toMin(line.start, '06:00'), b = toMin(line.end, '20:00')
  return a <= b ? t >= a && t <= b : t >= a || t <= b
}

// حافلات المحاكاة: كل الأجهزة تشوف نفس المواقع لأن الحساب مبني على الساعة (ذهاب ورجوع على نفس المسار)
export function simBuses(line, m, now = Date.now()) {
  if (!m.len || !inService(line, new Date(now))) return []
  const speed = line.speed || 18 // كم/سا بما فيها التوقف في المحطات
  const T = (m.len / speed) * 60 // دقائق الرحلة في اتجاه واحد
  const cycle = 2 * T
  const head = Math.max(3, line.headway || 12)
  const n = Math.max(1, Math.min(line.buses || 99, Math.round(cycle / head)))
  const tMin = now / 60000
  const out = []
  for (let i = 0; i < n; i++) {
    const s = (((tMin - i * (cycle / n)) % cycle) + cycle) % cycle
    const fwd = s < T
    const d = fwd ? (s / T) * m.len : ((cycle - s) / T) * m.len
    const at = pointAt(m, d)
    out.push({ id: `${line.id}-sim${i}`, line: line.id, d, dir: fwd ? 1 : -1, coords: at.p, heading: fwd ? at.h : (at.h + 180) % 360, sim: true })
  }
  return out
}

// وقت وصول الحافلة لنقطة على المسار (بالدقائق) — مع احتساب الدورة إذا فاتتها
export function etaTo(bus, dStop, m, line) {
  const speed = line.speed || 18
  let dist
  if (bus.dir >= 0) dist = dStop >= bus.d ? dStop - bus.d : (m.len - bus.d) + m.len + dStop // تكمّل وترجع
  else dist = dStop <= bus.d ? bus.d - dStop : bus.d + dStop // ترجع للبداية ثم تروح
  return { min: (dist / speed) * 60, dir: bus.dir }
}

// المشي: 5 كم/سا مع معامل التواء الطرق
export const walkMin = (a, b) => (haversine(a, b) * 1.25 / 5) * 60

// ===== البيانات =====
export const watchLines = (cb) => store.watchList('busLines', {}, (l) => cb(l.filter((x) => x.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0))))
export const watchAllLines = (cb) => store.watchList('busLines', {}, (l) => cb(l.sort((a, b) => (a.order || 0) - (b.order || 0))))
export const saveLine = (id, data) => (id ? store.set(`busLines/${id}`, { ...data, updatedAt: Date.now() }, true) : store.add('busLines', { ...data, createdAt: Date.now(), updatedAt: Date.now() }))
export const deleteLine = (id) => store.remove(`busLines/${id}`)
// الحافلات الحقيقية (سائق الحافلة يبث موقعه من تطبيق السائق)
export const watchLiveBuses = (cb) => store.watchList('buses', {}, (b) => cb(b.filter((x) => Date.now() - (x.at || 0) < 3 * 60000)))
export const pushBus = (uid, data) => store.set(`buses/${uid}`, { ...data, uid, at: Date.now() })
export const stopBus = (uid) => store.remove(`buses/${uid}`).catch(() => {})

// ===== خطوط تجريبية لسيدي بلعباس (تتبدّل من لوحة التحكم) =====
export function demoLines(center) {
  const P = (n, e) => offsetPoint(center, n, e)
  return [
    { id: 'demo-1', number: '1', name: 'المحطة البرية ⇄ الجامعة', color: '#E8650A', speed: 17, headway: 10, start: '06:00', end: '21:00', demo: true,
      stops: [['المحطة البرية', P(-1.9, -1.4)], ['حي الأمير عبد القادر', P(-1.1, -0.9)], ['ساحة أول نوفمبر', P(-0.2, -0.1)], ['وسط المدينة', P(0.3, 0.2)], ['المستشفى الجامعي', P(1.0, 0.8)], ['جامعة جيلالي ليابس', P(1.9, 1.7)]].map(([name, coords]) => ({ name, coords })) },
    { id: 'demo-2', number: '7', name: 'سيدي ياسين ⇄ حي الصباح', color: '#2E90FA', speed: 16, headway: 14, start: '06:30', end: '20:30', demo: true,
      stops: [['سيدي ياسين', P(1.5, -2.2)], ['السوق المغطى', P(0.8, -1.2)], ['البلدية', P(0.1, -0.3)], ['ميدان الشهداء', P(-0.4, 0.6)], ['حي العربي بن مهيدي', P(-1.0, 1.4)], ['حي الصباح', P(-1.6, 2.3)]].map(([name, coords]) => ({ name, coords })) },
    { id: 'demo-3', number: '12', name: 'الطريق الدائري', color: '#12B76A', speed: 20, headway: 18, start: '07:00', end: '19:30', demo: true,
      stops: [['محطة القطار', P(0.6, 0.0)], ['المدينة الجديدة', P(1.4, -0.8)], ['حي 1000 مسكن', P(0.4, -1.7)], ['الملعب', P(-0.9, -1.0)], ['الحديقة العمومية', P(-0.7, 0.4)], ['محطة القطار ', P(0.55, 0.05)]].map(([name, coords]) => ({ name, coords })) },
  ]
}
