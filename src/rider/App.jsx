import React, { useEffect, useState } from 'react'
import { ChevronDown, Gift, ShieldCheck, User, Phone, Mail, MapPin, Ticket } from 'lucide-react'
import { useBoot, AppProvider } from '@/ui/app-ctx.jsx'
import { NavProvider, Splash, Toasts, toast, Maintenance } from '@/ui/kit.jsx'
import { OnbArt } from '@/ui/art.jsx'
import { tr, isAr } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { watchUser, registerRider } from '@/core/api.js'
import Home from './Home.jsx'
import SearchPage from './Search.jsx'
import Reels from './Reels.jsx'
import Rewards from './Rewards.jsx'
import TopUp from './TopUp.jsx'
import Student from './Student.jsx'
import * as P from './pages.jsx'

const PAGES = {
  search: SearchPage, reels: Reels, rewards: Rewards, topup: TopUp, student: Student, trips: P.Trips, trip: P.TripDetail, wallet: P.Wallet, promo: P.Promo,
  notifications: P.Notifications, invite: P.Invite, support: P.Support, profile: P.Profile, edit: P.EditProfile, settings: P.Settings,
  places: P.Places, scheduled: P.Scheduled, about: P.About, chat: P.ChatPage,
}

export default function App() {
  const [st] = useBoot('rider')
  const [user, setUser] = useState(undefined)
  const [onb, setOnb] = useState(() => localStorage.getItem('w_onb') === '1')

  useEffect(() => {
    if (!st.uid) return
    return watchUser(st.uid, (u) => setUser(u && !u.deleted ? u : null))
  }, [st.uid])

  const ready = st.ready && (st.error || user !== undefined)
  const ctx = { ...st, user, kind: 'rider' }

  return (
    <AppProvider value={ctx}>
      <Toasts />
      <Splash done={ready} />
      {ready && st.error && <div className="empty" style={{ paddingTop: 120 }}><b>{tr('ما قدرناش نتكونيكتاو', 'Connection failed')}</b><div className="small">{st.error}</div><button className="btn btn-primary mt" onClick={() => location.reload()}>{tr('عاود', 'Retry')}</button></div>}
      {ready && !st.error && (
        st.settings.maintenance?.on ? <Maintenance message={st.settings.maintenance.message} support={st.settings.support} />
        : !onb ? <Onboarding onDone={() => { localStorage.setItem('w_onb', '1'); setOnb(true) }} />
          : !user ? <Register uid={st.uid} />
            : user.blocked ? <div className="empty" style={{ paddingTop: 140 }}><b>{tr('الحساب موقوف مؤقتًا', 'Account suspended')}</b><div className="small">{tr('تواصل مع الدعم لمزيد من المعلومات', 'Please contact support')}</div><a className="btn btn-primary mt" href={`https://wa.me/${st.settings.support.whatsapp}`}>{tr('تواصل مع الدعم', 'Contact support')}</a></div>
            : (
              <NavProvider render={(p) => { const C = PAGES[p.name]; return C ? <C {...p.params} /> : null }}>
                <Home />
              </NavProvider>
            )
      )}
    </AppProvider>
  )
}

const SLIDES = [
  { t: ['كورستك بكليكة وحدة', 'Your ride, one tap away'], d: ['اطلب طاكسي في ثواني وتبّع الشيفور مباشرة في الخريطة بسومة واضحة.', 'Request a ride in seconds and track your driver live with clear prices.'] },
  { t: ['شوف الريلز واركب بلاش', 'Watch reels, ride free'], d: ['كل إشهار تكمّلو يزيدلك 100 نقطة. جمّع النقاط وبدّلهم بكورسة بلاش!', 'Every ad you finish adds 100 points. Redeem them for free rides!'] },
  { t: ['آمن ومضمون', 'Safe & trusted'], d: ['شيفورات موثّقين، تقدر تبعث الكورسة لأهلك، وزر طوارئ في كل كورسة.', 'Verified drivers, trip sharing and an SOS button on every ride.'] },
]
function Onboarding({ onDone }) {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  return (
    <div className="onb">
      <div className="onb-art">
        <div className="blob" />
        <OnbArt i={i} key={i} />
      </div>
      <div className="onb-body">
        <div className="dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <h2 key={'t' + i} className="rise">{tr(...s.t)}</h2>
        <p key={'d' + i} className="rise">{tr(...s.d)}</p>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => (i < 2 ? setI(i + 1) : onDone())}>{i < 2 ? tr('التالي', 'Next') : tr('يلا نبداو', 'Get started')}</button>
        {i < 2 && <button className="btn btn-block mt muted" style={{ '--h': '40px' }} onClick={onDone}>{tr('فوت', 'Skip')}</button>}
      </div>
    </div>
  )
}

function Register({ uid }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', city: 'sba', referral: new URLSearchParams(location.search).get('ref') || '' })
  const [busy, setBusy] = useState(false)
  const [agree, setAgree] = useState(true)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.name.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 9 && agree
  const submit = async () => {
    if (!valid) return
    setBusy(true)
    try {
      await registerRider(uid, { ...f, name: f.name.trim(), phone: '+213' + f.phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^213/, '') })
      toast(tr('مرحبا بيك في وصلني 🎉', 'Welcome to Wasalni 🎉'), 'success')
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  return (
    <div className="page fade" style={{ overflowY: 'auto' }}>
      <div className="auth-hero">
        <img src="brand/mark.svg" alt="" />
        <h1>{tr('دير حسابك', 'Create your account')}</h1>
        <p>{tr('خطوة وحدة وتبدا كورساتك', 'One step and you are ready to ride')}</p>
      </div>
      <div className="card auth-card col">
        <div className="field"><label>{tr('الاسم واللقب', 'Full name')}</label>
          <div className="input-wrap"><User size={18} /><input className="input" value={f.name} onChange={set('name')} placeholder={tr('مثال: محمد أمين', 'e.g. Ahmed Mohamed')} autoComplete="name" /></div>
        </div>
        <div className="field"><label>{tr('رقم التيليفون', 'Phone number')}</label>
          <div className="phone-in"><div className="cc">🇩🇿 +213</div><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="550 12 34 56" autoComplete="tel" /></div>
        </div>
        <div className="field"><label>{tr('الإيمايل (إذا حبيت)', 'Email (optional)')}</label>
          <div className="input-wrap"><Mail size={18} /><input className="input" type="email" value={f.email} onChange={set('email')} placeholder="name@gmail.com" /></div>
        </div>
        <div className="grid2">
          <div className="field"><label>{tr('الولاية', 'City')}</label>
            <div className="input-wrap"><MapPin size={18} /><select className="input" value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c.id} value={c.id}>{isAr ? c.ar : c.en}</option>)}</select><ChevronDown size={16} className="suffix muted" style={{ insetInlineEnd: 14, position: 'absolute', pointerEvents: 'none' }} /></div>
          </div>
          <div className="field"><label>{tr('كود دعوة', 'Invite code')}</label>
            <div className="input-wrap"><Ticket size={18} /><input className="input" value={f.referral} onChange={set('referral')} placeholder="W12345" style={{ textTransform: 'uppercase' }} /></div>
          </div>
        </div>
        <label className="flex small muted" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 18, height: 18 }} />
          {tr('راني موافق على شروط الاستعمال والخصوصية', 'I agree to the Terms and Privacy Policy')}
        </label>
        <button className="btn btn-primary btn-block btn-lg" disabled={!valid || busy} onClick={submit}>{busy ? <span className="spinner" /> : tr('تابع', 'Continue')}</button>
        <div className="flex small muted" style={{ justifyContent: 'center' }}><ShieldCheck size={16} color="var(--success)" />{tr('معلوماتك محمية وما نعطوها لحتى واحد', 'Your data is protected')}</div>
      </div>
      <div className="center small muted" style={{ padding: 20 }}><Gift size={14} style={{ verticalAlign: -2 }} /> {tr('شوف الريلز واجمع 5 دينار على كل إشهار', 'Earn 5 DA for every reel you watch')}</div>
    </div>
  )
}
