// نافذة الإشعار بالشاشة كاملة: تظهر كي يدخل المستخدم للتطبيق (صورة، فيديو، عنوان، نص، رابط) — كل شيء من لوحة التحكم.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Volume2, VolumeX } from 'lucide-react'
import { watchPopups, popupStat } from '@/core/api.js'
import { play } from '@/core/sound.js'
import { useNav } from './kit.jsx'

const key = (id) => `w_pop_${id}`
const lastSeen = (id) => { try { return +localStorage.getItem(key(id)) || 0 } catch { return 0 } }
const markSeen = (id) => { try { localStorage.setItem(key(id), String(Date.now())) } catch {} }
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

// هل تنطبق النافذة على هذا المستخدم الآن؟
export function eligible(p, { audience, city }, now = Date.now()) {
  if (p.active === false) return false
  if (p.audience && p.audience !== 'all' && p.audience !== audience) return false
  if (p.cities?.length && city && !p.cities.includes(city)) return false
  if (p.start && now < p.start) return false
  if (p.end && now > p.end) return false
  const seen = lastSeen(p.id)
  if (p.freq === 'always') return true
  if (p.freq === 'daily') return !seen || !sameDay(seen, now)
  return !seen // مرة وحدة
}

export const ytId = (u = '') => (u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/) || [])[1]

export function PopupView({ p, onClose, onCta, onLink, preview = false }) {
  const [muted, setMuted] = useState(true)
  const [canClose, setCanClose] = useState(!(p.closeAfter > 0))
  const [left, setLeft] = useState(p.closeAfter || 0)
  const vid = useRef(null)
  useEffect(() => {
    if (!(p.closeAfter > 0) || preview) { setCanClose(true); return }
    setCanClose(false); setLeft(p.closeAfter)
    const t = setInterval(() => setLeft((x) => { if (x <= 1) { clearInterval(t); setCanClose(true); return 0 } return x - 1 }), 1000)
    return () => clearInterval(t)
  }, [p.id, p.closeAfter])
  const yt = ytId(p.video)
  const media = p.video ? (yt
    ? <iframe className="pp-media" src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${yt}&controls=0`} allow="autoplay; encrypted-media" title="video" />
    : <video ref={vid} className="pp-media" src={p.video} poster={p.image || undefined} autoPlay muted={muted} loop playsInline />)
    : p.image ? <img className="pp-media" src={p.image} alt="" /> : null
  return (
    <div className={`pp ${p.layout === 'card' ? 'card' : 'full'} theme-${p.theme || 'dark'} ${preview ? 'preview' : ''}`} style={{ '--pp-accent': p.accent || '#E8650A' }} onClick={(e) => e.stopPropagation()}>
      <div className="pp-box pop">
        {media && <div className={`pp-mediawrap ${p.text === false ? 'only' : ''}`}>{media}<div className="pp-shade" /></div>}
        <button className="pp-close" disabled={!canClose} onClick={onClose} aria-label="close">{canClose ? <X size={20} /> : <b className="num">{left}</b>}</button>
        {p.video && !yt && <button className="pp-mute" onClick={() => { setMuted(!muted); if (vid.current) vid.current.muted = !muted }} aria-label="mute">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
        <div className="pp-body">
          {p.badge && <span className="pp-badge">{p.badge}</span>}
          {p.title && <h2>{p.title}</h2>}
          {p.body && <p>{p.body}</p>}
          {p.link && p.link.startsWith('#') && <button className="pp-cta" onClick={() => { onCta?.(); onClose(); onLink?.(p.link.slice(1)) }}>{p.cta || 'اكتشف'}</button>}
          {p.link && !p.link.startsWith('#') && <a className="pp-cta" href={/^\+?\d[\d\s]{7,}$/.test(p.link) ? `https://wa.me/${p.link.replace(/\D/g, '')}` : p.link} target="_blank" rel="noreferrer" onClick={onCta}>{p.cta || 'اكتشف'}<ExternalLink size={17} /></a>}
          {!p.link && p.cta && <button className="pp-cta" onClick={() => { onCta?.(); onClose() }}>{p.cta}</button>}
        </div>
      </div>
    </div>
  )
}

// يجيب النوافذ المؤهلة ويبيّنها وحدة بوحدة (أقصى 3 في كل دخول)
export default function PopupGate({ audience, city }) {
  const nav = useNav()
  const [list, setList] = useState(null)
  const [idx, setIdx] = useState(0)
  const shownRef = useRef(new Set())
  useEffect(() => watchPopups(setList), [])
  // نجمّد القائمة كي تتحمّل أول مرة، باش ما تتبدّلش وهو يشوف
  const queue = useMemo(() => (list ? list.filter((p) => eligible(p, { audience, city })).slice(0, 3) : []), [list === null])
  const cur = queue[idx]
  useEffect(() => {
    if (!cur || shownRef.current.has(cur.id)) return
    shownRef.current.add(cur.id)
    markSeen(cur.id)
    popupStat(cur.id, 'views')
    play('notify')
  }, [cur?.id])
  if (!cur) return null
  const close = () => { popupStat(cur.id, 'closes'); setIdx((i) => i + 1) }
  return createPortal(<div className="pp-backdrop">{<PopupView key={cur.id} p={cur} onClose={close} onCta={() => popupStat(cur.id, 'clicks')} onLink={(page) => nav?.push(page)} />}</div>, document.body)
}
