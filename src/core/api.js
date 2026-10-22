// منطق المنصة فوق طبقة البيانات: الإعدادات، الركاب، السائقين، الرحلات، المكافآت، المحفظة، الدعم.
import { store, auth } from './store.js'
import { DEFAULT_SETTINGS, pointsToDa, daToPoints } from './config.js'
import { shortId } from './util.js'

// ===== الإعدادات =====
function merge(def, val) {
  if (!val || typeof val !== 'object' || Array.isArray(def)) return val ?? def
  const out = { ...def }
  for (const k of Object.keys(val)) out[k] = def && typeof def[k] === 'object' && !Array.isArray(def[k]) ? merge(def[k], val[k]) : val[k]
  return out
}
export const withDefaults = (s) => merge(DEFAULT_SETTINGS, s || {})
export function watchSettings(cb) { return store.watch('settings/app', (s) => cb(withDefaults(s))) }
export async function getSettings() { return withDefaults(await store.get('settings/app').catch(() => null)) }
export async function saveSettings(patch, note) {
  await store.set('settings/app', { ...patch, updatedAt: Date.now() }, true)
  audit('settings', note || `تعديل: ${Object.keys(patch).join('، ')}`)
}
// ===== سجل العمليات (لوحة التحكم) =====
export const audit = (action, detail = '', extra = {}) => store.add('audit', { action, detail, ...extra, at: Date.now() }).catch(() => {})
export const watchAudit = (cb) => store.watchList('audit', { orderBy: ['at', 'desc'], limit: 300 }, cb)

// ===== الركاب =====
export const watchUser = (uid, cb) => store.watch(`users/${uid}`, cb)
export const getUser = (uid) => store.get(`users/${uid}`)
export const updateUser = (uid, patch) => store.update(`users/${uid}`, { ...patch, updatedAt: Date.now() })

export async function registerRider(uid, { name, phone, email, city, referral }) {
  const exists = await store.get(`users/${uid}`)
  const code = 'W' + shortId(5)
  const data = {
    name, phone, email: email || '', city: city || 'sba', role: 'rider', createdAt: Date.now(), updatedAt: Date.now(),
    points: 0, wallet: 0, earnedTotal: 0, trips: 0, cancelled: 0, referrals: 0, rating: 5, ratingCount: 0,
    referralCode: exists?.referralCode || code, referredBy: referral || '', savedPlaces: exists?.savedPlaces || {}, blocked: false,
  }
  await store.set(`users/${uid}`, exists ? { ...exists, name, phone, email: email || exists.email || '', city: city || exists.city } : data)
  if (!exists && referral) {
    const ref = (await store.list('users', { where: [['referralCode', '==', referral.toUpperCase()]], limit: 1 }))[0]
    if (ref && ref.id !== uid) await store.add('referrals', { from: ref.id, to: uid, at: Date.now(), kind: 'rider' }).catch(() => {})
  }
}

export async function addTx(uid, tx, who = 'rider') { return store.add(`${who === 'driver' ? 'drivers' : 'users'}/${uid}/tx`, { ...tx, at: Date.now() }) }
export const watchTx = (uid, cb, who = 'rider') => store.watchList(`${who === 'driver' ? 'drivers' : 'users'}/${uid}/tx`, { orderBy: ['at', 'desc'], limit: 60 }, cb)

// ===== الريلز والمكافآت =====
export const watchViews = (uid, cb) => store.watchList(`users/${uid}/views`, {}, cb)
export const watchCustomReels = (cb) => store.watchList('reels', {}, (r) => cb(r.filter((x) => x.active !== false)))
export const watchAllReels = (cb) => store.watchList('reels', {}, cb)
export const saveReel = (id, data) => (id ? store.set(`reels/${id}`, data, true) : store.add('reels', { ...data, createdAt: Date.now() }))
export const deleteReel = (id) => store.remove(`reels/${id}`)

const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10)

export async function claimReel(uid, reel, rw) {
  const reward = Math.round(Number(reel.points ?? rw.pointsPerReel) || 0)
  const today = dayKey()
  return store.tx(async (t) => {
    const v = await t.get(`users/${uid}/views/${reel.id}`)
    if (v) return { ok: false, reason: 'seen' }
    const u = await t.get(`users/${uid}`)
    if (!u) return { ok: false, reason: 'nouser' }
    const todayCount = u.viewsDay === today ? u.viewsToday || 0 : 0
    if (todayCount >= rw.dailyLimit) return { ok: false, reason: 'limit' }
    t.set(`users/${uid}/views/${reel.id}`, { at: Date.now(), reward, day: today })
    t.update(`users/${uid}`, { points: store.inc(reward), earnedTotal: store.inc(reward), viewsToday: todayCount + 1, viewsDay: today, lastView: reel.id, updatedAt: Date.now() })
    return { ok: true, reward }
  }).then(async (r) => {
    if (r.ok) {
      await addTx(uid, { kind: 'reel', amount: reward, currency: 'points', title: `إشهار: ${reel.advertiser}` }).catch(() => {})
      if (rw.autoConvert) {
        const u = await store.get(`users/${uid}`)
        if ((u?.points || 0) >= (rw.autoConvertAt || 0)) await convertPoints(uid, rw, u.points).catch(() => {})
      }
      store.set(`reelStats/${reel.id}`, { views: store.inc(1) }, true).catch(() => {})
    }
    return r
  })
}

// تحويل النقاط إلى دنانير في البورتفاي بالسعر الحالي (يحدده الأدمن)
export async function convertPoints(uid, rw, pts) {
  const r = await store.tx(async (t) => {
    const u = await t.get(`users/${uid}`)
    const have = u?.points || 0
    const p = Math.min(Math.floor(pts ?? have), have)
    if (p <= 0 || p < (rw.minConvert || 0)) return { ok: false, reason: 'min' }
    const da = pointsToDa(p, rw)
    t.update(`users/${uid}`, { points: store.inc(-p), wallet: store.inc(da), lastConvert: { points: p, da, at: Date.now() }, updatedAt: Date.now() })
    return { ok: true, points: p, da }
  })
  if (r.ok) {
    await addTx(uid, { kind: 'convert', amount: -r.points, currency: 'points', title: 'تحويل النقاط للبورتفاي' }).catch(() => {})
    await addTx(uid, { kind: 'convert', amount: r.da, currency: 'wallet', title: `تحويل ${r.points} نقطة` }).catch(() => {})
  }
  return r
}

export const watchReelStats = (cb) => store.watchList('reelStats', {}, cb)
export const watchLikes = (uid, cb) => store.watchList(`users/${uid}/likes`, {}, cb)
export async function likeReel(uid, reelId, on) {
  if (on) await store.set(`users/${uid}/likes/${reelId}`, { at: Date.now() })
  else await store.remove(`users/${uid}/likes/${reelId}`)
  await store.set(`reelStats/${reelId}`, { likes: store.inc(on ? 1 : -1) }, true).catch(() => {})
}
export const clickReel = (reelId) => store.set(`reelStats/${reelId}`, { clicks: store.inc(1) }, true).catch(() => {})
export const shareReel = (reelId) => store.set(`reelStats/${reelId}`, { shares: store.inc(1) }, true).catch(() => {})
export const watchComments = (reelId, cb) => store.watchList(`reelStats/${reelId}/comments`, { orderBy: ['at', 'desc'], limit: 80 }, cb)
export async function addComment(reelId, uid, name, text) {
  await store.add(`reelStats/${reelId}/comments`, { uid, name, text: text.slice(0, 400), at: Date.now() })
  await store.set(`reelStats/${reelId}`, { comments: store.inc(1) }, true).catch(() => {})
}

// ===== أكواد الخصم والقسائم =====
export async function checkPromo(code) {
  code = code.trim().toUpperCase()
  if (!code) return null
  const p = await store.get(`promos/${code}`).catch(() => null)
  if (!p || !p.active) return null
  if (p.expires && p.expires < Date.now()) return null
  if (p.maxUses && (p.used || 0) >= p.maxUses) return null
  return { ...p, code }
}
export const watchPromos = (cb) => store.watchList('promos', {}, cb)
export const savePromo = (code, data) => store.set(`promos/${code.toUpperCase()}`, { ...data, code: code.toUpperCase() }, true)
export const deletePromo = (code) => store.remove(`promos/${code}`)

export async function redeemVoucher(uid, code, who = 'rider') {
  const col = who === 'driver' ? 'drivers' : 'users'
  code = code.trim().toUpperCase()
  const r = await store.tx(async (t) => {
    const v = await t.get(`vouchers/${code}`)
    if (!v) return { ok: false, msg: 'الكود غير صحيح' }
    if (v.used) return { ok: false, msg: 'تم استخدام هذا الكود' }
    t.update(`vouchers/${code}`, { used: true, usedBy: uid, usedAt: Date.now() })
    t.update(`${col}/${uid}`, { wallet: store.inc(v.amount), lastVoucher: code, updatedAt: Date.now() })
    return { ok: true, amount: v.amount }
  })
  if (r.ok) await addTx(uid, { kind: 'topup', amount: r.amount, currency: 'wallet', title: `شحن رصيد بقسيمة ${code}` }, who).catch(() => {})
  return r
}
// ===== الشحن (الذهبية / CIB / بريدي موب) =====
// في الوضع التجريبي يُشحن الرصيد مباشرة، وإلا يبقى الطلب "قيد المراجعة" حتى يوافق الأدمن
// who: 'rider' (users) أو 'driver' (drivers) — نفس طرق الدفع للزبون والسائق
export async function topUp(uid, { amount, method, last4 = '', receipt = '', ref = '' }, payments, who = 'rider') {
  amount = Math.round(Number(amount) || 0)
  const instant = payments.demo && method !== 'baridimob'
  const id = 'T' + Date.now().toString(36).toUpperCase() + shortId(3)
  const col = who === 'driver' ? 'drivers' : 'users'
  await store.tx(async (t) => {
    t.set(`topups/${id}`, { uid, who, amount, method, last4, receipt, ref, status: instant ? 'paid' : 'pending', demo: !!payments.demo, at: Date.now() })
    if (instant) t.update(`${col}/${uid}`, { wallet: store.inc(amount), lastTopup: id, updatedAt: Date.now() })
  })
  if (instant) await addTx(uid, { kind: 'topup', amount, currency: 'wallet', title: `شحن ${METHOD_NAMES[method] || method}${last4 ? ' •••• ' + last4 : ''}` }, who).catch(() => {})
  return { id, status: instant ? 'paid' : 'pending', amount }
}
export const METHOD_NAMES = { edahabia: 'الذهبية', cib: 'CIB', baridimob: 'بريدي موب', voucher: 'كارطة شحن' }
export const watchTopups = (cb) => store.watchList('topups', { orderBy: ['at', 'desc'], limit: 300 }, cb)
export const watchMyTopups = (uid, cb) => store.watchList('topups', { where: [['uid', '==', uid]] }, (t) => cb(t.sort((a, b) => b.at - a.at)))
export async function reviewTopup(t, approve, note = '') {
  await store.update(`topups/${t.id}`, { status: approve ? 'paid' : 'rejected', reviewedAt: Date.now(), note })
  audit('topup', `${approve ? 'قبول' : 'رفض'} شحن ${t.amount} دج (${t.name || t.uid})`)
  if (approve) {
    await store.update(`${t.who === 'driver' ? 'drivers' : 'users'}/${t.uid}`, { wallet: store.inc(t.amount), updatedAt: Date.now() })
    await addTx(t.uid, { kind: 'topup', amount: t.amount, currency: 'wallet', title: `شحن ${METHOD_NAMES[t.method] || t.method}` }, t.who).catch(() => {})
  }
}

export const watchVouchers = (cb) => store.watchList('vouchers', { orderBy: ['createdAt', 'desc'], limit: 300 }, cb)
export async function createVouchers(n, amount) {
  const codes = []
  for (let i = 0; i < n; i++) {
    const code = 'WS' + shortId(8)
    await store.set(`vouchers/${code}`, { amount, used: false, createdAt: Date.now() })
    codes.push(code)
  }
  return codes
}

// ===== الرحلات =====
export async function createRide(ride) {
  return store.add('rides', { ...ride, status: ride.scheduledAt ? 'scheduled' : 'searching', createdAt: Date.now(), updatedAt: Date.now(), declinedBy: [] })
}
export const watchRide = (id, cb) => store.watch(`rides/${id}`, cb)
export const updateRide = (id, patch) => store.update(`rides/${id}`, { ...patch, updatedAt: Date.now() })
export const watchRiderRides = (uid, cb) => store.watchList('rides', { where: [['riderId', '==', uid]] }, (r) => cb(r.sort((a, b) => b.createdAt - a.createdAt)))
export const watchDriverRides = (uid, cb) => store.watchList('rides', { where: [['driverId', '==', uid]] }, (r) => cb(r.sort((a, b) => b.createdAt - a.createdAt)))
export const watchSearching = (cb) => store.watchList('rides', { where: [['status', '==', 'searching']] }, cb)
export const watchAllRides = (cb, n = 500) => store.watchList('rides', { orderBy: ['createdAt', 'desc'], limit: n }, cb)

export async function cancelRide(id, by, reason = '') {
  await updateRide(id, { status: 'cancelled', cancelledBy: by, cancelReason: reason, cancelledAt: Date.now() })
}

export async function acceptRide(rideId, driver) {
  return store.tx(async (t) => {
    const r = await t.get(`rides/${rideId}`)
    if (!r || r.status !== 'searching') return false
    t.update(`rides/${rideId}`, { status: 'accepted', driverId: driver.id, driver, acceptedAt: Date.now(), updatedAt: Date.now() })
    return true
  })
}
export const declineRide = (rideId, uid) => store.update(`rides/${rideId}`, { declinedBy: store.union(uid) })

// الدفع غير النقدي يُخصم من جهاز الراكب بعد اكتمال الرحلة (مرة واحدة)
export async function settleRide(uid, ride) {
  if (ride.status !== 'completed' || ride.charged) return
  const amount = (ride.fare?.total || 0) + (ride.tip || 0)
  await store.tx(async (t) => {
    const r = await t.get(`rides/${ride.id}`)
    if (!r || r.charged) return
    const u = await t.get(`users/${uid}`)
    const field = ride.payment === 'points' ? 'points' : ride.payment === 'wallet' ? 'wallet' : null
    const patch = { trips: store.inc(1), updatedAt: Date.now() }
    const due = field === 'points' ? (ride.pointsCost ?? daToPoints(amount, ride.pointsRate)) : amount
    if (field) patch[field] = store.inc(-Math.min(due, u?.[field] || 0))
    t.update(`users/${uid}`, patch)
    t.update(`rides/${ride.id}`, { charged: true })
  })
  if (ride.payment !== 'cash') await addTx(uid, { kind: 'ride', amount: ride.payment === 'points' ? -(ride.pointsCost ?? daToPoints(amount, ride.pointsRate)) : -amount, currency: ride.payment === 'points' ? 'points' : 'wallet', title: ride.payment === 'points' ? 'كورسة بلاش بالنقاط' : 'خلاص كورسة من البورتفاي' }).catch(() => {})
}

export const watchMessages = (rideId, cb) => store.watchList(`rides/${rideId}/messages`, { orderBy: ['at', 'asc'], limit: 200 }, cb)
export const sendMessage = (rideId, from, text) => store.add(`rides/${rideId}/messages`, { from, text: text.slice(0, 500), at: Date.now() })

// ===== السائقون =====
export const watchDriver = (uid, cb) => store.watch(`drivers/${uid}`, cb)
export const getDriver = (uid) => store.get(`drivers/${uid}`)
export const updateDriver = (uid, patch) => store.update(`drivers/${uid}`, { ...patch, updatedAt: Date.now() })
export const watchOnlineDrivers = (cb) => store.watchList('drivers', { where: [['online', '==', true]] }, (d) => cb(d.filter((x) => Date.now() - (x.lastSeen || 0) < 10 * 60000)))
export const watchAllDrivers = (cb) => store.watchList('drivers', {}, (d) => cb(d.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))))
export async function registerDriver(uid, data, autoApprove) {
  const exists = await store.get(`drivers/${uid}`)
  await store.set(`drivers/${uid}`, {
    ...(exists || { createdAt: Date.now(), rating: 5, ratingCount: 0, trips: 0, earnings: 0, wallet: 0, online: false, referralCode: 'D' + shortId(5), referrals: 0 }),
    ...data,
    status: exists?.status === 'approved' ? 'approved' : autoApprove ? 'approved' : 'pending',
    updatedAt: Date.now(),
  })
}

// ===== الإشعارات والدعم =====
export const watchNotifications = (cb) => store.watchList('notifications', { orderBy: ['at', 'desc'], limit: 40 }, cb)
export const sendNotification = (n) => store.add('notifications', { ...n, at: Date.now() })
export const deleteNotification = (id) => store.remove(`notifications/${id}`)
export const createTicket = (t) => store.add('tickets', { ...t, status: 'open', at: Date.now(), replies: [] })
export const watchTickets = (cb) => store.watchList('tickets', { orderBy: ['at', 'desc'], limit: 200 }, cb)
export const watchMyTickets = (uid, cb) => store.watchList('tickets', { where: [['uid', '==', uid]] }, (t) => cb(t.sort((a, b) => b.at - a.at)))
export const updateTicket = (id, patch) => store.update(`tickets/${id}`, patch)
export const watchUsers = (cb) => store.watchList('users', {}, (u) => cb(u.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))))
export const sos = (data) => store.add('sos', { ...data, at: Date.now() })
export const watchSos = (cb) => store.watchList('sos', { orderBy: ['at', 'desc'], limit: 50 }, cb)

export async function deleteAccount(kind, uid) {
  await store.update(`${kind}/${uid}`, { deleted: true, name: 'محذوف', phone: '', email: '', online: false }).catch(() => {})
  await auth.reset()
}
export { store, auth }

// ===== خصم الطلبة =====
export const UNIVERSITIES = [
  'جامعة جيلالي ليابس – سيدي بلعباس', 'جامعة هواري بومدين (USTHB) – الجزائر', 'جامعة الجزائر 1 – بن يوسف بن خدة', 'جامعة الجزائر 2 – أبو القاسم سعد الله', 'جامعة الجزائر 3',
  'جامعة وهران 1 – أحمد بن بلة', 'جامعة وهران 2 – محمد بن أحمد', 'جامعة العلوم والتكنولوجيا – وهران (USTO)', 'جامعة قسنطينة 1 – الإخوة منتوري', 'جامعة باجي مختار – عنابة',
  'جامعة فرحات عباس – سطيف 1', 'جامعة سعد دحلب – البليدة 1', 'جامعة أبو بكر بلقايد – تلمسان', 'جامعة باتنة 2', 'جامعة عبد الرحمان ميرة – بجاية',
  'جامعة عبد الحميد بن باديس – مستغانم', 'جامعة مولود معمري – تيزي وزو', 'المدرسة الوطنية العليا للإعلام الآلي (ESI)', 'المدرسة الوطنية المتعددة التقنيات', 'جامعة أخرى / معهد',
]
export function academicYearEnd(now = new Date()) {
  const y = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
  return new Date(y, 6, 31, 23, 59).getTime()
}
export async function submitStudent(uid, { university, matricule, fullName, card }, st) {
  const auto = st?.autoVerify !== false
  const student = {
    status: auto ? 'verified' : 'pending', university, matricule, fullName, card,
    discount: st?.discount ?? 30, submittedAt: Date.now(), verifiedAt: auto ? Date.now() : null, expires: academicYearEnd(),
  }
  await store.update(`users/${uid}`, { student, updatedAt: Date.now() })
  if (!auto) await store.set(`students/${uid}`, { uid, ...student, card: '' })
  return student
}
export const studentActive = (u, st) => !!(st?.enabled !== false && u?.student?.status === 'verified' && (!u.student.expires || u.student.expires > Date.now()))
export async function reviewStudent(uid, approve, note = '') {
  const u = await store.get(`users/${uid}`)
  await store.update(`users/${uid}`, { student: { ...(u?.student || {}), status: approve ? 'verified' : 'rejected', verifiedAt: approve ? Date.now() : null, note } })
  await store.remove(`students/${uid}`).catch(() => {})
  audit('student', `${approve ? 'توثيق' : 'رفض'} بطاقة طالب (${u?.name || uid})`)
}
export const watchStudents = (cb) => store.watchList('students', { orderBy: ['submittedAt', 'desc'] }, cb)

// ===== محفظة السائق: سحب الأرباح =====
export const WITHDRAW_METHODS = { ccp: 'حساب CCP (بريد الجزائر)', baridimob: 'بريدي موب (RIP)', bank: 'حساب بنكي' }
export async function requestWithdraw(uid, { amount, method, account, name }, dw) {
  amount = Math.round(Number(amount) || 0)
  if (amount < (dw?.withdrawMin || 0)) throw new Error(`أقل مبلغ للسحب ${dw.withdrawMin} دج`)
  const id = 'W' + Date.now().toString(36).toUpperCase() + shortId(3)
  // المبلغ يتحجز من الرصيد في نفس اللحظة، ويرجع إذا ترفض الطلب
  await store.tx(async (t) => {
    const d = await t.get(`drivers/${uid}`)
    if ((d?.wallet || 0) < amount) throw new Error('الرصيد ما يكفيش')
    t.set(`withdrawals/${id}`, { uid, name: d.name, phone: d.phone, amount, method, account, holder: name, status: 'pending', at: Date.now() })
    t.update(`drivers/${uid}`, { wallet: store.inc(-amount), updatedAt: Date.now() })
  })
  await addTx(uid, { kind: 'withdraw', amount: -amount, currency: 'wallet', title: `طلب سحب إلى ${WITHDRAW_METHODS[method] || method}` }, 'driver').catch(() => {})
  return id
}
export const watchWithdrawals = (cb) => store.watchList('withdrawals', { orderBy: ['at', 'desc'], limit: 300 }, cb)
export const watchMyWithdrawals = (uid, cb) => store.watchList('withdrawals', { where: [['uid', '==', uid]] }, (w) => cb(w.sort((a, b) => b.at - a.at)))
export const watchMyTopupsAs = (uid, cb) => store.watchList('topups', { where: [['uid', '==', uid]] }, (t) => cb(t.sort((a, b) => b.at - a.at)))
export async function reviewWithdraw(w, approve, note = '') {
  await store.update(`withdrawals/${w.id}`, { status: approve ? 'paid' : 'rejected', reviewedAt: Date.now(), note })
  if (!approve) {
    await store.update(`drivers/${w.uid}`, { wallet: store.inc(w.amount), updatedAt: Date.now() })
    await addTx(w.uid, { kind: 'refund', amount: w.amount, currency: 'wallet', title: 'إرجاع مبلغ سحب مرفوض' + (note ? ` (${note})` : '') }, 'driver').catch(() => {})
  }
  audit('withdraw', `${approve ? 'تحويل' : 'رفض'} سحب ${w.amount} دج (${w.name || w.uid})`)
}

// ===== تحديات اليوم للسائق (مكافآت حسب عدد الكورسات) =====
export async function claimQuest(uid, day, idx, bonus, trips) {
  const key = `${day}:${idx}`
  const ok = await store.tx(async (t) => {
    const d = await t.get(`drivers/${uid}`)
    if ((d?.questsDone || []).includes(key)) return false
    t.update(`drivers/${uid}`, { wallet: store.inc(bonus), questsDone: [...(d?.questsDone || []).filter((k) => k.startsWith(day)), key], bonusTotal: store.inc(bonus), updatedAt: Date.now() })
    return true
  })
  if (ok) await addTx(uid, { kind: 'bonus', amount: bonus, currency: 'wallet', title: `مكافأة تحدي ${trips} كورسات اليوم 🏆` }, 'driver').catch(() => {})
  return ok
}
