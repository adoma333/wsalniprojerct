// الواجهة الخاصة بسائق الحافلة: خريطة الخط والمحطات، زر بدء/إيقاف بث الموقع، المحطة الجاية والتقدّم على المسار.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Menu, Bus, Radio, User, FileText, Settings as SetIco, LifeBuoy, Bell, LogOut, ChevronDown, Check, Navigation, AlertTriangle, Clock } from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import MapControls, { useMapPrefs } from '@/map/MapControls.jsx'
import DragPanel from '@/ui/DragPanel.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { useNav, Drawer, DrawerItem, Avatar, Sheet, toast, Empty } from '@/ui/kit.jsx'
import { tr, isAr, haversine } from '@/core/util.js'
import { CITIES } from '@/core/config.js'
import { watchPosition, currentPosition } from '@/core/geo.js'
import { watchLines, demoLines, linePath, measure, project, pushBus, stopBus } from '@/core/bus.js'
import { updateDriver } from '@/core/api.js'

// خطوط ولاية السائق (من لوحة التحكم، وإلا التجريبية لسيدي بلعباس)
export function useDriverLines(driver, settings) {
  const [lines, setLines] = useState(null)
  useEffect(() => watchLines((l) => setLines(l.filter((x) => !x.city || x.city === driver.city))), [driver.city])
  const city = CITIES.find((c) => c.id === driver.city) || CITIES[0]
  return lines && (lines.length || settings.bus?.demo === false ? lines : city.id === 'sba' ? demoLines(city.center) : [])
}

// بث موقع الحافلة كل 5 ثواني ما دام البث شغّال
export function useBusBroadcast({ uid, driver, line, on }) {
  const [info, setInfo] = useState(null)
  const [m, setM] = useState(null)
  useEffect(() => { setM(null); if (line) linePath(line).then((p) => setM(measure(p))) }, [line?.id])
  useEffect(() => {
    if (!on || !line) { setInfo(null); return }
    let stop = () => {}, lastD = null, dir = 1, alive = true, pos = null
    const send = () => {
      if (!alive || !pos) return
      const base = { line: line.id, coords: pos.coords, heading: pos.heading || 0, dir, name: driver.name, plate: driver.bus?.plate || driver.vehicle?.plate || '', number: driver.bus?.number || '' }
      if (!m) { setInfo({ coords: pos.coords }); return pushBus(uid, base).catch(() => {}) }
      const pr = project(m, pos.coords)
      if (lastD != null && Math.abs(pr.d - lastD) > 0.015) dir = pr.d > lastD ? 1 : -1
      lastD = pr.d
      setInfo({ coords: pos.coords, off: pr.off, d: pr.d, len: m.len, dir })
      pushBus(uid, { ...base, d: pr.d, dir }).catch(() => {})
    }
    watchPosition((p) => { pos = p }).then((s) => (stop = s))
    currentPosition().then((p) => { if (p && !pos) { pos = p; send() } })
    const t = setInterval(send, 5000)
    return () => { alive = false; clearInterval(t); stop(); stopBus(uid) }
  }, [on, line?.id, !!m])
  return { info, m }
}

export default function BusHome() {
  const { uid, driver, settings } = useApp()
  const nav = useNav()
  const mapRef = useRef(null)
  const prefs = useMapPrefs()
  const [brg, setBrg] = useState({ b: 0, p: 0 })
  const [panelH, setPanelH] = useState(260)
  const [drawer, setDrawer] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [me, setMe] = useState(driver.loc?.coords || null)
  const lines = useDriverLines(driver, settings)
  const line = lines?.find((l) => l.id === driver.busLine) || null
  const on = !!driver.broadcasting && !!line
  const { info, m } = useBusBroadcast({ uid, driver, line, on })
  const city = CITIES.find((c) => c.id === driver.city) || CITIES[0]
  useEffect(() => { let s = () => {}; watchPosition((p) => setMe(p.coords)).then((x) => (s = x)); return () => s() }, [])
  // أول مرة: نبيّنو الخط كامل
  const fitted = useRef(false)
  useEffect(() => { if (!fitted.current && m?.path?.length > 1) { fitted.current = true; setTimeout(() => mapRef.current?.fit(m.path, { bottom: panelH + 30, top: 110 }), 300) } }, [m])

  const toggle = async () => {
    if (!line) return setPickOpen(true)
    const v = !on
    await updateDriver(uid, { broadcasting: v, online: false, lastSeen: Date.now(), ...(v ? { broadcastSince: Date.now() } : {}) })
    toast(v ? tr('البث بدا — الزبائن يشوفو الحافلة تاعك دروك 🚌', 'Broadcasting — riders can see your bus 🚌') : tr('وقّفت البث', 'Broadcast stopped'), v ? 'success' : '')
  }
  const chooseLine = async (l) => { await updateDriver(uid, { busLine: l.id }); setPickOpen(false); fitted.current = false; toast(tr(`الخط ${l.number} تختار`, `Line ${l.number} selected`), 'success') }

  // المحطة الجاية حسب الاتجاه
  const next = useMemo(() => {
    if (!line || !m || info?.d == null) return null
    const st = (line.stops || []).map((s) => ({ ...s, d: project(m, s.coords).d }))
    const ahead = info.dir >= 0 ? st.filter((s) => s.d > info.d + 0.02).sort((a, b) => a.d - b.d) : st.filter((s) => s.d < info.d - 0.02).sort((a, b) => b.d - a.d)
    const n = ahead[0]
    return n ? { ...n, km: Math.abs(n.d - info.d) } : null
  }, [line?.id, m, info?.d, info?.dir])
  const toward = line?.stops?.[info?.dir >= 0 ? line.stops.length - 1 : 0]?.name

  const markers = [], routes = []
  if (m?.path?.length > 1) routes.push({ id: 'line', coords: m.path, color: line.color, from: line.color, to: line.color, width: 6, flow: false, casing: '#fff' })
  ;(line?.stops || []).forEach((s, i) => markers.push({ id: 'st' + i, type: 'busstop', coords: s.coords, color: line.color, near: next && next.name === s.name, label: next && next.name === s.name ? s.name : undefined }))
  const here = info?.coords || me
  if (here) markers.push(on ? { id: 'mybus', type: 'bus', coords: here, label: line?.number, color: line?.color, live: true, smooth: 1600 } : { id: 'me', type: 'me', coords: here })

  const mins = driver.broadcastSince && on ? Math.round((Date.now() - driver.broadcastSince) / 60000) : 0
  return (
    <div className="home">
      <MapView ref={mapRef} center={here || line?.stops?.[0]?.coords || city.center} zoom={14} markers={markers} routes={routes} padding={{ bottom: panelH, top: 80 }} mapType={prefs.mapType} pitch3d={prefs.pitch3d} onBearing={(b, p) => setBrg({ b, p })} />
      <div className="top-ctrls">
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="menu"><Menu size={22} /></button>
        <span className={`bus-status ${on ? 'on' : ''}`}>{on ? <><i className="pulse-dot" />{tr('البث شغّال', 'Live')}</> : tr('البث متوقف', 'Offline')}</span>
      </div>
      <MapControls prefs={prefs} bearing={brg.b} pitch={brg.p} onNorth={() => mapRef.current?.resetNorth()} bottom={panelH + 14} onLocate={() => here && mapRef.current?.flyTo(here, 16)} />

      <DragPanel peek={150} onVisible={setPanelH}>
        <div className="rise">
          {lines !== null && lines.length === 0 ? (
            <Empty icon={<Bus size={34} />} title={tr('ما كاين حتى خط في ولايتك', 'No lines in your city')} sub={tr('الإدارة تزيد الخطوط من لوحة التحكم', 'Lines are added by the admin')} />
          ) : (
            <>
              <button className="bus-line-card" onClick={() => !on && setPickOpen(true)}>
                {line ? <span className="line-badge lg" style={{ '--lc': line.color }}>{line.number}</span> : <span className="line-badge lg" style={{ '--lc': '#98A2B3' }}>?</span>}
                <span className="grow" style={{ textAlign: 'start', minWidth: 0 }}>
                  <small className="muted">{tr('الخط تاعك', 'Your line')}</small>
                  <b>{line ? line.name : tr('اختار الخط', 'Choose a line')}</b>
                  {line && <small className="muted"><span dir="ltr">{line.start} – {line.end}</span> • {(line.stops || []).length} {tr('محطات', 'stops')}</small>}
                </span>
                {!on && <ChevronDown size={20} />}
              </button>
              <button className={`go-btn bus ${on ? 'on' : ''}`} onClick={toggle}>
                <span className="go-ring">{on ? <Radio size={26} /> : <Bus size={26} />}</span>
                <span><b>{on ? tr('وقّف البث', 'Stop broadcasting') : tr('ابدا الخدمة وبث الموقع', 'Start & broadcast')}</b><small>{on ? tr(`راك تبث من ${mins} د`, `Broadcasting for ${mins} min`) : tr('الزبائن يشوفو الحافلة ووقت وصولها لكل محطة', 'Riders see your bus and arrival times')}</small></span>
              </button>
              {on && info?.d != null && (
                <div className="bus-progress">
                  <div className="between small"><span className="muted">{tr('الاتجاه', 'Direction')}</span><b><Navigation size={14} /> {tr('نحو', 'To')} {toward}</b></div>
                  <div className="q-bar mt"><i style={{ width: `${Math.round((info.d / Math.max(0.01, info.len)) * 100)}%`, background: line.color }} /></div>
                  {next && <div className="between small mt"><span className="muted">{tr('المحطة الجاية', 'Next stop')}</span><b>🚏 {next.name} • <span className="num">{next.km < 1 ? `${Math.round(next.km * 1000)} م` : `${next.km.toFixed(1)} كم`}</span></b></div>}
                  {info.off > 0.3 && <div className="tiny mt flex" style={{ color: 'var(--danger)', gap: 6 }}><AlertTriangle size={14} />{tr(`راك بعيد على مسار الخط بـ ${info.off.toFixed(1)} كم`, `${info.off.toFixed(1)} km off route`)}</div>}
                </div>
              )}
              <div className="tiny muted flex mt" style={{ gap: 6 }}><Clock size={13} />{tr('خلّي التطبيق مفتوح وانت تسوق باش يبقى البث شغّال', 'Keep the app open while driving')}</div>
            </>
          )}
        </div>
      </DragPanel>

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title={tr('اختار الخط تاعك', 'Choose your line')}>
        <div className="col" style={{ gap: 8 }}>
          {(lines || []).map((l) => (
            <button key={l.id} className={`method ${driver.busLine === l.id ? 'active' : ''}`} onClick={() => chooseLine(l)}>
              <span className="line-badge" style={{ '--lc': l.color }}>{l.number}</span>
              <span className="grow" style={{ textAlign: 'start' }}><b>{l.name}</b><small><span dir="ltr">{l.start} – {l.end}</span> • {(l.stops || []).length} {tr('محطات', 'stops')}</small></span>
              {driver.busLine === l.id && <Check size={20} color="var(--brand)" />}
            </button>
          ))}
        </div>
      </Sheet>

      <Drawer open={drawer} onClose={() => setDrawer(false)} head={
        <div className="flex" style={{ gap: 12 }}><Avatar name={driver.name} src={driver.photo} size={52} /><div><b style={{ color: '#fff' }}>{driver.name}</b><div className="tiny" style={{ color: '#c9bfb8' }}>{tr('سائق حافلة', 'Bus driver')}{driver.bus?.number ? ` • ${tr('حافلة', 'Bus')} ${driver.bus.number}` : ''}</div></div></div>
      }>
        {[[User, '#2E90FA', tr('البروفيل', 'Profile'), 'profile'], [FileText, '#64748b', tr('الوثائق', 'Documents'), 'documents'], [Bell, '#a855f7', tr('الإشعارات', 'Notifications'), 'notifications'], [LifeBuoy, '#22c55e', tr('الدعم', 'Support'), 'support'], [SetIco, '#7c3aed', tr('الإعدادات', 'Settings'), 'settings']].map(([I, c, l, pg]) => (
          <DrawerItem key={pg} icon={<I size={19} />} color={c} label={l} onClick={() => { setDrawer(false); nav.push(pg, pg === 'notifications' ? { audience: 'drivers' } : {}) }} />
        ))}
        <DrawerItem icon={<LogOut size={19} />} color="#92400e" label={tr('اخرج', 'Log out')} onClick={async () => { await updateDriver(uid, { broadcasting: false }).catch(() => {}); stopBus(uid); const { auth } = await import('@/core/store.js'); await auth.reset(); location.reload() }} />
      </Drawer>
    </div>
  )
}
