import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Menu, Crosshair, Layers, Search, Clock, Home as HomeIco, Briefcase, Plus, MapPin, Gift, Car, CalendarClock, Package, Wallet, Banknote,
  Ticket, MessageCircle, Phone, Share2, ShieldAlert, X, ChevronDown, Map as MapIco, Bell, Users, LifeBuoy, Settings, History, Star, Check,
  Sparkles, Zap, StickyNote, Navigation, Info,
} from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { useNav, Drawer, DrawerItem, Avatar, Sheet, Stars, toast, Confetti } from '@/ui/kit.jsx'
import { ClassCar, Coin } from '@/ui/art.jsx'
import { Plate, RouteSummary } from '@/ui/ride-ui.jsx'
import { tr, isAr, money, mins, km, haversine, greeting, shareLink, haptic, timeAgo } from '@/core/util.js'
import { CITIES, SITE_URL } from '@/core/config.js'
import { currentPosition, reverse, route, weather } from '@/core/geo.js'
import { quote, demandFactor } from '@/core/pricing.js'
import { spawnCars, stepCars, runSimulation } from '@/core/fleet.js'
import {
  watchRiderRides, createRide, cancelRide, updateRide, settleRide, watchOnlineDrivers, checkPromo, store, sos, watchNotifications, updateUser,
} from '@/core/api.js'

const ACTIVE = ['searching', 'accepted', 'arrived', 'ongoing']

export default function Home() {
  const { uid, user, settings } = useApp()
  const nav = useNav()
  const mapRef = useRef(null)
  const panelRef = useRef(null)
  const city = CITIES.find((c) => c.id === user.city) || CITIES[0]
  const [me, setMe] = useState(null)
  const [cars, setCars] = useState([])
  const [real, setReal] = useState([])
  const [rides, setRides] = useState([])
  const [draft, setDraft] = useState(null) // {pickup, dropoff, stops}
  const [pick, setPick] = useState(null) // {target, label, coords, moving}
  const [panelH, setPanelH] = useState(260)
  const [drawer, setDrawer] = useState(false)
  const [sat, setSat] = useState(false)
  const [wx, setWx] = useState(null)
  const [notifDot, setNotifDot] = useState(false)

  // الموقع الحالي
  const locate = async (fly = true) => {
    const p = await currentPosition()
    if (p) { setMe(p.coords); if (fly) mapRef.current?.flyTo(p.coords, 15.5) }
    else if (fly) toast(tr('شعّل اللوكاليزاسيون باش نعرفو وين راك بالضبط', 'Enable location for better accuracy'), '', <Info size={18} />)
    return p?.coords
  }
  useEffect(() => { locate(true) }, [])
  const base = me || city.center
  useEffect(() => { weather(base).then(setWx) }, [Math.round(base[0] * 10), Math.round(base[1] * 10)])

  // السيارات القريبة
  useEffect(() => {
    if (!settings.fleetSimulation) { setCars([]); return }
    setCars(spawnCars(base, 9))
    const t = setInterval(() => setCars((c) => stepCars(c, base)), 1600)
    return () => clearInterval(t)
  }, [settings.fleetSimulation, !!me])
  useEffect(() => watchOnlineDrivers(setReal), [])
  useEffect(() => watchRiderRides(uid, setRides), [uid])
  useEffect(() => watchNotifications((n) => setNotifDot(n[0] && n[0].at > Number(localStorage.getItem('w_notif_seen') || 0) && n[0].target !== 'drivers')), [])

  const ride = useMemo(() => {
    const r = rides.find((x) => ACTIVE.includes(x.status))
    if (r) return r
    const done = rides.find((x) => x.status === 'completed' && !x.riderRated && Date.now() - (x.completedAt || 0) < 3 * 3600e3)
    return done || null
  }, [rides])

  // استئناف المحاكاة + تسوية الدفع
  useEffect(() => {
    if (!ride) return
    if (settings.fleetSimulation && (ride.status === 'searching' || ride.driver?.simulated) && ACTIVE.includes(ride.status)) {
      runSimulation(ride.id, () => store.get(`rides/${ride.id}`))
    }
    if (ride.status === 'completed' && !ride.charged) settleRide(uid, ride).catch(() => {})
  }, [ride?.id, ride?.status, settings.fleetSimulation])

  // تنبيهات تغيّر الحالة
  const prevStatus = useRef(null)
  useEffect(() => {
    const s = ride?.status
    if (prevStatus.current && s && s !== prevStatus.current) {
      haptic('medium')
      if (s === 'accepted') toast(tr(`${ride.driver?.name} قبل طلبك 🚗`, `${ride.driver?.name} accepted 🚗`), 'success')
      if (s === 'arrived') toast(tr('الشيفور وصل لبلاصتك 📍', 'Your driver has arrived 📍'), 'brand')
      if (s === 'ongoing') toast(tr('الكورسة بدات، طريق السلامة ✨', 'Trip started ✨'))
      if (s === 'cancelled' && ride.cancelledBy === 'driver') toast(tr('الشيفور لغا الكورسة، راناحوّسو على واحد آخر', 'Driver cancelled'), 'error')
    }
    prevStatus.current = s
  }, [ride?.status])

  // ارتفاع اللوحة → حشوة الخريطة
  useEffect(() => {
    if (!panelRef.current) return
    const ro = new ResizeObserver(() => setPanelH(panelRef.current?.offsetHeight || 0))
    ro.observe(panelRef.current)
    return () => ro.disconnect()
  })

  const allCars = [
    ...real.filter((d) => d.loc?.coords).map((d) => ({ id: 'd-' + d.id, type: 'car', coords: d.loc.coords, heading: d.loc.heading || 0 })),
    ...cars.map((c) => ({ id: c.id, type: 'car', coords: c.pos, heading: c.heading })),
  ]
  const nearestEta = (p) => {
    const ds = allCars.map((c) => haversine(c.coords, p))
    if (!ds.length) return null
    return Math.max(2, Math.round(Math.min(...ds) / 0.45 + 1))
  }

  // ===== بدء الطلب =====
  const openSearch = (focus = 'dropoff', extra = {}) => {
    nav.push('search', {
      focus,
      initial: draft || { pickup: me ? { coords: me, title: tr('البلاصة اللي راني فيها', 'Current location'), current: true } : null, dropoff: null, stops: [] },
      near: base,
      onDone: (d) => { setDraft(d); setPick(null) },
      onPickMap: (target, d) => { setDraft(d); setPick({ target, coords: mapRef.current?.center() || base }) },
      ...extra,
    })
  }
  const quickPlace = (p) => {
    if (!p) return openSearch('dropoff')
    setDraft({ pickup: me ? { coords: me, title: tr('البلاصة اللي راني فيها', 'Current location'), current: true } : null, dropoff: p, stops: [] })
  }

  // تحديد على الخريطة
  const onMoveEnd = async (c, user) => {
    if (!pick) return
    setPick((p) => ({ ...p, coords: c, moving: false, label: null }))
    const r = await reverse(c)
    setPick((p) => (p && Math.abs(p.coords[0] - c[0]) < 1e-9 ? { ...p, label: r } : p))
  }
  useEffect(() => { if (pick && !pick.label) onMoveEnd(mapRef.current?.center() || base) }, [!!pick])
  const confirmPick = () => {
    const place = { ...(pick.label || { title: tr('بلاصة محددة', 'Pinned') }), coords: pick.coords }
    const d = { pickup: null, dropoff: null, stops: [], ...draft }
    if (pick.target === 'pickup') d.pickup = place
    else if (pick.target === 'stop') d.stops = [...(d.stops || []), place]
    else d.dropoff = place
    setPick(null)
    if (d.pickup && d.dropoff) setDraft(d)
    else { setDraft(d); openSearch(d.pickup ? 'dropoff' : 'pickup') }
  }

  // ===== المرحلة الحالية =====
  const stage = pick ? 'pick' : ride ? ride.status : draft?.pickup && draft?.dropoff ? 'choose' : 'idle'

  // المسار المقترح
  const [rt, setRt] = useState(null)
  useEffect(() => {
    if (stage !== 'choose') return
    let off = false
    setRt(null)
    route([draft.pickup.coords, ...(draft.stops || []).map((s) => s.coords), draft.dropoff.coords]).then((r) => { if (!off) setRt(r) })
    return () => { off = true }
  }, [stage, draft?.pickup?.coords?.join(), draft?.dropoff?.coords?.join(), (draft?.stops || []).length])

  // مسار السائق الحقيقي إلى نقطة الالتقاط
  const [approach, setApproach] = useState(null)
  useEffect(() => {
    if (ride?.status !== 'accepted' || !ride.driverLoc?.coords) { setApproach(null); return }
    if (ride.approach?.coords) { setApproach(ride.approach); return }
    route([ride.driverLoc.coords, ride.pickup.coords]).then(setApproach)
  }, [ride?.id, ride?.status, !!ride?.driverLoc])

  // ضبط إطار الخريطة
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const t = setTimeout(() => {
      if (stage === 'choose' && rt) m.fit(rt.coords, { bottom: panelH + 30, top: 110 })
      else if (stage === 'searching') m.flyTo(ride.pickup.coords, 15.2)
      else if (stage === 'accepted' && ride.driverLoc) m.fit([ride.driverLoc.coords, ride.pickup.coords], { bottom: panelH + 40, top: 120 })
      else if (stage === 'ongoing') m.fit(ride.route?.coords || [ride.pickup.coords, ride.dropoff.coords], { bottom: panelH + 40, top: 120 })
      else if (stage === 'arrived') m.flyTo(ride.pickup.coords, 16.5)
    }, 250)
    return () => clearTimeout(t)
  }, [stage, rt, ride?.id, Math.round(panelH / 60)])

  // ===== العلامات والمسارات =====
  const markers = []
  const routes = []
  if (stage === 'idle' || stage === 'pick') {
    if (me) markers.push({ id: 'me', type: 'me', coords: me })
    markers.push(...allCars)
  } else if (stage === 'choose') {
    const eta = nearestEta(draft.pickup.coords)
    markers.push({ id: 'pu', type: 'pickup', coords: draft.pickup.coords, label: draft.pickup.title, eta: eta ? mins(eta) : null })
    draft.stops?.forEach((s, i) => markers.push({ id: 'st' + i, type: 'stop', coords: s.coords, label: s.title }))
    markers.push({ id: 'do', type: 'drop', coords: draft.dropoff.coords, label: draft.dropoff.title, eta: rt ? mins(rt.durationMin) : null })
    markers.push(...allCars)
    if (rt) routes.push({ id: 'trip', coords: rt.coords })
  } else if (ride) {
    if (['searching', 'accepted', 'arrived'].includes(stage)) markers.push({ id: 'pu', type: 'pickup', coords: ride.pickup.coords, label: stage === 'arrived' ? tr('الشيفور راهو هنا', 'Driver is here') : ride.pickup.title })
    if (['ongoing', 'completed'].includes(stage) || stage === 'accepted') markers.push({ id: 'do', type: 'drop', coords: ride.dropoff.coords, label: ride.dropoff.title })
    if (ride.driverLoc?.coords && stage !== 'searching') markers.push({ id: 'drv', type: 'car', coords: ride.driverLoc.coords, heading: ride.driverLoc.heading || 0, size: 50 })
    if (stage === 'searching') markers.push(...allCars)
    if (stage === 'accepted' && approach) routes.push({ id: 'appr', coords: approach.coords, dashed: true, color: isDarkMode() ? '#fff' : '#18120e' })
    if (['accepted', 'ongoing'].includes(stage) && ride.route?.coords) routes.push({ id: 'trip', coords: ride.route.coords })
  }

  const ctrlBottom = panelH + 16

  return (
    <div className="home">
      <MapView ref={mapRef} center={base} zoom={14.5} markers={markers} routes={routes} satellite={sat} onMoveStart={() => pick && setPick((p) => ({ ...p, moving: true }))} onMoveEnd={onMoveEnd} padding={{ bottom: panelH }} />
      {stage === 'searching' && <div className="radar" style={{ top: `calc((100% - ${panelH}px) / 2)` }}><span /><span /><span /></div>}
      {stage === 'pick' && (
        <div className={`center-pin ${pick.moving ? 'lift' : ''}`} style={{ top: `calc((100% - ${panelH}px) / 2)` }}>
          <div className="head"><MapPin size={22} /></div><div className="stick" /><div className="shadow" />
        </div>
      )}

      <div className="top-ctrls">
        <div className="side-ctrls">
          {stage === 'idle' || stage === 'completed' ? (
            <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="menu"><Menu size={22} />{notifDot && <span className="dot" />}</button>
          ) : stage === 'choose' || stage === 'pick' ? (
            <button className="icon-btn" onClick={() => { setPick(null); setDraft(null) }}><X size={22} /></button>
          ) : (
            <button className="icon-btn" onClick={() => setDrawer(true)}><Menu size={22} /></button>
          )}
        </div>
        {(stage === 'idle') && (
          <button className="points-pill rise" onClick={() => nav.push('rewards')}>
            <span className="coin"><Coin size={20} /></span>
            <span className="num">{money(user.points || 0)}</span>
          </button>
        )}
      </div>
      {settings.announcement && stage === 'idle' && (
        <div className="card rise" style={{ position: 'absolute', top: 'calc(var(--safe-t) + 72px)', insetInline: 14, zIndex: 9, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
          <Sparkles size={18} color="var(--brand)" />{settings.announcement}
        </div>
      )}

      <div className="float-ctrls" style={{ bottom: ctrlBottom }}>
        <button className="icon-btn sm" onClick={() => setSat(!sat)} aria-label="layers" style={sat ? { background: 'var(--ink)', color: 'var(--bg)' } : null}><Layers size={19} /></button>
        <button className="icon-btn sm" onClick={() => locate(true)} aria-label="locate"><Crosshair size={19} /></button>
      </div>

      <div className="panel" ref={panelRef} key={stage}>
        <div className="grabber" />
        {stage === 'idle' && <IdlePanel user={user} wx={wx} onSearch={openSearch} onPlace={quickPlace} rides={rides} nav={nav} settings={settings} />}
        {stage === 'pick' && <PickPanel pick={pick} onConfirm={confirmPick} onCancel={() => { setPick(null); openSearch(pick.target) }} />}
        {stage === 'choose' && <ChoosePanel draft={draft} rt={rt} user={user} settings={settings} uid={uid} eta={nearestEta(draft.pickup.coords)} carsN={allCars.length} onEdit={() => openSearch('dropoff')} onBooked={() => setDraft(null)} />}
        {stage === 'searching' && <SearchingPanel ride={ride} settings={settings} />}
        {['accepted', 'arrived', 'ongoing'].includes(stage) && <TripPanel ride={ride} approach={approach} nav={nav} uid={uid} user={user} />}
        {stage === 'completed' && <RatePanel ride={ride} />}
      </div>

      <RiderDrawer open={drawer} onClose={() => setDrawer(false)} user={user} nav={nav} notifDot={notifDot} />
    </div>
  )
}
const isDarkMode = () => document.documentElement.dataset.theme === 'dark'

// ===== اللوحة الافتراضية =====
function IdlePanel({ user, wx, onSearch, onPlace, rides, nav, settings }) {
  const home = user.savedPlaces?.home, work = user.savedPlaces?.work
  const recent = []
  const seen = new Set()
  for (const r of rides) {
    if (!r.dropoff || seen.has(r.dropoff.title)) continue
    seen.add(r.dropoff.title); recent.push(r.dropoff)
    if (recent.length >= 3) break
  }
  const target = 300
  const pct = Math.min(100, ((user.points || 0) / target) * 100)
  return (
    <div className="rise">
      <div className="greet">
        <span style={{ fontSize: 20 }}>{wx?.icon || '🌤️'}</span>
        <span>{greeting()}، <b>{user.name?.split(' ')[0]}</b></span>
        {wx && <span className="badge gray" style={{ marginInlineStart: 'auto' }}><span className="num">{wx.temp}°</span></span>}
      </div>
      <button className="search-box" onClick={() => onSearch('dropoff')}>
        <span className="sicon"><Search size={19} /></span>
        {tr('وين حاب تروح؟', 'Where to?')}
        <span className="when" onClick={(e) => { e.stopPropagation(); onSearch('dropoff', { schedule: true }) }}><Clock size={14} />{tr('دروك', 'Now')}<ChevronDown size={14} /></span>
      </button>
      <div className="hscroll" style={{ marginTop: 12 }}>
        <button className="chip" onClick={() => (home ? onPlace(home) : nav.push('places'))}><HomeIco size={15} />{home ? tr('الدار', 'Home') : tr('زيد الدار', 'Add home')}</button>
        <button className="chip" onClick={() => (work ? onPlace(work) : nav.push('places'))}><Briefcase size={15} />{work ? tr('الخدمة', 'Work') : tr('زيد الخدمة', 'Add work')}</button>
        {(user.savedPlaces?.others || []).map((p, i) => <button key={i} className="chip" onClick={() => onPlace(p)}><Star size={15} />{p.name || p.title}</button>)}
        <button className="chip" onClick={() => nav.push('places')}><Plus size={15} />{tr('بلايص', 'Places')}</button>
      </div>
      {recent.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {recent.map((p, i) => (
            <button key={i} className="place-row" onClick={() => onPlace(p)}>
              <span className="pi"><History size={18} /></span>
              <span className="pt"><b>{p.title}</b><small>{p.subtitle}</small></span>
            </button>
          ))}
        </div>
      )}
      <div className="quick">
        <button onClick={() => onSearch('dropoff')}><span className="qi"><ClassCar type="eco" w={52} /></span>{tr('كورسة', 'Ride')}</button>
        <button onClick={() => onSearch('dropoff', { classId: 'moto' })}><span className="qi"><ClassCar type="moto" w={52} /></span>{tr('توصيل', 'Delivery')}</button>
        <button onClick={() => onSearch('dropoff', { schedule: true })}><span className="qi"><CalendarClock size={28} color="var(--brand)" /></span>{tr('برمج', 'Schedule')}</button>
        <button onClick={() => nav.push('reels')}><span className="qi" style={{ background: 'var(--grad)', color: '#fff' }}><Gift size={28} /><span className="new num">+{settings.rewards.perReel}</span></span>{tr('اربح', 'Earn')}</button>
      </div>
      <button className="reward-banner" onClick={() => nav.push('reels')}>
        <span className="rb-ico"><Sparkles size={26} /></span>
        <span style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <b>{pct >= 100 ? tr('الكورسة البلاش تاعك واجدة! 🎉', 'Your free ride is ready! 🎉') : tr('اركب بلاش كي تشوف الريلز', 'Ride free by watching reels')}</b>
          <small>{tr(`كل إشهار مكتمل = ${settings.rewards.perReel} دينار • رصيدك ${money(user.points || 0)}`, `Each reel = ${settings.rewards.perReel} DA • Balance ${money(user.points || 0)}`)}</small>
          <span className="rb-bar"><i style={{ width: pct + '%' }} /></span>
        </span>
      </button>
    </div>
  )
}

function PickPanel({ pick, onConfirm, onCancel }) {
  const titles = { pickup: tr('حدد وين يجيبك الشيفور', 'Set pickup'), dropoff: tr('حدد وين رايح', 'Set destination'), stop: tr('حدد الوقفة', 'Set stop') }
  return (
    <div className="rise">
      <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{titles[pick.target]}</h3>
      <div className="small muted" style={{ marginBottom: 12 }}>{tr('حرّك الخريطة باش تحط الدبوس في البلاصة الصحيحة', 'Move the map to place the pin')}</div>
      <div className="place-row" style={{ background: 'var(--card-2)', borderRadius: 16, padding: 12 }}>
        <span className="pi" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><MapPin size={18} /></span>
        <span className="pt">{pick.label ? <><b>{pick.label.title}</b><small>{pick.label.subtitle}</small></> : <><div className="skeleton" style={{ height: 14, width: '60%' }} /><div className="skeleton" style={{ height: 10, width: '40%', marginTop: 6 }} /></>}</span>
      </div>
      <div className="flex mt">
        <button className="btn btn-ghost" onClick={onCancel}><Search size={18} /></button>
        <button className="btn btn-primary grow" disabled={!pick.label || pick.moving} onClick={onConfirm}>{tr('أكّد البلاصة', 'Confirm location')}</button>
      </div>
    </div>
  )
}

// ===== اختيار الفئة والدفع =====
function ChoosePanel({ draft, rt, user, settings, uid, eta, carsN, onEdit, onBooked }) {
  const pricing = settings.pricing
  const [cls, setCls] = useState(draft.classId || 'eco')
  const [pay, setPay] = useState('cash')
  const [promo, setPromo] = useState(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(!!draft.schedule)
  const [note, setNote] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const demand = demandFactor(0, carsN)
  const quotes = useMemo(() => Object.fromEntries(pricing.classes.map((c) => [c.id, rt ? quote(c, rt, pricing, { demand, promo }) : null])), [rt, promo, pricing])
  const q = quotes[cls]
  const points = user.points || 0, wallet = user.wallet || 0
  useEffect(() => {
    if (!q) return
    if (pay === 'points' && points < q.total) setPay('cash')
    if (pay === 'wallet' && wallet < q.total) setPay('cash')
  }, [q?.total])

  const book = async () => {
    if (!q) return
    setBusy(true)
    try {
      const c = pricing.classes.find((x) => x.id === cls)
      const id = await createRide({
        riderId: uid, riderName: user.name, riderPhone: user.phone, riderRating: user.rating || 5, city: user.city,
        pickup: strip(draft.pickup), dropoff: strip(draft.dropoff), stops: (draft.stops || []).map(strip),
        route: { coords: rt.coords, distanceKm: +rt.distanceKm.toFixed(2), durationMin: +rt.durationMin.toFixed(1) },
        classId: cls, className: c.ar, fare: q, payment: pay, promoCode: promo?.code || '', note, scheduledAt: when ? new Date(when).getTime() : null,
      })
      if (promo) store.set(`promos/${promo.code}`, { used: store.inc(1) }, true).catch(() => {})
      haptic('medium')
      if (when) toast(tr('الكورسة تاعك تبرمجت ✅', 'Ride scheduled ✅'), 'success')
      onBooked(id)
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }

  const applyPromo = async (code) => {
    const p = await checkPromo(code)
    if (!p) return toast(tr('الكود ماشي صالح ولا فات وقتو', 'Invalid or expired code'), 'error')
    setPromo(p); setPromoOpen(false)
    toast(tr('التخفيض تطبّق 🎁', 'Discount applied 🎁'), 'success')
  }

  return (
    <div className="rise">
      <button className="btn-block" onClick={onEdit} style={{ textAlign: 'start' }}><RouteSummary ride={draft} /></button>
      {rt && (
        <div className="flex small muted" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="badge gray"><Navigation size={12} /> <span className="num">{km(rt.distanceKm)}</span></span>
          <span className="badge gray"><Clock size={12} /> <span className="num">{mins(rt.durationMin)}</span></span>
          {q?.surge > 1 && <span className="surge"><Zap size={13} />{q.timeKey === 'night' ? tr('سومة الليل', 'Night rate') : tr('وقت الزحمة', 'Peak time')} ×{q.surge}</span>}
        </div>
      )}
      <div className="cls-list">
        {pricing.classes.map((c) => {
          const qq = quotes[c.id]
          const free = qq && points >= qq.total
          return (
            <button key={c.id} className={`cls ${cls === c.id ? 'active' : ''}`} onClick={() => { setCls(c.id); haptic() }}>
              {free && <span className="free">{tr('بلاش بنقاطك', 'Free with points')}</span>}
              <span className="cimg"><ClassCar type={c.icon} /></span>
              <span className="ct">
                <b>{isAr ? c.ar : c.en}{c.seats > 0 && <span className="badge gray" style={{ padding: '1px 6px' }}><Users size={11} />{c.seats}</span>}</b>
                <small>{eta ? `${tr('يوصل في', 'Arrives in')} ${mins(eta + (c.id === 'vip' ? 3 : c.id === 'family' ? 2 : 0))}` : isAr ? c.desc : c.descEn}</small>
              </span>
              <span className="cp">{qq ? <><b className="num">{money(qq.total)}</b>{qq.discount > 0 && <s className="num">{money(qq.original)}</s>}</> : <span className="skeleton" style={{ width: 54, height: 18, display: 'block' }} />}</span>
            </button>
          )
        })}
      </div>
      <div className="pay-row">
        <button className={pay === 'cash' ? 'active' : ''} onClick={() => setPay('cash')}><Banknote size={17} color="var(--success)" />{tr('كاش', 'Cash')}</button>
        <button className={pay === 'wallet' ? 'active' : ''} disabled={!q || wallet < q.total} onClick={() => setPay('wallet')}><Wallet size={17} color="var(--info)" /><span className="num">{money(wallet)}</span></button>
        <button className={pay === 'points' ? 'active' : ''} disabled={!q || points < q.total} onClick={() => setPay('points')}><Coin size={17} /><span className="num">{money(points)}</span></button>
      </div>
      {q && points < q.total && <div className="tiny muted center" style={{ marginTop: -4, marginBottom: 8 }}>{tr(`تحتاج ${money(q.total - points)} إضافية من الريلز لتكون الكورسة بلاش`, `${money(q.total - points)} more from reels for a free ride`)}</div>}
      <div className="hscroll" style={{ marginBottom: 12 }}>
        <button className={`chip ${promo ? 'brand' : ''}`} onClick={() => setPromoOpen(true)}><Ticket size={15} />{promo ? promo.code : tr('كود تخفيض', 'Promo')}</button>
        <button className={`chip ${note ? 'brand' : ''}`} onClick={() => setNoteOpen(true)}><StickyNote size={15} />{note ? tr('ملاحظة ✓', 'Note ✓') : tr('ملاحظة للشيفور', 'Note')}</button>
        <button className={`chip ${when ? 'brand' : ''}`} onClick={() => setSchedOpen(true)}><CalendarClock size={15} />{when ? new Date(when).toLocaleString(isAr ? 'ar-DZ' : 'en', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : tr('برمج', 'Schedule')}</button>
      </div>
      <button className="btn btn-primary btn-block btn-lg" disabled={!q || busy} onClick={book}>
        {busy ? <span className="spinner" /> : <>{when ? tr('برمج', 'Schedule') : tr('اطلب', 'Request')} {isAr ? pricing.classes.find((c) => c.id === cls)?.ar : pricing.classes.find((c) => c.id === cls)?.en}{q && <span className="num" style={{ opacity: 0.9 }}>• {pay === 'points' ? tr('بلاش', 'Free') : money(q.total)}</span>}</>}
      </button>

      <PromoSheet open={promoOpen} onClose={() => setPromoOpen(false)} onApply={applyPromo} />
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={tr('ملاحظة للشيفور', 'Note to driver')} sub={tr('مثال: راني قدام الفارماسي، معايا شنطة كبيرة', 'e.g. I am next to the pharmacy')}>
        <textarea className="input" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder={tr('اكتب ملاحظتك…', 'Write a note…')} />
        <button className="btn btn-primary btn-block mt" onClick={() => setNoteOpen(false)}>{tr('حفظ', 'Save')}</button>
      </Sheet>
      <Sheet open={schedOpen} onClose={() => setSchedOpen(false)} title={tr('برمج الكورسة', 'Schedule ride')} sub={tr('اختار الوقت ونبعثولك الشيفور في الوقت بالضبط', 'Pick a time and we will send a driver')}>
        <input type="datetime-local" className="input" value={when} min={new Date(Date.now() + 15 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => setWhen(e.target.value)} />
        <div className="flex mt">
          {when && <button className="btn btn-ghost" onClick={() => { setWhen(''); setSchedOpen(false) }}>{tr('دروك', 'Now')}</button>}
          <button className="btn btn-primary grow" onClick={() => setSchedOpen(false)}>{tr('تأكيد', 'Confirm')}</button>
        </div>
      </Sheet>
    </div>
  )
}
const strip = (p) => p && { title: p.title || '', subtitle: p.subtitle || '', coords: p.coords }

export function PromoSheet({ open, onClose, onApply }) {
  const [code, setCode] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title={tr('كود التخفيض', 'Promo code')} sub={tr('دخّل الكود باش تاخذ تخفيض على الكورسة', 'Enter a code to get a discount')}>
      <div className="input-wrap"><Ticket size={18} /><input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WASALNI20" style={{ letterSpacing: 2 }} /></div>
      <button className="btn btn-primary btn-block mt" disabled={code.length < 3} onClick={() => onApply(code)}>{tr('تطبيق', 'Apply')}</button>
    </Sheet>
  )
}

// ===== البحث عن سائق =====
function SearchingPanel({ ride, settings }) {
  const [now, setNow] = useState(Date.now())
  const [cancel, setCancel] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const secs = Math.floor((now - ride.createdAt) / 1000)
  const late = secs > 150 && !settings.fleetSimulation
  return (
    <div className="rise">
      <div className="center">
        <div style={{ fontSize: 19, fontWeight: 600 }}>{late ? tr('ما كاين حتى شيفور فاضي دروك', 'No drivers available') : tr('راناحوّسو على أقرب شيفور…', 'Finding your driver…')}</div>
        <div className="small muted">{late ? tr('عاود بعد شوية ولا اختار نوع آخر', 'Try again shortly') : tr('راهو الطلب تاعك يوصل للشيفورات القراب', 'Sending your request to nearby drivers')} • <span className="num">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span></div>
      </div>
      <div className="searching-bar" />
      <div className="card pad" style={{ background: 'var(--card-2)', boxShadow: 'none' }}>
        <RouteSummary ride={ride} compact />
        <div className="between mt small">
          <span className="flex"><ClassCar type={settings.pricing.classes.find((c) => c.id === ride.classId)?.icon || 'eco'} w={40} />{ride.className}</span>
          <b className="num">{ride.payment === 'points' ? tr('بلاش 🎁', 'Free 🎁') : money(ride.fare.total)}</b>
        </div>
      </div>
      <button className="btn btn-danger btn-block mt" onClick={() => setCancel(true)}>{tr('ألغي الطلب', 'Cancel request')}</button>
      <CancelSheet open={cancel} onClose={() => setCancel(false)} ride={ride} />
    </div>
  )
}

const REASONS = ['تأخر السائق كثيرًا', 'غيّرت رأيي', 'طلبت بالخطأ', 'السعر مرتفع', 'وجدت وسيلة أخرى', 'سبب آخر']
function CancelSheet({ open, onClose, ride }) {
  const [r, setR] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title={tr('علاش راك تلغي؟', 'Why cancel?')} sub={ride.status !== 'searching' ? tr('ممكن تخلص شوية دراهم كي تلغي بعد ما يقبل الشيفور', 'A small fee may apply') : null}>
      <div className="col" style={{ gap: 8 }}>
        {REASONS.map((x) => <button key={x} className={`chip ${r === x ? 'active' : ''}`} style={{ height: 46, justifyContent: 'flex-start' }} onClick={() => setR(x)}>{x}</button>)}
      </div>
      <div className="flex mt">
        <button className="btn btn-ghost grow" onClick={onClose}>{tr('رجوع', 'Back')}</button>
        <button className="btn btn-danger grow" style={{ background: 'var(--danger)', color: '#fff' }} disabled={!r} onClick={async () => { await cancelRide(ride.id, 'rider', r); store.update(`users/${ride.riderId}`, { cancelled: store.inc(1) }).catch(() => {}); onClose(); toast(tr('الكورسة تلغات', 'Ride cancelled')) }}>{tr('أكّد الإلغاء', 'Confirm')}</button>
      </div>
    </Sheet>
  )
}

// ===== الرحلة الجارية =====
function TripPanel({ ride, approach, nav, uid, user }) {
  const [cancel, setCancel] = useState(false)
  const [sosOpen, setSos] = useState(false)
  const d = ride.driver || {}
  const etaMin = ride.status === 'accepted'
    ? Math.max(1, Math.round((approach?.durationMin || 4) * (1 - (ride.progress || 0))))
    : ride.status === 'ongoing' ? Math.max(1, Math.round((ride.route?.durationMin || 8) * (1 - (ride.progress || 0)))) : 0
  const title = { accepted: tr('الشيفور راهو جاي ليك', 'Driver is on the way'), arrived: tr('الشيفور راهو يستنى فيك', 'Your driver is waiting'), ongoing: tr('راكم رايحين لبلاصتك', 'Heading to destination') }[ride.status]
  const share = async () => {
    const loc = ride.driverLoc?.coords
    const r = await shareLink({ title: 'وصلني', text: tr(`أنا في كورسة مع وصلني 🚗 الشيفور: ${d.name} • ${d.car} ${d.color || ''} • لوحة ${d.plate}. الوجهة: ${ride.dropoff.title}`, `I'm on a Wasalni ride with ${d.name} (${d.car}, plate ${d.plate}) to ${ride.dropoff.title}`), url: loc ? `https://maps.google.com/?q=${loc[1]},${loc[0]}` : SITE_URL })
    if (r === 'copied') toast(tr('تفاصيل الكورسة تنسخات', 'Trip details copied'))
  }
  return (
    <div className="rise">
      <div className="status-strip">
        {ride.status === 'arrived' ? <MapPin size={18} /> : <Car size={18} />}
        <span className="grow">{title}</span>
        {etaMin > 0 && <span className="num">{mins(etaMin)}</span>}
      </div>
      <div className="driver-card">
        <div style={{ position: 'relative' }}>
          <Avatar name={d.name} src={d.photo} size={58} />
          <span className="badge" style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', background: 'var(--card)', boxShadow: 'var(--shadow-1)', color: 'var(--ink)', whiteSpace: 'nowrap' }}><Star size={11} fill="var(--gold)" color="var(--gold)" /><span className="num">{d.rating || 5}</span></span>
        </div>
        <div className="dc-main">
          <b>{d.name}</b>
          <div className="small muted">{d.car} • {d.color}</div>
          <div style={{ marginTop: 6 }}><Plate value={d.plate} /></div>
        </div>
        <div className="eta-big">
          <b className="num">{ride.status === 'arrived' ? '✓' : etaMin}</b>
          <small>{ride.status === 'arrived' ? tr('وصل', 'Here') : tr('دقيقة', 'min')}</small>
        </div>
      </div>
      {ride.status !== 'arrived' && <div className="progress-line"><i style={{ width: `${Math.round((ride.progress || 0) * 100)}%` }} /></div>}
      <div className="actions4">
        <a href={`tel:${d.phone}`} style={{ color: 'inherit' }}><button style={{ width: '100%' }}><Phone size={20} />{tr('عيّط', 'Call')}</button></a>
        <button onClick={() => nav.push('chat', { rideId: ride.id, me: 'rider' })}><MessageCircle size={20} />{tr('دردشة', 'Chat')}</button>
        <button onClick={share}><Share2 size={20} />{tr('بارتاجي', 'Share')}</button>
        <button className="red" onClick={() => setSos(true)}><ShieldAlert size={20} />{tr('طوارئ', 'SOS')}</button>
      </div>
      <div className="card pad mt" style={{ background: 'var(--card-2)', boxShadow: 'none' }}>
        <RouteSummary ride={ride} compact />
        <div className="between small mt">
          <span className="muted">{ride.payment === 'cash' ? tr('الخلاص كاش', 'Cash') : ride.payment === 'wallet' ? tr('من البورتفاي', 'Wallet') : tr('بنقاط الكادوات', 'Reward points')}</span>
          <b className="num">{ride.payment === 'points' ? tr('بلاش 🎁', 'Free 🎁') : money(ride.fare.total)}</b>
        </div>
      </div>
      {ride.status !== 'ongoing' && <button className="btn btn-block mt muted" style={{ '--h': '44px' }} onClick={() => setCancel(true)}>{tr('ألغي الكورسة', 'Cancel ride')}</button>}
      <CancelSheet open={cancel} onClose={() => setCancel(false)} ride={ride} />
      <Sheet open={sosOpen} onClose={() => setSos(false)} title={tr('عاونوني دغيا', 'Emergency')} sub={tr('نبعثو البلاصة تاعك وتفاصيل الكورسة لفريق الأمان دغيا', 'We will alert our safety team')}>
        <div className="col">
          <a className="btn btn-block" style={{ background: 'var(--danger)', color: '#fff' }} href="tel:17" onClick={() => sos({ uid, rideId: ride.id, name: user.name, phone: user.phone, loc: ride.driverLoc?.coords || ride.pickup.coords, kind: 'rider' })}><Phone size={18} />{tr('عيّط للشرطة 17', 'Call police 17')}</a>
          <button className="btn btn-ghost btn-block" onClick={async () => { await sos({ uid, rideId: ride.id, name: user.name, phone: user.phone, loc: ride.driverLoc?.coords || ride.pickup.coords, kind: 'rider' }); toast(tr('فريق الأمان تخبّر', 'Safety team alerted'), 'success'); setSos(false) }}><ShieldAlert size={18} />{tr('خبّر فريق وصلني', 'Alert Wasalni team')}</button>
          <button className="btn btn-ghost btn-block" onClick={share}><Share2 size={18} />{tr('بارتاجي بلاصتي مع العايلة', 'Share with family')}</button>
        </div>
      </Sheet>
    </div>
  )
}

// ===== التقييم =====
const TAGS = ['قيادة آمنة', 'سيارة نظيفة', 'سائق محترم', 'وصل بسرعة', 'معرفة بالطرق', 'محادثة لطيفة']
function RatePanel({ ride }) {
  const [stars, setStars] = useState(5)
  const [tags, setTags] = useState([])
  const [tip, setTip] = useState(0)
  const [comment, setComment] = useState('')
  const [fire, setFire] = useState(false)
  useEffect(() => { setTimeout(() => setFire(true), 300) }, [])
  const submit = async () => {
    await updateRide(ride.id, { riderRated: true, ratingByRider: stars, riderTags: tags, tip, riderComment: comment })
    if (ride.driverId && !ride.driver?.simulated) store.set(`drivers/${ride.driverId}`, { ratingSum: store.inc(stars), ratingCount: store.inc(1) }, true).catch(() => {})
    toast(tr('يعطيك الصحة على التقييم ❤️', 'Thanks for rating ❤️'), 'success')
  }
  const d = ride.driver || {}
  return (
    <div className="rise center">
      <Confetti run={fire && ride.payment === 'points'} />
      <div style={{ width: 64, height: 64, borderRadius: 22, background: 'var(--success-bg)', color: 'var(--success)', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }} className="pop"><Check size={34} strokeWidth={3} /></div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{tr('وصلت بالسلامة!', 'You have arrived!')}</div>
      <div className="small muted">{ride.dropoff.title}</div>
      <div className="card pad mt" style={{ background: 'var(--card-2)', boxShadow: 'none' }}>
        <div className="between"><span className="muted small">{tr('السومة', 'Fare')}</span><b className="num" style={{ fontSize: 22 }}>{ride.payment === 'points' ? tr('بلاش 🎁', 'Free 🎁') : money(ride.fare.total)}</b></div>
        {ride.payment === 'points' && <div className="tiny" style={{ color: 'var(--success)', textAlign: 'start' }}>{tr(`تم خصم ${money(ride.fare.total)} من نقاط الكادوات`, `${money(ride.fare.total)} paid with reward points`)}</div>}
      </div>
      <div className="mt flex" style={{ justifyContent: 'center' }}><Avatar name={d.name} size={44} /><div style={{ textAlign: 'start' }}><b>{d.name}</b><div className="tiny muted">{tr('كيفاش كانت الكورسة؟', 'How was your ride?')}</div></div></div>
      <div className="mt"><Stars value={stars} size={36} onChange={setStars} /></div>
      <div className="tag-chips">{TAGS.map((t) => <button key={t} className={`chip ${tags.includes(t) ? 'brand' : ''}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>)}</div>
      <div className="small muted" style={{ marginBottom: 8 }}>{tr('بوربوار للشيفور', 'Tip your driver')}</div>
      <div className="flex" style={{ justifyContent: 'center', marginBottom: 12 }}>{[0, 50, 100, 200].map((v) => <button key={v} className={`chip ${tip === v ? 'active' : ''}`} onClick={() => setTip(v)}>{v ? <span className="num">{money(v)}</span> : tr('والو', 'None')}</button>)}</div>
      <input className="input" placeholder={tr('زيد تعليق (إذا حبيت)', 'Add a comment (optional)')} value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn btn-primary btn-block btn-lg mt" onClick={submit}>{tr('ابعث التقييم', 'Submit')}</button>
    </div>
  )
}

// ===== القائمة الجانبية =====
function RiderDrawer({ open, onClose, user, nav, notifDot }) {
  const go = (p, params) => { onClose(); setTimeout(() => nav.push(p, params), 60) }
  return (
    <Drawer open={open} onClose={onClose}
      head={
        <button className="flex" style={{ position: 'relative', zIndex: 1, color: '#fff', textAlign: 'start', width: '100%' }} onClick={() => go('profile')}>
          <Avatar name={user.name} src={user.photo} size={62} style={{ border: '3px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.2)' }} />
          <div className="grow">
            <div style={{ fontSize: 18, fontWeight: 600 }}>{user.name}</div>
            <div className="small" style={{ opacity: 0.9 }}><span className="num">{user.phone}</span></div>
            <div className="flex tiny" style={{ marginTop: 6, gap: 6 }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}><Wallet size={11} /><span className="num">{money(user.wallet || 0)}</span></span>
              <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}><Coin size={11} /><span className="num">{money(user.points || 0)}</span></span>
            </div>
          </div>
        </button>
      }
      foot={
        <div style={{ padding: '12px 16px calc(var(--safe-b) + 14px)', borderTop: '1px solid var(--line)' }}>
          <a className="btn btn-soft btn-block btn-sm" href={(SITE_URL || '..') + '/driver/'}><Car size={16} />{tr('سجّل كشيفور واربح معانا', 'Drive with Wasalni')}</a>
          <div className="tiny muted center" style={{ marginTop: 8 }}>Wasalni v1.0 • {__BUILD__.slice(0, 10)}</div>
        </div>
      }
    >
      <DrawerItem icon={<MapIco size={19} />} color="#14b8a6" label={tr('كورساتي', 'My trips')} onClick={() => go('trips')} />
      <DrawerItem icon={<CalendarClock size={19} />} color="#475569" label={tr('كورسات مبرمجة', 'Scheduled')} onClick={() => go('scheduled')} />
      <DrawerItem icon={<Gift size={19} />} color="#E8650A" label={tr('الكادوات والريلز', 'Rewards & reels')} onClick={() => go('rewards')} tag={<span className="badge">+5</span>} />
      <DrawerItem icon={<Wallet size={19} />} color="#a16207" label={tr('البورتفاي', 'Wallet')} onClick={() => go('wallet')} />
      <DrawerItem icon={<Ticket size={19} />} color="#ef4444" label={tr('كود التخفيض', 'Promo codes')} onClick={() => go('promo')} />
      <DrawerItem icon={<Bell size={19} />} color="#a855f7" label={tr('الإشعارات', 'Notifications')} onClick={() => go('notifications')} tag={notifDot && <span className="dot" style={{ width: 9, height: 9, borderRadius: 9, background: 'var(--danger)', display: 'block' }} />} />
      <DrawerItem icon={<Users size={19} />} color="#0ea5e9" label={tr('عرّض صحابك', 'Invite friends')} onClick={() => go('invite')} />
      <DrawerItem icon={<LifeBuoy size={19} />} color="#22c55e" label={tr('المساعدة والدعم', 'Help & support')} onClick={() => go('support')} />
      <DrawerItem icon={<Settings size={19} />} color="#64748b" label={tr('الإعدادات', 'Settings')} onClick={() => go('settings')} />
    </Drawer>
  )
}
