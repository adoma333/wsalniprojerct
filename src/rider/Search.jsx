import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Map as MapIco, Crosshair, MapPin, Home as HomeIco, Briefcase, Star, Plus, X, Building2, Coffee, Hospital, GraduationCap, ShoppingBag, Plane, Fuel, Landmark } from 'lucide-react'
import { useNav, useSettle, Loader } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { tr, km } from '@/core/util.js'
import { searchPlaces, currentPosition, reverse } from '@/core/geo.js'

const TYPE_ICON = { restaurant: Coffee, cafe: Coffee, hospital: Hospital, clinic: Hospital, pharmacy: Hospital, university: GraduationCap, school: GraduationCap, mall: ShoppingBag, supermarket: ShoppingBag, aerodrome: Plane, fuel: Fuel, place_of_worship: Landmark, mosque: Landmark }

export default function SearchPage({ initial, focus = 'dropoff', near, onDone, onPickMap, schedule, classId }) {
  const nav = useNav()
  const { user } = useApp()
  const [d, setD] = useState(() => ({ pickup: null, dropoff: null, stops: [], ...(initial || {}) }))
  const [field, setField] = useState(focus)
  const [q, setQ] = useState({ pickup: initial?.pickup?.title || '', dropoff: initial?.dropoff?.title || '', stop: '' })
  const [res, setRes] = useState([])
  const [loading, setLoading] = useState(false)
  const query = useSettle(q[field] || '', 350)
  const refs = { pickup: useRef(null), dropoff: useRef(null), stop: useRef(null) }

  useEffect(() => { setTimeout(() => refs[focus]?.current?.focus(), 350) }, [])
  useEffect(() => {
    const isSel = (field === 'pickup' && d.pickup?.title === query) || (field === 'dropoff' && d.dropoff?.title === query)
    if (query.length < 2 || isSel) { setRes([]); return }
    let off = false
    setLoading(true)
    searchPlaces(query, near).then((r) => { if (!off) { setRes(r); setLoading(false) } })
    return () => { off = true }
  }, [query, field])

  const finish = (nd) => {
    if (nd.pickup && nd.dropoff) {
      nav.back()
      setTimeout(() => onDone({ ...nd, schedule, classId }), 50)
    }
  }
  const choose = (place) => {
    const nd = { ...d }
    if (field === 'pickup') { nd.pickup = place; setQ({ ...q, pickup: place.title }) }
    else if (field === 'stop') { nd.stops = [...(nd.stops || []), place]; setQ({ ...q, stop: '' }); setShowStop(false) }
    else { nd.dropoff = place; setQ({ ...q, dropoff: place.title }) }
    setD(nd)
    setRes([])
    if (!nd.pickup) { setField('pickup'); refs.pickup.current?.focus(); return }
    if (!nd.dropoff) { setField('dropoff'); refs.dropoff.current?.focus(); return }
    finish(nd)
  }
  const useCurrent = async () => {
    setLoading(true)
    const p = await currentPosition()
    setLoading(false)
    if (!p) return
    const r = await reverse(p.coords)
    choose({ ...r, title: tr('البلاصة اللي راني فيها', 'Current location'), subtitle: r.title, current: true })
  }
  const pickOnMap = () => {
    nav.back()
    setTimeout(() => onPickMap(field, d), 50)
  }
  const [showStop, setShowStop] = useState(false)

  const saved = [
    user.savedPlaces?.home && { ...user.savedPlaces.home, icon: HomeIco, label: tr('الدار', 'Home') },
    user.savedPlaces?.work && { ...user.savedPlaces.work, icon: Briefcase, label: tr('الخدمة', 'Work') },
    ...(user.savedPlaces?.others || []).map((p) => ({ ...p, icon: Star, label: p.name })),
  ].filter(Boolean)

  const input = (k, ph, dot) => (
    <div>
      <input ref={refs[k]} value={q[k]} placeholder={ph} onFocus={() => setField(k)} onChange={(e) => { setQ({ ...q, [k]: e.target.value }); setField(k) }} />
      {q[k] && field === k && <button onClick={() => { setQ({ ...q, [k]: '' }); if (k !== 'stop') setD({ ...d, [k]: null }); refs[k].current?.focus() }} style={{ padding: 8, color: 'var(--faint)' }}><X size={18} /></button>}
    </div>
  )

  return (
    <div className="page search-page">
      <div className="appbar">
        <button className="back" onClick={nav.back}><ArrowLeft size={20} /></button>
        <h1>{schedule ? tr('جدولة كورسة', 'Schedule a ride') : tr('وين رايح؟', 'Where to?')}</h1>
      </div>
      <div style={{ padding: '0 14px' }}>
        <div className="inputs">
          <div className="route-line"><span className="a" /><span className="l" />{(d.stops?.length > 0 || showStop) && <><span className="b" style={{ background: 'var(--warning)', borderRadius: 3 }} /><span className="l" /></>}<span className="b" /></div>
          <div className="ins">
            {input('pickup', tr('منين راك ناوي تنطلق', 'Pickup location'))}
            {d.stops?.map((s, i) => (
              <div key={i}><input value={s.title} readOnly /><button style={{ padding: 8, color: 'var(--faint)' }} onClick={() => setD({ ...d, stops: d.stops.filter((_, j) => j !== i) })}><X size={18} /></button></div>
            ))}
            {showStop && input('stop', tr('زيد وقفة', 'Add a stop'))}
            {input('dropoff', tr('وين حاب تروح؟', 'Where to?'))}
          </div>
          {(d.stops?.length || 0) < 2 && !showStop && <button className="add-stop" onClick={() => { setShowStop(true); setField('stop'); setTimeout(() => refs.stop.current?.focus(), 50) }} aria-label="add stop"><Plus size={24} /></button>}
        </div>
      </div>
      <div className="page-body" style={{ paddingTop: 10 }}>
        <div className="list" style={{ border: 0, background: 'transparent' }}>
          {field === 'pickup' && (
            <button className="place-row" onClick={useCurrent}>
              <span className="pi" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><Crosshair size={18} /></span>
              <span className="pt"><b>{tr('استعمل البلاصة اللي راني فيها', 'Use current location')}</b><small>{tr('تحديد أوتوماتيكي بالـ GPS', 'Automatic via GPS')}</small></span>
            </button>
          )}
          <button className="place-row" onClick={pickOnMap}>
            <span className="pi" style={{ background: 'var(--brand-50)', color: 'var(--brand)' }}><MapIco size={18} /></span>
            <span className="pt"><b style={{ color: 'var(--brand)' }}>{tr('حدد البلاصة من الخريطة', 'Choose on map')}</b><small>{tr('حرّك الدبوس للبلاصة بالضبط', 'Drag the pin to the exact spot')}</small></span>
          </button>
          {loading && <div style={{ padding: 10 }}>{[1, 2, 3].map((i) => <div key={i} className="flex" style={{ padding: '10px 0' }}><div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20 }} /><div className="grow"><div className="skeleton" style={{ height: 13, width: '70%' }} /><div className="skeleton" style={{ height: 10, width: '45%', marginTop: 6 }} /></div></div>)}</div>}
          {!loading && res.map((r, i) => {
            const I = TYPE_ICON[r.type] || (r.type === 'city' || r.type === 'town' ? Building2 : MapPin)
            return (
              <button key={i} className="place-row rise" style={{ animationDelay: i * 30 + 'ms' }} onClick={() => choose(r)}>
                <span className="pi"><I size={18} /></span>
                <span className="pt"><b>{r.title}</b><small>{r.subtitle}</small></span>
                {r.dist != null && <span className="pd num">{km(r.dist)}</span>}
              </button>
            )
          })}
          {!loading && query.length >= 2 && res.length === 0 && !(field !== 'stop' && d[field]?.title === query) && (
            <div className="empty" style={{ padding: 24 }}><b>{tr('ما كاين والو', 'No results')}</b><div className="small">{tr('جرّب اسم آخر ولا حدد من الخريطة', 'Try another name or use the map')}</div></div>
          )}
          {query.length < 2 && saved.length > 0 && (
            <>
              <div className="section-title">{tr('البلايص المحفوظة', 'Saved places')}</div>
              {saved.map((p, i) => (
                <button key={i} className="place-row" onClick={() => choose(p)}>
                  <span className="pi"><p.icon size={18} /></span>
                  <span className="pt"><b>{p.label}</b><small>{p.title}</small></span>
                </button>
              ))}
            </>
          )}
          {query.length < 2 && (
            <>
              <div className="section-title">{tr('اقتراحات', 'Suggestions')}</div>
              {[[tr('مطار', 'Airport'), Plane], [tr('مستشفى', 'Hospital'), Hospital], [tr('جامعة', 'University'), GraduationCap], [tr('مول', 'Mall'), ShoppingBag]].map(([t, I]) => (
                <button key={t} className="place-row" onClick={() => setQ({ ...q, [field]: t })}>
                  <span className="pi"><I size={18} /></span><span className="pt"><b>{t}</b><small>{tr('حوّس قريب منك', 'Search nearby')}</small></span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
