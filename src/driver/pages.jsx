import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, XCircle, ThumbsDown, User, Mail, Shuffle, Car, FileText, Languages, Settings as SetIco, LogOut, UserX, Camera, Copy, Share2, Gift,
  Users, CalendarClock, ArrowDownLeft, ArrowUpRight, TrendingUp, Clock, Wallet as WalletIco, MapPin, Banknote, Info,
} from 'lucide-react'
import { Page, Empty, Row, Sheet, toast, Avatar, Stars, useNav } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { ClassCar } from '@/ui/art.jsx'
import { StatusBadge, RouteSummary, Plate, ChatPage } from '@/ui/ride-ui.jsx'
import { tr, money, dateTime, km, mins, copy, shareLink, compressImage, isAr, LANG } from '@/core/util.js'
import { CITIES, SITE_URL } from '@/core/config.js'
import { driverNet } from '@/core/pricing.js'
import { watchDriverRides, updateDriver, deleteAccount, store, updateRide } from '@/core/api.js'
import { DOC_LIST } from './App.jsx'
import { rating } from './Home.jsx'
export { Notifications, Support, Settings } from '@/ui/common-pages.jsx'
export { ChatPage }

function useMyRides() {
  const { uid } = useApp()
  const [rides, setRides] = useState(null)
  useEffect(() => watchDriverRides(uid, setRides), [uid])
  return rides
}
const netOf = (r, p) => (r.driverNet ?? driverNet(r.fare?.total || 0, p).net) + (r.tip || 0)

export function Trips() {
  const rides = useMyRides()
  const nav = useNav()
  const { settings } = useApp()
  const [tab, setTab] = useState('done')
  const list = (rides || []).filter((r) => (tab === 'done' ? r.status === 'completed' : r.status === 'cancelled'))
  return (
    <Page title={tr('الرحلات', 'Trips')}>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>{tr('المكتملة', 'Completed')}</button>
        <button className={tab === 'cancel' ? 'active' : ''} onClick={() => setTab('cancel')}>{tr('الملغاة', 'Cancelled')}</button>
      </div>
      {rides && list.length === 0 && <Empty icon={<Car size={36} />} title={tr('لا توجد رحلات', 'No trips')} sub={tr('اتصل واستقبل أول طلب', 'Go online to get your first request')} />}
      <div className="col" style={{ gap: 10 }}>
        {list.map((r) => (
          <button key={r.id} className="card pad" style={{ textAlign: 'start' }} onClick={() => nav.push('trip', { id: r.id })}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span><b>{r.riderName}</b><div className="tiny muted">{dateTime(r.createdAt)}</div></span>
              <span style={{ textAlign: 'end' }}><b className="num" style={{ color: 'var(--success)' }}>+{money(netOf(r, settings.pricing))}</b><div><StatusBadge s={r.status} /></div></span>
            </div>
            <RouteSummary ride={r} compact />
          </button>
        ))}
      </div>
    </Page>
  )
}

export function TripDetail({ id }) {
  const [r, setR] = useState(null)
  const { settings } = useApp()
  useEffect(() => store.watch(`rides/${id}`, setR), [id])
  if (!r) return <Page title={tr('تفاصيل الرحلة', 'Trip')} />
  const { net, commission } = driverNet(r.fare?.total || 0, settings.pricing)
  return (
    <Page title={tr('تفاصيل الرحلة', 'Trip')}>
      <div className="card pad">
        <div className="between"><StatusBadge s={r.status} /><span className="tiny muted">{dateTime(r.createdAt)}</span></div>
        <div className="mt"><RouteSummary ride={r} compact /></div>
        <div className="grid3 mt" style={{ background: 'var(--card-2)', borderRadius: 16 }}>
          <div className="stat"><b className="num">{km(r.route?.distanceKm || 0)}</b><small>{tr('المسافة', 'Distance')}</small></div>
          <div className="stat"><b className="num">{mins(r.route?.durationMin || 0)}</b><small>{tr('المدة', 'Time')}</small></div>
          <div className="stat"><b>{r.className}</b><small>{tr('الفئة', 'Class')}</small></div>
        </div>
      </div>
      <div className="section-title">{tr('الأرباح', 'Earnings')}</div>
      <div className="list">
        <Row title={tr('أجرة الرحلة', 'Fare')} right={<span className="num">{money(r.fare?.total)}</span>} chevron={false} />
        <Row title={tr(`عمولة التطبيق (${settings.pricing.commission}%)`, 'Commission')} right={<span className="num" style={{ color: 'var(--danger)' }}>-{money(r.commission ?? commission)}</span>} chevron={false} />
        {r.tip > 0 && <Row title={tr('إكرامية', 'Tip')} right={<span className="num">{money(r.tip)}</span>} chevron={false} />}
        <Row title={<b>{tr('صافي ربحك', 'Your net')}</b>} sub={r.payment === 'cash' ? tr('تم التحصيل نقدًا', 'Collected in cash') : tr('يضاف لمحفظتك', 'Added to wallet')} right={<b className="num" style={{ color: 'var(--success)', fontSize: 18 }}>{money((r.driverNet ?? net) + (r.tip || 0))}</b>} chevron={false} />
      </div>
      {r.ratingByRider && <div className="card pad mt center"><div className="small muted">{tr('تقييم الراكب لك', 'Rider rating')}</div><Stars value={r.ratingByRider} size={24} />{r.riderComment && <div className="small mt">"{r.riderComment}"</div>}</div>}
    </Page>
  )
}

export function Scheduled() {
  const { uid, driver } = useApp()
  const [list, setList] = useState([])
  useEffect(() => store.watchList('rides', { where: [['status', '==', 'scheduled']] }, (r) => setList(r.sort((a, b) => a.scheduledAt - b.scheduledAt))), [])
  const take = async (r) => {
    await updateRide(r.id, { driverId: uid, driver: { id: uid, name: driver.name, phone: driver.phone, rating: rating(driver), car: `${driver.vehicle?.make} ${driver.vehicle?.model}`, color: driver.vehicle?.color, plate: driver.vehicle?.plate } })
    toast(tr('تم حجز الرحلة لك ✅', 'Booked for you ✅'), 'success')
  }
  const start = async (r) => { await updateRide(r.id, { status: 'accepted', acceptedAt: Date.now(), phaseAt: Date.now() }); history.back() }
  return (
    <Page title={tr('رحلات مجدولة', 'Scheduled rides')}>
      {list.length === 0 && <Empty icon={<CalendarClock size={36} />} title={tr('لا توجد حجوزات حاليًا', 'No bookings')} sub={tr('ستظهر هنا الرحلات المحجوزة مسبقًا في مدينتك', 'Pre-booked rides appear here')} />}
      <div className="col" style={{ gap: 10 }}>
        {list.map((r) => (
          <div key={r.id} className="card pad">
            <div className="between"><span className="badge blue"><CalendarClock size={12} />{dateTime(r.scheduledAt)}</span><b className="num">{money(r.fare?.total)}</b></div>
            <div className="mt"><RouteSummary ride={r} compact /></div>
            {!r.driverId && <button className="btn btn-primary btn-block btn-sm mt" onClick={() => take(r)}>{tr('احجزها لي', 'Take it')}</button>}
            {r.driverId === uid && <button className="btn btn-success btn-block btn-sm mt" onClick={() => start(r)}>{tr('ابدأ التوجّه للراكب', 'Start now')}</button>}
            {r.driverId && r.driverId !== uid && <div className="badge gray mt">{tr('محجوزة لسائق آخر', 'Taken')}</div>}
          </div>
        ))}
      </div>
    </Page>
  )
}

export function Earnings() {
  const rides = useMyRides() || []
  const { settings, driver } = useApp()
  const [range, setRange] = useState('week')
  const done = rides.filter((r) => r.status === 'completed')
  const since = { day: Date.now() - 86400000, week: Date.now() - 7 * 86400000, month: Date.now() - 30 * 86400000 }[range]
  const inRange = done.filter((r) => (r.completedAt || r.createdAt) >= since)
  const total = inRange.reduce((s, r) => s + netOf(r, settings.pricing), 0)
  const gross = inRange.reduce((s, r) => s + (r.fare?.total || 0), 0)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    const v = done.filter((r) => new Date(r.completedAt || r.createdAt).toISOString().slice(0, 10) === key).reduce((s, r) => s + netOf(r, settings.pricing), 0)
    return { label: d.toLocaleDateString(isAr ? 'ar-LY' : 'en', { weekday: 'short' }), v, today: i === 6 }
  })
  const max = Math.max(10, ...days.map((d) => d.v))
  return (
    <Page title={tr('الأرباح', 'Earnings')}>
      <div className="tabs">
        {[['day', tr('اليوم', 'Today')], ['week', tr('الأسبوع', 'Week')], ['month', tr('الشهر', 'Month')]].map(([k, l]) => <button key={k} className={range === k ? 'active' : ''} onClick={() => setRange(k)}>{l}</button>)}
      </div>
      <div className="wallet-card mt rise">
        <div className="small" style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>{tr('صافي الأرباح', 'Net earnings')}</div>
        <div className="wbig num" style={{ position: 'relative', zIndex: 1 }}>{money(total)}</div>
        <div className="wrow">
          <div><small>{tr('الرحلات', 'Trips')}</small><b className="num">{inRange.length}</b></div>
          <div><small>{tr('الإجمالي', 'Gross')}</small><b className="num">{money(gross)}</b></div>
          <div><small>{tr('التقييم', 'Rating')}</small><b className="num">★ {rating(driver)}</b></div>
        </div>
      </div>
      <div className="section-title">{tr('آخر 7 أيام', 'Last 7 days')}</div>
      <div className="card pad">
        <div className="chart">
          {days.map((d, i) => (
            <div key={i}>
              <span className="tiny num" style={{ color: 'var(--muted)' }}>{d.v ? Math.round(d.v) : ''}</span>
              <i className={d.v ? '' : 'dim'} style={{ height: `${(d.v / max) * 100}%` }} />
              <small style={d.today ? { color: 'var(--brand)', fontWeight: 700 } : null}>{d.label}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="grid2 mt">
        <div className="card stat"><TrendingUp size={20} color="var(--success)" /><b className="num">{money(inRange.length ? total / inRange.length : 0)}</b><small>{tr('متوسط الرحلة', 'Avg per trip')}</small></div>
        <div className="card stat"><Clock size={20} color="var(--info)" /><b className="num">{Math.round(((driver.onlineMs || 0) / 3600000) * 10) / 10}h</b><small>{tr('ساعات اليوم', 'Hours today')}</small></div>
      </div>
      <div className="card pad mt flex small" style={{ background: 'var(--info-bg)', border: 0 }}><Info size={18} color="var(--info)" />{tr(`عمولة وصلني ${settings.pricing.commission}% فقط من كل رحلة. الإكراميات لك بالكامل.`, `Only ${settings.pricing.commission}% commission. Tips are 100% yours.`)}</div>
    </Page>
  )
}

export function Wallet() {
  const { driver, settings } = useApp()
  const rides = useMyRides() || []
  const done = rides.filter((r) => r.status === 'completed').slice(0, 40)
  const bal = driver.wallet || 0
  return (
    <Page title={tr('المحفظة', 'Wallet')}>
      <div className="wallet-card rise">
        <div className="small" style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>{tr('رصيد المحفظة', 'Wallet balance')}</div>
        <div className="wbig num" style={{ position: 'relative', zIndex: 1, color: bal < 0 ? '#ffb4a8' : '#fff' }}>{money(bal)}</div>
        <div className="small" style={{ position: 'relative', zIndex: 1, opacity: 0.85 }}>{bal < 0 ? tr('عمولات مستحقة للتطبيق من الرحلات النقدية', 'Commission owed from cash trips') : tr('مستحقاتك من الرحلات المدفوعة إلكترونيًا', 'Owed to you from prepaid trips')}</div>
      </div>
      <div className="card pad mt small flex" style={{ background: 'var(--warning-bg)', border: 0 }}><Banknote size={18} />{tr('لتسوية الرصيد تواصل مع الدعم أو مكتب وصلني في مدينتك.', 'Contact support to settle your balance.')}</div>
      <div className="section-title">{tr('الحركات', 'Transactions')}</div>
      <div className="list">
        {done.length === 0 && <div className="empty" style={{ padding: 24 }}><b>{tr('لا توجد حركات', 'No transactions')}</b></div>}
        {done.map((r) => {
          const { net, commission } = driverNet(r.fare?.total || 0, settings.pricing)
          const cash = r.payment === 'cash'
          return (
            <div key={r.id} className="tx">
              <span className="txi" style={{ background: cash ? 'var(--danger-bg)' : 'var(--success-bg)', color: cash ? 'var(--danger)' : 'var(--success)' }}>{cash ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
              <div className="txb"><b>{cash ? tr('عمولة رحلة نقدية', 'Cash trip commission') : tr('أرباح رحلة مدفوعة', 'Prepaid trip earnings')}</b><small>{dateTime(r.completedAt || r.createdAt)} • {r.riderName}</small></div>
              <span className={`amt num ${cash ? '' : 'pos'}`}>{cash ? '-' : '+'}{money(cash ? r.commission ?? commission : r.driverNet ?? net)}</span>
            </div>
          )
        })}
      </div>
    </Page>
  )
}

export function Invite() {
  const { driver } = useApp()
  const link = `${SITE_URL || location.origin}/driver/`
  const share = async () => {
    const r = await shareLink({ title: 'وصلني كابتن', text: tr(`انضم لكباتن وصلني واربح بسيارتك 🚗 استخدم كودي ${driver.referralCode}`, `Drive with Wasalni. Use my code ${driver.referralCode}`), url: link })
    if (r === 'copied') toast(tr('تم النسخ', 'Copied'))
  }
  return (
    <Page title={tr('دعوة السائقين', 'Invite drivers')}>
      <div className="rw-hero center rise"><Gift size={54} style={{ position: 'relative' }} /><div style={{ position: 'relative', fontSize: 21, fontWeight: 700, marginTop: 10 }}>{tr('ادعُ سائقين واكسب مكافآت', 'Invite drivers, earn bonuses')}</div><div style={{ position: 'relative', opacity: 0.9, fontSize: 14 }}>{tr('مكافأة لكل سائق يكمل أول 10 رحلات', 'Bonus for every driver who completes 10 trips')}</div></div>
      <div className="card pad mt center">
        <div className="small muted">{tr('كود الدعوة', 'Invite code')}</div>
        <div className="brand-text num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, margin: '6px 0' }}>{driver.referralCode}</div>
        <div className="grid2">
          <button className="btn btn-ghost" onClick={async () => { await copy(driver.referralCode); toast(tr('تم النسخ', 'Copied')) }}><Copy size={18} />{tr('نسخ', 'Copy')}</button>
          <button className="btn btn-primary" onClick={share}><Share2 size={18} />{tr('مشاركة', 'Share')}</button>
        </div>
      </div>
    </Page>
  )
}

export function Referrals() {
  const { driver } = useApp()
  const [list, setList] = useState([])
  useEffect(() => store.watchList('drivers', { where: [['referredBy', '==', driver.referralCode]] }, setList), [driver.referralCode])
  return (
    <Page title={tr('الإحالات الخاصة بي', 'My referrals')}>
      {list.length === 0 && <Empty icon={<Users size={36} />} title={tr('لا توجد إحالات بعد', 'No referrals yet')} sub={tr('شارك كودك مع السائقين', 'Share your code with drivers')} />}
      <div className="list">{list.map((d) => <Row key={d.id} icon={<User size={19} />} title={d.name} sub={`${d.trips || 0} ${tr('رحلة', 'trips')}`} right={<StatusBadge s={d.status === 'approved' ? 'completed' : 'searching'} />} />)}</div>
    </Page>
  )
}

export function Profile() {
  const { uid, driver } = useApp()
  const nav = useNav()
  const [del, setDel] = useState(false)
  const rides = useMyRides() || []
  const city = CITIES.find((c) => c.id === driver.city)
  return (
    <Page title={tr('الملف الشخصي', 'My profile')}>
      <div className="profile-head rise">
        <Avatar name={driver.name} src={driver.photo} size={104} />
        <h2>{driver.name}</h2>
        <div style={{ marginTop: 4 }}><Stars value={rating(driver)} size={18} /></div>
      </div>
      <div className="stats3">
        <div><CheckCircle2 size={20} /><b className="num">{rides.filter((r) => r.status === 'completed').length}</b><small>{tr('المكتملة', 'Completed')}</small></div>
        <div><XCircle size={20} /><b className="num">{driver.cancelled || 0}</b><small>{tr('الملغية', 'Cancelled')}</small></div>
        <div><ThumbsDown size={20} /><b className="num">{driver.declined || 0}</b><small>{tr('مرفوض', 'Declined')}</small></div>
      </div>
      <div className="section-title" />
      <div className="list">
        <Row icon={<User size={19} />} color="#2E90FA" title={tr('تعديل الملف الشخصي', 'Edit profile')} onClick={() => nav.push('edit')} />
        <Row icon={<Mail size={19} />} color="#12B76A" title={tr('البريد الإلكتروني', 'Email')} sub={driver.email || '—'} onClick={() => nav.push('edit')} />
        <Row icon={<Shuffle size={19} />} color="#a16207" title={tr('تغيير المدينة', 'Change city')} sub={city ? (isAr ? city.ar : city.en) : ''} onClick={() => nav.push('city')} />
        <Row icon={<Car size={19} />} color="#06b6d4" title={tr('مركبات', 'Vehicles')} sub={`${driver.vehicle?.make || ''} ${driver.vehicle?.model || ''}`} onClick={() => nav.push('vehicle')} />
        <Row icon={<FileText size={19} />} color="#64748b" title={tr('وثائق ومستندات', 'Documents')} onClick={() => nav.push('documents')} />
        <Row icon={<Languages size={19} />} color="#0f172a" title={tr('لغة', 'Language')} sub={LANG === 'ar' ? 'arabic' : 'english'} onClick={() => nav.push('settings')} />
        <Row icon={<SetIco size={19} />} color="#7c3aed" title={tr('إعدادات', 'Settings')} onClick={() => nav.push('settings')} />
        <Row icon={<LogOut size={19} />} color="#92400e" title={tr('تسجيل خروج', 'Log out')} onClick={async () => { await updateDriver(uid, { online: false }).catch(() => {}); const { auth } = await import('@/core/store.js'); await auth.reset(); location.reload() }} />
        <Row icon={<UserX size={19} />} color="#e5484d" title={<span style={{ color: 'var(--danger)' }}>{tr('احذف حسابي', 'Delete account')}</span>} onClick={() => setDel(true)} />
      </div>
      <Sheet open={del} onClose={() => setDel(false)} title={tr('حذف الحساب نهائيًا؟', 'Delete account?')}>
        <div className="flex">
          <button className="btn btn-ghost grow" onClick={() => setDel(false)}>{tr('إلغاء', 'Cancel')}</button>
          <button className="btn grow" style={{ background: 'var(--danger)', color: '#fff' }} onClick={async () => { await deleteAccount('drivers', uid); location.reload() }}>{tr('حذف', 'Delete')}</button>
        </div>
      </Sheet>
    </Page>
  )
}

export function EditProfile() {
  const { uid, driver } = useApp()
  const nav = useNav()
  const [f, setF] = useState({ name: driver.name || '', email: driver.email || '', phone: driver.phone || '', photo: driver.photo || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Page title={tr('تعديل الملف', 'Edit profile')} foot={<button className="btn btn-primary btn-block" onClick={async () => { await updateDriver(uid, f); toast(tr('تم الحفظ', 'Saved'), 'success'); nav.back() }}>{tr('حفظ', 'Save')}</button>}>
      <label className="center" style={{ display: 'block', margin: '10px auto 20px', width: 110, position: 'relative', cursor: 'pointer' }}>
        <Avatar name={f.name} src={f.photo} size={110} />
        <span style={{ position: 'absolute', bottom: 2, insetInlineEnd: 2, width: 36, height: 36, borderRadius: 18, background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', border: '3px solid var(--bg)' }}><Camera size={16} /></span>
        <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setF({ ...f, photo: await compressImage(e.target.files[0], 320, 0.8) })} />
      </label>
      <div className="col">
        <div className="field"><label>{tr('الاسم', 'Name')}</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>{tr('الهاتف', 'Phone')}</label><input className="input" value={f.phone} onChange={set('phone')} style={{ direction: 'ltr' }} /></div>
        <div className="field"><label>{tr('البريد', 'Email')}</label><input className="input" value={f.email} onChange={set('email')} /></div>
      </div>
    </Page>
  )
}

export function City() {
  const { uid, driver } = useApp()
  const nav = useNav()
  return (
    <Page title={tr('تغيير المدينة', 'Change city')}>
      <div className="list">
        {CITIES.map((c) => <Row key={c.id} icon={<MapPin size={19} />} title={isAr ? c.ar : c.en} right={driver.city === c.id && <CheckCircle2 color="var(--success)" />} chevron={false} onClick={async () => { await updateDriver(uid, { city: c.id }); toast(tr('تم تغيير المدينة', 'City updated'), 'success'); nav.back() }} />)}
      </div>
    </Page>
  )
}

export function Vehicle() {
  const { uid, driver } = useApp()
  const nav = useNav()
  const [v, setV] = useState(driver.vehicle || {})
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  return (
    <Page title={tr('المركبة', 'Vehicle')} foot={<button className="btn btn-primary btn-block" onClick={async () => { await updateDriver(uid, { vehicle: v }); toast(tr('تم الحفظ', 'Saved'), 'success'); nav.back() }}>{tr('حفظ', 'Save')}</button>}>
      <div className="card pad center"><ClassCar type={v.class} w={140} /><div className="mt"><Plate value={v.plate} /></div></div>
      <div className="grid2 mt">
        {[['make', tr('الشركة', 'Make')], ['model', tr('الطراز', 'Model')], ['year', tr('السنة', 'Year')], ['color', tr('اللون', 'Color')]].map(([k, l]) => <div key={k} className="field"><label>{l}</label><input className="input" value={v[k] || ''} onChange={set(k)} /></div>)}
      </div>
      <div className="field mt"><label>{tr('رقم اللوحة', 'Plate')}</label><input className="input" value={v.plate || ''} onChange={set('plate')} style={{ direction: 'ltr' }} /></div>
    </Page>
  )
}

export function Documents() {
  const { uid, driver } = useApp()
  const docs = driver.docs || {}
  const up = (k) => async (e) => {
    const f = e.target.files[0]
    if (!f) return
    await updateDriver(uid, { docs: { ...docs, [k]: await compressImage(f, 760, 0.62) } })
    toast(tr('تم تحديث المستند', 'Document updated'), 'success')
  }
  return (
    <Page title={tr('وثائق ومستندات', 'Documents')}>
      <div className="col">
        {DOC_LIST.map(([k, label, I]) => (
          <label key={k} className="card" style={{ overflow: 'hidden', cursor: 'pointer' }}>
            {docs[k] ? <img src={docs[k]} alt="" style={{ width: '100%', height: 150, objectFit: 'cover' }} /> : <div style={{ height: 110, display: 'grid', placeItems: 'center', background: 'var(--card-2)' }}><I size={34} color="var(--faint)" /></div>}
            <div className="between" style={{ padding: 14 }}><b>{label}</b>{docs[k] ? <span className="badge green">{tr('مرفوع', 'Uploaded')}</span> : <span className="badge red">{tr('مطلوب', 'Required')}</span>}</div>
            <input type="file" accept="image/*" hidden onChange={up(k)} />
          </label>
        ))}
      </div>
    </Page>
  )
}
