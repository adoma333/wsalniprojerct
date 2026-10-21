// صفحات الإدارة المتقدمة: الخريطة الحية، الولايات، المدفوعات، الطلبة، الميزات والنظام، سجل العمليات
import React, { useEffect, useMemo, useState } from 'react'
import {
  Save, Plus, Trash2, MapPin, Power, Percent, Check, X, Download, CreditCard, GraduationCap, ShieldCheck, Wrench, History, Radio, Car, Users,
  Search, Image as ImageIcon, Zap, Banknote, Smartphone, Ticket, AlertTriangle, Settings2,
} from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import { Switch, toast, Empty, Avatar } from '@/ui/kit.jsx'
import { StatusBadge } from '@/ui/ride-ui.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { money, num, dateTime, timeAgo, compact } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { saveSettings, reviewTopup, reviewStudent, watchTopups, watchStudents, watchAudit, METHOD_NAMES, store } from '@/core/api.js'
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
  const { users } = useData()
  const topups = useWatch(watchTopups)
  const [tab, setTab] = useState('pending')
  const [img, setImg] = useState(null)
  const [p, setP] = useState(settings.payments)
  const names = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users])
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
                      <td><b className="small">{u?.name || '—'}</b><div className="tiny muted num">{u?.phone}</div></td>
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
