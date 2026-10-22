// مكونات مشتركة بين تطبيق الزبون والسائق
import React, { useEffect, useRef, useState } from 'react'
import { Send, Phone } from 'lucide-react'
import { Page, Avatar, toast } from './kit.jsx'
import { play } from '@/core/sound.js'
import { tr, dateTime } from '@/core/util.js'
import { watchMessages, sendMessage, watchRide, watchNotifications } from '@/core/api.js'

export function Plate({ value = '' }) {
  return <span className="plate"><i>الجزائر<br />DZ</i><span>{value}</span></span>
}

export const STATUS = {
  scheduled: { ar: 'مجدولة', en: 'Scheduled', c: 'blue' },
  searching: { ar: 'بحث عن سائق', en: 'Searching', c: 'yellow' },
  accepted: { ar: 'السائق في الطريق', en: 'Driver on the way', c: 'blue' },
  arrived: { ar: 'السائق وصل', en: 'Driver arrived', c: 'green' },
  ongoing: { ar: 'جارية', en: 'In progress', c: 'blue' },
  completed: { ar: 'مكتملة', en: 'Completed', c: 'green' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', c: 'red' },
}
export const statusLabel = (s) => tr(STATUS[s]?.ar || s, STATUS[s]?.en)
export function StatusBadge({ s }) { return <span className={`badge ${STATUS[s]?.c || 'gray'}`}>{statusLabel(s)}</span> }

export function RouteSummary({ ride, compact }) {
  return (
    <div className="route-head" style={compact ? { padding: 0 } : undefined}>
      <div className="route-line"><span className="a" /><span className="l" /><span className="b" /></div>
      <div className="route-txt">
        <div><small>{tr('من', 'From')}</small>{ride.pickup?.title}</div>
        {ride.stops?.map((s, i) => <div key={i}><small>{tr('توقف', 'Stop')} {i + 1}</small>{s.title}</div>)}
        <div><small>{tr('إلى', 'To')}</small>{ride.dropoff?.title}</div>
      </div>
    </div>
  )
}

const QUICK = {
  rider: ['أنا في الطريق إليك', 'أنتظرك عند المدخل', 'كم دقيقة تحتاج؟', 'شكرًا لك'],
  driver: ['وصلت إلى موقعك', 'أنا في الطريق، دقائق وأصل', 'لا أجد الموقع، هل يمكنك الشرح؟', 'أنتظرك في السيارة'],
}
export function ChatPage({ rideId, me }) {
  const [msgs, setMsgs] = useState([])
  const [ride, setRide] = useState(null)
  const [text, setText] = useState('')
  const end = useRef(null)
  useEffect(() => watchMessages(rideId, setMsgs), [rideId])
  useEffect(() => watchRide(rideId, setRide), [rideId])
  // الدردشة مفتوحة: الإشعار العام يسكت، ونسمعو غير صوت الرسالة
  useEffect(() => { window.__chatOpen = rideId; return () => { if (window.__chatOpen === rideId) window.__chatOpen = null } }, [rideId])
  const seen = useRef(null)
  useEffect(() => {
    if (seen.current === null) { seen.current = msgs.length; return }
    const fresh = msgs.slice(seen.current).filter((m) => m.from !== me)
    seen.current = msgs.length
    if (fresh.length) play('message')
  }, [msgs.length])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])
  const send = async (t) => {
    t = (t ?? text).trim()
    if (!t) return
    setText('')
    await sendMessage(rideId, me, t)
    // رد آلي من السائق الافتراضي
    if (me === 'rider' && ride?.driver?.simulated) setTimeout(() => sendMessage(rideId, 'driver', tr('صحا 👍 راني قريب ليك', 'OK 👍 I am close')), 1800)
  }
  const other = me === 'rider' ? ride?.driver : { name: ride?.riderName, phone: ride?.riderPhone }
  return (
    <Page
      title={<span className="flex"><Avatar name={other?.name} size={34} />{other?.name || tr('دردشة', 'Chat')}</span>}
      actions={other?.phone && <a className="icon-btn sm flat" href={`tel:${other.phone}`}><Phone size={18} /></a>}
      foot={
        <div className="col" style={{ gap: 10 }}>
          <div className="hscroll">{QUICK[me].map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
          <div className="flex">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={tr('اكتب ميساج…', 'Type a message…')} />
            <button className="icon-btn" style={{ background: 'var(--grad)', color: '#fff' }} onClick={() => send()}><Send size={20} style={{ transform: document.dir === 'rtl' ? 'scaleX(-1)' : '' }} /></button>
          </div>
        </div>
      }
    >
      <div className="col" style={{ gap: 8, paddingTop: 8 }}>
        <div className="center tiny muted">{tr('الدردشة محمية وكاينة غير وقت الكورسة', 'Chat is available during the trip only')}</div>
        {msgs.map((m) => (
          <div key={m.id} style={{ alignSelf: m.from === me ? 'flex-start' : 'flex-end', maxWidth: '78%' }} className="pop">
            <div style={{ padding: '10px 14px', borderRadius: 18, background: m.from === me ? 'var(--grad)' : 'var(--card)', color: m.from === me ? '#fff' : 'var(--ink)', boxShadow: 'var(--shadow-1)', border: m.from === me ? 0 : '1px solid var(--line)' }}>{m.text}</div>
            <div className="tiny muted" style={{ padding: '2px 8px' }}>{dateTime(m.at)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
    </Page>
  )
}

// رسائل الدردشة الجديدة خارج صفحة الدردشة: صوت + إشعار منبثق
export function useChatAlerts(rideId, me, otherName) {
  useEffect(() => {
    if (!rideId) return
    let first = true, count = 0
    return watchMessages(rideId, (msgs) => {
      if (first) { first = false; count = msgs.length; return }
      const fresh = msgs.slice(count).filter((m) => m.from !== me)
      count = msgs.length
      if (fresh.length && window.__chatOpen !== rideId) toast(`💬 ${otherName || tr('رسالة جديدة', 'New message')}: ${fresh[fresh.length - 1].text}`, 'brand', null, 4000, 'message')
    })
  }, [rideId])
}
// إشعارات الإدارة الجديدة (تصل وقت التطبيق مفتوح): صوت + إشعار منبثق
export function useBroadcastAlerts(audience) {
  useEffect(() => {
    const t0 = Date.now()
    const shown = new Set()
    return watchNotifications((list) => {
      for (const n of list) {
        if (n.at < t0 || shown.has(n.id)) continue
        if (n.target && n.target !== 'all' && n.target !== audience) continue
        shown.add(n.id)
        toast(`🔔 ${n.title}${n.body ? ' — ' + n.body : ''}`, 'brand', null, 5000, 'notify')
      }
    })
  }, [])
}
