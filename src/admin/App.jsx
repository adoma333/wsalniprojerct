import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  LayoutDashboard, Car, Users, UserRound, Tags, Clapperboard, Ticket, CreditCard, Bell, LifeBuoy, Settings, LogOut, Menu, Moon, Sun, Lock, Mail,
  Eye, EyeOff, ShieldCheck, Database, ExternalLink, Gift, Radio, MapPinned, Wallet, GraduationCap, ToggleRight, History, Banknote,
} from 'lucide-react'
import { useBoot, AppProvider } from '@/ui/app-ctx.jsx'
import { Toasts, toast, Avatar } from '@/ui/kit.jsx'
import { BRAND } from '@/core/config.js'
import { MODE } from '@/core/store.js'
import { setTheme, isDark } from '@/core/util.js'
import {
  watchAllRides, watchAllDrivers, watchUsers, watchTickets, watchSos, watchAllReels, watchReelStats, watchPromos, watchVouchers, watchNotifications, auth,
} from '@/core/api.js'
import * as A from './pages-a.jsx'
import * as B from './pages-b.jsx'
import * as C from './pages-c.jsx'

const DataCtx = createContext(null)
export const useData = () => useContext(DataCtx)

const NAV = [
  ['الرئيسية', [['overview', 'نظرة عامة', LayoutDashboard], ['live', 'الخريطة الحية', Radio], ['rides', 'الرحلات', Car], ['drivers', 'السائقون', UserRound], ['riders', 'الزبائن', Users]]],
  ['العمليات', [['wilayas', 'الولايات والمناطق', MapPinned], ['payments', 'المدفوعات والشحن', Wallet], ['driverwallet', 'محفظة السائقين', Banknote], ['students', 'الطلبة', GraduationCap]]],
  ['الإيرادات والنمو', [['pricing', 'التسعير', Tags], ['reels', 'الإعلانات (الريلز)', Clapperboard], ['rewards', 'النقاط والمكافآت', Gift], ['promos', 'أكواد الخصم', Ticket], ['vouchers', 'قسائم الشحن', CreditCard]]],
  ['التواصل', [['notifications', 'الإشعارات', Bell], ['support', 'الدعم والطوارئ', LifeBuoy]]],
  ['النظام', [['system', 'الميزات والصيانة', ToggleRight], ['audit', 'سجل العمليات', History], ['settings', 'الإعدادات', Settings]]],
]
const PAGES = { overview: A.Overview, rides: A.Rides, drivers: A.Drivers, riders: A.Riders, pricing: B.Pricing, reels: B.ReelsAdmin, rewards: B.RewardsAdmin, promos: B.Promos, vouchers: B.Vouchers, notifications: B.NotificationsAdmin, support: B.SupportAdmin, settings: B.SettingsAdmin, live: C.LiveMap, wilayas: C.Wilayas, payments: C.Payments, students: C.Students, system: C.SystemAdmin, audit: C.AuditLog, driverwallet: C.DriverWallet }

export default function App() {
  const [st] = useBoot('admin')
  const [status, setStatus] = useState(null)
  useEffect(() => { if (st.ready && !st.error) auth.adminStatus().then(setStatus).catch((e) => setStatus({ initialized: false, signedIn: false, error: e.message })) }, [st.ready])
  return (
    <AppProvider value={{ ...st, kind: 'admin' }}>
      <Toasts />
      {!status && <div className="splash"><img src="brand/logo.svg" alt="" /></div>}
      {status && !status.signedIn && <Login status={status} onIn={() => auth.adminStatus().then(setStatus)} />}
      {status?.signedIn && <Shell onOut={async () => { await auth.adminLogout(); setStatus(await auth.adminStatus()) }} />}
    </AppProvider>
  )
}

function Login({ status, onIn }) {
  const first = !status.initialized
  const [email, setEmail] = useState(BRAND.adminEmail)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState(first ? 'setup' : 'login')
  const submit = async (e) => {
    e.preventDefault()
    if (mode === 'setup' && pw !== pw2) return toast('كلمتا السر غير متطابقتين', 'error')
    if (pw.length < 6) return toast('كلمة السر 6 أحرف على الأقل', 'error')
    setBusy(true)
    try {
      if (mode === 'setup') { await auth.adminSetup(email.trim(), pw); toast('تم حفظ كلمة السر بشكل دائم ✅', 'success') }
      else await auth.adminLogin(email.trim(), pw)
      onIn()
    } catch (err) {
      toast(err.message, 'error')
      if (/موجود/.test(err.message)) setMode('login')
    }
    setBusy(false)
  }
  return (
    <div className="login">
      <div className="login-art">
        {[260, 420, 600, 800].map((s, i) => <span key={i} className="ring" style={{ width: s, height: s }} />)}
        <img src="brand/logo.svg" alt="وصلني" />
        <h2 style={{ position: 'relative', margin: '24px 0 6px', fontSize: 26 }}>لوحة تحكم وصلني</h2>
        <p style={{ position: 'relative', opacity: 0.9, margin: 0 }}>إدارة الرحلات والسائقين والإعلانات والمكافآت من مكان واحد</p>
      </div>
      <div className="login-form">
        <form className="box col" onSubmit={submit}>
          <div style={{ width: 58, height: 58, borderRadius: 18, background: 'var(--brand-50)', color: 'var(--brand)', display: 'grid', placeItems: 'center' }}><ShieldCheck size={30} /></div>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 26 }}>{mode === 'setup' ? 'إعداد كلمة السر' : 'تسجيل الدخول'}</h1>
            <div className="muted small">{mode === 'setup' ? 'هذه أول مرة تفتح اللوحة. اختر كلمة سر قوية، ستُحفظ للأبد ويُطلب منك إدخالها عند كل دخول.' : 'أدخل كلمة السر للمتابعة'}</div>
          </div>
          <div className="field"><label>البريد الإلكتروني</label><div className="input-wrap"><Mail size={18} /><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></div></div>
          <div className="field"><label>كلمة السر</label>
            <div className="input-wrap"><Lock size={18} /><input className="input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" autoFocus autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} />
              <button type="button" className="suffix" style={{ padding: 8, color: 'var(--muted)' }} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          </div>
          {mode === 'setup' && <div className="field"><label>تأكيد كلمة السر</label><div className="input-wrap"><Lock size={18} /><input className="input" type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" autoComplete="new-password" /></div></div>}
          {mode === 'setup' && pw && <div className="flex tiny"><span style={{ flex: 1, height: 5, borderRadius: 5, background: pw.length >= 10 ? 'var(--success)' : pw.length >= 6 ? 'var(--warning)' : 'var(--danger)' }} />{pw.length >= 10 ? 'قوية' : pw.length >= 6 ? 'متوسطة' : 'ضعيفة'}</div>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? <span className="spinner" /> : mode === 'setup' ? 'حفظ والدخول' : 'دخول'}</button>
          <div className="flex tiny muted" style={{ justifyContent: 'center' }}><Database size={13} />{MODE === 'server' ? 'متصل بخادم وصلني (SQLite)' : MODE === 'firebase' ? 'متصل بقاعدة بيانات Firebase' : 'وضع العرض: البيانات محفوظة في هذا المتصفح'}</div>
        </form>
      </div>
    </div>
  )
}

function useLive() {
  const [d, setD] = useState({ rides: [], drivers: [], users: [], tickets: [], sos: [], reels: [], reelStats: [], promos: [], vouchers: [], notifications: [] })
  useEffect(() => {
    const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }))
    const subs = [watchAllRides(set('rides'), 800), watchAllDrivers(set('drivers')), watchUsers(set('users')), watchTickets(set('tickets')), watchSos(set('sos')), watchAllReels(set('reels')), watchReelStats(set('reelStats')), watchPromos(set('promos')), watchVouchers(set('vouchers')), watchNotifications(set('notifications'))]
    return () => subs.forEach((u) => u?.())
  }, [])
  return d
}

function Shell({ onOut }) {
  const data = useLive()
  const [page, setPage] = useState(() => location.hash.slice(1) || 'overview')
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(isDark())
  useEffect(() => { const f = () => setPage(location.hash.slice(1) || 'overview'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const go = (p) => { location.hash = p; setOpen(false); window.scrollTo(0, 0) }
  const counts = {
    drivers: data.drivers.filter((x) => x.status === 'pending').length,
    support: data.tickets.filter((t) => t.status !== 'closed').length + data.sos.filter((s) => !s.handled).length,
    rides: data.rides.filter((r) => r.status === 'searching').length,
    students: data.users.filter((u) => u.student?.status === 'pending').length,
  }
  const C = PAGES[page] || A.Overview
  const title = NAV.flatMap((g) => g[1]).find((x) => x[0] === page)?.[1] || 'نظرة عامة'
  return (
    <DataCtx.Provider value={{ ...data, go }}>
      <div className="adm">
        <div className={`adm-mask ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`adm-side ${open ? 'open' : ''}`}>
          <div className="logo"><span className="lm"><img src="brand/mark.svg" alt="" /></span><span><b>وصلني</b><small>لوحة التحكم</small></span></div>
          {NAV.map(([g, items]) => (
            <div key={g}>
              <div className="grp">{g}</div>
              {items.map(([k, l, I]) => (
                <button key={k} className={`adm-nav ${page === k ? 'active' : ''}`} onClick={() => go(k)}><I size={19} />{l}{counts[k] > 0 && <span className="cnt">{counts[k]}</span>}</button>
              ))}
            </div>
          ))}
          <div className="grp">روابط</div>
          <a className="adm-nav" href="../" target="_blank" rel="noreferrer"><ExternalLink size={18} />صفحة الهبوط</a>
          <a className="adm-nav" href="../app/" target="_blank" rel="noreferrer"><ExternalLink size={18} />تطبيق الزبون</a>
          <a className="adm-nav" href="../driver/" target="_blank" rel="noreferrer"><ExternalLink size={18} />تطبيق السائق</a>
          <div className="me">
            <Avatar name="Admin" size={38} />
            <div className="grow" style={{ minWidth: 0 }}><b style={{ fontSize: 13.5, color: '#fff' }}>المدير</b><div className="tiny" style={{ color: '#9c8f86', overflow: 'hidden', textOverflow: 'ellipsis' }}>{BRAND.adminEmail}</div></div>
            <button onClick={onOut} title="خروج" style={{ color: '#c9bfb8' }}><LogOut size={18} /></button>
          </div>
        </aside>
        <main className="adm-main">
          <div className="adm-top">
            <button className="icon-btn sm flat burger" onClick={() => setOpen(true)}><Menu size={20} /></button>
            <h1>{title}</h1>
            <span className={`badge hide-m ${MODE !== 'local' ? 'green' : 'yellow'}`}><Database size={12} />{MODE === 'server' ? 'متصل مباشر (SQLite)' : MODE === 'firebase' ? 'Firebase مباشر' : 'وضع العرض المحلي'}</span>
            <button className="icon-btn sm flat" onClick={() => { const n = !dark; setDark(n); setTheme(n ? 'dark' : 'light') }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
          <div className="adm-body" key={page}><div className="rise"><C /></div></div>
        </main>
      </div>
    </DataCtx.Provider>
  )
}
