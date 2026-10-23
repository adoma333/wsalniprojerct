import React, { useEffect, useState } from 'react'
import { User, Phone, Mail, MapPin, Car, Palette, Hash, Calendar, Camera, FileCheck2, ShieldCheck, Clock, XCircle, ChevronDown, CheckCircle2, IdCard, FileText, ArrowLeft, ScanLine, Bus } from 'lucide-react'
import Scanner from '@/ui/Scanner.jsx'
import BusHome, { useDriverLines } from './BusHome.jsx'
import { useBoot, AppProvider } from '@/ui/app-ctx.jsx'
import { NavProvider, Splash, Toasts, toast, Avatar, Maintenance } from '@/ui/kit.jsx'
import { ClassCar } from '@/ui/art.jsx'
import { tr, isAr, compressImage } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { watchDriver, registerDriver } from '@/core/api.js'
import Home from './Home.jsx'
import * as P from './pages.jsx'
import TopUp from '@/rider/TopUp.jsx'
import PopupGate from '@/ui/Popup.jsx'

const PAGES = {
  topup: TopUp, withdraw: P.Withdraw, busmode: P.BusMode,
  trips: P.Trips, trip: P.TripDetail, scheduled: P.Scheduled, wallet: P.Wallet, earnings: P.Earnings, invite: P.Invite, referrals: P.Referrals,
  notifications: P.Notifications, support: P.Support, profile: P.Profile, edit: P.EditProfile, vehicle: P.Vehicle, documents: P.Documents,
  settings: P.Settings, chat: P.ChatPage, city: P.City,
}

export default function App() {
  const [st] = useBoot('driver')
  const [driver, setDriver] = useState(undefined)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (st.uid) return watchDriver(st.uid, (d) => setDriver(d && !d.deleted ? d : null)) }, [st.uid])
  const [slow, setSlow] = useState(false)
  useEffect(() => { if (!st.ready || driver !== undefined) return; const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t) }, [st.ready, driver === undefined])
  const ready = st.ready && (st.error || driver !== undefined || slow)
  const ctx = { ...st, driver, user: driver, kind: 'driver' }
  let body = null
  if (ready && !st.error && slow && driver === undefined) body = <div className="empty" style={{ paddingTop: 120 }}><b>{tr('الاتصال بالخادم ضعيف', 'Slow connection')}</b><div className="small">{tr('تحقق من الأنترنت وعاود', 'Check your internet and retry')}</div><button className="btn btn-primary mt" onClick={() => location.reload()}>{tr('عاود', 'Retry')}</button></div>
  else if (ready && !st.error) {
    if (st.settings.maintenance?.on) body = <Maintenance message={st.settings.maintenance.message} support={st.settings.support} />
    else if (!driver || editing) body = <Register uid={st.uid} existing={driver} settings={st.settings} autoApprove={st.settings.autoApproveDrivers || st.settings.kyc?.autoVerify} onDone={() => setEditing(false)} />
    else if (driver.status === 'pending') body = <Status icon={<Clock size={44} />} color="var(--warning)" title={tr('الطلب تاعك راهو يتراجع', 'Under review')} sub={tr('نراجع مستنداتك دروك. ستصلك الموافقة خلال 24 ساعة كحد أقصى.', 'We are reviewing your documents.')} onEdit={() => setEditing(true)} />
    else if (driver.status === 'rejected') body = <Status icon={<XCircle size={44} />} color="var(--danger)" title={tr('ما قدرناش نقبلو الطلب', 'Application rejected')} sub={driver.rejectReason || tr('يرجى تحديث المستندات وإعادة الإرسال', 'Please update your documents')} onEdit={() => setEditing(true)} />
    else if (driver.status === 'blocked') body = <Status icon={<XCircle size={44} />} color="var(--danger)" title={tr('الحساب موقوف', 'Account suspended')} sub={tr('تواصل مع الدعم لمزيد من المعلومات', 'Contact support')} />
    else body = (
      <NavProvider render={(p) => { const C = PAGES[p.name]; return C ? <C {...p.params} /> : null }}>
        {driver.kind === 'bus' ? <BusHome /> : <Home />}
        <PopupGate audience="drivers" city={driver.city} />
      </NavProvider>
    )
  }
  return (
    <AppProvider value={ctx}>
      <Toasts />
      <Splash done={ready} />
      {ready && st.error && <div className="empty" style={{ paddingTop: 120 }}><b>{tr('ما قدرناش نتكونيكتاو', 'Connection failed')}</b><div className="small">{st.error}</div></div>}
      {body}
    </AppProvider>
  )
}

function Status({ icon, color, title, sub, onEdit }) {
  return (
    <div className="page fade" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 30 }}>
      <div className="pop" style={{ width: 110, height: 110, borderRadius: 36, display: 'grid', placeItems: 'center', color, background: `color-mix(in srgb, ${color} 14%, transparent)`, marginBottom: 20 }}>{icon}</div>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <p className="muted" style={{ maxWidth: 320 }}>{sub}</p>
      <div className="card pad" style={{ width: '100%', maxWidth: 360, textAlign: 'start' }}>
        {[[tr('إنشاء الحساب', 'Account created'), true], [tr('تحميل الوثائق', 'Documents uploaded'), true], [tr('مراجعة فريق وصلني', 'Team review'), false], [tr('ابدا الخدمة واربح', 'Start earning'), false]].map(([t, ok], i) => (
          <div key={i} className="flex" style={{ padding: '8px 0' }}>{ok ? <CheckCircle2 size={20} color="var(--success)" /> : <span style={{ width: 20, height: 20, borderRadius: 10, border: '2px dashed var(--line-2)' }} />}<span className={ok ? '' : 'muted'}>{t}</span></div>
        ))}
      </div>
      {onEdit && <button className="btn btn-ghost mt" onClick={onEdit}>{tr('بدّل المعلومات', 'Edit details')}</button>}
    </div>
  )
}

const DOCS = [
  ['license', tr('البيرمي', 'Driving license'), IdCard],
  ['id', tr('بطاقة التعريف / الباسبور', 'National ID / Passport'), FileText],
  ['carPhoto', tr('تصويرة الطوموبيل من القدام', 'Car photo (front)'), Car],
  ['registration', tr('الكارط قريز', 'Vehicle registration'), FileCheck2],
]
export const DOC_LIST = DOCS
// وثائق سائق الحافلة: نفس المفاتيح بأسماء الحافلة
export const BUS_DOCS = [
  ['license', tr('البيرمي (صنف D)', 'Driving license (D)'), IdCard],
  ['id', tr('بطاقة التعريف / الباسبور', 'National ID / Passport'), FileText],
  ['carPhoto', tr('تصويرة الحافلة من القدام', 'Bus photo (front)'), Bus],
  ['registration', tr('الكارط قريز تاع الحافلة', 'Bus registration'), FileCheck2],
]
export const docsFor = (d) => (d?.kind === 'bus' ? BUS_DOCS : DOCS)
const TYPES = [
  ['m', 'car', '👨', tr('شيفور', 'Driver'), tr('كورسات بالطوموبيل', 'Car rides')],
  ['f', 'car', '👩', tr('شيفورة', 'Female driver'), tr('كورسات + طلبات النساء', 'Rides + women-only')],
  ['m', 'bus', '🚌', tr('سائق حافلة', 'Bus driver'), tr('بث موقع الحافلة', 'Share bus location')],
]

function Register({ uid, existing, autoApprove, onDone, settings }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState(() => ({
    name: existing?.name || '', phone: (existing?.phone || '').replace('+213', ''), email: existing?.email || '', city: existing?.city || 'sba', photo: existing?.photo || '', gender: existing?.gender || 'm', kind: existing?.kind || 'car',
    busLine: existing?.busLine || '', bus: existing?.bus || { number: '', plate: '', operator: '', seats: '' },
    vehicle: existing?.vehicle || { make: '', model: '', year: '', color: '', plate: '', class: 'eco' },
    docs: existing?.docs || {}, referral: '',
  }))
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(null)
  const busLines = useDriverLines({ city: f.city }, settings || {})
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setV = (k) => (e) => setF({ ...f, vehicle: { ...f.vehicle, [k]: e.target.value } })
  const upload = (k) => async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const data = await compressImage(file, k === 'photo' ? 320 : 760, 0.62)
    if (k === 'photo') setF({ ...f, photo: data })
    else setF({ ...f, docs: { ...f.docs, [k]: data } })
  }
  const isBus = f.kind === 'bus'
  const D = isBus ? BUS_DOCS : DOCS
  const setB = (k) => (e) => setF({ ...f, bus: { ...f.bus, [k]: e.target.value } })
  const valid = [
    f.name.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 9,
    isBus ? f.busLine && f.bus.plate.trim().length >= 4 : f.vehicle.make && f.vehicle.model && f.vehicle.plate && f.vehicle.color,
    D.every(([k]) => f.docs[k]),
    true,
  ]
  const submit = async () => {
    setBusy(true)
    try {
      await registerDriver(uid, {
        name: f.name.trim(), phone: '+213' + f.phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^213/, ''), email: f.email, city: f.city, photo: f.photo, gender: f.gender, kind: f.kind,
        vehicle: isBus ? { make: tr('حافلة', 'Bus'), model: f.bus.operator || '', year: '', color: '', plate: f.bus.plate, class: 'bus' } : f.vehicle,
        ...(isBus ? { busLine: f.busLine, bus: f.bus } : {}),
        docs: f.docs, referredBy: f.referral.toUpperCase(),
      }, autoApprove)
      toast(autoApprove ? tr('الحساب تاعك تفعّل، ابدا الخدمة دروك 🚀', 'Account activated 🚀') : tr('الطلب تاعك تبعث للمراجعة ✅', 'Submitted for review ✅'), 'success')
      onDone?.()
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  const titles = [tr('المعلومات تاعك', 'Personal info'), isBus ? tr('الحافلة والخط', 'Bus & line') : tr('معلومات الطوموبيل', 'Vehicle'), tr('الوثائق', 'Documents'), tr('المراجعة والإرسال', 'Review')]
  return (
    <div className="page fade">
      <div className="auth-hero" style={{ paddingBottom: 60, background: 'linear-gradient(135deg,#2A1A12,#18120E 60%,#3a1b0c)' }}>
        <div className="flex">
          {step > 0 && <button className="icon-btn sm" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', boxShadow: 'none' }} onClick={() => setStep(step - 1)}><ArrowLeft size={18} style={{ transform: isAr ? 'scaleX(-1)' : '' }} /></button>}
          <img src="brand/mark.svg" alt="" style={{ width: 54, margin: 0 }} />
          <span className="badge" style={{ background: 'var(--brand)', color: '#fff', marginInlineStart: 'auto' }}>{tr('شيفور وصلني', 'Wasalni Captain')}</span>
        </div>
        <h1 style={{ marginTop: 18 }}>{titles[step]}</h1>
        <p>{tr(`الخطوة ${step + 1} من 4`, `Step ${step + 1} of 4`)}</p>
        <div className="flex" style={{ gap: 6, marginTop: 14 }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ flex: 1, height: 5, borderRadius: 5, background: i <= step ? 'var(--brand)' : 'rgba(255,255,255,.2)', transition: 'background .3s' }} />)}</div>
      </div>
      <div className="page-body" style={{ marginTop: -44, position: 'relative', zIndex: 2, padding: '0 16px 20px' }}>
      <div className="card col" style={{ padding: '22px 18px' }} key={step}>
        {step === 0 && (
          <div className="col rise">
            <label className="center" style={{ display: 'block', margin: '0 auto', position: 'relative', cursor: 'pointer' }}>
              <Avatar name={f.name} src={f.photo} size={92} />
              <span style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 32, height: 32, borderRadius: 16, background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', border: '3px solid var(--card)' }}><Camera size={14} /></span>
              <input type="file" accept="image/*" hidden onChange={upload('photo')} />
            </label>
            <div className="field"><label>{tr('الاسم واللقب', 'Full name')}</label><div className="input-wrap"><User size={18} /><input className="input" value={f.name} onChange={set('name')} /></div></div>
            <div className="field"><label>{tr('نوع الحساب', 'Account type')}</label>
              <div className="acc-types">
                {TYPES.map(([g, k, ic, t, sub]) => {
                  const on = f.kind === k && (k === 'bus' || f.gender === g)
                  return <button key={g + k} className={on ? 'active' : ''} onClick={() => setF({ ...f, gender: g, kind: k })}><span className="ic">{ic}</span><b>{t}</b><small>{sub}</small></button>
                })}
              </div>
              {f.kind === 'car' && f.gender === 'f' && <span className="tiny muted">{tr('تجيك طلبات "شيفورة مرا" من الزبونات', 'You will also receive women-only requests')}</span>}
              {isBus && <span className="tiny muted">{tr('حساب خاص: تختار الخط وتبث موقع الحافلة، والزبائن يشوفو وقت وصولها لكل محطة', 'Choose your line and share the bus location with riders')}</span>}
            </div>
            <div className="field"><label>{tr('رقم التيليفون', 'Phone')}</label><div className="phone-in"><div className="cc">🇩🇿 +213</div><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="661 23 45 67" /></div></div>
            <div className="field"><label>{tr('البريد الإلكتروني', 'Email')}</label><div className="input-wrap"><Mail size={18} /><input className="input" type="email" value={f.email} onChange={set('email')} /></div></div>
            <div className="grid2">
              <div className="field"><label>{tr('ولاية الخدمة', 'City')}</label><div className="input-wrap"><MapPin size={18} /><select className="input" value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c.id} value={c.id}>{isAr ? c.ar : c.en}</option>)}</select></div></div>
              <div className="field"><label>{tr('كود دعوة', 'Invite code')}</label><input className="input" value={f.referral} onChange={set('referral')} placeholder="D12345" /></div>
            </div>
          </div>
        )}
        {step === 1 && isBus && (
          <div className="col rise">
            <div className="field"><label>{tr('الخط اللي تسوق فيه', 'Your bus line')}</label>
              {busLines === null && <span className="spinner" />}
              {busLines?.length === 0 && <div className="small muted">{tr('ما كاين حتى خط في ولايتك دروك — الإدارة تزيدو', 'No lines in your city yet')}</div>}
              <div className="col" style={{ gap: 8 }}>
                {busLines?.map((l) => (
                  <button key={l.id} className={`method ${f.busLine === l.id ? 'active' : ''}`} onClick={() => setF({ ...f, busLine: l.id })}>
                    <span className="line-badge" style={{ '--lc': l.color }}>{l.number}</span>
                    <span className="grow" style={{ textAlign: 'start' }}><b>{l.name}</b><small><span dir="ltr">{l.start} – {l.end}</span></small></span>
                    <span className={`radio ${f.busLine === l.id ? 'on' : ''}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid2">
              <div className="field"><label>{tr('رقم الحافلة', 'Bus number')}</label><div className="input-wrap"><Hash size={18} /><input className="input" value={f.bus.number} onChange={setB('number')} placeholder="17" /></div></div>
              <div className="field"><label>{tr('عدد المقاعد', 'Seats')}</label><input className="input" inputMode="numeric" value={f.bus.seats} onChange={setB('seats')} placeholder="30" /></div>
            </div>
            <div className="field"><label>{tr('رقم الماتريكول', 'Plate number')}</label><div className="input-wrap"><Hash size={18} /><input className="input" value={f.bus.plate} onChange={setB('plate')} placeholder="12345 118 22" style={{ direction: 'ltr', letterSpacing: 2 }} /></div></div>
            <div className="field"><label>{tr('الشركة / المؤسسة', 'Operator')}</label><div className="input-wrap"><Bus size={18} /><input className="input" value={f.bus.operator} onChange={setB('operator')} placeholder={tr('مؤسسة النقل الحضري', 'Urban transport company')} /></div></div>
          </div>
        )}
        {step === 1 && !isBus && (
          <div className="col rise">
            <div className="field"><label>{tr('نوع الطوموبيل', 'Vehicle class')}</label>
              <div className="grid2">
                {[['eco', tr('اقتصادي', 'Economy')], ['comfort', tr('مريح', 'Comfort')], ['family', tr('عائلي', 'Family')], ['vip', 'VIP'], ['moto', tr('توصيل', 'Delivery')]].map(([k, l]) => (
                  <button key={k} className={`cls ${f.vehicle.class === k ? 'active' : ''}`} style={{ flexDirection: 'column', gap: 4, padding: 10 }} onClick={() => setF({ ...f, vehicle: { ...f.vehicle, class: k } })}><ClassCar type={k} w={58} /><b className="small">{l}</b></button>
                ))}
              </div>
            </div>
            <div className="grid2">
              <div className="field"><label>{tr('الماركة', 'Make')}</label><div className="input-wrap"><Car size={18} /><input className="input" value={f.vehicle.make} onChange={setV('make')} placeholder={tr('رونو', 'Toyota')} /></div></div>
              <div className="field"><label>{tr('الموديل', 'Model')}</label><input className="input" value={f.vehicle.model} onChange={setV('model')} placeholder={tr('سامبول', 'Corolla')} /></div>
              <div className="field"><label>{tr('العام', 'Year')}</label><div className="input-wrap"><Calendar size={18} /><input className="input" inputMode="numeric" value={f.vehicle.year} onChange={setV('year')} placeholder="2018" /></div></div>
              <div className="field"><label>{tr('اللون', 'Color')}</label><div className="input-wrap"><Palette size={18} /><input className="input" value={f.vehicle.color} onChange={setV('color')} placeholder={tr('بيضاء', 'White')} /></div></div>
            </div>
            <div className="field"><label>{tr('رقم الماتريكول', 'Plate number')}</label><div className="input-wrap"><Hash size={18} /><input className="input" value={f.vehicle.plate} onChange={setV('plate')} placeholder="12345 116 22" style={{ direction: 'ltr', letterSpacing: 2 }} /></div></div>
          </div>
        )}
        {step === 2 && (
          <div className="col rise">
            <div className="small muted">{tr('صوّر الوثائق مليح. محفوظين في أمان وما يشوفهم غير فريق المراجعة.', 'Take clear photos. Only our review team can see them.')}</div>
            {D.map(([k, label, I]) => (
              <button key={k} className="row" onClick={() => setScan(k)} style={{ border: '1.5px dashed ' + (f.docs[k] ? 'var(--success)' : 'var(--line-2)'), borderRadius: 18, background: f.docs[k] ? 'var(--success-bg)' : 'var(--card-2)', textAlign: 'start', width: '100%' }}>
                {f.docs[k] ? <img src={f.docs[k]} alt="" style={{ width: 54, height: 42, objectFit: 'cover', borderRadius: 10 }} /> : <span className="ri" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><I size={20} /></span>}
                <span className="rt"><b>{label}</b><small>{f.docs[k] ? tr('تحقّقنا منها ✓ اضغط باش تبدّل', 'Verified ✓ tap to change') : tr('اضغط وصوّرها، الكاميرا تكشفها وحدها', 'Tap to scan, auto-detected')}</small></span>
                {f.docs[k] ? <CheckCircle2 color="var(--success)" /> : <ScanLine size={20} color="var(--brand)" />}
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="col rise">
            <div className="flex"><Avatar name={f.name} src={f.photo} size={56} /><div><b>{f.name}</b><div className="small muted num">+213 {f.phone}</div></div></div>
            {isBus
              ? <div className="card pad flex" style={{ background: 'var(--card-2)', boxShadow: 'none' }}><span className="line-badge lg" style={{ '--lc': busLines?.find((l) => l.id === f.busLine)?.color || '#E8650A' }}>{busLines?.find((l) => l.id === f.busLine)?.number}</span><div><b>{tr('سائق حافلة', 'Bus driver')} • {busLines?.find((l) => l.id === f.busLine)?.name}</b><div className="small muted">{f.bus.number && `${tr('حافلة', 'Bus')} ${f.bus.number} • `}<span className="num">{f.bus.plate}</span></div></div></div>
              : <div className="card pad flex" style={{ background: 'var(--card-2)', boxShadow: 'none' }}><ClassCar type={f.vehicle.class} /><div><b>{f.vehicle.make} {f.vehicle.model} {f.vehicle.year}</b><div className="small muted">{f.vehicle.color} • <span className="num">{f.vehicle.plate}</span></div></div></div>}
            <div className="flex small" style={{ color: 'var(--success)' }}><ShieldCheck size={18} />{tr('تحمّلو 4 وثائق', '4 documents uploaded')}</div>
            <div className="small muted">{tr('كي تضغط ابعث راك موافق على شروط الخدمة مع وصلني والخصوصية.', 'By submitting you accept the driver terms.')}</div>
          </div>
        )}
      </div>
      </div>
      <Scanner
        open={!!scan} onClose={() => setScan(null)}
        onDone={(img) => { setF((x) => ({ ...x, docs: { ...x.docs, [scan]: img } })); setScan(null) }}
        shape={scan === 'carPhoto' ? 'wide' : 'card'}
        title={D.find(([k]) => k === scan)?.[1]}
        hint={scan === 'carPhoto' ? tr('خلّي الطوموبيل كاملة والماتريكول باينة', 'Whole car with visible plate') : tr('حط الوثيقة داخل الإطار', 'Place the document in the frame')}
        steps={scan === 'carPhoto' ? [tr('تحليل التصويرة', 'Analysing photo'), tr('قراءة الماتريكول', 'Reading plate'), tr('تمّ الحفظ', 'Saved')] : [tr('قراءة الوثيقة', 'Reading document'), tr('التحقق من الصلاحية', 'Checking validity'), tr('مطابقة المعلومات', 'Matching details')]}
        successText={tr('الوثيقة مقبولة ✓', 'Document accepted ✓')}
      />
      <div className="page-foot">
        <button className="btn btn-primary btn-block btn-lg" disabled={!valid[step] || busy} onClick={() => (step < 3 ? setStep(step + 1) : submit())}>
          {busy ? <span className="spinner" /> : step < 3 ? tr('التالي', 'Next') : tr('ابعث الطلب', 'Submit')}
        </button>
      </div>
    </div>
  )
}
