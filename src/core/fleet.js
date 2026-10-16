// أسطول المحاكاة: سيارات افتراضية على الخريطة، وسائق افتراضي يقبل الطلب ويتحرك على الطريق الحقيقي
// (يُفعّل/يُعطّل من لوحة التحكم: fleetSimulation). يعمل داخل جهاز الراكب فقط.
import { offsetPoint, along, pick, haversine, sleep } from './util.js'
import { route } from './geo.js'
import { updateRide, store } from './api.js'

const FIRST = ['محمد', 'أحمد', 'علي', 'عبدالله', 'سالم', 'خالد', 'مصطفى', 'عمر', 'إبراهيم', 'يوسف', 'حمزة', 'طارق', 'أنس', 'معاذ']
const LAST = ['الورفلي', 'المصراتي', 'الزوي', 'العبيدي', 'الترهوني', 'القماطي', 'البرعصي', 'الفيتوري', 'الشريف', 'المغربي']
const CARS = {
  eco: [['هيونداي', 'أكسنت'], ['كيا', 'ريو'], ['تويوتا', 'ياريس'], ['نيسان', 'صني']],
  comfort: [['تويوتا', 'كورولا'], ['هيونداي', 'إلنترا'], ['كيا', 'سيراتو'], ['هوندا', 'سيفيك']],
  family: [['تويوتا', 'إينوفا'], ['هيونداي', 'H1'], ['كيا', 'كرنفال']],
  vip: [['مرسيدس', 'E200'], ['بي إم دبليو', '520i'], ['لكزس', 'ES350']],
  moto: [['سوزوكي', 'ألتو'], ['هيونداي', 'i10']],
}
const COLORS = ['أبيض', 'أسود', 'فضي', 'رمادي', 'أزرق', 'أحمر']

export function virtualDriver(cls = 'eco') {
  const [make, model] = pick(CARS[cls] || CARS.eco)
  return {
    id: 'sim-' + Math.random().toString(36).slice(2, 8),
    name: `${pick(FIRST)} ${pick(LAST)}`,
    phone: '+21891' + Math.floor(1000000 + Math.random() * 8999999),
    rating: +(4.6 + Math.random() * 0.4).toFixed(1),
    trips: Math.floor(120 + Math.random() * 3000),
    car: `${make} ${model}`,
    color: pick(COLORS),
    plate: `${Math.floor(1 + Math.random() * 99)}-${Math.floor(100000 + Math.random() * 899999)}`,
    simulated: true,
  }
}

// سيارات حول نقطة، تتحرك بشكل عشوائي ناعم
export function spawnCars(center, n = 9) {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = 0.3 + Math.random() * 2.2
    return { id: 'v' + i, pos: offsetPoint(center, Math.cos(a) * d, Math.sin(a) * d), heading: Math.random() * 360, speed: 0.004 + Math.random() * 0.006, cls: pick(['eco', 'eco', 'comfort', 'family', 'vip']) }
  })
}
export function stepCars(cars, center) {
  return cars.map((c) => {
    let h = c.heading + (Math.random() - 0.5) * 18
    if (haversine(c.pos, center) > 2.8) h = (Math.atan2(center[0] - c.pos[0], center[1] - c.pos[1]) * 180) / Math.PI
    const rad = (h * Math.PI) / 180
    return { ...c, heading: (h + 360) % 360, pos: offsetPoint(c.pos, Math.cos(rad) * c.speed * 4, Math.sin(rad) * c.speed * 4) }
  })
}

const running = new Set()

// يدير رحلة محاكاة كاملة: قبول ← الوصول ← بدء ← إنهاء. قابل للاستئناف بعد إعادة فتح التطبيق.
export async function runSimulation(rideId, getRide) {
  if (running.has(rideId)) return
  running.add(rideId)
  try {
    let ride = await getRide()
    if (!ride) return
    if (ride.status === 'searching') {
      const wait = 5000 + Math.random() * 6000
      const end = Date.now() + wait
      while (Date.now() < end) { await sleep(500); ride = await getRide(); if (!ride || ride.status !== 'searching') break }
      if (!ride || ride.status !== 'searching') { if (ride?.driver?.simulated !== true) return }
      else {
        const d = virtualDriver(ride.classId)
        const a = Math.random() * Math.PI * 2, dist = 0.9 + Math.random() * 1.4
        const start = offsetPoint(ride.pickup.coords, Math.cos(a) * dist, Math.sin(a) * dist)
        const toPickup = await route([start, ride.pickup.coords])
        const ok = await store.tx(async (t) => {
          const r = await t.get(`rides/${rideId}`)
          if (!r || r.status !== 'searching') return false
          t.update(`rides/${rideId}`, { status: 'accepted', driverId: d.id, driver: d, acceptedAt: Date.now(), driverLoc: { coords: start, heading: 0 }, approach: { coords: toPickup.coords, durationMin: toPickup.durationMin, distanceKm: toPickup.distanceKm }, phaseAt: Date.now(), updatedAt: Date.now() })
          return true
        })
        if (!ok) return
        ride = await getRide()
      }
    }
    if (!ride?.driver?.simulated) return
    // مرحلة القدوم: مدة عرض مضغوطة (20–45 ثانية) بدل المدة الحقيقية
    if (ride.status === 'accepted') {
      const dur = Math.min(45000, Math.max(20000, (ride.approach?.durationMin || 3) * 9000))
      if (!(await animate(rideId, ride.approach?.coords || [ride.pickup.coords], dur, ride.phaseAt, getRide, 'accepted'))) return
      await updateRide(rideId, { status: 'arrived', arrivedAt: Date.now(), driverLoc: { coords: ride.pickup.coords, heading: 0 }, phaseAt: Date.now() })
      ride = await getRide()
    }
    if (ride.status === 'arrived') {
      const left = 9000 - (Date.now() - (ride.phaseAt || Date.now()))
      if (left > 0) await sleep(left)
      ride = await getRide()
      if (ride?.status !== 'arrived') return
      await updateRide(rideId, { status: 'ongoing', startedAt: Date.now(), phaseAt: Date.now() })
      ride = await getRide()
    }
    if (ride.status === 'ongoing') {
      const dur = Math.min(60000, Math.max(25000, (ride.route?.durationMin || 5) * 6000))
      if (!(await animate(rideId, ride.route?.coords || [ride.dropoff.coords], dur, ride.phaseAt, getRide, 'ongoing'))) return
      await updateRide(rideId, { status: 'completed', completedAt: Date.now(), driverLoc: { coords: ride.dropoff.coords, heading: 0 } })
    }
  } finally { running.delete(rideId) }
}

async function animate(rideId, coords, dur, startAt = Date.now(), getRide, phase) {
  const t0 = startAt || Date.now()
  while (true) {
    const t = (Date.now() - t0) / dur
    const r = await getRide()
    if (!r || r.status !== phase) return false
    const pt = along(coords, Math.min(1, t))
    if (pt) await updateRide(rideId, { driverLoc: { coords: pt.p, heading: pt.h }, progress: Math.min(1, t) }).catch(() => {})
    if (t >= 1) return true
    await sleep(1400)
  }
}
