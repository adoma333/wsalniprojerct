// خدمات الخرائط المجانية: البحث (Photon/Nominatim)، العنوان العكسي، المسارات (OSRM)، الطقس (Open-Meteo)، والموقع.
import { haversine, isAr, tr, offsetPoint } from './util.js'
import { BRAND } from './config.js'

const cache = new Map()
async function getJSON(url, ms = 8000) {
  if (cache.has(url)) return cache.get(url)
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const j = await r.json()
    cache.set(url, j)
    if (cache.size > 300) cache.delete(cache.keys().next().value)
    return j
  } finally { clearTimeout(t) }
}

const lang = isAr ? 'ar' : 'en'

function photonLabel(p) {
  const name = p.name || p.street || ''
  const sub = [p.street && p.name !== p.street ? p.street : null, p.district, p.city || p.county, p.state].filter(Boolean)
  return { title: name || sub[0] || tr('بلاصة', 'Place'), subtitle: [...new Set(sub)].filter((x) => x !== name).slice(0, 2).join('، ') }
}

export async function searchPlaces(q, near) {
  q = q.trim()
  if (q.length < 2) return []
  const bias = near ? `&lat=${near[1]}&lon=${near[0]}` : ''
  try {
    const j = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8${bias}`)
    const rows = (j.features || []).map((f) => {
      const l = photonLabel(f.properties)
      const c = f.geometry.coordinates
      return { ...l, coords: c, type: f.properties.osm_value, dist: near ? haversine(near, c) : null }
    })
    if (rows.length) return near ? rows.sort((a, b) => (a.dist > 60) - (b.dist > 60)) : rows
  } catch {}
  try {
    const vb = near ? `&viewbox=${near[0] - 0.5},${near[1] + 0.5},${near[0] + 0.5},${near[1] - 0.5}` : ''
    const j = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&accept-language=${lang}&limit=8&countrycodes=${BRAND.country}${vb}`)
    return j.map((r) => ({
      title: r.name || r.display_name.split(',')[0],
      subtitle: r.display_name.split(',').slice(1, 3).join('،'),
      coords: [+r.lon, +r.lat],
      type: r.type,
      dist: near ? haversine(near, [+r.lon, +r.lat]) : null,
    }))
  } catch { return [] }
}

export async function reverse(coords) {
  const [lng, lat] = coords
  const key = `${lng.toFixed(4)},${lat.toFixed(4)}`
  try {
    const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${lang}&zoom=18`)
    const a = j.address || {}
    const title = j.name || [a.road, a.house_number].filter(Boolean).join(' ') || a.neighbourhood || a.suburb || j.display_name?.split(',')[0]
    const subtitle = [a.suburb || a.neighbourhood, a.city || a.town || a.village || a.state].filter(Boolean).filter((x) => x !== title).join('، ')
    if (title) return { title, subtitle, coords }
  } catch {}
  try {
    const j = await getJSON(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`)
    const f = j.features?.[0]
    if (f) return { ...photonLabel(f.properties), coords }
  } catch {}
  return { title: tr('بلاصة محددة', 'Pinned location'), subtitle: key, coords }
}

// مسار على الطرق الحقيقية، وعند تعذّر الخدمة: خط منحنٍ تقديري
export async function route(points) {
  const pts = points.filter(Boolean)
  if (pts.length < 2) return null
  const path = pts.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';')
  try {
    const j = await getJSON(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`, 9000)
    const r = j.routes?.[0]
    if (r) return { coords: simplify(r.geometry.coordinates, 350), distanceKm: r.distance / 1000, durationMin: r.duration / 60 * 1.15, real: true }
  } catch {}
  return fallbackRoute(pts)
}

// مسار المشي على الطرقات والأرصفة (OSRM للمشاة)، وإلا مسار السيارة، وإلا خط مستقيم
export async function walkRoute(a, b) {
  const path = `${a[0].toFixed(6)},${a[1].toFixed(6)};${b[0].toFixed(6)},${b[1].toFixed(6)}`
  for (const base of ['https://routing.openstreetmap.de/routed-foot/route/v1/foot/', 'https://router.project-osrm.org/route/v1/foot/', 'https://router.project-osrm.org/route/v1/driving/']) {
    try {
      const j = await getJSON(`${base}${path}?overview=full&geometries=geojson&steps=false`, 8000)
      const r = j.routes?.[0]
      if (r?.geometry?.coordinates?.length > 1) {
        const c = r.geometry.coordinates
        // نوصلو بداية ونهاية المسار بالنقطتين الحقيقيتين
        return { coords: [a, ...c, b], distanceKm: r.distance / 1000, durationMin: (r.distance / 1000 / 4.8) * 60, real: true }
      }
    } catch {}
  }
  return { coords: [a, b], distanceKm: haversine(a, b) * 1.25, durationMin: (haversine(a, b) * 1.25 / 4.8) * 60, real: false }
}

export function fallbackRoute(pts) {
  const coords = []
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    d += haversine(a, b) * 1.3
    // منحنى بيزيه خفيف ليبدو كطريق
    const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.12, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.12
    for (let t = 0; t <= 1.0001; t += 0.05) {
      coords.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]])
    }
  }
  return { coords, distanceKm: d, durationMin: (d / 32) * 60 + 2, real: false }
}

function simplify(coords, max) {
  if (coords.length <= max) return coords
  const step = coords.length / max
  const out = []
  for (let i = 0; i < coords.length; i += step) out.push(coords[Math.floor(i)])
  out.push(coords[coords.length - 1])
  return out
}

// أكواد طقس Open-Meteo → رمز
const WMO = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '🌨️', 80: '🌦️', 81: '🌧️', 82: '⛈️', 95: '⛈️' }
export async function weather(coords) {
  try {
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${coords[1]}&longitude=${coords[0]}&current=temperature_2m,weather_code,is_day`)
    const c = j.current
    let icon = WMO[c.weather_code] || '🌤️'
    if (!c.is_day && c.weather_code <= 1) icon = '🌙'
    return { temp: Math.round(c.temperature_2m), icon, code: c.weather_code }
  } catch { return null }
}

// ===== الموقع الحالي =====
let nativeGeo = null
async function geoPlugin() {
  if (nativeGeo !== null) return nativeGeo
  try {
    const { Capacitor } = await import('@capacitor/core')
    nativeGeo = Capacitor.isNativePlatform() ? (await import('@capacitor/geolocation')).Geolocation : false
  } catch { nativeGeo = false }
  return nativeGeo
}

export async function currentPosition() {
  // إذا عندنا موقع حديث من المتتبّع المشترك نرجعوه في بلاصتو
  if (lastFix && Date.now() - lastFix.at < 30000) return lastFix
  const g = await geoPlugin()
  if (g) {
    try {
      await g.requestPermissions().catch(() => {})
      const p = await g.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 })
      return { coords: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy, heading: p.coords.heading }
    } catch { return null }
  }
  if (!navigator.geolocation) return null
  return new Promise((res) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res({ coords: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy, heading: p.coords.heading }),
      () => res(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 },
    )
  })
}

// متتبّع موقع واحد مشترك لكل الشاشات: يوفّر البطارية ويمنع تعارض طلبات الموقع
let lastFix = null
const watchers = new Set()
let stopNative = null, starting = null
async function startNative() {
  const push = (fix) => { lastFix = { ...fix, at: Date.now() }; watchers.forEach((f) => { try { f(lastFix) } catch {} }) }
  const g = await geoPlugin()
  if (g) {
    const id = await g.watchPosition({ enableHighAccuracy: true }, (p) => p && push({ coords: [p.coords.longitude, p.coords.latitude], heading: p.coords.heading, speed: p.coords.speed, accuracy: p.coords.accuracy }))
    return () => g.clearWatch({ id })
  }
  if (!navigator.geolocation) return () => {}
  const id = navigator.geolocation.watchPosition(
    (p) => push({ coords: [p.coords.longitude, p.coords.latitude], heading: p.coords.heading, speed: p.coords.speed, accuracy: p.coords.accuracy }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}
export async function watchPosition(cb) {
  watchers.add(cb)
  if (lastFix) setTimeout(() => watchers.has(cb) && cb(lastFix), 0)
  if (!stopNative && !starting) starting = startNative().then((s) => { stopNative = s; starting = null })
  return () => {
    watchers.delete(cb)
    if (!watchers.size) setTimeout(() => { if (!watchers.size && stopNative) { stopNative(); stopNative = null } }, 3000)
  }
}
export const lastPosition = () => lastFix

export { offsetPoint }
export const mapsLink = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}&travelmode=driving`
