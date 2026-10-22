// صفحة التتبّع العامة: يفتحها الشخص اللي تطلبتلو الكورسة من رابط واتساب، بلا تطبيق ولا تسجيل
import React, { useEffect, useState } from 'react'
import { Phone, Star, MapPin, Car, Flag, CheckCircle2, XCircle, Loader2, Download } from 'lucide-react'
import MapView from '@/map/MapView.jsx'
import { Avatar } from '@/ui/kit.jsx'
import { Plate, RouteSummary } from '@/ui/ride-ui.jsx'
import { tr, money, mins } from '@/core/util.js'
import { store } from '@/core/store.js'

export default function Track({ shareKey }) {
  const [s, setS] = useState(undefined)
  useEffect(() => store.watch(`shares/${shareKey}`, setS), [shareKey])
  if (s === undefined) return <div className="track-page center" style={{ display: 'grid', placeItems: 'center', height: '100dvh' }}><Loader2 className="spin" size={34} color="var(--brand)" /></div>
  if (!s) return (
    <div className="empty" style={{ paddingTop: 140 }}>
      <img src="brand/mark.svg" alt="" style={{ width: 70 }} />
      <b>{tr('الرابط هذا ما راهوش صالح ولا الكورسة كملت', 'This link is invalid or the ride ended')}</b>
      <a className="btn btn-primary mt" href="./">{tr('حمّل وصلني', 'Get Wasalni')}</a>
    </div>
  )
  const d = s.driver || {}
  const left = s.status === 'ongoing' ? Math.max(1, Math.round(s.durationMin * (1 - (s.progress || 0)))) : null
  const st = {
    searching: [Loader2, tr('راهم يتقلّبو على شيفور…', 'Finding a driver…'), 'var(--warning)'],
    accepted: [Car, tr('الشيفور راهو جاي ليك', 'Driver is on the way'), 'var(--info)'],
    arrived: [MapPin, tr('الشيفور وصل، راهو يستنى فيك 📍', 'Driver has arrived 📍'), 'var(--success)'],
    ongoing: [Flag, tr('راك في الطريق، طريق السلامة ✨', 'On the way ✨'), 'var(--brand)'],
    completed: [CheckCircle2, tr('وصلت بالسلامة 🎉', 'Arrived safely 🎉'), 'var(--success)'],
    cancelled: [XCircle, tr('الكورسة تلغات', 'Ride cancelled'), 'var(--danger)'],
  }[s.status] || [Car, s.status, 'var(--ink)']
  const [I, label, color] = st
  const markers = [
    { id: 'pu', type: 'pickup', coords: s.pickup.coords, label: s.pickup.title },
    { id: 'do', type: 'drop', coords: s.dropoff.coords, label: s.dropoff.title },
  ]
  if (s.driverLoc?.coords) markers.push({ id: 'car', type: 'car', coords: s.driverLoc.coords, heading: s.driverLoc.heading || 0, size: 50 })
  const center = s.driverLoc?.coords || s.pickup.coords
  return (
    <div className="track-page">
      <div className="track-map"><MapView center={center} zoom={15} markers={markers} routes={s.route ? [{ id: 't', coords: s.route }] : []} padding={{ bottom: 320, top: 60 }} interactive /></div>
      <div className="track-top"><img src="brand/mark.svg" alt="" /><span><b>{tr('وصلني', 'Wasalni')}</b><small>{tr(`كورسة طلبها ${s.by || ''}`, `Booked by ${s.by || ''}`)}</small></span></div>
      <div className="track-card rise">
        <div className="status-strip" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}><I size={18} className={s.status === 'searching' ? 'spin' : ''} /><span className="grow">{label}</span>{left && <span className="num">{mins(left)}</span>}</div>
        {d.name && (
          <div className="driver-card">
            <Avatar name={d.name} src={d.photo} size={54} />
            <div className="dc-main">
              <b>{d.name} <span className="small muted"><Star size={12} fill="var(--gold)" color="var(--gold)" /> <span className="num">{d.rating}</span></span></b>
              <div className="small muted">{d.car} • {d.color}</div>
              <div style={{ marginTop: 6 }}><Plate value={d.plate} /></div>
            </div>
            {d.phone && <a className="icon-btn" style={{ background: 'var(--success)', color: '#fff' }} href={`tel:${d.phone}`} aria-label="call"><Phone size={20} /></a>}
          </div>
        )}
        <div className="card pad" style={{ background: 'var(--card-2)', boxShadow: 'none', marginTop: 10 }}>
          <RouteSummary ride={s} compact />
          <div className="between small mt"><span className="muted">{s.payment === 'cash' ? tr('خلّص الشيفور كاش', 'Pay the driver in cash') : tr('الكورسة مخلّصة ✓', 'Already paid ✓')}</span>{s.payment === 'cash' && <b className="num">{money(s.fare)}</b>}</div>
        </div>
        <a className="btn btn-ghost btn-block mt" href="./"><Download size={17} />{tr('حمّل وصلني واطلب كورساتك', 'Get the Wasalni app')}</a>
      </div>
    </div>
  )
}
