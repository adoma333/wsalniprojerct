import React, { useMemo, useState } from 'react'
import { Save, Plus, Trash2, Edit3, Eye, Heart, MessageCircle, Share2, Copy, Download, Send, Bell, CheckCircle2, AlertTriangle, Lock, Database, Upload, Image as ImageIcon, Video, Calculator, Sparkles } from 'lucide-react'
import { Switch, toast, Empty, Avatar } from '@/ui/kit.jsx'
import { ClassCar, Coin } from '@/ui/art.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { money, num, dateTime, timeAgo, compressImage, copy, compact } from '@/core/util.js'
import { BRAND, DEFAULT_SETTINGS, pointsToDa } from '@/core/config.js'
import { MODE } from '@/core/store.js'
import { quote } from '@/core/pricing.js'
import { builtinReels } from '@/core/reels.js'
import { saveSettings, saveReel, deleteReel, savePromo, deletePromo, createVouchers, sendNotification, deleteNotification, updateTicket, store, auth } from '@/core/api.js'
import { useData } from './App.jsx'
import { Modal, csv } from './pages-a.jsx'

const Field = ({ label, children, hint }) => <div className="field"><label>{label}</label>{children}{hint && <span className="tiny muted">{hint}</span>}</div>
const N = (v) => (v === '' ? '' : Number(v))

// ===== التسعير =====
export function Pricing() {
  const { settings } = useApp()
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(settings.pricing)))
  const [d, setD] = useState({ km: 8, min: 18 })
  const [hour, setHour] = useState(new Date().getHours())
  const setC = (i, k, v) => setP({ ...p, classes: p.classes.map((c, j) => (j === i ? { ...c, [k]: v } : c)) })
  const save = async () => { await saveSettings({ pricing: p }); toast('تم حفظ التسعير ✅', 'success') }
  const when = new Date(); when.setHours(hour)
  return (
    <>
      <div className="panel-card">
        <h3>فئات السيارات<span className="sp" /><button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ التسعير</button></h3>
        <div className="col" style={{ gap: 10 }}>
          {p.classes.map((c, i) => (
            <div key={c.id} className="cls-edit">
              <ClassCar type={c.icon} w={74} />
              <div><label>الاسم</label><input className="input" value={c.ar} onChange={(e) => setC(i, 'ar', e.target.value)} /></div>
              <div><label>فتح العداد</label><input className="input" type="number" step="0.5" value={c.base} onChange={(e) => setC(i, 'base', N(e.target.value))} /></div>
              <div><label>لكل كم</label><input className="input" type="number" step="0.05" value={c.perKm} onChange={(e) => setC(i, 'perKm', N(e.target.value))} /></div>
              <div><label>لكل دقيقة</label><input className="input" type="number" step="0.05" value={c.perMin} onChange={(e) => setC(i, 'perMin', N(e.target.value))} /></div>
              <div><label>الحد الأدنى</label><input className="input" type="number" step="0.5" value={c.min} onChange={(e) => setC(i, 'min', N(e.target.value))} /></div>
              <div><label>المقاعد</label><input className="input" type="number" value={c.seats} onChange={(e) => setC(i, 'seats', N(e.target.value))} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-main">
        <div className="panel-card">
          <h3>العوامل الديناميكية</h3>
          <div className="form-grid">
            <Field label="معامل الليل (11م–6ص)"><input className="input" type="number" step="0.05" value={p.nightMult} onChange={(e) => setP({ ...p, nightMult: N(e.target.value) })} /></Field>
            <Field label="معامل الذروة (7–9 و16–19)"><input className="input" type="number" step="0.05" value={p.peakMult} onChange={(e) => setP({ ...p, peakMult: N(e.target.value) })} /></Field>
            <Field label="عمولة التطبيق %"><input className="input" type="number" value={p.commission} onChange={(e) => setP({ ...p, commission: N(e.target.value) })} /></Field>
            <Field label="رسوم الإلغاء"><input className="input" type="number" step="0.5" value={p.cancelFee} onChange={(e) => setP({ ...p, cancelFee: N(e.target.value) })} /></Field>
            <Field label="التقريب لأقرب"><input className="input" type="number" step="0.25" value={p.roundTo} onChange={(e) => setP({ ...p, roundTo: N(e.target.value) })} /></Field>
          </div>
          <div className="tiny muted mt">يُضاف تلقائيًا معامل الطلب (1.15–1.3) عندما تزيد الطلبات على السيارات المتاحة.</div>
        </div>
        <div className="panel-card calc">
          <h3><Calculator size={18} color="var(--brand)" />حاسبة الأسعار</h3>
          <Field label={`المسافة: ${d.km} كم`}><input className="range" type="range" min="1" max="40" value={d.km} onChange={(e) => setD({ ...d, km: +e.target.value })} /></Field>
          <Field label={`المدة: ${d.min} دقيقة`}><input className="range" type="range" min="3" max="90" value={d.min} onChange={(e) => setD({ ...d, min: +e.target.value })} /></Field>
          <Field label={`الساعة: ${hour}:00`}><input className="range" type="range" min="0" max="23" value={hour} onChange={(e) => setHour(+e.target.value)} /></Field>
          <div className="col mt" style={{ gap: 6 }}>
            {p.classes.map((c) => { const q = quote(c, { distanceKm: d.km, durationMin: d.min }, p, { when }); return <div key={c.id} className="between small"><span>{c.ar} {q.surge > 1 && <span className="badge yellow">×{q.surge}</span>}</span><b className="num">{money(q.total)}</b></div> })}
          </div>
        </div>
      </div>
    </>
  )
}

// ===== الريلز =====
const EMPTY_REEL = { advertiser: '', handle: '', title: '', caption: '', cta: 'اعرف أكثر', link: '', image: '', video: '', tint: '#E8650A', points: '', duration: '', active: true, order: 0 }
export function ReelsAdmin() {
  const { reels, reelStats } = useData()
  const { settings } = useApp()
  const [edit, setEdit] = useState(null)
  const [tab, setTab] = useState('custom')
  const stats = Object.fromEntries(reelStats.map((s) => [s.id, s]))
  const builtins = useMemo(() => builtinReels(settings.rewards), [settings.rewards])
  const list = tab === 'custom' ? reels : builtins
  const totalViews = reelStats.reduce((s, r) => s + (r.views || 0), 0)
  return (
    <>
      <div className="kpis">
        <div className="kpi hero"><span className="ki"><Eye size={20} /></span><b className="num">{num(totalViews)}</b><small>مشاهدات مكتملة</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><Coin size={20} /></span><b className="num">{num(totalViews * settings.rewards.pointsPerReel)}</b><small>نقاط موزعة ≈ {money(pointsToDa(totalViews * settings.rewards.pointsPerReel, settings.rewards))}</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Share2 size={20} /></span><b className="num">{num(reelStats.reduce((s, r) => s + (r.clicks || 0), 0))}</b><small>نقرات على الزر</small></div>
        <div className="kpi"><span className="ki" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><Sparkles size={20} /></span><b className="num">{reels.filter((r) => r.active !== false).length}</b><small>إعلانات نشطة</small></div>
      </div>
      <div className="toolbar mt">
        <div className="seg"><button className={tab === 'custom' ? 'active' : ''} onClick={() => setTab('custom')}>إعلاناتي ({reels.length})</button><button className={tab === 'builtin' ? 'active' : ''} onClick={() => setTab('builtin')}>المدمجة (100)</button></div>
        <span className="grow" />
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY_REEL })}><Plus size={16} />إعلان جديد</button>
      </div>
      {tab === 'builtin' && <div className="panel-card small flex" style={{ marginBottom: 12 }}><Sparkles size={18} color="var(--brand)" /><span className="grow">100 ريل جاهز بنفس صورة المعاينة. يمكنك إخفاؤها من صفحة المكافآت بعد إضافة إعلاناتك الحقيقية.</span><span className={`badge ${settings.rewards.builtinReels ? 'green' : 'gray'}`}>{settings.rewards.builtinReels ? 'ظاهرة' : 'مخفية'}</span></div>}
      {list.length === 0 && <div className="panel-card"><Empty icon={<ImageIcon size={36} />} title="لا توجد إعلانات خاصة بعد" sub="أضف إعلانًا بصورة أو فيديو وحدد المكافأة ومدة المشاهدة" action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY_REEL })}><Plus size={16} />إضافة إعلان</button>} /></div>}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {list.slice(0, tab === 'builtin' ? 24 : 999).map((r) => {
          const s = stats[r.id] || {}
          return (
            <div key={r.id} className="reel-tile">
              <div className="th" style={{ backgroundImage: `url(${r.image || 'reels/ad.jpg'})` }}>
                <span className={`badge ${r.active === false ? 'gray' : 'green'}`}>{r.active === false ? 'متوقف' : 'نشط'}</span>
                {r.video && <Video size={18} color="#fff" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }} />}
              </div>
              <div className="bd">
                <b className="small">{r.advertiser}</b>
                <div className="tiny muted" style={{ height: 34, overflow: 'hidden' }}>{r.caption}</div>
                <div className="flex tiny muted mt" style={{ justifyContent: 'space-between' }}><span><Eye size={12} /> {compact(s.views || 0)}</span><span><Share2 size={12} /> {compact(s.clicks || 0)}</span><span className="badge">+{r.points || settings.rewards.pointsPerReel} نقطة</span></div>
                {!r.builtin && <div className="flex mt"><button className="btn btn-xs btn-ghost grow" onClick={() => setEdit(r)}><Edit3 size={14} />تعديل</button><button className="btn btn-xs btn-danger" onClick={async () => { if (confirm('حذف الإعلان؟')) { await deleteReel(r.id); toast('تم الحذف') } }}><Trash2 size={14} /></button></div>}
              </div>
            </div>
          )
        })}
      </div>
      {edit && <ReelEditor r={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
function ReelEditor({ r, onClose }) {
  const [f, setF] = useState(r)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? N(e.target.value) : e.target.value })
  const save = async () => {
    if (!f.advertiser || !f.caption) return toast('أدخل اسم المعلن والنص', 'error')
    const { id, ...data } = f
    for (const k of ['points', 'duration']) if (data[k] === '') delete data[k]
    await saveReel(id, data)
    toast('تم حفظ الإعلان ✅', 'success'); onClose()
  }
  return (
    <Modal title={r.id ? 'تعديل الإعلان' : 'إعلان جديد'} onClose={onClose} wide>
      <div className="grid-main" style={{ marginTop: 0 }}>
        <div className="col">
          <div className="form-grid">
            <Field label="اسم المعلن *"><input className="input" value={f.advertiser} onChange={set('advertiser')} /></Field>
            <Field label="المعرف (handle)"><input className="input" value={f.handle} onChange={set('handle')} dir="ltr" placeholder="brand.ly" /></Field>
            <Field label="العنوان الكبير"><input className="input" value={f.title} onChange={set('title')} placeholder="عرض خاص" /></Field>
            <Field label="نص الزر"><input className="input" value={f.cta} onChange={set('cta')} /></Field>
          </div>
          <Field label="نص الإعلان *"><textarea className="input" value={f.caption} onChange={set('caption')} /></Field>
          <div className="form-grid">
            <Field label="رابط الزر"><input className="input" value={f.link} onChange={set('link')} dir="ltr" placeholder="https://" /></Field>
            <Field label="رابط فيديو (اختياري)" hint="MP4 مباشر"><input className="input" value={f.video} onChange={set('video')} dir="ltr" /></Field>
            <Field label="النقاط لكل مشاهدة" hint="فارغ = الافتراضي"><input className="input" type="number" value={f.points} onChange={set('points')} /></Field>
            <Field label="مدة المشاهدة (ث)" hint="فارغ = الافتراضي"><input className="input" type="number" value={f.duration} onChange={set('duration')} /></Field>
            <Field label="الترتيب"><input className="input" type="number" value={f.order} onChange={set('order')} /></Field>
            <Field label="لون الطبقة"><input className="input" type="color" value={f.tint} onChange={set('tint')} style={{ padding: 4 }} /></Field>
          </div>
          <div className="flex">
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}><Upload size={16} />رفع صورة<input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setF({ ...f, image: await compressImage(e.target.files[0], 1080, 0.75) })} /></label>
            <input className="input" style={{ height: 40 }} placeholder="أو رابط صورة" value={f.image?.startsWith('data:') ? '' : f.image} onChange={set('image')} dir="ltr" />
          </div>
          <label className="flex small"><Switch on={f.active !== false} onChange={(v) => setF({ ...f, active: v })} />الإعلان نشط</label>
          <button className="btn btn-primary" onClick={save}><Save size={18} />حفظ</button>
        </div>
        <div>
          <div className="phone-prev">
            {f.video ? <video src={f.video} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="bg" style={{ backgroundImage: `url(${f.image || 'reels/ad.jpg'})` }} />}
            <div style={{ position: 'absolute', inset: 0, background: f.tint, mixBlendMode: 'soft-light', opacity: 0.55 }} />
            <div style={{ position: 'absolute', top: '32%', insetInline: 14, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 22, textShadow: '0 4px 20px rgba(0,0,0,.5)' }}>{f.title || f.advertiser}</div>
            <div className="tx"><b>{f.advertiser || 'اسم المعلن'}</b><div>{f.caption || 'نص الإعلان يظهر هنا'}</div><div style={{ marginTop: 8, background: 'var(--brand)', borderRadius: 8, padding: '6px 10px', fontWeight: 600 }}>{f.cta}</div></div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ===== المكافآت =====
export function RewardsAdmin() {
  const { settings } = useApp()
  const { users } = useData()
  const [r, setR] = useState(settings.rewards)
  const top = [...users].sort((a, b) => (b.earnedTotal || 0) - (a.earnedTotal || 0)).slice(0, 10)
  const S = (k) => (e) => setR({ ...r, [k]: N(e.target.value) })
  const outstanding = users.reduce((t, u) => t + (u.points || 0), 0)
  const perDay = r.dailyLimit * r.pointsPerReel
  return (
    <div className="grid-main" style={{ marginTop: 0 }}>
      <div className="col">
        <div className="panel-card">
          <h3>نظام النقاط<span className="sp" /><button className="btn btn-primary btn-sm" onClick={async () => { await saveSettings({ rewards: r }); toast('تم الحفظ ✅', 'success') }}><Save size={16} />حفظ</button></h3>
          <div className="form-grid">
            <Field label="نقاط كل إعلان"><input className="input" type="number" value={r.pointsPerReel} onChange={S('pointsPerReel')} /></Field>
            <Field label="قيمة 100 نقطة (دج)" hint="يمكن تغييرها في أي وقت دون أن يلاحظ الزبون — الزبون يرى النقاط فقط"><input className="input" type="number" step="0.5" value={r.pointValue} onChange={S('pointValue')} /></Field>
            <Field label="مدة المشاهدة المطلوبة (ثانية)"><input className="input" type="number" value={r.watchSeconds} onChange={S('watchSeconds')} /></Field>
            <Field label="الحد اليومي للإعلانات"><input className="input" type="number" value={r.dailyLimit} onChange={S('dailyLimit')} /></Field>
            <Field label="أدنى تحويل (نقطة)"><input className="input" type="number" value={r.minConvert} onChange={S('minConvert')} /></Field>
            <Field label="مكافأة الإحالة (نقطة)"><input className="input" type="number" value={r.referralBonus} onChange={S('referralBonus')} /></Field>
          </div>
          <label className="between mt"><span><b className="small">التحويل التلقائي إلى الرصيد</b><div className="tiny muted">عندما يصل الزبون إلى الحد التالي تتحول نقاطه تلقائيًا إلى دينار في البورتفاي</div></span><Switch on={r.autoConvert} onChange={(v) => setR({ ...r, autoConvert: v })} /></label>
          {r.autoConvert && <Field label="التحويل عند (نقطة)"><input className="input" type="number" value={r.autoConvertAt} onChange={S('autoConvertAt')} /></Field>}
          <label className="flex mt"><Switch on={r.builtinReels} onChange={(v) => setR({ ...r, builtinReels: v })} />إظهار الـ 100 إعلان المدمجة</label>
          <div className="calc mt small">
            <b>حساب سريع:</b> 100 نقطة = <b className="num">{money(r.pointValue)}</b> • إعلان واحد = <b className="num">{money(pointsToDa(r.pointsPerReel, r))}</b> • زبون يشاهد {r.dailyLimit} إعلان يربح <b className="num">{num(perDay)}</b> نقطة = <b className="num">{money(pointsToDa(perDay, r))}</b> في اليوم ≈ <b className="num">{Math.floor(pointsToDa(perDay, r) / 200)}</b> كورسة مجانية.
          </div>
        </div>
      </div>
      <div className="col">
        <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="kpi hero"><span className="ki"><Coin size={20} /></span><b className="num">{compact(outstanding)}</b><small>نقاط عند الزبائن</small></div>
          <div className="kpi"><span className="ki" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><Calculator size={20} /></span><b className="num">{money(pointsToDa(outstanding, r))}</b><small>القيمة الحالية (التزام)</small></div>
        </div>
        <div className="panel-card">
          <h3>الأكثر ربحًا</h3>
          {top.length === 0 && <Empty title="لا يوجد بعد" />}
          {top.map((u, i) => <div key={u.id} className="feed-item"><b className="num" style={{ width: 22 }}>{i + 1}</b><Avatar name={u.name} size={34} /><span className="grow small">{u.name}</span><b className="num small" style={{ color: 'var(--brand)' }}>{num(u.points || 0)} نقطة</b></div>)}
        </div>
      </div>
    </div>
  )
}

// ===== أكواد الخصم =====
export function Promos() {
  const { promos } = useData()
  const [f, setF] = useState({ code: '', type: 'percent', value: 20, max: '', maxUses: '', expires: '' })
  const add = async () => {
    if (f.code.length < 3) return toast('الكود 3 أحرف على الأقل', 'error')
    await savePromo(f.code, { type: f.type, value: Number(f.value), max: f.max ? Number(f.max) : null, maxUses: f.maxUses ? Number(f.maxUses) : null, expires: f.expires ? new Date(f.expires).getTime() : null, active: true, used: 0, createdAt: Date.now() })
    setF({ ...f, code: '' }); toast('تم إنشاء الكود ✅', 'success')
  }
  return (
    <>
      <div className="panel-card">
        <h3>كود جديد</h3>
        <div className="form-grid">
          <Field label="الكود"><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="WASALNI20" dir="ltr" /></Field>
          <Field label="النوع"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select></Field>
          <Field label="القيمة"><input className="input" type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="أقصى خصم (دج)"><input className="input" type="number" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></Field>
          <Field label="عدد الاستخدامات"><input className="input" type="number" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} placeholder="غير محدود" /></Field>
          <Field label="ينتهي في"><input className="input" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field>
        </div>
        <button className="btn btn-primary btn-sm mt" onClick={add}><Plus size={16} />إنشاء</button>
      </div>
      <div className="tbl-wrap mt">
        <table className="tbl">
          <thead><tr><th>الكود</th><th>الخصم</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th /></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td><b className="num">{p.id}</b></td>
                <td>{p.type === 'percent' ? `${p.value}%` : money(p.value)}{p.max ? ` (حتى ${money(p.max)})` : ''}</td>
                <td className="num">{p.used || 0}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
                <td className="small">{p.expires ? dateTime(p.expires) : '—'}</td>
                <td><Switch on={p.active} onChange={(v) => savePromo(p.id, { active: v })} /></td>
                <td><button className="btn btn-xs btn-danger" onClick={() => deletePromo(p.id)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {promos.length === 0 && <Empty title="لا توجد أكواد" />}
      </div>
    </>
  )
}

// ===== قسائم الشحن =====
export function Vouchers() {
  const { vouchers } = useData()
  const [n, setN] = useState(10)
  const [amount, setAmount] = useState(1000)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState([])
  const gen = async () => { setBusy(true); const c = await createVouchers(Math.min(200, n), Number(amount)); setLast(c); setBusy(false); toast(`تم إنشاء ${c.length} قسيمة`, 'success') }
  const unused = vouchers.filter((v) => !v.used)
  return (
    <>
      <div className="kpis">
        <div className="kpi"><b className="num">{vouchers.length}</b><small>إجمالي القسائم</small></div>
        <div className="kpi"><b className="num">{unused.length}</b><small>غير مستخدمة</small></div>
        <div className="kpi"><b className="num">{money(vouchers.filter((v) => v.used).reduce((s, v) => s + v.amount, 0))}</b><small>قيمة مستخدمة</small></div>
      </div>
      <div className="panel-card mt">
        <h3>توليد قسائم</h3>
        <div className="form-grid">
          <Field label="العدد"><input className="input" type="number" value={n} onChange={(e) => setN(+e.target.value)} /></Field>
          <Field label="القيمة (دج)"><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>
        <div className="flex mt">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={gen}>{busy ? <span className="spinner" /> : <><Plus size={16} />توليد</>}</button>
          {last.length > 0 && <button className="btn btn-ghost btn-sm" onClick={async () => { await copy(last.join('\n')); toast('تم نسخ الأكواد') }}><Copy size={16} />نسخ آخر {last.length}</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => csv('vouchers', unused.map((v) => ({ code: v.id, amount: v.amount, created: dateTime(v.createdAt) })))}><Download size={16} />تصدير غير المستخدمة</button>
        </div>
      </div>
      <div className="tbl-wrap mt">
        <table className="tbl">
          <thead><tr><th>الكود</th><th>القيمة</th><th>الحالة</th><th>استخدمها</th><th>التاريخ</th></tr></thead>
          <tbody>{vouchers.slice(0, 200).map((v) => <tr key={v.id}><td><b className="num">{v.id}</b></td><td className="num">{money(v.amount)}</td><td>{v.used ? <span className="badge gray">مستخدمة</span> : <span className="badge green">متاحة</span>}</td><td className="small num">{v.usedBy?.slice(0, 8) || '—'}</td><td className="small">{dateTime(v.usedAt || v.createdAt)}</td></tr>)}</tbody>
        </table>
        {vouchers.length === 0 && <Empty title="لا توجد قسائم" />}
      </div>
    </>
  )
}

// ===== الإشعارات =====
export function NotificationsAdmin() {
  const { notifications } = useData()
  const [f, setF] = useState({ title: '', body: '', target: 'all' })
  const send = async () => {
    if (!f.title) return toast('أدخل العنوان', 'error')
    await sendNotification(f); setF({ title: '', body: '', target: f.target }); toast('تم الإرسال ✅', 'success')
  }
  return (
    <div className="grid-main" style={{ marginTop: 0 }}>
      <div className="panel-card">
        <h3><Bell size={18} color="var(--brand)" />إشعار جديد</h3>
        <div className="col">
          <Field label="الجمهور"><div className="seg">{[['all', 'الجميع'], ['riders', 'الزبائن'], ['drivers', 'السائقون']].map(([k, l]) => <button key={k} className={f.target === k ? 'active' : ''} onClick={() => setF({ ...f, target: k })}>{l}</button>)}</div></Field>
          <Field label="العنوان"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="🎁 عرض نهاية الأسبوع" /></Field>
          <Field label="النص"><textarea className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="استخدم الكود WEEKEND لخصم 25%" /></Field>
          <button className="btn btn-primary" onClick={send}><Send size={18} />إرسال</button>
        </div>
      </div>
      <div className="panel-card">
        <h3>المرسلة</h3>
        {notifications.length === 0 && <Empty title="لا توجد إشعارات" />}
        {notifications.map((n) => <div key={n.id} className="feed-item"><div className="grow"><b className="small">{n.title}</b><div className="tiny muted">{n.body}</div><div className="tiny muted">{timeAgo(n.at)} • {{ all: 'الجميع', riders: 'الزبائن', drivers: 'السائقون' }[n.target || 'all']}</div></div><button className="btn btn-xs btn-danger" onClick={() => deleteNotification(n.id)}><Trash2 size={14} /></button></div>)}
      </div>
    </div>
  )
}

// ===== الدعم =====
export function SupportAdmin() {
  const { tickets, sos } = useData()
  const [reply, setReply] = useState({})
  return (
    <div className="grid-main" style={{ marginTop: 0 }}>
      <div className="panel-card">
        <h3>رسائل الدعم<span className="sp" /><span className="badge yellow">{tickets.filter((t) => t.status !== 'closed').length} مفتوحة</span></h3>
        {tickets.length === 0 && <Empty title="لا توجد رسائل" />}
        <div className="col">
          {tickets.map((t) => (
            <div key={t.id} className="calc">
              <div className="between"><span className="flex"><Avatar name={t.name} size={32} /><span><b className="small">{t.name || 'مستخدم'}</b><div className="tiny muted num">{t.phone} • {t.app === 'driver' ? 'سائق' : 'زبون'}</div></span></span><span className={`badge ${t.status === 'closed' ? 'green' : 'yellow'}`}>{t.status === 'closed' ? 'مغلقة' : 'مفتوحة'}</span></div>
              <p className="small" style={{ margin: '10px 0' }}>{t.message}</p>
              {t.replies?.map((r, i) => <div key={i} className="tiny" style={{ padding: 8, borderRadius: 10, background: 'var(--brand-50)', marginBottom: 6 }}>↩ {r.text}</div>)}
              <div className="flex">
                <input className="input" style={{ height: 40 }} placeholder="اكتب الرد…" value={reply[t.id] || ''} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} />
                <button className="btn btn-primary btn-sm" onClick={async () => { if (!reply[t.id]) return; await updateTicket(t.id, { replies: [...(t.replies || []), { text: reply[t.id], at: Date.now() }] }); setReply({ ...reply, [t.id]: '' }) }}><Send size={15} /></button>
                {t.status !== 'closed' && <button className="btn btn-ghost btn-sm" onClick={() => updateTicket(t.id, { status: 'closed' })}><CheckCircle2 size={15} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel-card">
        <h3><AlertTriangle size={18} color="var(--danger)" />بلاغات الطوارئ</h3>
        {sos.length === 0 && <Empty title="لا توجد بلاغات" />}
        {sos.map((s) => (
          <div key={s.id} className="feed-item">
            <span className="badge red">SOS</span>
            <div className="grow"><b className="small">{s.name}</b> <span className="tiny muted">({s.kind === 'driver' ? 'سائق' : 'زبون'})</span><div className="tiny muted num">{s.phone} • {timeAgo(s.at)}</div>{s.loc && <a className="tiny" href={`https://maps.google.com/?q=${s.loc[1]},${s.loc[0]}`} target="_blank" rel="noreferrer">عرض الموقع</a>}</div>
            {!s.handled ? <button className="btn btn-xs btn-success" onClick={() => store.update(`sos/${s.id}`, { handled: true })}>تمت المعالجة</button> : <CheckCircle2 color="var(--success)" size={18} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== الإعدادات =====
export function SettingsAdmin() {
  const { settings } = useApp()
  const data = useData()
  const [s, setS] = useState({ fleetSimulation: settings.fleetSimulation, autoApproveDrivers: settings.autoApproveDrivers, announcement: settings.announcement, support: settings.support })
  const [pw, setPw] = useState({ old: '', n1: '', n2: '' })
  const save = async () => { await saveSettings(s); toast('تم حفظ الإعدادات ✅', 'success') }
  const changePw = async () => {
    if (pw.n1.length < 6 || pw.n1 !== pw.n2) return toast('تحقق من كلمة السر الجديدة', 'error')
    try { await auth.adminChangePassword(BRAND.adminEmail, pw.old, pw.n1); setPw({ old: '', n1: '', n2: '' }); toast('تم تغيير كلمة السر ✅', 'success') } catch (e) { toast(e.message, 'error') }
  }
  const backup = () => {
    const a = document.createElement('a')
    const { go, ...rest } = data
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ settings, ...rest }, null, 1)], { type: 'application/json' }))
    a.download = `wasalni-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  return (
    <div className="grid-main" style={{ marginTop: 0 }}>
      <div className="col">
        <div className="panel-card">
          <h3>تشغيل المنصة<span className="sp" /><button className="btn btn-primary btn-sm" onClick={save}><Save size={16} />حفظ</button></h3>
          <div className="col">
            <label className="between"><span><b className="small">أسطول المحاكاة</b><div className="tiny muted">سيارات افتراضية على الخريطة وسائق افتراضي يقبل الطلب إن لم يقبله سائق حقيقي — مفيد للعرض والتجربة. أوقفه عند وجود سائقين حقيقيين.</div></span><Switch on={s.fleetSimulation} onChange={(v) => setS({ ...s, fleetSimulation: v })} /></label>
            <label className="between"><span><b className="small">قبول السائقين تلقائيًا</b><div className="tiny muted">عند الإيقاف يجب الموافقة يدويًا على كل سائق من صفحة السائقين.</div></span><Switch on={s.autoApproveDrivers} onChange={(v) => setS({ ...s, autoApproveDrivers: v })} /></label>
            <Field label="إعلان أعلى الشاشة الرئيسية للزبائن"><input className="input" value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} placeholder="مثال: خصم 20% على كل الرحلات اليوم!" /></Field>
            <div className="form-grid">
              <Field label="هاتف الدعم"><input className="input" dir="ltr" value={s.support.phone} onChange={(e) => setS({ ...s, support: { ...s.support, phone: e.target.value } })} /></Field>
              <Field label="واتساب (بدون +)"><input className="input" dir="ltr" value={s.support.whatsapp} onChange={(e) => setS({ ...s, support: { ...s.support, whatsapp: e.target.value } })} /></Field>
              <Field label="بريد الدعم"><input className="input" dir="ltr" value={s.support.email} onChange={(e) => setS({ ...s, support: { ...s.support, email: e.target.value } })} /></Field>
            </div>
          </div>
        </div>
        <div className="panel-card">
          <h3><Lock size={18} />تغيير كلمة السر</h3>
          <div className="form-grid">
            <Field label="الحالية"><input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
            <Field label="الجديدة"><input className="input" type="password" value={pw.n1} onChange={(e) => setPw({ ...pw, n1: e.target.value })} /></Field>
            <Field label="تأكيد"><input className="input" type="password" value={pw.n2} onChange={(e) => setPw({ ...pw, n2: e.target.value })} /></Field>
          </div>
          <button className="btn btn-dark btn-sm mt" onClick={changePw}>تحديث كلمة السر</button>
        </div>
      </div>
      <div className="col">
        <div className="panel-card">
          <h3><Database size={18} />البيانات</h3>
          <div className="small">{MODE === 'firebase' ? <span className="badge green">Firebase مباشر — البيانات مشتركة بين كل الأجهزة</span> : <span className="badge yellow">وضع العرض — البيانات في هذا المتصفح فقط</span>}</div>
          {MODE !== 'firebase' && <div className="tiny muted mt">لربط كل الأجهزة (زبون + سائق + لوحة) أضف مفاتيح Firebase عبر أمر الإعداد على السيرفر، وسيعاد البناء تلقائيًا.</div>}
          <div className="tiny muted mt">المدير: <b className="num">{BRAND.adminEmail}</b></div>
          <button className="btn btn-ghost btn-sm mt" onClick={backup}><Download size={16} />نسخة احتياطية JSON</button>
          <button className="btn btn-ghost btn-sm mt" onClick={async () => { if (confirm('إعادة الإعدادات الافتراضية للتسعير والمكافآت؟')) { await saveSettings({ pricing: DEFAULT_SETTINGS.pricing, rewards: DEFAULT_SETTINGS.rewards }); toast('تمت الاستعادة') } }}>استعادة الإعدادات الافتراضية</button>
        </div>
      </div>
    </div>
  )
}
