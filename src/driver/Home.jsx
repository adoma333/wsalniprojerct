import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Menu, Zap, Crosshair, Layers, Phone, MessageCircle, Navigation, MapPin, Flag, Banknote, Wallet, Clock, Star, X, ShieldAlert, Map as MapIco,
  CalendarClock, BadgeDollarSign, Gift, Users, Bell, LifeBuoy, Info, Check, Route as RouteIco, Coins,
  KeyRound, AlertTriangle, ChevronLeft, SlidersHorizontal, Trophy, Bus as BusIcon,
} from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import MapControls, { useMapPrefs } from '@/map/MapControls.jsx'
import DragPanel from '@/ui/DragPanel.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { useNav, Drawer, DrawerItem, Avatar, Sheet, Stars, toast } from '@/ui/kit.jsx'
import { ClassCar, Coin } from '@/ui/art.jsx'
import { RouteSummary, useChatAlerts, useBroadcastAlerts } from '@/ui/ride-ui.jsx'
import { play } from '@/core/sound.js'
import { tr, money, mins, km, haversine, haptic, offsetPoint, along, pick, num } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { currentPosition, watchPosition, route, reverse, mapsLink } from '@/core/geo.js'
import { quote, driverNet } from '@/core/pricing.js'
import { watchSearching, watchDriverRides, acceptRide, declineRide, updateRide, updateDriver, store, cancelRide, sos, claimQuest } from '@/core/api.js'

const ACTIVE = ['accepted', 'arrived', 'ongoing']
const RIDE_PREFS = [['ac', '❄️', 'كليماتيزور', 'A/C'], ['quiet', '🤫', 'كورسة هادية', 'Quiet ride'], ['bag', '🧳', 'شنطة كبيرة', 'Big luggage'], ['child', '👶', 'كرسي طفل', 'Child seat']]
const RIDER_NAMES = ['أمينة', 'محمد', 'سارة', 'ياسين', 'مريم', 'رياض', 'إيمان', 'وليد', 'خديجة', 'سفيان']
const CLASS_OK = { eco: ['eco', 'moto'], comfort: ['eco', 'comfort', 'moto'], family: ['eco', 'comfort', 'family', 'moto'], vip: ['eco', 'comfort', 'vip'], moto: ['moto'] }

export default function Home() {
  const { uid, driver, settings } = useApp()
  const nav = useNav()
  const mapRef = useRef(null)
  const panelRef = useRef(null)
  const city = CITIES.find((c) => c.id === driver.city) || CITIES[0]
  const [pos, setPos] = useState(driver.loc?.coords || null)
  const [heading, setHeading] = useState(0)
  const [requests, setRequests] = useState([])
  const [simReq, setSimReq] = useState(null)
  const [rides, setRides] = useState([])
  const [drawer, setDrawer] = useState(false)
  const prefs = useMapPrefs()
  const [brg, setBrg] = useState({ b: 0, p: 0 })
  const [panelH, setPanelH] = useState(140)
  const [now, setNow] = useState(Date.now())
  const [fltOpen, setFltOpen] = useState(false)
  const online = !!driver.online
  const me = pos || city.center

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { currentPosition().then((p) => { if (p) { setPos(p.coords); mapRef.current?.flyTo(p.coords, 15.5) } }) }, [])

  const ride = useMemo(() => rides.find((r) => ACTIVE.includes(r.status)) || rides.find((r) => r.status === 'completed' && !r.driverClosed && Date.now() - (r.completedAt || 0) < 3 * 3600e3) || null, [rides])
  const simDriving = ride?.simulated && ACTIVE.includes(ride.status)

  // تتبع الموقع الحقيقي (إلا أثناء رحلة محاكاة فالسيارة تتحرك تلقائيًا)
  useEffect(() => {
    let stop = () => {}
    watchPosition((p) => { if (!simRef.current) { setPos(p.coords); if (p.heading != null && !isNaN(p.heading)) setHeading(p.heading) } }).then((s) => (stop = s))
    return () => stop()
  }, [])
  const simRef = useRef(false)
  simRef.current = simDriving

  // نشر الموقع
  const lastPush = useRef(0)
  useEffect(() => {
    if (!online || !pos) return
    if (Date.now() - lastPush.current < 4000) return
    lastPush.current = Date.now()
    updateDriver(uid, { loc: { coords: pos, heading }, lastSeen: Date.now() }).catch(() => {})
    if (ride && ACTIVE.includes(ride.status) && !ride.simulated) updateRide(ride.id, { driverLoc: { coords: pos, heading } }).catch(() => {})
  }, [pos, online])
  useEffect(() => {
    if (!online) return
    const t = setInterval(() => updateDriver(uid, { lastSeen: Date.now() }).catch(() => {}), 60000)
    return () => clearInterval(t)
  }, [online])

  useEffect(() => watchDriverRides(uid, setRides), [uid])
  useEffect(() => watchSearching(setRequests), [])

  // طلبات حقيقية مناسبة
  const myClass = driver.vehicle?.class || 'eco'
  const flt = driver.filters || {}
  const incoming = useMemo(() => {
    if (!online || ride) return null
    const list = requests
      .filter((r) => !(r.declinedBy || []).includes(uid) && (CLASS_OK[myClass] || ['eco']).includes(r.classId) && haversine(me, r.pickup.coords) < (flt.maxKm || 25) && Date.now() - r.createdAt < 5 * 60000)
      // طلب سائقة امرأة يروح غير للسائقات
      .filter((r) => !r.womenOnly || driver.gender === 'f')
      // فلاتر السائق: أقل سومة وطريقة الدفع
      .filter((r) => (r.fare?.total || 0) >= (flt.minFare || 0) && (flt.pay !== 'prepaid' || r.payment !== 'cash') && (flt.pay !== 'cash' || r.payment === 'cash'))
      .sort((a, b) => haversine(me, a.pickup.coords) - haversine(me, b.pickup.coords))
    return list[0] || null
  }, [requests, online, !!ride, uid, Math.round(me[0] * 200), Math.round(me[1] * 200), JSON.stringify(flt), driver.gender])

  // طلبات محاكاة عند عدم وجود طلبات حقيقية
  useEffect(() => {
    if (!online || ride || incoming || simReq || !settings.fleetSimulation) return
    const t = setTimeout(async () => {
      const a = Math.random() * Math.PI * 2, d = 0.4 + Math.random() * 1.6
      const pu = offsetPoint(me, Math.cos(a) * d, Math.sin(a) * d)
      const b = Math.random() * Math.PI * 2, d2 = 2 + Math.random() * 6
      const dof = offsetPoint(pu, Math.cos(b) * d2, Math.sin(b) * d2)
      const [r, p1, p2] = await Promise.all([route([pu, dof]), reverse(pu), reverse(dof)])
      const cls = settings.pricing.classes.find((c) => c.id === (CLASS_OK[myClass] || ['eco'])[0]) || settings.pricing.classes[0]
      setSimReq({
        id: 'sim-' + Date.now(), simulated: true, createdAt: Date.now(), riderName: pick(RIDER_NAMES), riderRating: +(4.5 + Math.random() * 0.5).toFixed(1), riderPhone: '+2135' + Math.floor(1e7 + Math.random() * 9e7),
        pickup: { ...p1, coords: pu }, dropoff: { ...p2, coords: dof }, stops: [], route: { coords: r.coords, distanceKm: r.distanceKm, durationMin: r.durationMin },
        classId: cls.id, className: cls.ar, fare: quote(cls, r, settings.pricing), payment: Math.random() > 0.8 ? 'points' : 'cash', note: Math.random() > 0.7 ? 'راني قدام الباب الكبير' : '',
      })
    }, 9000 + Math.random() * 14000)
    return () => clearTimeout(t)
  }, [online, !!ride, !!incoming, !!simReq, settings.fleetSimulation])

  const request = incoming || simReq

  // تحريك سيارة المحاكاة على المسار
  useEffect(() => {
    if (!simDriving) return
    let coords, dur
    if (ride.status === 'accepted') { coords = ride.approach?.coords; dur = 22000 }
    else if (ride.status === 'ongoing') { coords = ride.route?.coords; dur = 35000 }
    else return
    if (!coords?.length) return
    const t0 = ride.phaseAt || Date.now()
    const t = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / dur)
      const pt = along(coords, k)
      if (pt) { setPos(pt.p); setHeading(pt.h) }
      if (k >= 1) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [simDriving, ride?.status, ride?.id])


  // مسار الوصول للراكب
  const [approach, setApproach] = useState(null)
  useEffect(() => {
    if (ride?.status !== 'accepted') { setApproach(null); return }
    if (ride.approach?.coords) setApproach(ride.approach)
    else route([pos || me, ride.pickup.coords]).then(setApproach)
  }, [ride?.id, ride?.status])

  // الإطار
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const t = setTimeout(() => {
      if (request && !ride) m.fit([me, request.pickup.coords, request.dropoff.coords], { bottom: 120, top: 380 })
      else if (ride?.status === 'accepted') m.fit([me, ride.pickup.coords], { bottom: panelH + 40, top: 110 })
      else if (ride?.status === 'ongoing') m.fit(ride.route?.coords || [ride.pickup.coords, ride.dropoff.coords], { bottom: panelH + 40, top: 110 })
      else if (ride?.status === 'arrived') m.flyTo(ride.pickup.coords, 16.5)
    }, 250)
    return () => clearTimeout(t)
  }, [request?.id, ride?.id, ride?.status])

  // أصوات: رسائل الزبون، إشعارات الإدارة، وإلغاء الزبون
  useChatAlerts(ride && ACTIVE.includes(ride.status) && !ride.simulated ? ride.id : null, 'driver', ride?.riderName)
  useBroadcastAlerts('drivers')
  const prevSt = useRef(null)
  useEffect(() => {
    const cur = rides[0]
    if (cur && prevSt.current && prevSt.current.id === cur.id && prevSt.current.status !== cur.status && cur.status === 'cancelled' && cur.cancelledBy !== 'driver') toast(tr('الزبون لغا الكورسة', 'The rider cancelled the trip'), 'error')
    prevSt.current = cur ? { id: cur.id, status: cur.status } : null
  }, [rides[0]?.id, rides[0]?.status])

  // ===== التحكم =====
  const toggleOnline = async () => {
    haptic('medium')
    if (online) {
      const add = driver.onlineSince ? Date.now() - driver.onlineSince : 0
      const day = new Date().toISOString().slice(0, 10)
      await updateDriver(uid, { online: false, onlineSince: null, onlineMs: driver.onlineDay === day ? (driver.onlineMs || 0) + add : add, onlineDay: day })
      setSimReq(null)
      toast(tr('راك ماشي متصل دروك', 'You are offline'))
    } else {
      const minB = settings.driverWallet?.minBalance ?? -1000
      if ((driver.wallet || 0) < minB) {
        toast(tr(`الرصيد تاعك تحت ${money(minB)}، اشحن البورتفاي باش تتكونيكتا`, `Balance below ${money(minB)} — top up to go online`), 'error')
        return nav.push('wallet')
      }
      const p = pos || (await currentPosition())?.coords || city.center
      await updateDriver(uid, { online: true, onlineSince: Date.now(), loc: { coords: p, heading }, lastSeen: Date.now() })
      toast(tr('راك متصل دروك، استنى الطلبات 🚀', 'You are online 🚀'), 'success')
    }
  }

  const accept = async () => {
    const req = request
    haptic('heavy')
    const d = { id: uid, name: driver.name, phone: driver.phone, photo: driver.photo || '', rating: rating(driver), car: `${driver.vehicle?.make || ''} ${driver.vehicle?.model || ''}`.trim(), color: driver.vehicle?.color || '', plate: driver.vehicle?.plate || '', simulated: false }
    if (req.simulated) {
      const ap = await route([pos || me, req.pickup.coords])
      const { id, ...rest } = req
      await store.add('rides', { ...rest, riderId: 'sim-rider', status: 'accepted', driverId: uid, driver: d, acceptedAt: Date.now(), updatedAt: Date.now(), phaseAt: Date.now(), approach: { coords: ap.coords, durationMin: ap.durationMin, distanceKm: ap.distanceKm }, declinedBy: [] })
      setSimReq(null)
    } else {
      const ok = await acceptRide(req.id, d)
      if (!ok) return toast(tr('شيفور آخر سبقك للطلب', 'Another driver took it'), 'error')
      updateRide(req.id, { driverLoc: { coords: pos || me, heading } }).catch(() => {})
    }
    toast(tr('الطلب تقبل، روح للزبون', 'Accepted — head to pickup'), 'success')
  }
  const decline = async () => {
    if (request.simulated) setSimReq(null)
    else await declineRide(request.id, uid)
    updateDriver(uid, { declined: store.inc(1) }).catch(() => {})
  }

  // ===== العلامات =====
  const markers = [{ id: 'me', type: 'car', coords: me, heading, size: 52, smooth: 1000 }]
  const routes = []
  if (request && !ride) {
    markers.push({ id: 'rp', type: 'pickup', coords: request.pickup.coords, label: request.pickup.title })
    markers.push({ id: 'rd', type: 'drop', coords: request.dropoff.coords, label: request.dropoff.title })
    if (request.route?.coords) routes.push({ id: 'req', coords: request.route.coords })
  }
  if (ride && ACTIVE.includes(ride.status)) {
    if (ride.status !== 'ongoing') markers.push({ id: 'pu', type: 'pickup', coords: ride.pickup.coords, label: ride.riderName })
    markers.push({ id: 'do', type: 'drop', coords: ride.dropoff.coords, label: ride.dropoff.title })
    if (ride.status === 'accepted' && approach) routes.push({ id: 'appr', coords: approach.coords, color: '#2E90FA', from: '#2E90FA', to: '#1d4ed8' })
    if (ride.status === 'ongoing' && ride.route?.coords) routes.push({ id: 'trip', coords: ride.route.coords })
  }

  // إحصاءات اليوم
  const day = new Date().toISOString().slice(0, 10)
  const todayRides = rides.filter((r) => r.status === 'completed' && new Date(r.completedAt || r.createdAt).toISOString().slice(0, 10) === day)
  const todayEarn = todayRides.reduce((s, r) => s + (r.driverNet ?? driverNet(r.fare?.total || 0, settings.pricing).net) + (r.tip || 0), 0)
  const onlineMs = (driver.onlineDay === day ? driver.onlineMs || 0 : 0) + (online && driver.onlineSince ? now - driver.onlineSince : 0)
  const hm = `${Math.floor(onlineMs / 3600000)}h ${Math.floor((onlineMs % 3600000) / 60000)}m`

  // نقاط الطلب المرتفع (تقديرية)
  const hot = useMemo(() => [0, 1, 2].map((i) => offsetPoint(city.center, Math.cos(i * 2.1) * 1.6, Math.sin(i * 2.1) * 1.6)), [city.id])

  return (
    <div className="home">
      <MapView ref={mapRef} center={me} zoom={15} markers={markers} routes={routes} mapType={prefs.mapType} pitch3d={prefs.pitch3d} onBearing={(b, p) => setBrg({ b, p })} padding={{ bottom: panelH, top: 70 }} onReady={(m) => {
        try {
          m.addSource('hot', { type: 'geojson', data: { type: 'FeatureCollection', features: hot.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } })) } })
          m.addLayer({ id: 'hot', type: 'circle', source: 'hot', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 30, 16, 180], 'circle-color': '#E8650A', 'circle-opacity': 0.12, 'circle-blur': 0.6 } })
        } catch {}
      }} />

      <div className="top-ctrls">
        <button className="icon-btn" onClick={() => setDrawer(true)}><Menu size={22} /></button>
        <button className={`online-toggle ${online ? 'on' : ''}`} onClick={toggleOnline} disabled={!!ride && ACTIVE.includes(ride.status)}>
          <span className="lbl">{online ? tr('متصل', 'Online') : tr('ماشي متصل', 'Offline')}</span>
          <span className="knob"><Zap size={20} fill="#fff" /></span>
        </button>
      </div>
      <MapControls prefs={prefs} bearing={brg.b} pitch={brg.p} onNorth={() => mapRef.current?.resetNorth()} bottom={panelH + 14} onLocate={async () => { const p = await currentPosition(); if (p) { setPos(p.coords); mapRef.current?.flyTo(p.coords, 16.5) } }} />

      {request && !ride && <RequestCard req={request} me={me} settings={settings} onAccept={accept} onDecline={decline} key={request.id} />}

      <DragPanel key={ride ? ride.id + ride.status : 'idle'} resetKey={ride?.status} peek={ride ? 150 : 120} onVisible={setPanelH}>
        {!ride && (
          <div className="rise">
            {!online && (
              <button className="go-btn" onClick={toggleOnline}>
                <span className="go-ring"><Zap size={26} fill="#fff" /></span>
                <span><b>{tr('ابدا الخدمة دروك', 'Go online')}</b><small>{tr('تكونيكتا باش تبدا تستقبل الطلبات', 'Start receiving requests')}</small></span>
              </button>
            )}
            {online && (
              <div className="center" style={{ marginBottom: 12 }}>
                <div className="flex" style={{ justifyContent: 'center', fontWeight: 600 }}><span className="pulse-dot" />{tr('نستناو الطلبات القريبة…', 'Looking for requests…')}</div>
                <div className="tiny muted">{tr('ابقى قريب من البلايص البرتقاليين باش تجيك طلبات أكثر', 'Stay near orange zones for more requests')}</div>
              </div>
            )}
            {(driver.wallet || 0) < (settings.driverWallet?.minBalance ?? -1000) && (
              <button className="low-bal" onClick={() => nav.push('topup')}><AlertTriangle size={20} /><span className="grow"><b>{tr('اشحن البورتفاي باش تخدم', 'Top up to go online')}</b><small>{tr('رصيدك', 'Balance')} <span className="num">{money(driver.wallet || 0)}</span></small></span><ChevronLeft size={18} /></button>
            )}
            {settings.quests?.enabled !== false && <Quests list={settings.quests?.list || []} trips={todayRides.length} done={driver.questsDone || []} day={day} uid={uid} />}
            <button className="flt-btn" onClick={() => setFltOpen(true)}><SlidersHorizontal size={16} />{tr('فلتر الطلبات', 'Request filters')}{(flt.maxKm || flt.minFare || (flt.pay && flt.pay !== 'all')) && <span className="badge">{tr('مفعّل', 'On')}</span>}</button>
            <div className="stats-bar">
              <div><small>{tr('الوقت متصل', 'Online time')}</small><b className="num">{hm}</b></div>
              <div><small>{tr('الدخل اليوم', 'Earned today')}</small><b className="num">{money(todayEarn)}</b></div>
              <div><small>{tr('الكورسات الكاملين', 'Trips')}</small><b className="num">{todayRides.length}</b></div>
            </div>
          </div>
        )}
        {ride && ACTIVE.includes(ride.status) && <ActiveRide ride={ride} me={me} approach={approach} nav={nav} uid={uid} driver={driver} settings={settings} />}
        {ride && ride.status === 'completed' && <Collect ride={ride} uid={uid} settings={settings} />}
      </DragPanel>

      <FiltersSheet open={fltOpen} onClose={() => setFltOpen(false)} value={flt} onSave={(v) => { updateDriver(uid, { filters: v }); setFltOpen(false); toast(tr('الفلتر تسجّل ✓', 'Filters saved ✓'), 'success') }} />
      <DriverDrawer open={drawer} onClose={() => setDrawer(false)} driver={driver} nav={nav} online={online} settings={settings} />
    </div>
  )
}
// تحديات اليوم: كل ما توصل لعدد كورسات تاخذ مكافأة في البورتفاي
function Quests({ list, trips, done, day, uid }) {
  useEffect(() => {
    list.forEach((q, i) => { if (trips >= q.trips && !done.includes(`${day}:${i}`)) claimQuest(uid, day, i, q.bonus, q.trips).then((ok) => ok && toast(tr(`🏆 ربحت ${money(q.bonus)} مكافأة!`, `🏆 You earned a ${money(q.bonus)} bonus!`), 'success', null, 3500, 'coin')) })
  }, [trips, list.length])
  if (!list.length) return null
  const next = list.findIndex((q, i) => !done.includes(`${day}:${i}`) && trips < q.trips)
  const q = list[next === -1 ? list.length - 1 : next]
  const pct = Math.min(100, (trips / q.trips) * 100)
  return (
    <div className="quest">
      <div className="between"><b className="small"><Trophy size={16} color="#F4B740" /> {tr('تحدي اليوم', "Today's challenge")}</b><span className="tiny muted num">{Math.min(trips, q.trips)}/{q.trips}</span></div>
      <div className="small" style={{ margin: '4px 0 8px' }}>{next === -1 ? tr('كمّلت كل التحديات اليوم 🎉', 'All challenges completed 🎉') : tr(`كمّل ${q.trips - trips} كورسات وتاخذ `, `${q.trips - trips} more trips to earn `)}{next !== -1 && <b className="num" style={{ color: 'var(--brand)' }}>{money(q.bonus)}</b>}</div>
      <div className="q-bar"><i style={{ width: pct + '%' }} /></div>
      <div className="q-steps">{list.map((x, i) => <span key={i} className={done.includes(`${day}:${i}`) ? 'ok' : ''}><b className="num">{x.trips}</b><small className="num">+{x.bonus}</small></span>)}</div>
    </div>
  )
}

function FiltersSheet({ open, onClose, value, onSave }) {
  const [f, setF] = useState(value)
  useEffect(() => { if (open) setF(value) }, [open])
  return (
    <Sheet open={open} onClose={onClose} title={tr('فلتر الطلبات', 'Request filters')} sub={tr('تجيك غير الطلبات اللي تناسبك', 'Only receive requests that suit you')}>
      <div className="field"><label>{tr('أقصى مسافة للزبون', 'Max pickup distance')}: <b className="num">{f.maxKm || 25} {tr('كم', 'km')}</b></label><input type="range" className="range" min="1" max="25" value={f.maxKm || 25} onChange={(e) => setF({ ...f, maxKm: +e.target.value })} /></div>
      <div className="field"><label>{tr('أقل سومة للكورسة', 'Minimum fare')}: <b className="num">{money(f.minFare || 0)}</b></label><input type="range" className="range" min="0" max="1000" step="50" value={f.minFare || 0} onChange={(e) => setF({ ...f, minFare: +e.target.value })} /></div>
      <div className="field"><label>{tr('طريقة الدفع', 'Payment')}</label>
        <div className="seg-btns">{[['all', tr('الكل', 'All')], ['cash', tr('كاش برك', 'Cash only')], ['prepaid', tr('مخلّصة برك', 'Prepaid only')]].map(([k, l]) => <button key={k} className={(f.pay || 'all') === k ? 'active' : ''} onClick={() => setF({ ...f, pay: k })}>{l}</button>)}</div>
      </div>
      <div className="flex mt" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => onSave({})}>{tr('نحّي الفلتر', 'Reset')}</button>
        <button className="btn btn-primary grow" onClick={() => onSave(f)}>{tr('حفظ', 'Save')}</button>
      </div>
    </Sheet>
  )
}

export const rating = (d) => (d.ratingCount ? Math.round(((d.ratingSum || 0) + 5) / (d.ratingCount + 1) * 10) / 10 : d.rating || 5)

// ===== بطاقة الطلب الوارد =====
function RequestCard({ req, me, settings, onAccept, onDecline }) {
  const T = 20
  const [left, setLeft] = useState(T)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    haptic('heavy')
    play('request')
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); onDecline(); return 0 } return l - 1 }), 1000)
    return () => clearInterval(t)
  }, [])
  const dist = haversine(me, req.pickup.coords)
  const { net } = driverNet(req.fare.total, settings.pricing)
  const C = 2 * Math.PI * 26
  return (
    <div className="req-card pop">
      <div className="between">
        <div className="flex">
          <span className="badge" style={{ background: 'var(--brand)', color: '#fff' }}><ClassCar type={req.classId} w={26} />{req.className}</span>
          {req.offer && <span className="badge" style={{ background: '#FEF0C7', color: '#93370D' }}>{tr('سومة مقترحة', 'Offer')}</span>}
          {req.student && <span className="badge" style={{ background: '#EEF4FF', color: '#3538CD' }}>🎓</span>}
          {req.payment !== 'cash' && <span className="badge green">{req.payment === 'points' ? tr('مدفوعة بالنقاط', 'Points') : tr('محفظة', 'Wallet')}</span>}
        </div>
        <div className="req-timer">
          <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="none" stroke="var(--line)" strokeWidth="5" /><circle cx="30" cy="30" r="26" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / T)} style={{ transition: 'stroke-dashoffset 1s linear' }} /></svg>
          <b className="num">{left}</b>
        </div>
      </div>
      <div className="req-fare"><b className="num">{money(req.fare.total)}</b><small>{tr('الصافي تاعك', 'Your net')} <span className="num">{money(net)}</span></small></div>
      <div className="grid3" style={{ margin: '10px 0' }}>
        <div className="mini"><Navigation size={15} /><b className="num">{km(dist)}</b><small>{tr('للزبون', 'to pickup')}</small></div>
        <div className="mini"><RouteIco size={15} /><b className="num">{km(req.route?.distanceKm || 0)}</b><small>{tr('الكورسة', 'trip')}</small></div>
        <div className="mini"><Clock size={15} /><b className="num">{mins(req.route?.durationMin || 0)}</b><small>{tr('المدة', 'time')}</small></div>
      </div>
      <RouteSummary ride={req} compact />
      <div className="flex small" style={{ marginTop: 10 }}><Avatar name={req.riderName} size={30} /><b>{req.riderName}</b><Star size={13} fill="var(--gold)" color="var(--gold)" /><span className="num">{req.riderRating || 5}</span></div>
      {req.prefs?.length > 0 && <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{req.prefs.map((k) => { const x = RIDE_PREFS.find((p) => p[0] === k); return x ? <span key={k} className="badge gray">{x[1]} {tr(x[2], x[3])}</span> : null })}</div>}
      {req.forOther && <div className="small" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12, background: 'var(--info-bg, #EFF8FF)' }}>👤 {tr('الراكب', 'Passenger')}: <b>{req.forOther.name}</b> <span className="num">{req.forOther.phone}</span></div>}
      {req.note && <div className="small" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12, background: 'var(--warning-bg)' }}>📝 {req.note}</div>}
      <div className="flex mt">
        <button className="btn btn-ghost" onClick={onDecline}><X size={20} /></button>
        <button className="btn btn-success grow btn-lg" disabled={busy} onClick={async () => { setBusy(true); await onAccept(); setBusy(false) }}>{busy ? <span className="spinner" /> : tr('اقبل الطلب', 'Accept')}</button>
      </div>
    </div>
  )
}

// ===== الرحلة الجارية =====
function ActiveRide({ ride, me, approach, nav, uid, driver, settings }) {
  const [cancel, setCancel] = useState(false)
  const [sosOpen, setSos] = useState(false)
  const [wait, setWait] = useState(0)
  useEffect(() => {
    if (ride.status !== 'arrived') return
    const t = setInterval(() => setWait(Math.floor((Date.now() - (ride.arrivedAt || Date.now())) / 1000)), 1000)
    return () => clearInterval(t)
  }, [ride.status])
  const target = ride.status === 'ongoing' ? ride.dropoff : ride.pickup
  const dist = haversine(me, target.coords)
  const step = {
    accepted: { t: tr('روح للزبون', 'Head to pickup'), btn: tr('وصلت للزبون', 'I have arrived'), next: { status: 'arrived', arrivedAt: Date.now(), phaseAt: Date.now() }, color: 'btn-primary' },
    arrived: { t: tr('نستنى الزبون', 'Waiting for rider'), btn: tr('ابدا الكورسة', 'Start trip'), next: { status: 'ongoing', startedAt: Date.now(), phaseAt: Date.now() }, color: 'btn-success' },
    ongoing: { t: tr('رايح للبلاصة', 'Driving to destination'), btn: tr('كمّل الكورسة', 'Complete trip'), next: null, color: 'btn-dark' },
  }[ride.status]
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState('')
  const advance = async (force) => {
    haptic('medium')
    if (ride.status === 'arrived' && ride.pin && force !== true) { setPin(''); setPinOpen(true); return }
    if (ride.status === 'ongoing') {
      const { net, commission } = driverNet(ride.fare.total, settings.pricing)
      await updateRide(ride.id, { status: 'completed', completedAt: Date.now(), driverNet: net, commission, driverLoc: { coords: ride.dropoff.coords, heading: 0 } })
      const cash = ride.payment === 'cash'
      await updateDriver(uid, { trips: store.inc(1), earnings: store.inc(net + (ride.tip || 0)), wallet: store.inc(cash ? -commission : net) })
    } else {
      await updateRide(ride.id, { ...step.next, arrivedAt: ride.status === 'accepted' ? Date.now() : ride.arrivedAt, startedAt: ride.status === 'arrived' ? Date.now() : ride.startedAt, phaseAt: Date.now() })
      if (ride.simulated && ride.status === 'accepted') toast(tr('الزبون عرف بلي وصلت', 'Rider notified'))
    }
  }
  return (
    <div className="rise">
      <div className="status-strip" style={ride.status === 'arrived' ? { background: 'var(--success-bg)', color: 'var(--success)' } : null}>
        {ride.status === 'ongoing' ? <Flag size={18} /> : <MapPin size={18} />}
        <span className="grow">{step.t}</span>
        {ride.status === 'arrived' ? <span className="num">{Math.floor(wait / 60)}:{String(wait % 60).padStart(2, '0')}</span> : <span className="num">{km(dist)}</span>}
      </div>
      <div className="driver-card">
        <Avatar name={ride.riderName} size={52} />
        <div className="dc-main">
          <b>{ride.riderName}</b>
          <div className="small muted flex" style={{ gap: 4 }}><Star size={13} fill="var(--gold)" color="var(--gold)" /><span className="num">{ride.riderRating || 5}</span> • {ride.className}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <b className="num" style={{ fontSize: 20 }}>{money(ride.fare.total)}</b>
          <div className="tiny muted">{ride.payment === 'cash' ? tr('كاش', 'Cash') : tr('مدفوعة', 'Prepaid')}</div>
        </div>
      </div>
      <div className="place-row" style={{ marginTop: 8 }}>
        <span className="pi" style={{ background: ride.status === 'ongoing' ? 'var(--card-2)' : 'var(--success-bg)', color: ride.status === 'ongoing' ? 'var(--ink)' : 'var(--success)' }}>{ride.status === 'ongoing' ? <Flag size={18} /> : <MapPin size={18} />}</span>
        <span className="pt"><b>{target.title}</b><small>{target.subtitle}</small></span>
        <a className="icon-btn sm" style={{ background: 'var(--info)', color: '#fff' }} href={mapsLink(target.coords)} target="_blank" rel="noreferrer"><Navigation size={18} /></a>
      </div>
      {ride.note && <div className="small" style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--warning-bg)', marginTop: 6 }}>📝 {ride.note}</div>}
      <div className="actions4">
        <a href={`tel:${ride.riderPhone}`} style={{ color: 'inherit' }}><button style={{ width: '100%' }}><Phone size={20} />{tr('عيّط', 'Call')}</button></a>
        <button onClick={() => nav.push('chat', { rideId: ride.id, me: 'driver' })}><MessageCircle size={20} />{tr('دردشة', 'Chat')}</button>
        <a href={mapsLink(target.coords)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}><button style={{ width: '100%' }}><MapIco size={20} />{tr('GPS', 'Navigate')}</button></a>
        <button className="red" onClick={() => setSos(true)}><ShieldAlert size={20} />{tr('طوارئ', 'SOS')}</button>
      </div>
      {ride.forOther && <div className="small" style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--info-bg, #EFF8FF)', marginTop: 6 }}>👤 {tr('الراكب', 'Passenger')}: <b>{ride.forOther.name}</b> • <a className="num" href={`tel:${ride.forOther.phone}`}>{ride.forOther.phone}</a></div>}
      <button className={`btn ${step.color} btn-block btn-lg mt`} onClick={advance}>{ride.status === 'arrived' && ride.pin ? <><KeyRound size={19} />{tr('دخّل الكود وابدا', 'Enter PIN & start')}</> : step.btn}</button>
      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title={tr('كود الكورسة', 'Trip PIN')} sub={tr('طلب من الزبون الكود اللي ظاهر عندو في التطبيق', 'Ask the rider for the 4-digit PIN')}>
        <input className="input num" autoFocus inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ textAlign: 'center', letterSpacing: 14, fontSize: 30, fontWeight: 800, height: 68, marginTop: 6, direction: 'ltr' }} placeholder="••••" />
        {ride.simulated && <div className="tiny muted center mt">{tr('تجريبي: الكود هو', 'Demo PIN')} <b className="num">{ride.pin}</b></div>}
        <button className="btn btn-success btn-block btn-lg mt" disabled={pin.length !== 4} onClick={() => { if (pin === ride.pin) { setPinOpen(false); advance(true) } else { haptic('heavy'); toast(tr('الكود غالط', 'Wrong PIN'), 'error'); setPin('') } }}>{tr('ابدا الكورسة', 'Start trip')}</button>
      </Sheet>
      {ride.status !== 'ongoing' && <button className="btn btn-block muted" style={{ '--h': '42px', marginTop: 6 }} onClick={() => setCancel(true)}>{tr('ألغي الكورسة', 'Cancel ride')}</button>}
      <Sheet open={cancel} onClose={() => setCancel(false)} title={tr('تلغي الكورسة؟', 'Cancel ride?')} sub={tr('الإلغاء بزاف ينقّص من التقييم تاعك ومن الطلبات', 'Frequent cancellations affect your rating')}>
        <div className="col" style={{ gap: 8 }}>
          {['الراكب لم يحضر', 'الموقع بعيد جدًا', 'مشكلة في السيارة', 'سبب آخر'].map((r) => (
            <button key={r} className="chip" style={{ height: 46 }} onClick={async () => { await cancelRide(ride.id, 'driver', r); updateDriver(uid, { cancelled: store.inc(1) }).catch(() => {}); setCancel(false); toast(tr('تلغات', 'Cancelled')) }}>{r}</button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sosOpen} onClose={() => setSos(false)} title={tr('طلب مساعدة', 'Get help')}>
        <div className="col">
          <a className="btn btn-block" style={{ background: 'var(--danger)', color: '#fff' }} href="tel:17">{tr('عيّط للشرطة 17', 'Call police 17')}</a>
          <button className="btn btn-ghost btn-block" onClick={async () => { await sos({ uid, rideId: ride.id, name: driver.name, phone: driver.phone, loc: me, kind: 'driver' }); setSos(false); toast(tr('فريق الأمان تخبّر', 'Safety team alerted'), 'success') }}>{tr('خبّر فريق وصلني', 'Alert Wasalni')}</button>
        </div>
      </Sheet>
    </div>
  )
}

// ===== التحصيل والتقييم =====
function Collect({ ride, uid, settings }) {
  const [stars, setStars] = useState(5)
  const cash = ride.payment === 'cash'
  const { net, commission } = driverNet(ride.fare.total, settings.pricing)
  const done = async () => {
    await updateRide(ride.id, { driverClosed: true, ratingByDriver: stars })
    if (!ride.simulated && ride.riderId) store.set(`users/${ride.riderId}`, { ratingSum: store.inc(stars), ratingCount: store.inc(1) }, true).catch(() => {})
    toast(tr('صحيت! كورسة مليحة 💪', 'Great job! 💪'), 'success')
  }
  return (
    <div className="rise center">
      <div className="pop" style={{ width: 70, height: 70, borderRadius: 24, margin: '0 auto 10px', display: 'grid', placeItems: 'center', background: cash ? 'var(--success-bg)' : 'var(--info-bg)', color: cash ? 'var(--success)' : 'var(--info)' }}>{cash ? <Banknote size={36} /> : <Wallet size={36} />}</div>
      <div className="small muted">{cash ? tr('خوذ الدراهم كاش من الزبون', 'Collect cash from rider') : tr('الكورسة مخلّصة إلكترونيًا', 'Trip is prepaid')}</div>
      <div style={{ fontSize: 40, fontWeight: 800 }} className="num brand-text">{money(ride.fare.total + (ride.tip || 0))}</div>
      <div className="grid3 card" style={{ margin: '12px 0', boxShadow: 'none', background: 'var(--card-2)' }}>
        <div className="stat"><b className="num">{money(net)}</b><small>{tr('الصافي تاعك', 'Net')}</small></div>
        <div className="stat"><b className="num">{money(commission)}</b><small>{tr('عمولة', 'Commission')} {settings.pricing.commission}%</small></div>
        <div className="stat"><b className="num">{money(ride.tip || 0)}</b><small>{tr('بوربوار', 'Tip')}</small></div>
      </div>
      <div className="small muted">{tr(`كيف كان ${ride.riderName}؟`, `Rate ${ride.riderName}`)}</div>
      <div style={{ margin: '8px 0 14px' }}><Stars value={stars} size={34} onChange={setStars} /></div>
      <button className="btn btn-primary btn-block btn-lg" onClick={done}><Check size={20} />{cash ? tr('خذيت الدراهم', 'Cash collected') : tr('تم', 'Done')}</button>
    </div>
  )
}

function DriverDrawer({ open, onClose, driver, nav, online, settings }) {
  const go = (p) => { onClose(); setTimeout(() => nav.push(p), 60) }
  return (
    <Drawer open={open} onClose={onClose}
      head={
        <button className="flex" style={{ position: 'relative', zIndex: 1, color: '#fff', textAlign: 'start', width: '100%' }} onClick={() => go('profile')}>
          <Avatar name={driver.name} src={driver.photo} size={62} style={{ border: '3px solid rgba(255,255,255,.5)' }} />
          <div className="grow">
            <div style={{ fontSize: 18, fontWeight: 600 }}>{driver.name}</div>
            <div className="small" style={{ opacity: 0.9 }}>{tr('رصيد البورتفاي:', 'Wallet:')} <span className="num">{money(driver.wallet || 0)}</span></div>
            <div className="flex tiny" style={{ marginTop: 6, gap: 6 }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}><Star size={11} fill="#fff" /><span className="num">{rating(driver)}</span></span>
              <span className="badge" style={{ background: online ? 'var(--success)' : 'rgba(255,255,255,.2)', color: '#fff' }}>{online ? tr('متصل', 'Online') : tr('ماشي متصل', 'Offline')}</span>
            </div>
          </div>
        </button>
      }
      foot={<div className="tiny muted center" style={{ padding: '10px 0 calc(var(--safe-b) + 12px)' }}>Wasalni Captain v1.0</div>}
    >
      <DrawerItem icon={<MapIco size={19} />} color="#14b8a6" label={tr('الكورسات', 'Trips')} onClick={() => go('trips')} />
      <DrawerItem icon={<CalendarClock size={19} />} color="#475569" label={tr('كورسات محجوزة ولا مبرمجة', 'Scheduled rides')} onClick={() => go('scheduled')} />
      <DrawerItem icon={<Wallet size={19} />} color="#a16207" label={tr('البورتفاي', 'Wallet')} onClick={() => go('wallet')} />
      <DrawerItem icon={<BadgeDollarSign size={19} />} color="#16a34a" label={tr('المدخول', 'Earnings')} onClick={() => go('earnings')} />
      {settings?.features?.bus !== false && <DrawerItem icon={<BusIcon size={19} />} color="#2E90FA" label={tr('وضع سائق الحافلة', 'Bus driver mode')} onClick={() => go('busmode')} />}
      <DrawerItem icon={<Gift size={19} />} color="#ef4444" label={tr('عرّض الشيفورات', 'Invite drivers')} onClick={() => go('invite')} />
      <DrawerItem icon={<Users size={19} />} color="#475569" label={tr('الإحالات تاعي', 'My referrals')} onClick={() => go('referrals')} />
      <DrawerItem icon={<Bell size={19} />} color="#a855f7" label={tr('الإشعارات', 'Notifications')} onClick={() => go('notifications')} />
      <DrawerItem icon={<Phone size={19} />} color="#22c55e" label={tr('اطلب المساعدة', 'Get help')} onClick={() => go('support')} />
      <DrawerItem icon={<Info size={19} />} color="#3b82f6" label={tr('الدعم', 'Support')} onClick={() => go('support')} />
    </Drawer>
  )
}

