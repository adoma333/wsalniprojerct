// صفحات الإدارة المتقدمة: الخريطة الحية، الولايات، المدفوعات، الطلبة، الميزات والنظام، سجل العمليات
import React, { useEffect, useMemo, useState } from 'react'
import {
  Save, Plus, Trash2, MapPin, Power, Percent, Check, X, Download, CreditCard, GraduationCap, ShieldCheck, Wrench, History, Radio, Car, Users,
  Search, Image as ImageIcon, Zap, Banknote, Smartphone, Ticket, AlertTriangle, Settings2, Bus, Sparkles, Navigation, MonitorSmartphone, Eye, ExternalLink, Video, Upload, FileText,
} from 'lucide-react'
import { PopupView } from '@/ui/Popup.jsx'
import { watchAllLines, watchLiveBuses, saveLine, deleteLine, linePath, measure, simBuses, demoLines } from '@/core/bus.js'
import { route } from '@/core/geo.js'
import MapView from '@/map/MapView.jsx'
import { Switch, toast, Empty, Avatar } from '@/ui/kit.jsx'
import { StatusBadge } from '@/ui/ride-ui.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { money, num, dateTime, timeAgo, compact, compressImage } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { saveSettings, reviewTopup, reviewStudent, watchTopups, watchStudents, watchAudit, METHOD_NAMES, store, watchWithdrawals, reviewWithdraw, WITHDRAW_METHODS, watchPopups, watchPopupStats, savePopup, deletePopup } from '@/core/api.js'
import { useData } from './App.jsx'
import { Modal, csv } from './pages-a.jsx'
import { Bars, Donut } from './charts.jsx'

const Field = ({ label, children, hint }) => <div className="field"><label>{label}</label>{children}{hint && <span className="tiny muted">{hint}</span>}</div>
const N = (v) => (v === '' ? '' : Number(v))
const ACTIVE = ['searching', 'accepted', 'arrived', 'ongoing']
function useWatch(fn) {
  const [v, setV] = useState([])
  useEffect(() => fn(setV), [])
  return v
}

// ===== الخريطة الحية (التوزيع) =====
export function LiveMap() {
  const { rides, drivers } = useData()
  const [city, setCity] = useState(CITIES[0].id)
  const c = CITIES.find((x) => x.id === city) || CITIES[0]
  const active = rides.filter((r) => ACTIVE.includes(r.status))
  const online = drivers.filter((d) => d.online && Date.now() - (d.lastSeen || 0) < 10 * 60000)
  const markers = [
    ...online.filter((d) => d.loc?.coords).map((d) => ({ id: 'd' + d.id, type: 'car', coords: d.loc.coords, heading: d.loc.heading || 0 })),
    ...active.filter((r) => r.driverLoc?.coords).map((r) => ({ id: 'r' + r.id, type: 'car', coords: r.driverLoc.coords, heading: r.driverLoc.heading || 0 })),
    ...active.filter((r) => r.status === 'searching').map((r) => ({ id: 'p' + r.id, type: 'pickup', coords: r.pickup.coords, label: r.riderName })),
  ]
  const routes = active.filter((r) => r.status === 'ongoing' && r.route?.coords).slice(0, 20).map((r) => ({ id: 't' + r.id, coords: r.route.coords }))
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><Radio size={20} /></span><b className="num">{active.length}</b><small>رحلات جارية الآن</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--warning-bg)', color: '#a16207' }}><Search size={20} /></span><b className="num">{active.filter((r) => r.status === 'searching').length}</b><small>تبحث عن سائق</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><Car size={20} /></span><b className="num">{online.length}</b><small>سائقون متصلون</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Users size={20} /></span><b className="num">{active.filter((r) => r.status === 'ongoing').length}</b><small>زبائن في الطريق</small></div>
      </div>
      <div className="grid-main">
        <div className="panel-card" style={{ padding: 10 }}>
          <div className="toolbar" style={{ margin: '4px 6px 10px' }}>
            <select className="input" style={{ maxWidth: 220, height: 40 }} value={city} onChange={(e) => setCity(e.target.value)}>{CITIES.map((x) => <option key={x.id} value={x.id}>{x.ar}</option>)}</select>
            <span className="badge green"><i className="live-dot" />مباشر</span>
          </div>
          <div className="live-map" style={{ height: 560 }}><MapView key={city} center={c.center} zoom={12.5} markers={markers} routes={routes} /></div>
        </div>
        <div className="panel-card">
          <h3>الطلبات الجارية</h3>
          {active.length === 0 && <Empty title="لا توجد رحلات جارية" />}
          {active.slice(0, 40).map((r) => (
            <div key={r.id} className="feed-item">
              <Avatar name={r.riderName} size={34} />
              <span className="grow small" style={{ minWidth: 0 }}><b>{r.riderName}</b><div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pickup?.title} ← {r.dropoff?.title}</div></span>
              <span style={{ textAlign: 'end' }}><StatusBadge s={r.status} /><div className="tiny num muted">{money(r.fare?.total)}</div></span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ===== الولايات والمناطق =====
export function Wilayas() {
  const { settings } = useApp()
  const { rides, drivers, users } = useData()
  const [z, setZ] = useState(() => settings.zones || {})
  const [extra, setExtra] = useState(() => settings.extraCities || [])
  const [add, setAdd] = useState(null)
  const all = [...CITIES, ...extra]
  const stat = useMemo(() => {
    const o = {}
    for (const c of all) o[c.id] = { rides: 0, revenue: 0, drivers: 0, users: 0 }
    for (const r of rides) if (o[r.city] && r.status === 'completed') { o[r.city].rides++; o[r.city].revenue += r.fare?.total || 0 }
    for (const d of drivers) if (o[d.city]) o[d.city].drivers++
    for (const u of users) if (o[u.city]) o[u.city].users++
    return o
  }, [rides, drivers, users, extra])
  const setC = (id, k, v) => setZ({ ...z, [id]: { enabled: true, mult: 1, ...(z[id] || {}), [k]: v } })
  const save = async () => { await saveSettings({ zones: z, extraCities: extra }, 'تحديث الولايات والمناطق'); toast('تم حفظ الولايات ✅', 'success') }
  const enabledN = all.filter((c) => z[c.id]?.enabled !== false).length
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><MapPin size={20} /></span><b className="num">{enabledN}/{all.length}</b><small>ولايات مفعّلة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><Car size={20} /></span><b className="num">{drivers.length}</b><small>سائقون مسجلون</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Users size={20} /></span><b className="num">{users.length}</b><small>زبائن مسجلون</small></div>
      </div>
      <div className="toolbar mt">
        <span className="small muted grow">فعّل أو أوقف الخدمة في كل ولاية، وحدد معامل السعر (مثلاً 1.2 = +20%) ونسبة الزيادة المؤقتة.</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setAdd({ id: '', ar: '', en: '', lat: '', lng: '' })}><Plus size={16} />ولاية جديدة</button>
        <button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>الولاية</th><th>الحالة</th><th>معامل السعر</th><th>زيادة مؤقتة</th><th>رحلات مكتملة</th><th>الإيراد</th><th>سائقون</th><th>زبائن</th><th /></tr></thead>
          <tbody>
            {all.map((c) => {
              const cz = z[c.id] || {}, s = stat[c.id] || {}
              const on = cz.enabled !== false
              return (
                <tr key={c.id} style={{ opacity: on ? 1 : 0.55 }}>
                  <td><b className="small">{c.ar}</b><div className="tiny muted">{c.en}{c.custom && ' • مضافة'}</div></td>
                  <td><Switch on={on} onChange={(v) => setC(c.id, 'enabled', v)} /></td>
                  <td><input className="input num" style={{ width: 90, height: 38 }} type="number" step="0.05" min="0.5" max="3" value={cz.mult ?? 1} onChange={(e) => setC(c.id, 'mult', N(e.target.value) || 1)} /></td>
                  <td>
                    <div className="seg" style={{ padding: 3 }}>{[0, 10, 25, 50].map((p) => <button key={p} className={(cz.boost || 0) === p ? 'active' : ''} onClick={() => setZ({ ...z, [c.id]: { enabled: true, ...cz, boost: p, mult: +(1 + p / 100).toFixed(2) } })}>{p ? `+${p}%` : 'لا'}</button>)}</div>
                  </td>
                  <td className="num small">{num(s.rides)}</td>
                  <td className="num small"><b>{money(s.revenue)}</b></td>
                  <td className="num small">{s.drivers}</td>
                  <td className="num small">{s.users}</td>
                  <td>{c.custom && <button className="btn btn-xs btn-danger" onClick={() => setExtra(extra.filter((x) => x.id !== c.id))}><Trash2 size={14} /></button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {add && (
        <Modal title="إضافة ولاية / مدينة" onClose={() => setAdd(null)}>
          <div className="form-grid">
            <Field label="الاسم بالعربية"><input className="input" value={add.ar} onChange={(e) => setAdd({ ...add, ar: e.target.value })} placeholder="ورقلة" /></Field>
            <Field label="الاسم باللاتينية"><input className="input" dir="ltr" value={add.en} onChange={(e) => setAdd({ ...add, en: e.target.value })} placeholder="Ouargla" /></Field>
            <Field label="خط العرض (lat)"><input className="input num" dir="ltr" value={add.lat} onChange={(e) => setAdd({ ...add, lat: e.target.value })} placeholder="31.95" /></Field>
            <Field label="خط الطول (lng)"><input className="input num" dir="ltr" value={add.lng} onChange={(e) => setAdd({ ...add, lng: e.target.value })} placeholder="5.32" /></Field>
          </div>
          <button className="btn btn-primary mt" disabled={!add.ar || !add.en || isNaN(+add.lat) || isNaN(+add.lng) || !add.lat || !add.lng} onClick={() => {
            const id = add.en.toLowerCase().replace(/[^a-z]/g, '').slice(0, 16) || 'c' + Date.now()
            setExtra([...extra, { id, ar: add.ar, en: add.en, center: [+add.lng, +add.lat], custom: true }]); setAdd(null)
            toast('أضيفت — لا تنس الحفظ')
          }}><Plus size={16} />إضافة</button>
        </Modal>
      )}
    </>
  )
}

// ===== المدفوعات وطلبات الشحن =====
const METHOD_ICON = { edahabia: CreditCard, cib: CreditCard, baridimob: Smartphone, voucher: Ticket }
export function Payments() {
  const { settings } = useApp()
  const { users, drivers } = useData()
  const topups = useWatch(watchTopups)
  const [tab, setTab] = useState('pending')
  const [img, setImg] = useState(null)
  const [p, setP] = useState(settings.payments)
  const names = useMemo(() => Object.fromEntries([...users, ...drivers].map((u) => [u.id, u])), [users, drivers])
  const paid = topups.filter((t) => t.status === 'paid')
  const list = topups.filter((t) => tab === 'all' || t.status === tab)
  const byMethod = Object.entries(paid.reduce((o, t) => ({ ...o, [t.method]: (o[t.method] || 0) + t.amount }), {})).map(([k, v], i) => ({ label: METHOD_NAMES[k] || k, v, c: ['#E8650A', '#2E90FA', '#12B76A', '#7c3aed'][i % 4] }))
  const savePay = async () => { await saveSettings({ payments: p }, 'تحديث طرق الدفع'); toast('تم الحفظ ✅', 'success') }
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><Banknote size={20} /></span><b className="num">{money(paid.reduce((s, t) => s + t.amount, 0))}</b><small>إجمالي الشحن</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--warning-bg)', color: '#a16207' }}><AlertTriangle size={20} /></span><b className="num">{topups.filter((t) => t.status === 'pending').length}</b><small>بانتظار المراجعة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><Check size={20} /></span><b className="num">{paid.length}</b><small>عمليات ناجحة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><CreditCard size={20} /></span><b className="num">{money(users.reduce((s, u) => s + (u.wallet || 0), 0))}</b><small>أرصدة الزبائن</small></div>
      </div>
      <div className="grid-main">
        <div>
          <div className="toolbar">
            <div className="seg">{[['pending', 'بانتظار المراجعة'], ['paid', 'مقبولة'], ['rejected', 'مرفوضة'], ['all', 'الكل']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
            <span className="grow" />
            <button className="btn btn-sm btn-ghost" onClick={() => csv('topups', list.map((t) => ({ id: t.id, date: dateTime(t.at), user: names[t.uid]?.name || t.uid, phone: names[t.uid]?.phone || '', method: METHOD_NAMES[t.method] || t.method, amount: t.amount, status: t.status, ref: t.ref || '' })))}><Download size={16} />تصدير</button>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>التاريخ</th><th>الزبون</th><th>الطريقة</th><th>المبلغ</th><th>المرجع</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 300).map((t) => {
                  const I = METHOD_ICON[t.method] || CreditCard, u = names[t.uid]
                  return (
                    <tr key={t.id}>
                      <td className="small">{dateTime(t.at)}</td>
                      <td><b className="small">{u?.name || '—'}</b>{t.who === 'driver' && <span className="badge gray" style={{ marginInlineStart: 6 }}>سائق</span>}<div className="tiny muted num">{u?.phone}</div></td>
                      <td className="small"><span className="flex" style={{ gap: 6 }}><I size={15} />{METHOD_NAMES[t.method] || t.method}{t.last4 && <span className="num muted">•••• {t.last4}</span>}</span>{t.demo && <span className="badge gray">تجريبي</span>}</td>
                      <td><b className="num small">{money(t.amount)}</b></td>
                      <td className="tiny num">{t.ref || t.id}{t.receipt && <button className="btn btn-xs btn-ghost" style={{ marginInlineStart: 6 }} onClick={() => setImg(t.receipt)}><ImageIcon size={13} />الوصل</button>}</td>
                      <td><span className={`badge ${t.status === 'paid' ? 'green' : t.status === 'pending' ? 'yellow' : 'red'}`}>{{ paid: 'مقبول', pending: 'معلّق', rejected: 'مرفوض' }[t.status]}</span></td>
                      <td>{t.status === 'pending' && <span className="flex" style={{ gap: 6 }}>
                        <button className="btn btn-xs btn-success" onClick={async () => { await reviewTopup(t, true); toast('تم قبول الشحن وإضافة الرصيد ✅', 'success') }}><Check size={14} />قبول</button>
                        <button className="btn btn-xs btn-danger" onClick={async () => { const n = prompt('سبب الرفض؟', 'الوصل غير واضح'); if (n !== null) { await reviewTopup(t, false, n); toast('تم الرفض') } }}><X size={14} /></button>
                      </span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {list.length === 0 && <Empty title="لا توجد عمليات" />}
          </div>
        </div>
        <div className="col">
          <div className="panel-card">
            <h3>توزيع طرق الدفع</h3>
            {byMethod.length ? <Donut data={byMethod} /> : <Empty title="لا توجد بيانات بعد" />}
          </div>
          <div className="panel-card">
            <h3>طرق الدفع<span className="sp" /><button className="btn btn-primary btn-sm" onClick={savePay}><Save size={16} />حفظ</button></h3>
            <div className="col">
              {[['edahabia', 'البطاقة الذهبية (بريد الجزائر)'], ['cib', 'بطاقة CIB (SATIM)'], ['baridimob', 'بريدي موب / تحويل CCP'], ['voucher', 'قسائم الشحن']].map(([k, l]) => (
                <label key={k} className="between small"><span>{l}</span><Switch on={p[k] !== false} onChange={(v) => setP({ ...p, [k]: v })} /></label>
              ))}
              <label className="between small"><span><b>الوضع التجريبي</b><div className="tiny muted">الدفع بالبطاقة يُقبل فورًا بدون بوابة حقيقية (للعرض). أوقفه عند ربط بوابة SATIM.</div></span><Switch on={p.demo} onChange={(v) => setP({ ...p, demo: v })} /></label>
              <div className="form-grid">
                <Field label="أدنى مبلغ"><input className="input num" type="number" value={p.min} onChange={(e) => setP({ ...p, min: N(e.target.value) })} /></Field>
                <Field label="أقصى مبلغ"><input className="input num" type="number" value={p.max} onChange={(e) => setP({ ...p, max: N(e.target.value) })} /></Field>
              </div>
              <Field label="مبالغ سريعة (مفصولة بفاصلة)"><input className="input num" dir="ltr" value={(p.presets || []).join(',')} onChange={(e) => setP({ ...p, presets: e.target.value.split(',').map((x) => +x.trim()).filter(Boolean) })} /></Field>
              <Field label="رقم RIP للتحويل"><input className="input num" dir="ltr" value={p.rip} onChange={(e) => setP({ ...p, rip: e.target.value })} /></Field>
              <Field label="اسم صاحب الحساب"><input className="input" dir="ltr" value={p.ripName} onChange={(e) => setP({ ...p, ripName: e.target.value })} /></Field>
            </div>
          </div>
        </div>
      </div>
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="" /></div>}
    </>
  )
}

// ===== الطلبة =====
export function Students() {
  const { settings } = useApp()
  const { users } = useData()
  const pending = useWatch(watchStudents)
  const [st, setSt] = useState(settings.students)
  const [img, setImg] = useState(null)
  const [tab, setTab] = useState('pending')
  const verified = users.filter((u) => u.student?.status === 'verified')
  const pendingUsers = users.filter((u) => u.student?.status === 'pending')
  const list = tab === 'pending' ? pendingUsers : tab === 'verified' ? verified : users.filter((u) => u.student?.status === 'rejected')
  const uni = Object.entries(verified.reduce((o, u) => ({ ...o, [u.student.university]: (o[u.student.university] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><GraduationCap size={20} /></span><b className="num">{verified.length}</b><small>طلبة موثّقون</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--warning-bg)', color: '#a16207' }}><AlertTriangle size={20} /></span><b className="num">{Math.max(pending.length, pendingUsers.length)}</b><small>بانتظار المراجعة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><Percent size={20} /></span><b className="num">{st.discount}%</b><small>نسبة التخفيض</small></div>
      </div>
      <div className="grid-main">
        <div>
          <div className="toolbar"><div className="seg">{[['pending', 'بانتظار المراجعة'], ['verified', 'موثّقون'], ['rejected', 'مرفوضون']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>الطالب</th><th>الجامعة</th><th>رقم التسجيل</th><th>البطاقة</th><th>التاريخ</th><th /></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td><b className="small">{u.student.fullName || u.name}</b><div className="tiny muted num">{u.phone}</div></td>
                    <td className="small">{u.student.university}</td>
                    <td className="num small">{u.student.matricule}</td>
                    <td>{u.student.card ? <img src={u.student.card} alt="" style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} onClick={() => setImg(u.student.card)} /> : '—'}</td>
                    <td className="small">{timeAgo(u.student.submittedAt)}</td>
                    <td><span className="flex" style={{ gap: 6 }}>
                      {u.student.status !== 'verified' && <button className="btn btn-xs btn-success" onClick={async () => { await reviewStudent(u.id, true); toast('تم التوثيق ✅', 'success') }}><Check size={14} />توثيق</button>}
                      {u.student.status !== 'rejected' && <button className="btn btn-xs btn-danger" onClick={async () => { const n = prompt('سبب الرفض؟', 'البطاقة غير واضحة أو منتهية'); if (n !== null) { await reviewStudent(u.id, false, n); toast('تم الرفض') } }}><X size={14} /></button>}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <Empty icon={<GraduationCap size={34} />} title="لا يوجد طلبة هنا" />}
          </div>
        </div>
        <div className="col">
          <div className="panel-card">
            <h3>إعدادات خصم الطلبة<span className="sp" /><button className="btn btn-primary btn-sm" onClick={async () => { await saveSettings({ students: st }, 'تحديث خصم الطلبة'); toast('تم الحفظ ✅', 'success') }}><Save size={16} />حفظ</button></h3>
            <div className="col">
              <label className="between small"><span><b>تفعيل خصم الطلبة</b></span><Switch on={st.enabled} onChange={(v) => setSt({ ...st, enabled: v })} /></label>
              <label className="between small"><span><b>التوثيق الفوري</b><div className="tiny muted">تفعيل الخصم مباشرة بعد تصوير البطاقة (مناسب للعرض والإطلاق). عند الإيقاف تُراجع البطاقات يدويًا هنا.</div></span><Switch on={st.autoVerify} onChange={(v) => setSt({ ...st, autoVerify: v })} /></label>
              <div className="form-grid">
                <Field label="نسبة التخفيض %"><input className="input num" type="number" min="0" max="90" value={st.discount} onChange={(e) => setSt({ ...st, discount: N(e.target.value) })} /></Field>
                <Field label="أقصى تخفيض للرحلة (دج)"><input className="input num" type="number" value={st.maxDiscount} onChange={(e) => setSt({ ...st, maxDiscount: N(e.target.value) })} /></Field>
              </div>
            </div>
          </div>
          <div className="panel-card">
            <h3>أكثر الجامعات</h3>
            {uni.length ? <Bars data={uni.map(([k, v]) => ({ label: k.split('–')[0].replace('جامعة', '').trim().slice(0, 14), v }))} /> : <Empty title="لا توجد بيانات بعد" />}
          </div>
        </div>
      </div>
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="" /></div>}
    </>
  )
}

// ===== الميزات والنظام =====
const FEATURES = [
  ['reels', 'الإعلانات والنقاط (الريلز)', 'مشاهدة الإعلانات وربح النقاط'],
  ['delivery', 'خدمة التوصيل', 'توصيل الطرود والمشتريات'],
  ['schedule', 'برمجة الكورسات', 'حجز رحلة لوقت لاحق'],
  ['offerPrice', 'اقترح سومتك', 'الزبون يقترح سعرًا والسائق يقبل (مثل inDrive)'],
  ['womenDrivers', 'سائقة امرأة', 'خيار طلب سائقة للنساء'],
  ['tripPin', 'كود الرحلة PIN', 'السائق يُدخل كود الزبون قبل البدء — أمان إضافي'],
  ['rideForOther', 'رحلة لشخص آخر', 'حجز رحلة لأحد أفراد العائلة'],
  ['students', 'خصم الطلبة', 'تخفيض للطلبة الجامعيين'],
]
export function SystemAdmin() {
  const { settings } = useApp()
  const [f, setF] = useState(settings.features)
  const [m, setM] = useState(settings.maintenance)
  const [k, setK] = useState(settings.kyc)
  const [v, setV] = useState(settings.minVersion)
  const save = async () => { await saveSettings({ features: f, maintenance: m, kyc: k, minVersion: v }, 'تحديث الميزات والنظام'); toast('تم الحفظ ✅', 'success') }
  return (
    <div className="grid-main" style={{ marginTop: 0 }}>
      <div className="panel-card">
        <h3><Zap size={18} />الميزات<span className="sp" /><button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ</button></h3>
        <div className="col">
          {FEATURES.map(([key, t, d]) => (
            <label key={key} className="between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span><b className="small">{t}</b><div className="tiny muted">{d}</div></span>
              <Switch on={f[key] !== false} onChange={(x) => setF({ ...f, [key]: x })} />
            </label>
          ))}
        </div>
      </div>
      <div className="col">
        <div className="panel-card" style={m.on ? { borderColor: 'var(--danger)' } : null}>
          <h3><Wrench size={18} />وضع الصيانة</h3>
          <label className="between small"><span><b>إيقاف التطبيقات مؤقتًا</b><div className="tiny muted">يظهر للزبائن والسائقين شاشة صيانة بدل التطبيق</div></span><Switch on={m.on} onChange={(x) => setM({ ...m, on: x })} /></label>
          <Field label="رسالة الصيانة"><input className="input" value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} /></Field>
          {m.on && <div className="small mt" style={{ color: 'var(--danger)' }}><AlertTriangle size={14} /> التطبيقات متوقفة عند الحفظ</div>}
        </div>
        <div className="panel-card">
          <h3><ShieldCheck size={18} />التحقق من الهوية (KYC)</h3>
          <label className="between small"><span><b>توثيق وثائق السائقين فورًا</b><div className="tiny muted">بعد تصوير الوثائق بالماسح يتفعّل الحساب مباشرة</div></span><Switch on={k.autoVerify} onChange={(x) => setK({ ...k, autoVerify: x })} /></label>
        </div>
        <div className="panel-card">
          <h3><Settings2 size={18} />إصدار التطبيق</h3>
          <Field label="أدنى إصدار مسموح" hint="الإصدارات الأقدم يُطلب منها التحديث"><input className="input num" dir="ltr" value={v} onChange={(e) => setV(e.target.value)} /></Field>
          <button className="btn btn-primary btn-sm mt" onClick={save}><Save size={16} />حفظ</button>
        </div>
      </div>
    </div>
  )
}

// ===== سجل العمليات =====
const AUDIT_ICON = { settings: Settings2, topup: CreditCard, student: GraduationCap, driver: Car, ride: MapPin }
export function AuditLog() {
  const list = useWatch(watchAudit)
  const [q, setQ] = useState('')
  const rows = list.filter((a) => !q || `${a.detail} ${a.action}`.includes(q))
  return (
    <>
      <div className="toolbar">
        <div className="input-wrap" style={{ flex: 1, maxWidth: 340 }}><Search size={17} /><input className="input" placeholder="بحث في السجل" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn btn-sm btn-ghost" onClick={() => csv('audit', rows.map((a) => ({ date: dateTime(a.at), action: a.action, detail: a.detail })))}><Download size={16} />تصدير</button>
      </div>
      <div className="panel-card">
        {rows.length === 0 && <Empty icon={<History size={34} />} title="السجل فارغ" sub="كل تعديل من لوحة التحكم يُسجَّل هنا تلقائيًا" />}
        {rows.map((a) => {
          const I = AUDIT_ICON[a.action] || History
          return <div key={a.id} className="feed-item"><span className="ri" style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--brand-50)', color: 'var(--brand)' }}><I size={17} /></span><span className="grow small">{a.detail}</span><span className="tiny muted">{dateTime(a.at)}</span></div>
        })}
      </div>
    </>
  )
}

// ===== محفظة السائقين: السحوبات، الحد الأدنى، التحديات =====
export function DriverWallet() {
  const { settings } = useApp()
  const { drivers } = useData()
  const list = useWatch(watchWithdrawals)
  const [tab, setTab] = useState('pending')
  const [dw, setDw] = useState(settings.driverWallet)
  const [qs, setQs] = useState(settings.quests)
  const rows = list.filter((w) => tab === 'all' || w.status === tab)
  const owed = drivers.filter((d) => (d.wallet || 0) < 0)
  const save = async () => { await saveSettings({ driverWallet: dw, quests: qs }, 'تحديث محفظة السائقين والتحديات'); toast('تم الحفظ ✅', 'success') }
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><Banknote size={20} /></span><b className="num">{money(list.filter((w) => w.status === 'pending').reduce((s, w) => s + w.amount, 0))}</b><small>سحوبات معلّقة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><Check size={20} /></span><b className="num">{money(list.filter((w) => w.status === 'paid').reduce((s, w) => s + w.amount, 0))}</b><small>محوّلة للسائقين</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}><AlertTriangle size={20} /></span><b className="num">{money(-owed.reduce((s, d) => s + (d.wallet || 0), 0))}</b><small>عمولات مستحقة ({owed.length} سائق)</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><CreditCard size={20} /></span><b className="num">{money(drivers.reduce((s, d) => s + Math.max(0, d.wallet || 0), 0))}</b><small>أرصدة السائقين</small></div>
      </div>
      <div className="grid-main">
        <div>
          <div className="toolbar">
            <div className="seg">{[['pending', 'بانتظار التحويل'], ['paid', 'محوّلة'], ['rejected', 'مرفوضة'], ['all', 'الكل']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
            <span className="grow" />
            <button className="btn btn-sm btn-ghost" onClick={() => csv('withdrawals', rows.map((w) => ({ id: w.id, date: dateTime(w.at), driver: w.name, phone: w.phone, method: WITHDRAW_METHODS[w.method], account: w.account, holder: w.holder, amount: w.amount, status: w.status })))}><Download size={16} />تصدير</button>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>التاريخ</th><th>السائق</th><th>الطريقة</th><th>الحساب</th><th>المبلغ</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td className="small">{dateTime(w.at)}</td>
                    <td><b className="small">{w.name}</b><div className="tiny muted num">{w.phone}</div></td>
                    <td className="small">{WITHDRAW_METHODS[w.method] || w.method}</td>
                    <td className="small"><span className="num" dir="ltr">{w.account}</span><div className="tiny muted">{w.holder}</div></td>
                    <td><b className="num small">{money(w.amount)}</b></td>
                    <td><span className={`badge ${w.status === 'paid' ? 'green' : w.status === 'pending' ? 'yellow' : 'red'}`}>{{ paid: 'محوّل', pending: 'معلّق', rejected: 'مرفوض' }[w.status]}</span></td>
                    <td>{w.status === 'pending' && <span className="flex" style={{ gap: 6 }}>
                      <button className="btn btn-xs btn-success" onClick={async () => { if (confirm(`تأكيد أنك حوّلت ${w.amount} دج إلى ${w.account}؟`)) { await reviewWithdraw(w, true); toast('تم ✅', 'success') } }}><Check size={14} />تم التحويل</button>
                      <button className="btn btn-xs btn-danger" onClick={async () => { const n = prompt('سبب الرفض؟ (المبلغ يرجع لرصيد السائق)', 'رقم الحساب غير صحيح'); if (n !== null) { await reviewWithdraw(w, false, n); toast('تم الرفض وإرجاع المبلغ') } }}><X size={14} /></button>
                    </span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty title="لا توجد طلبات سحب" />}
          </div>
        </div>
        <div className="col">
          <div className="panel-card">
            <h3>إعدادات المحفظة<span className="sp" /><button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ</button></h3>
            <div className="col">
              <Field label="أدنى رصيد للاتصال (دج)" hint="إذا نزل رصيد السائق تحت هذا الحد (عمولات الكاش) لا يستطيع الاتصال حتى يشحن"><input className="input num" type="number" value={dw.minBalance} onChange={(e) => setDw({ ...dw, minBalance: N(e.target.value) })} /></Field>
              <Field label="أقل مبلغ للسحب (دج)"><input className="input num" type="number" value={dw.withdrawMin} onChange={(e) => setDw({ ...dw, withdrawMin: N(e.target.value) })} /></Field>
              <label className="between small"><span>السماح بشحن محفظة السائق</span><Switch on={dw.topup !== false} onChange={(v) => setDw({ ...dw, topup: v })} /></label>
              <label className="between small"><span>السماح بسحب الأرباح</span><Switch on={dw.withdraw !== false} onChange={(v) => setDw({ ...dw, withdraw: v })} /></label>
            </div>
          </div>
          <div className="panel-card">
            <h3>تحديات اليوم للسائقين</h3>
            <label className="between small"><span>تفعيل التحديات</span><Switch on={qs.enabled !== false} onChange={(v) => setQs({ ...qs, enabled: v })} /></label>
            {(qs.list || []).map((q, i) => (
              <div key={i} className="flex mt" style={{ gap: 8 }}>
                <Field label="عدد الكورسات"><input className="input num" type="number" value={q.trips} onChange={(e) => setQs({ ...qs, list: qs.list.map((x, j) => (j === i ? { ...x, trips: N(e.target.value) } : x)) })} /></Field>
                <Field label="المكافأة (دج)"><input className="input num" type="number" value={q.bonus} onChange={(e) => setQs({ ...qs, list: qs.list.map((x, j) => (j === i ? { ...x, bonus: N(e.target.value) } : x)) })} /></Field>
                <button className="btn btn-xs btn-danger" style={{ alignSelf: 'flex-end', marginBottom: 8 }} onClick={() => setQs({ ...qs, list: qs.list.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm mt" onClick={() => setQs({ ...qs, list: [...(qs.list || []), { trips: 30, bonus: 2000 }] })}><Plus size={16} />تحدي جديد</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ===== خطوط الحافلات =====
const EMPTY_LINE = { number: '', name: '', color: '#E8650A', speed: 18, headway: 12, buses: 0, start: '06:00', end: '20:00', mode: 'auto', active: true, city: 'sba', stops: [], path: null, order: 0 }
export function BusLines() {
  const { settings } = useApp()
  const lines = useWatch(watchAllLines)
  const live = useWatch(watchLiveBuses)
  const [edit, setEdit] = useState(null)
  const [b, setB] = useState(settings.bus)
  const [paths, setPaths] = useState({})
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 3000); return () => clearInterval(t) }, [])
  useEffect(() => { lines.forEach((l) => { if (!paths[l.id]) linePath(l).then((p) => setPaths((x) => ({ ...x, [l.id]: p }))) }) }, [lines.map((l) => l.id + l.updatedAt).join()])
  const markers = [], routes = []
  for (const l of lines.filter((x) => x.active !== false && paths[x.id]?.length > 1)) {
    const m = measure(paths[l.id])
    routes.push({ id: 'l' + l.id, coords: paths[l.id], color: l.color, from: l.color, to: l.color, width: 4, flow: false, casing: '#fff' })
    ;(l.stops || []).forEach((s, i) => markers.push({ id: `s${l.id}${i}`, type: 'busstop', coords: s.coords, color: l.color }))
    const real = live.filter((x) => x.line === l.id)
    real.forEach((x) => markers.push({ id: 'lv' + x.uid, type: 'bus', coords: x.coords, label: l.number, color: l.color, live: true }))
    if ((l.mode || 'auto') === 'sim' || (l.mode !== 'live' && !real.length && b.simulate !== false)) simBuses(l, m, now).forEach((x) => markers.push({ id: x.id, type: 'bus', coords: x.coords, label: l.number, color: l.color, smooth: 2900 }))
  }
  const c0 = CITIES.find((c) => c.id === (lines[0]?.city || 'sba')) || CITIES[0]
  const save = async () => { await saveSettings({ bus: b, features: { ...settings.features, bus: b.enabled !== false } }, 'تحديث إعدادات الحافلات'); toast('تم الحفظ ✅', 'success') }
  const importDemo = async () => {
    for (const l of demoLines(CITIES[0].center)) {
      const { id, demo, ...data } = l
      const r = await route(data.stops.map((s) => s.coords)).catch(() => null)
      await saveLine(null, { ...data, city: 'sba', active: true, mode: 'auto', ...(r?.real ? { path: r.coords, km: +r.distanceKm.toFixed(1) } : {}) })
    }
    toast('أضيفت 3 خطوط لسيدي بلعباس — عدّلها كيما تحب', 'success')
  }
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><Bus size={20} /></span><b className="num">{lines.filter((l) => l.active !== false).length}</b><small>خطوط نشطة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><MapPin size={20} /></span><b className="num">{lines.reduce((s, l) => s + (l.stops || []).length, 0)}</b><small>محطات</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><Radio size={20} /></span><b className="num">{live.length}</b><small>حافلات تبث مباشرة</small></div>
      </div>
      <div className="grid-main">
        <div className="col">
          <div className="panel-card" style={{ padding: 10 }}>
            <div className="live-map" style={{ height: 440 }}><MapView center={c0.center} zoom={12.6} markers={markers} routes={routes} /></div>
          </div>
          <div className="toolbar">
            <b className="grow">الخطوط</b>
            {lines.length === 0 && <button className="btn btn-ghost btn-sm" onClick={importDemo}><Sparkles size={16} />استيراد خطوط تجريبية</button>}
            <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY_LINE, order: lines.length })}><Plus size={16} />خط جديد</button>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>الخط</th><th>الولاية</th><th>المحطات</th><th>الأوقات</th><th>كل</th><th>الوضع</th><th>نشط</th><th /></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td><span className="flex" style={{ gap: 8 }}><span className="line-badge" style={{ '--lc': l.color }}>{l.number}</span><b className="small">{l.name}</b></span></td>
                    <td className="small">{CITIES.find((c) => c.id === l.city)?.ar || '—'}</td>
                    <td className="num small">{(l.stops || []).length}</td>
                    <td className="num small" dir="ltr">{l.start} – {l.end}</td>
                    <td className="num small">{l.headway} د</td>
                    <td className="small">{{ auto: 'تلقائي', live: 'مباشر فقط', sim: 'تقديري' }[l.mode || 'auto']}</td>
                    <td><Switch on={l.active !== false} onChange={(v) => saveLine(l.id, { active: v })} /></td>
                    <td><span className="flex" style={{ gap: 6 }}><button className="btn btn-xs btn-ghost" onClick={() => setEdit(l)}>تعديل</button><button className="btn btn-xs btn-danger" onClick={async () => { if (confirm(`حذف الخط ${l.number}؟`)) { await deleteLine(l.id); toast('تم الحذف') } }}><Trash2 size={14} /></button></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length === 0 && <Empty icon={<Bus size={34} />} title="ما كاين حتى خط" sub="أضف خطًا جديدًا أو استورد الخطوط التجريبية. بلا خطوط، التطبيق يبيّن خطوط تجريبية لسيدي بلعباس إذا فعّلتها." />}
          </div>
        </div>
        <div className="col">
          <div className="panel-card">
            <h3>إعدادات الحافلات<span className="sp" /><button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ</button></h3>
            <div className="col">
              <label className="between small"><span><b>تتبّع الحافلات في التطبيق</b><div className="tiny muted">زر "الحافلة" في الواجهة الرئيسية</div></span><Switch on={b.enabled !== false} onChange={(v) => setB({ ...b, enabled: v })} /></label>
              <label className="between small"><span><b>حافلات تقديرية</b><div className="tiny muted">إذا ما كاينش سائق يبث موقعه، نبيّنو الحافلات حسب جدول الخط (التوقيت وعدد المرات)</div></span><Switch on={b.simulate !== false} onChange={(v) => setB({ ...b, simulate: v })} /></label>
              <label className="between small"><span><b>خطوط تجريبية</b><div className="tiny muted">تظهر لسيدي بلعباس فقط ما دام ما زدتش خطوط</div></span><Switch on={b.demo !== false} onChange={(v) => setB({ ...b, demo: v })} /></label>
            </div>
          </div>
          <div className="panel-card">
            <h3><Radio size={18} />الحافلات المباشرة</h3>
            {live.length === 0 && <div className="tiny muted">سائق الحافلة يفتح تطبيق السائق ← القائمة ← "وضع سائق الحافلة" ← يختار الخط ويبدا البث.</div>}
            {live.map((x) => <div key={x.uid} className="feed-item"><span className="line-badge" style={{ '--lc': lines.find((l) => l.id === x.line)?.color }}>{lines.find((l) => l.id === x.line)?.number || '?'}</span><span className="grow small"><b>{x.name}</b><div className="tiny muted num">{x.plate}</div></span><span className="tiny muted">{timeAgo(x.at)}</span></div>)}
          </div>
        </div>
      </div>
      {edit && <LineEditor l={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
function LineEditor({ l, onClose }) {
  const [f, setF] = useState(l)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? N(e.target.value) : e.target.value })
  const city = CITIES.find((c) => c.id === f.city) || CITIES[0]
  const addStop = (coords) => setF((x) => ({ ...x, path: null, stops: [...(x.stops || []), { name: `محطة ${(x.stops || []).length + 1}`, coords: coords.map((v) => +v.toFixed(6)) }] }))
  const mapReady = (m) => m.on('click', (e) => addStop([e.lngLat.lng, e.lngLat.lat]))
  const moveStop = (i, d) => { const s = [...f.stops]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setF({ ...f, stops: s, path: null }) }
  const calc = async () => {
    if ((f.stops || []).length < 2) return toast('زيد محطتين على الأقل', 'error')
    setBusy(true)
    const r = await route(f.stops.map((s) => s.coords))
    setF((x) => ({ ...x, path: r?.coords || null, km: r ? +r.distanceKm.toFixed(1) : null }))
    setBusy(false)
    toast(r?.real ? `المسار على الطرقات: ${r.distanceKm.toFixed(1)} كم ✅` : 'ما قدرناش نجيبو المسار، راح نستعملو خطوط مستقيمة', r?.real ? 'success' : '')
  }
  const save = async () => {
    if (!f.number || !f.name || (f.stops || []).length < 2) return toast('دخّل رقم الخط واسمه ومحطتين على الأقل', 'error')
    const { id, ...data } = f
    // نحسبو المسار على الطرقات ونحفظوه، باش كل الهواتف تشوف الخط يتبع الطريق بمنعطفاتو
    if (!data.path) {
      const r = await route(data.stops.map((s) => s.coords)).catch(() => null)
      if (r?.real) { data.path = r.coords; data.km = +r.distanceKm.toFixed(1) }
    }
    await saveLine(id, data)
    toast('تم حفظ الخط ✅', 'success'); onClose()
  }
  const markers = (f.stops || []).map((s, i) => ({ id: 'e' + i, type: 'busstop', coords: s.coords, color: f.color, label: `${i + 1}. ${s.name}` }))
  return (
    <Modal title={l.id ? `تعديل الخط ${l.number}` : 'خط جديد'} onClose={onClose} wide>
      <div className="grid-main" style={{ marginTop: 0 }}>
        <div className="col">
          <div className="tiny muted">اضغط على الخريطة باش تزيد محطة في البلاصة اللي ضغطت فيها.</div>
          <div className="live-map" style={{ height: 380 }}><MapView center={f.stops?.[0]?.coords || city.center} zoom={13} markers={markers} routes={(f.path || (f.stops || []).map((s) => s.coords)).length > 1 ? [{ id: 'ed', coords: f.path || f.stops.map((s) => s.coords), color: f.color, from: f.color, to: f.color, width: 5, flow: false, dashed: !f.path }] : []} onReady={mapReady} /></div>
          <div className="flex"><button className="btn btn-ghost btn-sm" disabled={busy} onClick={calc}>{busy ? <span className="spinner" /> : <Navigation size={16} />}حساب المسار على الطرقات</button>{f.km && <span className="badge green">{f.km} كم</span>}{!f.path && <span className="tiny muted">بلا حساب: خطوط مستقيمة بين المحطات</span>}</div>
          <div className="col" style={{ gap: 6, maxHeight: 260, overflow: 'auto' }}>
            {(f.stops || []).map((s, i) => (
              <div key={i} className="flex" style={{ gap: 6 }}>
                <span className="line-badge" style={{ '--lc': f.color, minWidth: 28, height: 28 }}>{i + 1}</span>
                <input className="input" style={{ height: 38 }} value={s.name} onChange={(e) => setF({ ...f, stops: f.stops.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <button className="btn btn-xs btn-ghost" onClick={() => moveStop(i, -1)}>▲</button>
                <button className="btn btn-xs btn-ghost" onClick={() => moveStop(i, 1)}>▼</button>
                <button className="btn btn-xs btn-danger" onClick={() => setF({ ...f, path: null, stops: f.stops.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="col">
          <div className="form-grid">
            <Field label="رقم الخط *"><input className="input" value={f.number} onChange={set('number')} placeholder="7" /></Field>
            <Field label="اللون"><input className="input" type="color" value={f.color} onChange={set('color')} style={{ padding: 4 }} /></Field>
          </div>
          <Field label="اسم الخط *"><input className="input" value={f.name} onChange={set('name')} placeholder="المحطة البرية ⇄ الجامعة" /></Field>
          <Field label="الولاية"><select className="input" value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c.id} value={c.id}>{c.ar}</option>)}</select></Field>
          <div className="form-grid">
            <Field label="أول حافلة"><input className="input num" type="time" value={f.start} onChange={set('start')} /></Field>
            <Field label="آخر حافلة"><input className="input num" type="time" value={f.end} onChange={set('end')} /></Field>
            <Field label="كل (دقيقة)" hint="الوقت بين حافلتين"><input className="input num" type="number" value={f.headway} onChange={set('headway')} /></Field>
            <Field label="السرعة (كم/سا)" hint="مع التوقف في المحطات"><input className="input num" type="number" value={f.speed} onChange={set('speed')} /></Field>
            <Field label="عدد الحافلات" hint="0 = حسب التوقيت"><input className="input num" type="number" value={f.buses || 0} onChange={set('buses')} /></Field>
            <Field label="الترتيب"><input className="input num" type="number" value={f.order || 0} onChange={set('order')} /></Field>
          </div>
          <Field label="مصدر المواقع">
            <div className="seg">{[['auto', 'تلقائي'], ['live', 'مباشر فقط'], ['sim', 'تقديري']].map(([k, t]) => <button key={k} className={(f.mode || 'auto') === k ? 'active' : ''} onClick={() => setF({ ...f, mode: k })}>{t}</button>)}</div>
          </Field>
          <div className="tiny muted">تلقائي: نبيّنو الحافلات المباشرة، وإذا ما كاينش نبيّنو حافلات تقديرية حسب التوقيت.</div>
          <label className="flex small mt"><Switch on={f.active !== false} onChange={(v) => setF({ ...f, active: v })} />الخط نشط</label>
          <button className="btn btn-primary mt" onClick={save}><Save size={18} />حفظ الخط</button>
        </div>
      </div>
    </Modal>
  )
}

// ===== نوافذ الإشعار بالشاشة كاملة =====
const EMPTY_POP = { title: '', badge: 'جديد', body: '', image: '', video: '', link: '', cta: 'اكتشف', audience: 'all', cities: [], freq: 'once', start: null, end: null, closeAfter: 0, layout: 'full', theme: 'dark', accent: '#E8650A', priority: 0, active: true }
const toLocal = (ms) => (ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const fromLocal = (v) => (v ? new Date(v).getTime() : null)
export function Popups() {
  const list = useWatch(watchPopups)
  const stats = useWatch(watchPopupStats)
  const [edit, setEdit] = useState(null)
  const st = Object.fromEntries(stats.map((x) => [x.id, x]))
  const now = Date.now()
  const status = (p) => (p.active === false ? ['gray', 'متوقفة'] : p.end && now > p.end ? ['red', 'منتهية'] : p.start && now < p.start ? ['yellow', 'مبرمجة'] : ['green', 'تظهر دروك'])
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><MonitorSmartphone size={20} /></span><b className="num">{list.filter((p) => status(p)[0] === 'green').length}</b><small>نوافذ تظهر دروك</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Eye size={20} /></span><b className="num">{compact(stats.reduce((s, x) => s + (x.views || 0), 0))}</b><small>مشاهدات</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><ExternalLink size={20} /></span><b className="num">{compact(stats.reduce((s, x) => s + (x.clicks || 0), 0))}</b><small>نقرات على الزر</small></div>
      </div>
      <div className="toolbar mt">
        <span className="small muted grow">نافذة تملأ الشاشة تظهر للمستخدم كي يدخل للتطبيق: صورة ولا فيديو، عنوان، نص وزر برابط.</span>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY_POP })}><Plus size={16} />نافذة جديدة</button>
      </div>
      {list.length === 0 && <div className="panel-card"><Empty icon={<MonitorSmartphone size={36} />} title="ما كاين حتى نافذة" sub="أضف نافذة إشعار تظهر للزبائن ولا السائقين كي يفتحو التطبيق" action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY_POP })}><Plus size={16} />إضافة نافذة</button>} /></div>}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {list.map((p) => {
          const s = st[p.id] || {}, [c, t] = status(p)
          return (
            <div key={p.id} className="reel-tile">
              <div className="th" style={{ backgroundImage: p.image ? `url(${p.image})` : 'linear-gradient(135deg,#E8650A,#7B0E13)' }}>
                <span className={`badge ${c}`}>{t}</span>
                {p.video && <Video size={18} color="#fff" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }} />}
              </div>
              <div className="bd">
                <b className="small">{p.title || '(بلا عنوان)'}</b>
                <div className="tiny muted">{{ all: 'الجميع', riders: 'الزبائن', drivers: 'السائقون' }[p.audience || 'all']} • {{ once: 'مرة وحدة', daily: 'كل يوم', always: 'كل دخول' }[p.freq || 'once']}</div>
                <div className="flex tiny muted mt" style={{ justifyContent: 'space-between' }}><span><Eye size={12} /> {compact(s.views || 0)}</span><span><ExternalLink size={12} /> {compact(s.clicks || 0)}</span><span>{s.views ? Math.round(((s.clicks || 0) / s.views) * 100) : 0}% نقر</span></div>
                <div className="flex mt"><button className="btn btn-xs btn-ghost grow" onClick={() => setEdit(p)}>تعديل</button><button className="btn btn-xs btn-ghost" onClick={() => savePopup(p.id, { active: p.active === false })}>{p.active === false ? 'تشغيل' : 'إيقاف'}</button><button className="btn btn-xs btn-danger" onClick={async () => { if (confirm('حذف النافذة؟')) { await deletePopup(p.id); toast('تم الحذف') } }}><Trash2 size={14} /></button></div>
              </div>
            </div>
          )
        })}
      </div>
      {edit && <PopupEditor p={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
function PopupEditor({ p, onClose }) {
  const [f, setF] = useState(p)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? N(e.target.value) : e.target.value })
  const upVideo = (file) => {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) return toast('الفيديو كبير بزاف (أقصى 8 ميغا). استعمل رابط MP4 ولا يوتيوب', 'error')
    const r = new FileReader(); r.onload = () => setF((x) => ({ ...x, video: r.result })); r.readAsDataURL(file)
  }
  const save = async () => {
    if (!f.title && !f.image && !f.video) return toast('زيد عنوان ولا صورة ولا فيديو', 'error')
    setBusy(true)
    const { id, ...data } = f
    try { await savePopup(id, data); toast('تم حفظ النافذة ✅', 'success'); onClose() } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  return (
    <Modal title={p.id ? 'تعديل النافذة' : 'نافذة جديدة'} onClose={onClose} wide>
      <div className="grid-main" style={{ marginTop: 0 }}>
        <div className="col">
          <div className="form-grid">
            <Field label="العنوان"><input className="input" value={f.title} onChange={set('title')} placeholder="خصم 50% هاد الويكاند 🎉" /></Field>
            <Field label="الشارة"><input className="input" value={f.badge} onChange={set('badge')} placeholder="جديد" /></Field>
          </div>
          <Field label="النص"><textarea className="input" value={f.body} onChange={set('body')} placeholder="التفاصيل…" /></Field>
          <div className="form-grid">
            <Field label="رابط الزر" hint="https://… ولا رقم واتساب ولا #reels"><input className="input" dir="ltr" value={f.link} onChange={set('link')} /></Field>
            <Field label="نص الزر"><input className="input" value={f.cta} onChange={set('cta')} /></Field>
          </div>
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><Upload size={16} />رفع صورة<input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setF({ ...f, image: await compressImage(e.target.files[0], 1080, 0.8) })} /></label>
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><Video size={16} />رفع فيديو قصير<input type="file" accept="video/mp4,video/webm" hidden onChange={(e) => upVideo(e.target.files[0])} /></label>
            {(f.image || f.video) && <button className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, image: '', video: '' })}><Trash2 size={15} />نحّي الوسائط</button>}
          </div>
          <div className="form-grid">
            <Field label="رابط صورة"><input className="input" dir="ltr" value={f.image?.startsWith('data:') ? '(صورة مرفوعة)' : f.image} onChange={set('image')} /></Field>
            <Field label="رابط فيديو" hint="MP4 مباشر ولا يوتيوب"><input className="input" dir="ltr" value={f.video?.startsWith('data:') ? '(فيديو مرفوع)' : f.video} onChange={set('video')} /></Field>
          </div>
          <div className="form-grid">
            <Field label="الجمهور"><div className="seg">{[['all', 'الجميع'], ['riders', 'الزبائن'], ['drivers', 'السائقون']].map(([k, t]) => <button key={k} className={f.audience === k ? 'active' : ''} onClick={() => setF({ ...f, audience: k })}>{t}</button>)}</div></Field>
            <Field label="التكرار"><div className="seg">{[['once', 'مرة'], ['daily', 'كل يوم'], ['always', 'كل دخول']].map(([k, t]) => <button key={k} className={f.freq === k ? 'active' : ''} onClick={() => setF({ ...f, freq: k })}>{t}</button>)}</div></Field>
            <Field label="الشكل"><div className="seg">{[['full', 'شاشة كاملة'], ['card', 'بطاقة']].map(([k, t]) => <button key={k} className={f.layout === k ? 'active' : ''} onClick={() => setF({ ...f, layout: k })}>{t}</button>)}</div></Field>
            <Field label="الألوان"><div className="seg">{[['dark', 'داكن'], ['light', 'فاتح'], ['brand', 'برتقالي']].map(([k, t]) => <button key={k} className={f.theme === k ? 'active' : ''} onClick={() => setF({ ...f, theme: k })}>{t}</button>)}</div></Field>
            <Field label="يبدا من"><input className="input" type="datetime-local" value={toLocal(f.start)} onChange={(e) => setF({ ...f, start: fromLocal(e.target.value) })} /></Field>
            <Field label="ينتهي في"><input className="input" type="datetime-local" value={toLocal(f.end)} onChange={(e) => setF({ ...f, end: fromLocal(e.target.value) })} /></Field>
            <Field label="زر الإغلاق يظهر بعد (ثانية)"><input className="input num" type="number" min="0" max="15" value={f.closeAfter} onChange={set('closeAfter')} /></Field>
            <Field label="الأولوية" hint="الأكبر تظهر أولًا"><input className="input num" type="number" value={f.priority} onChange={set('priority')} /></Field>
            <Field label="لون الزر"><input className="input" type="color" value={f.accent} onChange={set('accent')} style={{ padding: 4 }} /></Field>
          </div>
          <Field label="الولايات" hint="فارغ = كل الولايات">
            <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>{CITIES.map((c) => <button key={c.id} className={`chip ${f.cities?.includes(c.id) ? 'brand' : ''}`} onClick={() => setF({ ...f, cities: f.cities?.includes(c.id) ? f.cities.filter((x) => x !== c.id) : [...(f.cities || []), c.id] })}>{c.ar}</button>)}</div>
          </Field>
          <label className="flex small"><Switch on={f.active !== false} onChange={(v) => setF({ ...f, active: v })} />النافذة نشطة</label>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : <Save size={18} />}حفظ ونشر</button>
        </div>
        <div>
          <div className="small muted center" style={{ marginBottom: 8 }}>معاينة على الهاتف</div>
          <div className="phone-prev" style={{ overflow: 'hidden' }}><PopupView p={f} preview onClose={() => {}} /></div>
        </div>
      </div>
    </Modal>
  )
}

// ===== محتوى التطبيق: أزرار الواجهة، البانر، النصوص القانونية =====
const QUICK_OPTS = [['ride', 'كورسة 🚗'], ['delivery', 'توصيل 📦'], ['bus', 'الحافلة 🚌'], ['reels', 'اربح (الإعلانات) 🎁'], ['schedule', 'برمج 📅'], ['student', 'خصم الطالب 🎓'], ['wallet', 'البورتفاي 💳']]
export function AppContent() {
  const { settings } = useApp()
  const [h, setH] = useState(settings.home)
  const [c, setC] = useState(settings.content)
  const [ann, setAnn] = useState(settings.announcement || '')
  const q = h.quick?.length ? h.quick : ['ride', 'delivery', 'bus', 'reels']
  const setSlot = (i, v) => { const n = [...q]; n[i] = v; setH({ ...h, quick: n }) }
  const save = async () => { await saveSettings({ home: h, content: c, announcement: ann }, 'تحديث محتوى التطبيق'); toast('تم الحفظ — يتبدّل في كل الهواتف ✅', 'success') }
  const bn = h.banner || {}
  return (
    <div className="grid-main" style={{ marginTop: 0 }}>
      <div className="col">
        <div className="panel-card">
          <h3>أزرار الواجهة الرئيسية<span className="sp" /><button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ</button></h3>
          <div className="tiny muted" style={{ marginBottom: 10 }}>الأزرار الأربعة تحت خانة "وين حاب تروح؟" عند الزبون.</div>
          <div className="form-grid">
            {[0, 1, 2, 3].map((i) => (
              <Field key={i} label={`الزر ${i + 1}`}><select className="input" value={q[i] || ''} onChange={(e) => setSlot(i, e.target.value)}>{QUICK_OPTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
            ))}
          </div>
        </div>
        <div className="panel-card">
          <h3>بانر الواجهة الرئيسية</h3>
          <label className="between small"><span>إظهار البانر</span><Switch on={!!bn.on} onChange={(v) => setH({ ...h, banner: { ...bn, on: v } })} /></label>
          <div className="form-grid mt">
            <Field label="العنوان"><input className="input" value={bn.title || ''} onChange={(e) => setH({ ...h, banner: { ...bn, title: e.target.value } })} placeholder="كورسة المطار بـ 800 دج" /></Field>
            <Field label="النص الصغير"><input className="input" value={bn.sub || ''} onChange={(e) => setH({ ...h, banner: { ...bn, sub: e.target.value } })} /></Field>
            <Field label="الرابط" hint="https://… ولا #bus ولا #student"><input className="input" dir="ltr" value={bn.link || ''} onChange={(e) => setH({ ...h, banner: { ...bn, link: e.target.value } })} /></Field>
            <Field label="لون الخلفية"><input className="input" type="color" value={bn.color || '#7B0E13'} onChange={(e) => setH({ ...h, banner: { ...bn, color: e.target.value } })} style={{ padding: 4 }} /></Field>
          </div>
          <div className="flex">
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><Upload size={16} />صورة البانر<input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setH({ ...h, banner: { ...bn, image: await compressImage(e.target.files[0], 900, 0.8) } })} /></label>
            {bn.image && <button className="btn btn-ghost btn-sm" onClick={() => setH({ ...h, banner: { ...bn, image: '' } })}><Trash2 size={15} /></button>}
          </div>
          {bn.on && <div className="home-banner mt" style={{ '--bc': bn.color || '#7B0E13', backgroundImage: bn.image ? `url(${bn.image})` : undefined }}><span><b>{bn.title || 'العنوان'}</b><small>{bn.sub}</small></span></div>}
        </div>
        <div className="panel-card">
          <h3>شريط الإعلان</h3>
          <Field label="نص يظهر أعلى الشاشة الرئيسية للزبائن"><input className="input" value={ann} onChange={(e) => setAnn(e.target.value)} placeholder="مثال: خصم 20% على كل الرحلات اليوم!" /></Field>
        </div>
      </div>
      <div className="col">
        <div className="panel-card">
          <h3><FileText size={18} />النصوص القانونية</h3>
          <Field label="شروط الاستخدام"><textarea className="input" style={{ minHeight: 140 }} value={c.terms || ''} onChange={(e) => setC({ ...c, terms: e.target.value })} placeholder="شروط استعمال وصلني…" /></Field>
          <Field label="سياسة الخصوصية"><textarea className="input" style={{ minHeight: 140 }} value={c.privacy || ''} onChange={(e) => setC({ ...c, privacy: e.target.value })} /></Field>
          <Field label="على التطبيق"><textarea className="input" style={{ minHeight: 90 }} value={c.about || ''} onChange={(e) => setC({ ...c, about: e.target.value })} /></Field>
          <button className="btn btn-primary btn-sm mt" onClick={save}><Save size={16} />حفظ</button>
        </div>
      </div>
    </div>
  )
}
