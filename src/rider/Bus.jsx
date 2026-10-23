// تتبّع الحافلات: خريطة كاملة فيها الخطوط والمحطات والحافلات، أقرب محطة ليك، ووقت وصول كل حافلة —
// باش تخرج تمشي للمحطة في الوقت وتركب مباشرة.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bus as BusIco, Footprints, Clock, MapPin, Navigation, Crosshair, Info, Radio, ChevronLeft } from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import DragPanel from '@/ui/DragPanel.jsx'
import { useNav, Empty } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { tr, isAr, haversine } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { currentPosition, walkRoute } from '@/core/geo.js'
import MapControls, { useMapPrefs } from '@/map/MapControls.jsx'
import { measure, project, pointAt, simBuses, etaTo, walkMin, linePath, watchLines, watchLiveBuses, demoLines, inService } from '@/core/bus.js'

const fmt = (m) => (m < 1 ? tr('توصل دروك', 'Arriving') : `${Math.round(m)} ${tr('د', 'min')}`)

export default function BusPage() {
  const nav = useNav()
  const { user, settings } = useApp()
  const cfg = settings.bus || {}
  const city = CITIES.find((c) => c.id === user?.city) || CITIES[0]
  const mapRef = useRef(null)
  const [me, setMe] = useState(null)
  const [rawLines, setRawLines] = useState(null)
  const [paths, setPaths] = useState({})
  const [live, setLive] = useState([])
  const [sel, setSel] = useState('all') // خط محدد
  const [stopSel, setStopSel] = useState(null) // {line, i}
  const [busSel, setBusSel] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [panelH, setPanelH] = useState(300)
  const prefs = useMapPrefs()
  const [brg, setBrg] = useState({ b: 0, p: 0 })
  const [walkPath, setWalkPath] = useState(null)

  useEffect(() => watchLines(setRawLines), [])
  useEffect(() => watchLiveBuses(setLive), [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(t) }, [])
  useEffect(() => { currentPosition().then((p) => p && setMe(p.coords)) }, [])

  // الخطوط: من لوحة التحكم، وإلا خطوط تجريبية (إذا مفعّلة)
  const lines = useMemo(() => {
    const own = (rawLines || []).filter((l) => !l.city || l.city === city.id)
    if (own.length || cfg.demo === false) return own
    return city.id === 'sba' ? demoLines(city.center) : []
  }, [rawLines, city.id, cfg.demo])

  // المسارات على الطرقات الحقيقية
  useEffect(() => {
    let off = false
    lines.forEach((l) => { if (!paths[l.id]) linePath(l).then((p) => { if (!off && p?.length > 1) setPaths((x) => ({ ...x, [l.id]: p })) }) })
    return () => { off = true }
  }, [lines.map((l) => l.id + (l.updatedAt || '')).join()])
  const meas = useMemo(() => Object.fromEntries(lines.filter((l) => paths[l.id]).map((l) => [l.id, measure(paths[l.id])])), [paths, lines])

  // الحافلات: الحقيقية أولًا، والمحاكاة للخطوط اللي ما فيهاش حافلات حقيقية (حسب إعداد الخط)
  const buses = useMemo(() => {
    const out = []
    for (const l of lines) {
      const m = meas[l.id]
      if (!m) continue
      const real = live.filter((b) => b.line === l.id).map((b) => {
        const pr = project(m, b.coords)
        return { ...b, id: 'live-' + b.uid, d: b.d ?? pr.d, dir: b.dir || 1, live: true }
      })
      const mode = l.mode || 'auto'
      out.push(...real)
      if (mode === 'sim' || (mode === 'auto' && !real.length && cfg.simulate !== false)) out.push(...simBuses(l, m, now))
    }
    return out
  }, [lines, meas, live, now, cfg.simulate])

  // كل المحطات + أقرب محطة لي
  const stops = useMemo(() => lines.flatMap((l) => (l.stops || []).map((s, i) => ({ ...s, line: l, i, d: meas[l.id] ? project(meas[l.id], s.coords).d : 0 }))), [lines, meas])
  const here = me || city.center
  const visibleStops = stops.filter((s) => sel === 'all' || s.line.id === sel)
  const nearest = useMemo(() => [...visibleStops].sort((a, b) => haversine(here, a.coords) - haversine(here, b.coords))[0] || null, [visibleStops, here[0], here[1]])
  const focus = stopSel ? stops.find((s) => s.line.id === stopSel.line && s.i === stopSel.i) : nearest

  // الحافلات الجاية للمحطة المختارة (كل الخطوط اللي تفوت عليها نفس البلاصة تقريبًا)
  const arrivals = useMemo(() => {
    if (!focus) return []
    const sameStops = stops.filter((s) => haversine(s.coords, focus.coords) < 0.12)
    const out = []
    for (const s of sameStops) {
      const m = meas[s.line.id]
      if (!m) continue
      for (const b of buses.filter((x) => x.line === s.line.id)) {
        const e = etaTo(b, s.d, m, s.line)
        const last = s.line.stops?.[e.dir >= 0 ? s.line.stops.length - 1 : 0]
        out.push({ bus: b, line: s.line, min: e.min, toward: last?.name })
      }
    }
    return out.sort((a, b) => a.min - b.min).slice(0, 8)
  }, [focus?.coords?.join(), buses, meas])
  const walk0 = focus ? walkMin(here, focus.coords) : 0
  // مسار المشي الحقيقي على الطرقات (مع المنعطفات) من بلاصتي للمحطة
  const wkKey = focus && me ? `${me[0].toFixed(4)},${me[1].toFixed(4)}>${focus.coords.join()}` : ''
  useEffect(() => {
    if (!wkKey) { setWalkPath(null); return }
    let off = false
    setWalkPath(null)
    walkRoute(me, focus.coords).then((r) => { if (!off) setWalkPath(r) })
    return () => { off = true }
  }, [wkKey])
  const walk = walkPath?.real ? walkPath.durationMin : walk0

  // تحريك الخريطة لأقرب محطة أول مرة
  const did = useRef(false)
  useEffect(() => {
    if (did.current || !nearest) return
    did.current = true
    setTimeout(() => mapRef.current?.fit([here, nearest.coords], { bottom: panelH + 40, top: 130 }), 400)
  }, [!!nearest])

  const markers = []
  if (me) markers.push({ id: 'me', type: 'me', coords: me })
  for (const s of visibleStops) markers.push({ id: `st-${s.line.id}-${s.i}`, type: 'busstop', coords: s.coords, color: s.line.color, near: focus && s.line.id === focus.line.id && s.i === focus.i, label: focus && s.line.id === focus.line.id && s.i === focus.i ? s.name : undefined, onClick: () => { setStopSel({ line: s.line.id, i: s.i }); setBusSel(null) } })
  for (const b of buses.filter((x) => sel === 'all' || x.line === sel)) {
    const l = lines.find((x) => x.id === b.line)
    markers.push({ id: b.id, type: 'bus', coords: b.coords, label: l?.number, color: l?.color, live: b.live, smooth: 1900, onClick: () => setBusSel(b.id) })
  }
  const routes = lines.filter((l) => meas[l.id] && (sel === 'all' || l.id === sel)).map((l) => ({ id: 'ln-' + l.id, coords: meas[l.id].path, color: l.color, from: l.color, to: l.color, width: sel === l.id ? 6 : 4, flow: false, casing: '#ffffff' }))
  if (focus && me && walk < 40 && walkPath?.real && walkPath.coords.length > 1) routes.push({ id: 'walk', coords: walkPath.coords, dashed: true, color: '#2E90FA' })

  const selBus = busSel && buses.find((b) => b.id === busSel)
  const selBusLine = selBus && lines.find((l) => l.id === selBus.line)
  const selBusEta = selBus && focus && focus.line.id === selBus.line && meas[selBus.line] ? etaTo(selBus, focus.d, meas[selBus.line], selBusLine).min : null

  return (
    <div className="home bus-page">
      <MapView ref={mapRef} center={here} zoom={14} markers={markers} routes={routes} padding={{ bottom: panelH, top: 120 }} mapType={prefs.mapType} pitch3d={prefs.pitch3d} onBearing={(b, p) => setBrg({ b, p })} />
      <MapControls prefs={prefs} bearing={brg.b} pitch={brg.p} onNorth={() => mapRef.current?.resetNorth()} bottom={panelH + 14} onLocate={async () => { const p = await currentPosition(); if (p) { setMe(p.coords); setStopSel(null); mapRef.current?.flyTo(p.coords, 16) } }} />
      <div className="bus-top">
        <div className="flex" style={{ gap: 10 }}>
          <button className="icon-btn" onClick={nav.back} aria-label="back"><ArrowLeft size={20} style={{ transform: isAr ? 'scaleX(-1)' : '' }} /></button>
          <div className="bus-title"><b>{tr('تتبّع الحافلات', 'Bus tracker')}</b><small>{isAr ? city.ar : city.en} • {buses.length} {tr('حافلة في الطريق', 'buses running')}</small></div>
          <button className="icon-btn" onClick={async () => { const p = await currentPosition(); if (p) { setMe(p.coords); setStopSel(null); mapRef.current?.flyTo(p.coords, 15.5) } }} aria-label="locate"><Crosshair size={20} /></button>
        </div>
        {lines.length > 0 && (
          <div className="hscroll line-chips">
            <button className={`chip ${sel === 'all' ? 'brand' : ''}`} onClick={() => setSel('all')}>{tr('كل الخطوط', 'All lines')}</button>
            {lines.map((l) => <button key={l.id} className={`chip line-chip ${sel === l.id ? 'on' : ''}`} style={{ '--lc': l.color }} onClick={() => { setSel(l.id); setStopSel(null); setBusSel(null); if (meas[l.id]) mapRef.current?.fit(meas[l.id].path, { bottom: panelH + 30, top: 140 }) }}><b>{l.number}</b>{l.name}</button>)}
          </div>
        )}
      </div>

      <DragPanel peek={170} onVisible={setPanelH}>
        {rawLines !== null && lines.length === 0 ? (
          <Empty icon={<BusIco size={36} />} title={tr('ما كاين حتى خط حافلات في ولايتك دروك', 'No bus lines in your city yet')} sub={tr('راح نزيدو الخطوط قريب إن شاء الله', 'Coming soon')} />
        ) : selBus ? (
          <div className="rise">
            <button className="flex small muted" onClick={() => setBusSel(null)} style={{ marginBottom: 8 }}><ChevronLeft size={16} style={{ transform: isAr ? '' : 'scaleX(-1)' }} />{tr('رجوع', 'Back')}</button>
            <div className="flex" style={{ gap: 12 }}>
              <span className="line-badge lg" style={{ '--lc': selBusLine?.color }}>{selBusLine?.number}</span>
              <div className="grow"><b>{selBusLine?.name}</b><div className="tiny muted">{selBus.live ? <><Radio size={12} color="var(--success)" /> {tr('موقع مباشر من الحافلة', 'Live GPS')}</> : tr('موقع تقديري حسب جدول الخط', 'Estimated from schedule')}</div></div>
            </div>
            {selBusEta != null && <div className="eta-card mt"><Clock size={20} /><span className="grow">{tr(`توصل لمحطة "${focus.name}" في`, `Reaches "${focus.name}" in`)}</span><b className="num">{fmt(selBusEta)}</b></div>}
          </div>
        ) : focus ? (
          <div className="rise">
            <div className="stop-head">
              <span className="stop-ico">🚏</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <small className="muted">{stopSel ? tr('المحطة المختارة', 'Selected stop') : tr('أقرب محطة ليك', 'Nearest stop')}</small>
                <b>{focus.name}</b>
              </div>
              <div className="walk"><Footprints size={16} /><b className="num">{Math.max(1, Math.round(walk))}</b><small>{tr('د مشي', 'min walk')}</small>{walkPath?.real && <small className="num" style={{ opacity: .75 }}>{walkPath.distanceKm < 1 ? `${Math.round(walkPath.distanceKm * 1000)} م` : `${walkPath.distanceKm.toFixed(1)} كم`}</small>}</div>
            </div>
            <div className="section-title" style={{ marginTop: 12 }}>{tr('الحافلات الجاية', 'Next buses')}</div>
            {arrivals.length === 0 && <div className="small muted center" style={{ padding: 14 }}>{lines.every((l) => !inService(l)) ? tr('الحافلات ما راهيش تخدم في هاد الوقت', 'Buses are not running now') : tr('نحسبو أوقات الوصول…', 'Calculating arrivals…')}</div>}
            {arrivals.map((a, k) => {
              const go = a.min - walk
              const hint = go < -0.5 ? ['late', tr('ما تلحقهاش', 'You will miss it')] : go < 2 ? ['now', tr('اخرج دروك!', 'Leave now!')] : ['ok', tr(`اخرج بعد ${Math.round(go)} د`, `Leave in ${Math.round(go)} min`)]
              return (
                <button key={k} className="arr-row" onClick={() => setBusSel(a.bus.id)}>
                  <span className="line-badge" style={{ '--lc': a.line.color }}>{a.line.number}</span>
                  <span className="grow" style={{ minWidth: 0, textAlign: 'start' }}><b className="small">{tr('نحو', 'To')} {a.toward}</b><small className={`hint ${hint[0]}`}>{a.bus.live && <Radio size={11} />} {hint[1]}</small></span>
                  <b className="num arr-min">{fmt(a.min)}</b>
                </button>
              )
            })}
            {stopSel && <button className="btn btn-ghost btn-block mt" onClick={() => setStopSel(null)}><MapPin size={16} />{tr('رجع لأقرب محطة ليك', 'Back to nearest stop')}</button>}
            <div className="tiny muted flex mt" style={{ gap: 6 }}><Info size={13} />{tr('اضغط على أي محطة ولا حافلة في الخريطة باش تشوف التفاصيل. 🟢 = موقع مباشر', 'Tap any stop or bus for details. 🟢 = live GPS')}</div>
          </div>
        ) : (
          <div className="center" style={{ padding: 20 }}><span className="spinner" /></div>
        )}
      </DragPanel>
    </div>
  )
}
