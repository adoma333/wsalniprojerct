import React, { useEffect, useState } from 'react'
import {
  MapPin, Wallet as WalletIco, Ticket, Copy, Share2, User, Mail, Phone, Lock, MapIcon, LogOut, UserX, Languages, CheckCircle2, XCircle, Users,
  Home as HomeIco, Briefcase, Star, Plus, Trash2, Camera, Gift, Car, CalendarClock, ArrowDownLeft, ArrowUpRight, Receipt, Sparkles, Settings as SetIco, CreditCard,
} from 'lucide-react'
import { Page, Empty, Row, Sheet, toast, Avatar, Stars, useNav } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { ClassCar, Coin } from '@/ui/art.jsx'
import { StatusBadge, RouteSummary, Plate, ChatPage } from '@/ui/ride-ui.jsx'
import { tr, money, dateTime, km, mins, copy, shareLink, compressImage, isAr, LANG } from '@/core/util.js'
import { CITIES, SITE_URL } from '@/core/config.js'
import { watchRiderRides, watchTx, redeemVoucher, checkPromo, updateUser, deleteAccount, cancelRide, store } from '@/core/api.js'
import { searchPlaces } from '@/core/geo.js'
import { levelOf } from './Rewards.jsx'
export { Notifications, Support, Settings, About } from '@/ui/common-pages.jsx'
export { ChatPage }

export function Trips() {
  const { uid } = useApp()
  const nav = useNav()
  const [rides, setRides] = useState(null)
  const [tab, setTab] = useState('all')
  useEffect(() => watchRiderRides(uid, setRides), [uid])
  const list = (rides || []).filter((r) => tab === 'all' || (tab === 'done' ? r.status === 'completed' : r.status === 'cancelled'))
  return (
    <Page title={tr('كورساتي', 'My trips')}>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['all', tr('الكل', 'All')], ['done', tr('الكاملين', 'Completed')], ['cancel', tr('الملغيين', 'Cancelled')]].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {rides && list.length === 0 && <Empty icon={<Car size={36} />} title={tr('ما كاين حتى كورسة', 'No trips yet')} sub={tr('أول كورسة تاعك تستنى فيك', 'Your first ride awaits')} />}
      <div className="col" style={{ gap: 10 }}>
        {list.map((r, i) => (
          <button key={r.id} className="card pad rise" style={{ textAlign: 'start', animationDelay: Math.min(i, 8) * 35 + 'ms' }} onClick={() => nav.push('trip', { id: r.id })}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="flex small"><ClassCar type={r.classId === 'moto' ? 'moto' : r.classId} w={42} /><span><b>{r.className}</b><div className="tiny muted">{dateTime(r.createdAt)}</div></span></span>
              <span style={{ textAlign: 'end' }}><b className="num">{r.payment === 'points' ? tr('بلاش', 'Free') : money(r.fare?.total)}</b><div><StatusBadge s={r.status} /></div></span>
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
  const nav = useNav()
  useEffect(() => store.watch(`rides/${id}`, setR), [id])
  if (!r) return <Page title={tr('تفاصيل الكورسة', 'Trip details')} />
  const b = r.fare?.breakdown || {}
  return (
    <Page title={tr('تفاصيل الكورسة', 'Trip details')}>
      <div className="card pad">
        <div className="between"><StatusBadge s={r.status} /><span className="tiny muted">{dateTime(r.createdAt)}</span></div>
        <div className="mt"><RouteSummary ride={r} compact /></div>
        <div className="grid3 mt" style={{ background: 'var(--card-2)', borderRadius: 16 }}>
          <div className="stat"><b className="num">{km(r.route?.distanceKm || 0)}</b><small>{tr('المسافة', 'Distance')}</small></div>
          <div className="stat"><b className="num">{mins(r.route?.durationMin || 0)}</b><small>{tr('المدة', 'Duration')}</small></div>
          <div className="stat"><b>{r.className}</b><small>{tr('الفئة', 'Class')}</small></div>
        </div>
      </div>
      {r.driver && (
        <div className="card pad mt flex">
          <Avatar name={r.driver.name} size={50} />
          <div className="grow"><b>{r.driver.name}</b><div className="small muted">{r.driver.car} • {r.driver.color}</div><div style={{ marginTop: 4 }}><Plate value={r.driver.plate} /></div></div>
          {r.ratingByRider && <Stars value={r.ratingByRider} size={14} />}
        </div>
      )}
      <div className="section-title">{tr('الفاتورة', 'Receipt')}</div>
      <div className="list">
        <Row title={tr('حلّان العداد', 'Base fare')} right={<span className="num">{money(b.base)}</span>} chevron={false} />
        <Row title={tr(`المسافة (${(b.km || 0).toFixed(1)} كم)`, `Distance (${(b.km || 0).toFixed(1)} km)`)} right={<span className="num">{money(b.distance)}</span>} chevron={false} />
        <Row title={tr(`الوقت (${Math.round(b.min || 0)} د)`, `Time (${Math.round(b.min || 0)} min)`)} right={<span className="num">{money(b.time)}</span>} chevron={false} />
        {r.fare?.surge > 1 && <Row title={tr('معامل الوقت/الطلب', 'Time/demand factor')} right={<span className="num">×{r.fare.surge}</span>} chevron={false} />}
        {r.fare?.discount > 0 && <Row title={tr(`خصم ${r.promoCode}`, `Promo ${r.promoCode}`)} right={<span className="num" style={{ color: 'var(--success)' }}>-{money(r.fare.discount)}</span>} chevron={false} />}
        {r.tip > 0 && <Row title={tr('بوربوار', 'Tip')} right={<span className="num">{money(r.tip)}</span>} chevron={false} />}
        <Row title={<b>{tr('المجموع', 'Total')}</b>} sub={r.payment === 'cash' ? tr('كاش', 'Cash') : r.payment === 'wallet' ? tr('البورتفاي', 'Wallet') : tr('نقاط الكادوات', 'Reward points')} right={<b className="num" style={{ fontSize: 18 }}>{money((r.fare?.total || 0) + (r.tip || 0))}</b>} chevron={false} />
      </div>
      {r.status === 'scheduled' && <button className="btn btn-danger btn-block mt" onClick={async () => { await cancelRide(r.id, 'rider', 'scheduled'); nav.back() }}>{tr('إلغاء الحجز', 'Cancel booking')}</button>}
      {r.driver && ['completed'].includes(r.status) && <button className="btn btn-ghost btn-block mt" onClick={() => nav.push('support')}>{tr('بلّغ على مشكل / حاجة نسيتها', 'Report an issue / lost item')}</button>}
    </Page>
  )
}

export function Scheduled() {
  const { uid } = useApp()
  const nav = useNav()
  const [rides, setRides] = useState([])
  useEffect(() => watchRiderRides(uid, (r) => setRides(r.filter((x) => x.status === 'scheduled' || (x.scheduledAt && x.status === 'accepted')))), [uid])
  return (
    <Page title={tr('كورسات مبرمجة', 'Scheduled rides')}>
      {rides.length === 0 && <Empty icon={<CalendarClock size={36} />} title={tr('ما كاين حتى حجز', 'No bookings')} sub={tr('احجز الكورسة من قبل بزر "برمج"', 'Book ahead using "Schedule"')} />}
      <div className="col" style={{ gap: 10 }}>
        {rides.map((r) => (
          <button key={r.id} className="card pad" style={{ textAlign: 'start' }} onClick={() => nav.push('trip', { id: r.id })}>
            <div className="between"><span className="badge blue"><CalendarClock size={12} />{dateTime(r.scheduledAt)}</span><b className="num">{money(r.fare?.total)}</b></div>
            <div className="mt"><RouteSummary ride={r} compact /></div>
          </button>
        ))}
      </div>
    </Page>
  )
}

export function Wallet() {
  const { uid, user } = useApp()
  const nav = useNav()
  const [tx, setTx] = useState([])
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => watchTx(uid, setTx), [uid])
  const redeem = async () => {
    setBusy(true)
    try {
      const r = await redeemVoucher(uid, code)
      if (r.ok) { toast(tr(`تم شحن ${money(r.amount)} ✅`, `${money(r.amount)} added ✅`), 'success'); setOpen(false); setCode('') }
      else toast(r.msg, 'error')
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  return (
    <Page title={tr('البورتفاي', 'Wallet')}>
      <div className="wallet-card rise">
        <div className="small" style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>{tr('رصيد البورتفاي', 'Wallet balance')}</div>
        <div className="wbig num" style={{ position: 'relative', zIndex: 1 }}>{money(user.wallet || 0)}</div>
        <div className="wrow">
          <div><small>{tr('نقاط الكادوات', 'Reward points')}</small><b className="num">{money(user.points || 0)}</b></div>
          <div><small>{tr('كورساتي', 'Trips')}</small><b className="num">{user.trips || 0}</b></div>
        </div>
      </div>
      <div className="grid2 mt">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} />{tr('اشحن بكارطة', 'Top up')}</button>
        <button className="btn btn-ghost" onClick={() => nav.push('rewards')}><Coin size={18} />{tr('اربح نقاط', 'Earn points')}</button>
      </div>
      <div className="section-title">{tr('طرق الخلاص', 'Payment methods')}</div>
      <div className="list">
        <Row icon={<CreditCard size={19} />} color="#12B76A" title={tr('كاش', 'Cash')} sub={tr('خلّص الشيفور مباشرة', 'Pay the driver directly')} right={<CheckCircle2 size={20} color="var(--success)" />} chevron={false} />
        <Row icon={<WalletIco size={19} />} color="#2E90FA" title={tr('بورتفاي وصلني', 'Wasalni wallet')} sub={money(user.wallet || 0)} chevron={false} />
        <Row icon={<Sparkles size={19} />} color="#E8650A" title={tr('نقاط الكادوات', 'Reward points')} sub={tr('كورسات بلاش من الريلز', 'Free rides from reels')} chevron={false} />
      </div>
      <div className="section-title">{tr('آخر الحركات', 'Recent activity')}</div>
      <div className="list">
        {tx.length === 0 && <div className="empty" style={{ padding: 26 }}><b>{tr('ما كاين حتى حركة', 'No transactions')}</b></div>}
        {tx.map((t) => (
          <div key={t.id} className="tx">
            <span className="txi" style={{ background: t.amount > 0 ? 'var(--success-bg)' : 'var(--danger-bg)', color: t.amount > 0 ? 'var(--success)' : 'var(--danger)' }}>{t.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
            <div className="txb"><b>{t.title}</b><small>{dateTime(t.at)} • {t.currency === 'points' ? tr('نقاط', 'Points') : tr('محفظة', 'Wallet')}</small></div>
            <span className={`amt num ${t.amount > 0 ? 'pos' : ''}`}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</span>
          </div>
        ))}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('اشحن البورتفاي', 'Top up wallet')} sub={tr('دخّل كود الكارطة (10 حروف)', 'Enter your voucher code')}>
        <div className="input-wrap"><Ticket size={18} /><input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WSXXXXXXXX" style={{ letterSpacing: 2 }} /></div>
        <button className="btn btn-primary btn-block mt" disabled={code.length < 6 || busy} onClick={redeem}>{busy ? <span className="spinner" /> : tr('اشحن', 'Redeem')}</button>
      </Sheet>
    </Page>
  )
}

export function Promo() {
  const [code, setCode] = useState('')
  const [res, setRes] = useState(null)
  const check = async () => {
    const p = await checkPromo(code)
    setRes(p || false)
    if (p) { localStorage.setItem('w_promo', p.code) }
  }
  return (
    <Page title={tr('كود التخفيض', 'Promo codes')}>
      <div className="card pad center rise">
        <div style={{ width: 80, height: 80, borderRadius: 26, background: 'var(--brand-50)', color: 'var(--brand)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Gift size={38} /></div>
        <b style={{ fontSize: 18 }}>{tr('عندك كود تخفيض؟', 'Have a promo code?')}</b>
        <div className="small muted">{tr('شوف الكود واستعملو في الكورسة الجاية', 'Check it and apply it on your next ride')}</div>
        <div className="input-wrap mt"><Ticket size={18} /><input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WASALNI20" style={{ letterSpacing: 2 }} /></div>
        <button className="btn btn-primary btn-block mt" disabled={code.length < 3} onClick={check}>{tr('شوف', 'Check')}</button>
        {res && <div className="badge green mt" style={{ padding: '8px 14px' }}><CheckCircle2 size={15} />{res.type === 'percent' ? tr(`خصم ${res.value}٪ صالح`, `${res.value}% off`) : tr(`خصم ${money(res.value)} صالح`, `${money(res.value)} off`)}</div>}
        {res === false && <div className="badge red mt" style={{ padding: '8px 14px' }}><XCircle size={15} />{tr('الكود ماشي صالح', 'Invalid code')}</div>}
      </div>
    </Page>
  )
}

export function Invite() {
  const { user, settings } = useApp()
  const link = `${SITE_URL || location.origin}/app/?ref=${user.referralCode}`
  const share = async () => {
    const r = await shareLink({ title: 'وصلني', text: tr(`جرّب وصلني 🚗 اركب بسعر عادل أو بلاش بمشاهدة الريلز! استخدم كودي ${user.referralCode}`, `Try Wasalni 🚗 Use my code ${user.referralCode}`), url: link })
    if (r === 'copied') toast(tr('تم نسخ رابط الدعوة', 'Invite link copied'))
  }
  return (
    <Page title={tr('عرّض صحابك', 'Invite friends')}>
      <div className="rw-hero center rise">
        <Users size={54} style={{ position: 'relative' }} />
        <div style={{ position: 'relative', fontSize: 22, fontWeight: 700, marginTop: 10 }}>{tr('بارتاجي وصلني مع صحابك', 'Share Wasalni with friends')}</div>
        <div style={{ position: 'relative', opacity: 0.9, fontSize: 14 }}>{tr('كل صاحب يسجّل بالكود تاعك يتحسبلك', 'Every friend who joins with your code counts toward your referrals')}</div>
      </div>
      <div className="card pad mt center">
        <div className="small muted">{tr('كود الدعوة تاعك', 'Your invite code')}</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, margin: '6px 0' }} className="brand-text num">{user.referralCode}</div>
        <div className="grid2">
          <button className="btn btn-ghost" onClick={async () => { await copy(user.referralCode); toast(tr('تم النسخ', 'Copied')) }}><Copy size={18} />{tr('نسخ', 'Copy')}</button>
          <button className="btn btn-primary" onClick={share}><Share2 size={18} />{tr('بارتاجي', 'Share')}</button>
        </div>
      </div>
      <div className="grid2 mt">
        <div className="card stat"><b className="num">{user.referrals || 0}</b><small>{tr('صحاب سجّلو', 'Friends joined')}</small></div>
        <div className="card stat"><b className="num">{user.trips || 0}</b><small>{tr('كورساتك', 'Your trips')}</small></div>
      </div>
    </Page>
  )
}

export function Profile() {
  const { uid, user } = useApp()
  const nav = useNav()
  const [del, setDel] = useState(false)
  const lvl = levelOf(user.earnedTotal)
  const city = CITIES.find((c) => c.id === user.city)
  return (
    <Page title={tr('البروفيل', 'My profile')}>
      <div className="profile-head rise">
        <Avatar name={user.name} src={user.photo} size={104} />
        <h2>{user.name}</h2>
        <div className="flex" style={{ justifyContent: 'center', marginTop: 4 }}><Stars value={user.rating || 5} size={18} /><span className="badge" style={{ background: 'transparent', color: lvl.c }}>● {tr(lvl.ar, lvl.en)}</span></div>
      </div>
      <div className="stats3">
        <div><CheckCircle2 size={20} /><b className="num">{user.trips || 0}</b><small>{tr('الكورسات الكاملين', 'Completed')}</small></div>
        <div><XCircle size={20} /><b className="num">{user.cancelled || 0}</b><small>{tr('الكورسات الملغيين', 'Cancelled')}</small></div>
        <div><Users size={20} /><b className="num">{user.referrals || 0}</b><small>{tr('الإحالات', 'Referrals')}</small></div>
      </div>
      <div className="section-title" />
      <div className="list">
        <Row icon={<User size={19} />} color="#2E90FA" title={tr('بدّل البروفيل', 'Edit profile')} onClick={() => nav.push('edit')} />
        <Row icon={<Mail size={19} />} color="#12B76A" title={tr('البريد الإلكتروني', 'Email')} sub={user.email || tr('زيد الإيمايل تاعك', 'Add email')} onClick={() => nav.push('edit')} />
        <Row icon={<Phone size={19} />} color="#E8650A" title={tr('رقم التيليفون', 'Phone')} sub={<span className="num">{user.phone}</span>} onClick={() => nav.push('edit')} />
        <Row icon={<MapIcon size={19} />} color="#a16207" title={tr('الولاية', 'City')} sub={city ? (isAr ? city.ar : city.en) : ''} onClick={() => nav.push('edit')} />
        <Row icon={<HomeIco size={19} />} color="#0ea5e9" title={tr('البلايص المحفوظة', 'Saved places')} onClick={() => nav.push('places')} />
        <Row icon={<Languages size={19} />} color="#0f172a" title={tr('اللغة', 'Language')} sub={LANG === 'ar' ? 'العربية' : 'English'} onClick={() => nav.push('settings')} />
        <Row icon={<SetIco size={19} />} color="#7c3aed" title={tr('الإعدادات', 'Settings')} onClick={() => nav.push('settings')} />
        <Row icon={<LogOut size={19} />} color="#92400e" title={tr('اخرج', 'Log out')} onClick={async () => { localStorage.removeItem('w_onb'); const { auth } = await import('@/core/store.js'); await auth.reset(); location.reload() }} />
        <Row icon={<UserX size={19} />} color="#e5484d" title={<span style={{ color: 'var(--danger)' }}>{tr('احذف حسابي', 'Delete my account')}</span>} onClick={() => setDel(true)} />
      </div>
      <Sheet open={del} onClose={() => setDel(false)} title={tr('تحذف الحساب نهائيًا؟', 'Delete account?')} sub={tr('راح تتحذف المعلومات والرصيد والنقاط وما تقدرش ترجعهم.', 'Your data, balance and points will be removed.')}>
        <div className="flex">
          <button className="btn btn-ghost grow" onClick={() => setDel(false)}>{tr('ألغي', 'Cancel')}</button>
          <button className="btn grow" style={{ background: 'var(--danger)', color: '#fff' }} onClick={async () => { await deleteAccount('users', uid); location.reload() }}>{tr('احذف', 'Delete')}</button>
        </div>
      </Sheet>
    </Page>
  )
}

export function EditProfile() {
  const { uid, user } = useApp()
  const nav = useNav()
  const [f, setF] = useState({ name: user.name || '', email: user.email || '', phone: user.phone || '', city: user.city || 'sba', photo: user.photo || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => { await updateUser(uid, f); toast(tr('تسجّل ✅', 'Saved ✅'), 'success'); nav.back() }
  return (
    <Page title={tr('بدّل البروفيل', 'Edit profile')} foot={<button className="btn btn-primary btn-block" onClick={save} disabled={f.name.trim().length < 2}>{tr('سجّل التبديلات', 'Save changes')}</button>}>
      <label className="center" style={{ display: 'block', margin: '10px auto 20px', width: 110, position: 'relative', cursor: 'pointer' }}>
        <Avatar name={f.name} src={f.photo} size={110} />
        <span style={{ position: 'absolute', bottom: 2, insetInlineEnd: 2, width: 36, height: 36, borderRadius: 18, background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', border: '3px solid var(--bg)' }}><Camera size={16} /></span>
        <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setF({ ...f, photo: await compressImage(e.target.files[0], 320, 0.8) })} />
      </label>
      <div className="col">
        <div className="field"><label>{tr('الاسم', 'Name')}</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>{tr('رقم التيليفون', 'Phone')}</label><input className="input" value={f.phone} onChange={set('phone')} style={{ direction: 'ltr', textAlign: isAr ? 'right' : 'left' }} /></div>
        <div className="field"><label>{tr('البريد الإلكتروني', 'Email')}</label><input className="input" type="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label>{tr('الولاية', 'City')}</label><select className="input" value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c.id} value={c.id}>{isAr ? c.ar : c.en}</option>)}</select></div>
      </div>
    </Page>
  )
}

export function Places() {
  const { uid, user } = useApp()
  const [edit, setEdit] = useState(null) // 'home' | 'work' | 'other'
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [name, setName] = useState('')
  const sp = user.savedPlaces || {}
  const city = CITIES.find((c) => c.id === user.city) || CITIES[0]
  useEffect(() => {
    if (q.length < 2) { setRes([]); return }
    const t = setTimeout(() => searchPlaces(q, city.center).then(setRes), 350)
    return () => clearTimeout(t)
  }, [q])
  const save = async (p) => {
    const place = { title: p.title, subtitle: p.subtitle || '', coords: p.coords }
    const next = { ...sp }
    if (edit === 'other') next.others = [...(sp.others || []), { ...place, name: name || p.title }]
    else next[edit] = place
    await updateUser(uid, { savedPlaces: next })
    setEdit(null); setQ(''); setName('')
    toast(tr('البلاصة تسجّلت', 'Place saved'), 'success')
  }
  const remove = async (k, i) => {
    const next = { ...sp }
    if (k === 'other') next.others = sp.others.filter((_, j) => j !== i)
    else delete next[k]
    await updateUser(uid, { savedPlaces: next })
  }
  return (
    <Page title={tr('البلايص المحفوظة', 'Saved places')}>
      <div className="list">
        <Row icon={<HomeIco size={19} />} color="#2E90FA" title={tr('الدار', 'Home')} sub={sp.home?.title || tr('زيد عنوان الدار', 'Add home')} onClick={() => setEdit('home')} right={sp.home && <button onClick={(e) => { e.stopPropagation(); remove('home') }}><Trash2 size={17} color="var(--danger)" /></button>} />
        <Row icon={<Briefcase size={19} />} color="#a16207" title={tr('الخدمة', 'Work')} sub={sp.work?.title || tr('زيد عنوان الخدمة', 'Add work')} onClick={() => setEdit('work')} right={sp.work && <button onClick={(e) => { e.stopPropagation(); remove('work') }}><Trash2 size={17} color="var(--danger)" /></button>} />
        {(sp.others || []).map((p, i) => <Row key={i} icon={<Star size={19} />} color="#E8650A" title={p.name} sub={p.title} right={<button onClick={() => remove('other', i)}><Trash2 size={17} color="var(--danger)" /></button>} />)}
      </div>
      <button className="btn btn-soft btn-block mt" onClick={() => setEdit('other')}><Plus size={18} />{tr('زيد بلاصة', 'Add a place')}</button>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'home' ? tr('عنوان الدار', 'Home address') : edit === 'work' ? tr('عنوان الخدمة', 'Work address') : tr('مكان جديد', 'New place')}>
        {edit === 'other' && <input className="input" style={{ marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('اسم البلاصة (مثال: الصال)', 'Name (e.g. Gym)')} />}
        <div className="input-wrap"><MapPin size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('حوّس على العنوان', 'Search address')} autoFocus /></div>
        <div style={{ marginTop: 8 }}>
          {res.map((r, i) => <button key={i} className="place-row" onClick={() => save(r)}><span className="pi"><MapPin size={18} /></span><span className="pt"><b>{r.title}</b><small>{r.subtitle}</small></span></button>)}
        </div>
      </Sheet>
    </Page>
  )
}
