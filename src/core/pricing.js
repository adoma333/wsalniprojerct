// التسعير حسب العوامل: الفئة، المسافة، الزمن، وقت اليوم (ليل/ذروة)، الطلب، كود الخصم، والانتظار.
import { roundTo } from './util.js'

export function timeFactor(p, d = new Date()) {
  const h = d.getHours()
  const day = d.getDay()
  if (h >= 23 || h < 6) return { mult: p.nightMult || 1, key: 'night' }
  const peak = (h >= 7 && h < 9) || (h >= 16 && h < 19)
  if (peak && day !== 5) return { mult: p.peakMult || 1, key: 'peak' }
  return { mult: 1, key: 'normal' }
}

// الطلب: نسبة الرحلات الجارية إلى السيارات المتاحة
export function demandFactor(searching = 0, available = 5) {
  const ratio = searching / Math.max(1, available)
  if (ratio > 1.5) return 1.3
  if (ratio > 0.8) return 1.15
  return 1
}

export function quote(cls, route, pricing, { demand = 1, promo = null, when = new Date() } = {}) {
  const km = route?.distanceKm || 0
  const min = route?.durationMin || 0
  const tf = timeFactor(pricing, when)
  const raw = cls.base + cls.perKm * km + cls.perMin * min
  const surge = Math.round(tf.mult * demand * 100) / 100
  let subtotal = Math.max(cls.min, raw) * surge
  let discount = 0
  if (promo?.active) {
    discount = promo.type === 'percent' ? (subtotal * promo.value) / 100 : promo.value
    if (promo.max) discount = Math.min(discount, promo.max)
  }
  const total = Math.max(0, roundTo(subtotal - discount, pricing.roundTo || 0.5))
  return {
    total,
    original: roundTo(subtotal, pricing.roundTo || 0.5),
    discount: roundTo(discount, 0.5),
    surge,
    timeKey: tf.key,
    breakdown: { base: cls.base, distance: cls.perKm * km, time: cls.perMin * min, km, min },
  }
}

export function driverNet(total, pricing) {
  const c = (total * (pricing.commission || 0)) / 100
  return { commission: Math.round(c * 100) / 100, net: Math.round((total - c) * 100) / 100 }
}
