import React, { useEffect, useState } from 'react'
import { ChevronDown, Gift, ShieldCheck, User, Phone, Mail, MapPin, Ticket } from 'lucide-react'
import { useBoot, AppProvider } from '@/ui/app-ctx.jsx'
import { NavProvider, Splash, Toasts, toast } from '@/ui/kit.jsx'
import { OnbArt } from '@/ui/art.jsx'
import { tr, isAr } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { watchUser, registerRider } from '@/core/api.js'
import Home from './Home.jsx'
import SearchPage from './Search.jsx'
import Reels from './Reels.jsx'
import Rewards from './Rewards.jsx'
import * as P from './pages.jsx'

const PAGES = {
  search: SearchPage, reels: Reels, rewards: Rewards, trips: P.Trips, trip: P.TripDetail, wallet: P.Wallet, promo: P.Promo,
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
      {ready && st.error && <div className="empty" style={{ paddingTop: 120 }}><b>{tr('تعذر الاتصال', 'Connection failed')}</b><div className="small">{st.error}</div><button className="btn btn-primary mt" onClick={() => location.reload()}>{tr('إعادة المحاولة', 'Retry')}</button></div>}
      {ready && !st.error && (
        !onb ? <Onboarding onDone={() => { localStorage.setItem('w_onb', '1'); setOnb(true) }} />
          : !user ? <Register uid={st.uid} />
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
  { t: ['مشوارك بلمسة واحدة', 'Your ride, one tap away'], d: ['اطلب سيارة خلال ثوانٍ وتابع السائق مباشرة على الخريطة بأسعار واضحة.', 'Request a ride in seconds and track your driver live with clear prices.'] },
  { t: ['شاهد الريلز واركب مجانًا', 'Watch reels, ride free'], d: ['كل إعلان تكمله يضيف 5 دينار لرصيد مكافآتك. اجمعها واستبدلها برحلة مجانية!', 'Every reel you finish adds 5 LYD to your rewards. Redeem them for free rides!'] },
  { t: ['آمن وموثوق', 'Safe & trusted'], d: ['سائقون موثقون، مشاركة الرحلة مع أهلك، وزر طوارئ في كل رحلة.', 'Verified drivers, trip sharing and an SOS button on every ride.'] },
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
        <button className="btn btn-primary btn-block btn-lg" onClick={() => (i < 2 ? setI(i + 1) : onDone())}>{i < 2 ? tr('التالي', 'Next') : tr('ابدأ الآن', 'Get started')}</button>
        {i < 2 && <button className="btn btn-block mt muted" style={{ '--h': '40px' }} onClick={onDone}>{tr('تخطي', 'Skip')}</button>}
      </div>
    </div>
  )
}

function Register({ uid }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', city: 'tripoli', referral: new URLSearchParams(location.search).get('ref') || '' })
  const [busy, setBusy] = useState(false)
  const [agree, setAgree] = useState(true)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.name.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 9 && agree
  const submit = async () => {
    if (!valid) return
    setBusy(true)
    try {
      await registerRider(uid, { ...f, name: f.name.trim(), phone: '+218' + f.phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^218/, '') })
      toast(tr('أهلًا بك في وصلني 🎉', 'Welcome to Wasalni 🎉'), 'success')
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  return (
    <div className="page fade" style={{ overflowY: 'auto' }}>
      <div className="auth-hero">
        <img src="brand/mark.svg" alt="" />
        <h1>{tr('أنشئ حسابك', 'Create your account')}</h1>
        <p>{tr('خطوة واحدة وتبدأ مشاويرك', 'One step and you are ready to ride')}</p>
      </div>
      <div className="card auth-card col">
        <div className="field"><label>{tr('الاسم الكامل', 'Full name')}</label>
          <div className="input-wrap"><User size={18} /><input className="input" value={f.name} onChange={set('name')} placeholder={tr('مثال: أحمد محمد', 'e.g. Ahmed Mohamed')} autoComplete="name" /></div>
        </div>
        <div className="field"><label>{tr('رقم الهاتف', 'Phone number')}</label>
          <div className="phone-in"><div className="cc">🇱🇾 +218</div><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="91 234 5678" autoComplete="tel" /></div>
        </div>
        <div className="field"><label>{tr('البريد الإلكتروني (اختياري)', 'Email (optional)')}</label>
          <div className="input-wrap"><Mail size={18} /><input className="input" type="email" value={f.email} onChange={set('email')} placeholder="name@gmail.com" /></div>
        </div>
        <div className="grid2">
          <div className="field"><label>{tr('المدينة', 'City')}</label>
            <div className="input-wrap"><MapPin size={18} /><select className="input" value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c.id} value={c.id}>{isAr ? c.ar : c.en}</option>)}</select><ChevronDown size={16} className="suffix muted" style={{ insetInlineEnd: 14, position: 'absolute', pointerEvents: 'none' }} /></div>
          </div>
          <div className="field"><label>{tr('كود دعوة', 'Invite code')}</label>
            <div className="input-wrap"><Ticket size={18} /><input className="input" value={f.referral} onChange={set('referral')} placeholder="W12345" style={{ textTransform: 'uppercase' }} /></div>
          </div>
        </div>
        <label className="flex small muted" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ accentColor: 'var(--brand)', width: 18, height: 18 }} />
          {tr('أوافق على شروط الاستخدام وسياسة الخصوصية', 'I agree to the Terms and Privacy Policy')}
        </label>
        <button className="btn btn-primary btn-block btn-lg" disabled={!valid || busy} onClick={submit}>{busy ? <span className="spinner" /> : tr('متابعة', 'Continue')}</button>
        <div className="flex small muted" style={{ justifyContent: 'center' }}><ShieldCheck size={16} color="var(--success)" />{tr('بياناتك محمية ولا تُشارك مع أحد', 'Your data is protected')}</div>
      </div>
      <div className="center small muted" style={{ padding: 20 }}><Gift size={14} style={{ verticalAlign: -2 }} /> {tr('شاهد الريلز واجمع 5 دينار عن كل إعلان', 'Earn 5 LYD for every reel you watch')}</div>
    </div>
  )
}
