import React, { useMemo, useState } from 'react'
import {
  Car, Wallet, Users, UserRound, Clapperboard, Activity, TrendingUp, AlertTriangle, Search, X, Check, Ban, Phone, MapPin, Eye, Star, Coins,
  Download, RotateCcw, CheckCircle2, Clock, Navigation,
} from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import { Avatar, Stars, toast, Empty } from '@/ui/kit.jsx'
import { StatusBadge, RouteSummary, Plate, statusLabel } from '@/ui/ride-ui.jsx'
import { ClassCar } from '@/ui/art.jsx'
import { money, num, dateTime, timeAgo, km, mins } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { useApp } from '@/ui/app-ctx.jsx'
import { updateDriver, updateRide, cancelRide, updateUser, addTx, store } from '@/core/api.js'
import { AreaChart, Donut } from './charts.jsx'
import { useData } from './App.jsx'

const DAY = 86400000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const cityName = (id) => CITIES.find((c) => c.id === id)?.ar || id || '—'
export const csv = (name, rows) => {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const body = [keys.join(','), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }))
  a.download = name + '.csv'
  a.click()
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn sm flat" onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

// ===== نظرة عامة =====
export function Overview() {
  const { rides, drivers, users, sos, reelStats, go } = useData()
  const { settings } = useApp()
  const now = Date.now()
  const today = dayKey(now)
  const done = rides.filter((r) => r.status === 'completed')
  const todayDone = done.filter((r) => dayKey(r.completedAt || r.createdAt) === today)
  const revenue = (list) => list.reduce((s, r) => s + (r.fare?.total || 0), 0)
  const commission = (list) => list.reduce((s, r) => s + (r.commission ?? ((r.fare?.total || 0) * settings.pricing.commission) / 100), 0)
  const online = drivers.filter((d) => d.online && now - (d.lastSeen || 0) < 10 * 60000)
  const active = rides.filter((r) => ['searching', 'accepted', 'arrived', 'ongoing'].includes(r.status))
  const views = reelStats.reduce((s, r) => s + (r.views || 0), 0)
  const pointsIssued = users.reduce((s, u) => s + (u.earnedTotal || 0), 0)
  const freeRides = done.filter((r) => r.payment === 'points').length
  const series = Array.from({ length: 14 }, (_, i) => {
    const t = now - (13 - i) * DAY
    const k = dayKey(t)
    return { label: new Date(t).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' }), v: rides.filter((r) => dayKey(r.createdAt) === k).length, rev: revenue(done.filter((r) => dayKey(r.completedAt || r.createdAt) === k)) }
  })
  const byClass = settings.pricing.classes.map((c, i) => ({ label: c.ar, v: rides.filter((r) => r.classId === c.id).length, c: ['#E8650A', '#2E90FA', '#12B76A', '#18120E', '#F5A524'][i % 5] }))
  const pending = drivers.filter((d) => d.status === 'pending')
  const [metric, setMetric] = useState('v')
  const markers = [
    ...online.filter((d) => d.loc?.coords).map((d) => ({ id: 'd' + d.id, type: 'car', coords: d.loc.coords, heading: d.loc.heading || 0 })),
    ...active.filter((r) => r.driverLoc?.coords).map((r) => ({ id: 'r' + r.id, type: 'car', coords: r.driverLoc.coords, heading: r.driverLoc.heading || 0, color: '#FFD9B8' })),
    ...active.filter((r) => r.status === 'searching').map((r) => ({ id: 'p' + r.id, type: 'pickup', coords: r.pickup.coords, label: r.riderName })),
  ]
  const center = markers[0]?.coords || CITIES[0].center
  return (
    <>
      {(pending.length > 0 || sos.some((s) => !s.handled)) && (
        <div className="flex" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {pending.length > 0 && <button className="badge yellow" style={{ padding: '10px 14px', fontSize: 13.5 }} onClick={() => go('drivers')}><Clock size={15} />{pending.length} سائق بانتظار الموافقة</button>}
          {sos.some((s) => !s.handled) && <button className="badge red" style={{ padding: '10px 14px', fontSize: 13.5 }} onClick={() => go('support')}><AlertTriangle size={15} />بلاغات طوارئ جديدة</button>}
        </div>
      )}
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><Wallet size={20} /></span><b className="num">{money(revenue(todayDone))}</b><small>إيرادات اليوم • عمولة {money(commission(todayDone))}</small></div>
        <Kpi icon={Car} c="#2E90FA" v={todayDone.length} l="رحلات مكتملة اليوم" sub={`${active.length} جارية الآن`} />
        <Kpi icon={Activity} c="#12B76A" v={online.length} l="سائقون متصلون" sub={`من ${drivers.filter((d) => d.status === 'approved').length} معتمد`} />
        <Kpi icon={Users} c="#a855f7" v={users.length} l="الزبائن المسجلون" sub={`${users.filter((u) => now - (u.createdAt || 0) < 7 * DAY).length} جديد هذا الأسبوع`} />
        <Kpi icon={Clapperboard} c="#E8650A" v={num(views)} l="مشاهدات الريلز" sub={`${money(pointsIssued)} مكافآت موزعة`} />
        <Kpi icon={Coins} c="#F5A524" v={freeRides} l="رحلات مجانية بالنقاط" sub={`${money(revenue(done))} إجمالي الإيرادات`} />
      </div>
      <div className="grid-main">
        <div className="panel-card">
          <h3><TrendingUp size={18} color="var(--brand)" />أداء آخر 14 يومًا<span className="sp" /><span className="seg"><button className={metric === 'v' ? 'active' : ''} onClick={() => setMetric('v')}>الرحلات</button><button className={metric === 'rev' ? 'active' : ''} onClick={() => setMetric('rev')}>الإيرادات</button></span></h3>
          <AreaChart data={series.map((s) => ({ label: s.label, v: s[metric] }))} format={metric === 'rev' ? (v) => money(v) : (v) => `${v} رحلة`} color={metric === 'rev' ? '#12B76A' : '#E8650A'} />
        </div>
        <div className="panel-card"><h3>الرحلات حسب الفئة</h3><Donut data={byClass} /></div>
      </div>
      <div className="grid-main">
        <div className="panel-card">
          <h3><MapPin size={18} color="var(--brand)" />الخريطة الحية<span className="sp" /><span className="badge green"><span className="pulse-dot" style={{ width: 7, height: 7 }} />{online.length} متصل • {active.length} رحلة</span></h3>
          <div className="live-map"><MapView center={center} zoom={12} markers={markers} /></div>
        </div>
        <div className="panel-card">
          <h3>آخر الرحلات<span className="sp" /><button className="btn btn-xs btn-ghost" onClick={() => go('rides')}>الكل</button></h3>
          {rides.length === 0 && <Empty title="لا توجد رحلات بعد" sub="ستظهر هنا فور طلب أول رحلة" />}
          {rides.slice(0, 7).map((r) => (
            <div key={r.id} className="feed-item">
              <ClassCar type={r.classId} w={44} />
              <div className="grow" style={{ minWidth: 0 }}><b className="small">{r.riderName}</b><div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pickup?.title} ← {r.dropoff?.title}</div></div>
              <div style={{ textAlign: 'end' }}><b className="small num">{money(r.fare?.total)}</b><div><StatusBadge s={r.status} /></div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
function Kpi({ icon: I, c, v, l, sub }) {
  return <div className="kpi"><span className="ki" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}><I size={20} /></span><b className="num">{v}</b><small>{l}</small>{sub && <div className="tiny muted" style={{ marginTop: 4 }}>{sub}</div>}</div>
}

// ===== الرحلات =====
export function Rides() {
  const { rides } = useData()
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [sim, setSim] = useState(true)
  const [sel, setSel] = useState(null)
  const list = rides.filter((r) => (status === 'all' || r.status === status || (status === 'active' && ['searching', 'accepted', 'arrived', 'ongoing'].includes(r.status))) && (sim || !(r.simulated || r.driver?.simulated)) && (!q || `${r.riderName} ${r.riderPhone} ${r.driver?.name} ${r.pickup?.title} ${r.dropoff?.title} ${r.id}`.includes(q)))
  return (
    <>
      <div className="toolbar">
        <div className="input-wrap" style={{ flex: 1, maxWidth: 340 }}><Search size={17} /><input className="input" placeholder="بحث بالاسم أو الهاتف أو العنوان" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg">{[['all', 'الكل'], ['active', 'الجارية'], ['scheduled', 'المجدولة'], ['completed', 'المكتملة'], ['cancelled', 'الملغاة']].map(([k, l]) => <button key={k} className={status === k ? 'active' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <label className="flex small"><input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} style={{ accentColor: 'var(--brand)' }} />إظهار رحلات المحاكاة</label>
        <button className="btn btn-sm btn-ghost" onClick={() => csv('rides', list.map((r) => ({ id: r.id, date: dateTime(r.createdAt), rider: r.riderName, phone: r.riderPhone, driver: r.driver?.name || '', from: r.pickup?.title, to: r.dropoff?.title, class: r.className, fare: r.fare?.total, payment: r.payment, status: statusLabel(r.status) })))}><Download size={16} />تصدير</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>التاريخ</th><th>الزبون</th><th>السائق</th><th>المسار</th><th>الفئة</th><th>الأجرة</th><th>الدفع</th><th>الحالة</th></tr></thead>
          <tbody>
            {list.slice(0, 300).map((r) => (
              <tr key={r.id} onClick={() => setSel(r)}>
                <td className="small">{dateTime(r.createdAt)}</td>
                <td><b className="small">{r.riderName}</b><div className="tiny muted num">{r.riderPhone}</div></td>
                <td className="small">{r.driver?.name || '—'}{r.driver?.simulated && <span className="badge gray" style={{ marginInlineStart: 6 }}>محاكاة</span>}</td>
                <td className="small" style={{ maxWidth: 260 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pickup?.title} ← {r.dropoff?.title}</div><div className="tiny muted num">{km(r.route?.distanceKm || 0)} • {mins(r.route?.durationMin || 0)}</div></td>
                <td className="small">{r.className}</td>
                <td><b className="num small">{money(r.fare?.total)}</b></td>
                <td className="small">{{ cash: 'نقدًا', wallet: 'محفظة', points: 'نقاط' }[r.payment]}</td>
                <td><StatusBadge s={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="لا توجد رحلات" />}
      </div>
      {sel && <RideModal r={rides.find((x) => x.id === sel.id) || sel} onClose={() => setSel(null)} />}
    </>
  )
}
function RideModal({ r, onClose }) {
  const markers = [{ id: 'a', type: 'pickup', coords: r.pickup.coords, label: r.pickup.title }, { id: 'b', type: 'drop', coords: r.dropoff.coords, label: r.dropoff.title }]
  if (r.driverLoc?.coords) markers.push({ id: 'c', type: 'car', coords: r.driverLoc.coords, heading: r.driverLoc.heading })
  return (
    <Modal title={`رحلة #${r.id.slice(-6).toUpperCase()}`} onClose={onClose} wide>
      <div className="grid-main" style={{ marginTop: 0 }}>
        <div className="live-map" style={{ height: 320 }}><MapView center={r.pickup.coords} zoom={13} markers={markers} routes={r.route?.coords ? [{ id: 't', coords: r.route.coords }] : []} onReady={(m) => setTimeout(() => {
          const c = r.route?.coords || [r.pickup.coords, r.dropoff.coords]
          const b = c.reduce((bb, p) => [[Math.min(bb[0][0], p[0]), Math.min(bb[0][1], p[1])], [Math.max(bb[1][0], p[0]), Math.max(bb[1][1], p[1])]], [c[0], c[0]])
          m.fitBounds(b, { padding: 50, duration: 0 })
        }, 100)} /></div>
        <div className="col">
          <div className="between"><StatusBadge s={r.status} /><span className="tiny muted">{dateTime(r.createdAt)}</span></div>
          <RouteSummary ride={r} compact />
          <div className="list">
            <Line k="الزبون" v={<>{r.riderName} • <span className="num">{r.riderPhone}</span></>} />
            <Line k="السائق" v={r.driver ? <>{r.driver.name} • {r.driver.car} • <Plate value={r.driver.plate} /></> : '—'} />
            <Line k="الأجرة" v={<b className="num">{money(r.fare?.total)}{r.fare?.discount > 0 && ` (خصم ${money(r.fare.discount)})`}</b>} />
            <Line k="الدفع" v={{ cash: 'نقدًا', wallet: 'محفظة', points: 'نقاط المكافآت' }[r.payment]} />
            {r.ratingByRider && <Line k="التقييم" v={<Stars value={r.ratingByRider} size={14} />} />}
            {r.cancelReason && <Line k="سبب الإلغاء" v={`${r.cancelReason} (${r.cancelledBy === 'driver' ? 'السائق' : 'الزبون'})`} />}
            {r.note && <Line k="ملاحظة" v={r.note} />}
          </div>
          {['searching', 'accepted', 'arrived', 'ongoing', 'scheduled'].includes(r.status) && (
            <div className="flex">
              <button className="btn btn-danger btn-sm grow" onClick={async () => { await cancelRide(r.id, 'admin', 'ألغيت من الإدارة'); toast('تم إلغاء الرحلة') }}><Ban size={16} />إلغاء الرحلة</button>
              {r.status === 'ongoing' && <button className="btn btn-success btn-sm grow" onClick={async () => { await updateRide(r.id, { status: 'completed', completedAt: Date.now() }); toast('تم إنهاء الرحلة') }}><Check size={16} />إنهاء</button>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
const Line = ({ k, v }) => <div className="between" style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 13.5, gap: 16 }}><span className="muted">{k}</span><span style={{ textAlign: 'end' }}>{v}</span></div>

// ===== السائقون =====
const DOCS = { license: 'رخصة القيادة', id: 'الهوية', carPhoto: 'صورة السيارة', registration: 'كتيب السيارة' }
export function Drivers() {
  const { drivers, rides } = useData()
  const [tab, setTab] = useState(() => (drivers.some((d) => d.status === 'pending') ? 'pending' : 'approved'))
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const list = drivers.filter((d) => !d.deleted && (tab === 'all' || d.status === tab || (tab === 'online' && d.online)) && (!q || `${d.name} ${d.phone} ${d.vehicle?.plate}`.includes(q)))
  const counts = (s) => drivers.filter((d) => d.status === s).length
  return (
    <>
      <div className="toolbar">
        <div className="input-wrap" style={{ flex: 1, maxWidth: 340 }}><Search size={17} /><input className="input" placeholder="بحث بالاسم أو الهاتف أو اللوحة" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg">{[['pending', `بانتظار الموافقة (${counts('pending')})`], ['approved', `معتمدون (${counts('approved')})`], ['online', 'متصلون'], ['rejected', 'مرفوضون'], ['blocked', 'موقوفون'], ['all', 'الكل']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      </div>
      {list.length === 0 && <div className="panel-card"><Empty icon={<UserRound size={36} />} title="لا يوجد سائقون هنا" sub="عند تسجيل سائق جديد من تطبيق السائق سيظهر هنا" /></div>}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {list.map((d) => {
          const trips = rides.filter((r) => r.driverId === d.id && r.status === 'completed').length
          return (
            <button key={d.id} className="panel-card" style={{ textAlign: 'start' }} onClick={() => setSel(d)}>
              <div className="flex">
                <div style={{ position: 'relative' }}><Avatar name={d.name} src={d.photo} size={52} />{d.online && <span className="pulse-dot" style={{ position: 'absolute', bottom: 2, insetInlineEnd: 2, border: '2px solid var(--card)' }} />}</div>
                <div className="grow" style={{ minWidth: 0 }}><b>{d.name}</b><div className="tiny muted num">{d.phone} • {cityName(d.city)}</div></div>
                <StatusBadge s={{ pending: 'searching', approved: 'completed', rejected: 'cancelled', blocked: 'cancelled' }[d.status]} />
              </div>
              <div className="flex mt small"><ClassCar type={d.vehicle?.class} w={46} /><span className="grow">{d.vehicle?.make} {d.vehicle?.model} {d.vehicle?.year}<div className="tiny muted">{d.vehicle?.color}</div></span><Plate value={d.vehicle?.plate} /></div>
              <div className="flex tiny muted mt" style={{ justifyContent: 'space-between' }}><span>{trips} رحلة</span><span>★ {d.ratingCount ? (((d.ratingSum || 0) + 5) / (d.ratingCount + 1)).toFixed(1) : '5.0'}</span><span className="num">محفظة {money(d.wallet || 0)}</span><span>{timeAgo(d.createdAt || Date.now())}</span></div>
            </button>
          )
        })}
      </div>
      {sel && <DriverModal d={drivers.find((x) => x.id === sel.id) || sel} onClose={() => setSel(null)} rides={rides} />}
    </>
  )
}
function DriverModal({ d, onClose, rides }) {
  const [img, setImg] = useState(null)
  const [reason, setReason] = useState('')
  const my = rides.filter((r) => r.driverId === d.id)
  const earned = my.filter((r) => r.status === 'completed').reduce((s, r) => s + (r.driverNet || 0), 0)
  const set = async (status, extra = {}) => { await updateDriver(d.id, { status, ...extra, ...(status !== 'approved' ? { online: false } : {}) }); toast('تم التحديث ✅', 'success') }
  return (
    <Modal title="ملف السائق" onClose={onClose} wide>
      <div className="flex" style={{ flexWrap: 'wrap' }}>
        <Avatar name={d.name} src={d.photo} size={72} />
        <div className="grow"><h3 style={{ margin: 0 }}>{d.name}</h3><div className="small muted"><span className="num">{d.phone}</span> • {d.email || 'بدون بريد'} • {cityName(d.city)}</div><div className="mt"><StatusBadge s={{ pending: 'searching', approved: 'completed', rejected: 'cancelled', blocked: 'cancelled' }[d.status]} /> <span className="badge gray">{d.online ? 'متصل' : 'غير متصل'}</span></div></div>
        <a className="btn btn-ghost btn-sm" href={`tel:${d.phone}`}><Phone size={16} />اتصال</a>
      </div>
      <div className="kpis mt" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        <div className="kpi"><b className="num">{my.filter((r) => r.status === 'completed').length}</b><small>رحلات مكتملة</small></div>
        <div className="kpi"><b className="num">{money(earned)}</b><small>صافي الأرباح</small></div>
        <div className="kpi"><b className="num" style={{ color: (d.wallet || 0) < 0 ? 'var(--danger)' : 'var(--success)' }}>{money(d.wallet || 0)}</b><small>رصيد المحفظة</small></div>
        <div className="kpi"><b className="num">{d.cancelled || 0}</b><small>إلغاءات</small></div>
      </div>
      <h4>المركبة</h4>
      <div className="flex"><ClassCar type={d.vehicle?.class} w={80} /><div className="grow"><b>{d.vehicle?.make} {d.vehicle?.model} {d.vehicle?.year}</b><div className="small muted">{d.vehicle?.color} • فئة {d.vehicle?.class}</div></div><Plate value={d.vehicle?.plate} /></div>
      <h4>المستندات</h4>
      <div className="doc-grid">
        {Object.entries(DOCS).map(([k, l]) => (
          <figure key={k} onClick={() => d.docs?.[k] && setImg(d.docs[k])}>
            {d.docs?.[k] ? <img src={d.docs[k]} alt={l} /> : <div style={{ height: 120, display: 'grid', placeItems: 'center' }} className="muted small">غير مرفوع</div>}
            <figcaption>{l}</figcaption>
          </figure>
        ))}
      </div>
      <div className="hr" />
      <div className="flex" style={{ flexWrap: 'wrap' }}>
        {d.status !== 'approved' && <button className="btn btn-success btn-sm" onClick={() => set('approved', { approvedAt: Date.now() })}><CheckCircle2 size={16} />موافقة وتفعيل</button>}
        {d.status !== 'blocked' && d.status === 'approved' && <button className="btn btn-danger btn-sm" onClick={() => set('blocked')}><Ban size={16} />إيقاف الحساب</button>}
        {d.status === 'blocked' && <button className="btn btn-ghost btn-sm" onClick={() => set('approved')}><RotateCcw size={16} />إعادة التفعيل</button>}
        {(d.wallet || 0) !== 0 && <button className="btn btn-ghost btn-sm" onClick={async () => { await updateDriver(d.id, { wallet: 0, lastSettle: Date.now() }); toast('تمت تسوية المحفظة') }}><Wallet size={16} />تسوية المحفظة ({money(d.wallet)})</button>}
        {d.status === 'pending' && (
          <div className="flex grow" style={{ minWidth: 260 }}>
            <input className="input" style={{ height: 40 }} placeholder="سبب الرفض (يظهر للسائق)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-danger btn-sm" onClick={() => set('rejected', { rejectReason: reason || 'المستندات غير واضحة' })}><X size={16} />رفض</button>
          </div>
        )}
      </div>
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="" /></div>}
    </Modal>
  )
}

// ===== الزبائن =====
export function Riders() {
  const { users, rides } = useData()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const list = users.filter((u) => !u.deleted && (!q || `${u.name} ${u.phone} ${u.email} ${u.referralCode}`.includes(q)))
  return (
    <>
      <div className="toolbar">
        <div className="input-wrap" style={{ flex: 1, maxWidth: 340 }}><Search size={17} /><input className="input" placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="badge gray">{list.length} زبون</span>
        <button className="btn btn-sm btn-ghost" onClick={() => csv('riders', list.map((u) => ({ name: u.name, phone: u.phone, email: u.email, city: cityName(u.city), trips: u.trips || 0, points: u.points || 0, wallet: u.wallet || 0, joined: dateTime(u.createdAt) })))}><Download size={16} />تصدير</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>الزبون</th><th>المدينة</th><th>الرحلات</th><th>النقاط</th><th>المحفظة</th><th>كود الدعوة</th><th>التسجيل</th><th>الحالة</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} onClick={() => setSel(u)}>
                <td><div className="flex"><Avatar name={u.name} src={u.photo} size={34} /><div><b className="small">{u.name}</b><div className="tiny muted num">{u.phone}</div></div></div></td>
                <td className="small">{cityName(u.city)}</td>
                <td className="num">{rides.filter((r) => r.riderId === u.id && r.status === 'completed').length}</td>
                <td className="num" style={{ color: 'var(--brand)' }}>{money(u.points || 0)}</td>
                <td className="num">{money(u.wallet || 0)}</td>
                <td className="num small">{u.referralCode}</td>
                <td className="small">{timeAgo(u.createdAt || Date.now())}</td>
                <td>{u.blocked ? <span className="badge red">موقوف</span> : <span className="badge green">نشط</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="لا يوجد زبائن بعد" />}
      </div>
      {sel && <RiderModal u={users.find((x) => x.id === sel.id) || sel} rides={rides} onClose={() => setSel(null)} />}
    </>
  )
}
function RiderModal({ u, rides, onClose }) {
  const [amt, setAmt] = useState('')
  const [field, setField] = useState('points')
  const my = rides.filter((r) => r.riderId === u.id)
  const adjust = async () => {
    const v = Number(amt)
    if (!v) return
    await store.update(`users/${u.id}`, { [field]: store.inc(v) })
    await addTx(u.id, { kind: 'admin', amount: v, currency: field === 'points' ? 'points' : 'wallet', title: v > 0 ? 'إضافة من الإدارة' : 'خصم من الإدارة' })
    setAmt(''); toast('تم التحديث ✅', 'success')
  }
  return (
    <Modal title="ملف الزبون" onClose={onClose}>
      <div className="flex"><Avatar name={u.name} src={u.photo} size={64} /><div className="grow"><h3 style={{ margin: 0 }}>{u.name}</h3><div className="small muted"><span className="num">{u.phone}</span> • {u.email || 'بدون بريد'}</div></div><a className="btn btn-ghost btn-sm" href={`tel:${u.phone}`}><Phone size={16} /></a></div>
      <div className="kpis mt" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi"><b className="num">{my.length}</b><small>طلبات</small></div>
        <div className="kpi"><b className="num">{money(u.points || 0)}</b><small>نقاط</small></div>
        <div className="kpi"><b className="num">{money(u.wallet || 0)}</b><small>محفظة</small></div>
      </div>
      <h4>تعديل الرصيد</h4>
      <div className="flex">
        <select className="input" style={{ height: 44, width: 140 }} value={field} onChange={(e) => setField(e.target.value)}><option value="points">النقاط</option><option value="wallet">المحفظة</option></select>
        <input className="input" style={{ height: 44 }} type="number" placeholder="المبلغ (سالب للخصم)" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={adjust}>تطبيق</button>
      </div>
      <div className="hr" />
      <button className={`btn btn-sm ${u.blocked ? 'btn-ghost' : 'btn-danger'}`} onClick={async () => { await updateUser(u.id, { blocked: !u.blocked }); toast('تم التحديث') }}>{u.blocked ? 'إلغاء الإيقاف' : 'إيقاف الحساب'}</button>
      <h4>آخر الرحلات</h4>
      {my.slice(0, 8).map((r) => <div key={r.id} className="feed-item small"><StatusBadge s={r.status} /><span className="grow">{r.pickup?.title} ← {r.dropoff?.title}</span><b className="num">{money(r.fare?.total)}</b></div>)}
    </Modal>
  )
}
