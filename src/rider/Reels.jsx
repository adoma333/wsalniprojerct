import { play } from '@/core/sound.js'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Music2, BadgeCheck, ChevronLeft, Pause, Volume2, VolumeX, Check, Eye, Sparkles, ChevronsUp } from 'lucide-react'
import { useNav, toast, Confetti } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { Coin } from '@/ui/art.jsx'
import { tr, num, compact, haptic } from '@/core/util.js'
import { builtinReels } from '@/core/reels.js'
import { watchViews, watchCustomReels, claimReel, clickReel } from '@/core/api.js'

// قائمة الإشهارات: إشهارات الأدمن أولًا ثم المدمجة
export function useReels() {
  const { settings } = useApp()
  const [custom, setCustom] = useState([])
  useEffect(() => watchCustomReels(setCustom), [])
  return useMemo(() => {
    const rw = settings.rewards
    const c = custom
      .map((r) => ({ duration: rw.watchSeconds, image: 'reels/ad.jpg', ...r, points: r.points ?? rw.pointsPerReel }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return [...c, ...(rw.builtinReels ? builtinReels(rw) : [])]
  }, [custom, settings.rewards])
}

export default function Reels({ start }) {
  const nav = useNav()
  const { uid, user, settings } = useApp()
  const reels = useReels()
  const [views, setViews] = useState({})
  const [active, setActive] = useState(0)
  const [confetti, setConfetti] = useState(0)
  const [hint, setHint] = useState(() => !localStorage.getItem('w_reel_hint'))
  const scroller = useRef(null)
  const startedAt = useRef(false)

  useEffect(() => watchViews(uid, (v) => setViews(Object.fromEntries(v.map((x) => [x.id, x])))), [uid])

  // ابدأ من أول إشهار ما شافوش
  useEffect(() => {
    if (startedAt.current || !reels.length || !scroller.current) return
    const i = start != null ? start : Math.max(0, reels.findIndex((r) => !views[r.id]))
    startedAt.current = true
    if (i > 0) { scroller.current.scrollTop = i * scroller.current.clientHeight; setActive(i) }
  }, [reels.length, Object.keys(views).length])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number(e.target.dataset.i))
    }, { root: el, threshold: [0.6] })
    el.querySelectorAll('.reel').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [reels.length])
  useEffect(() => { if (active > 0 && hint) { setHint(false); localStorage.setItem('w_reel_hint', '1') } }, [active])

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = user.viewsDay === today ? user.viewsToday || 0 : 0
  const left = Math.max(0, settings.rewards.dailyLimit - todayCount)

  const onComplete = async (reel) => {
    if (views[reel.id]) return
    if (left <= 0) { toast(tr('كمّلت الحد تاع اليوم، ارجع غدوة 🌙', 'Daily limit reached'), '', null, 3200); return }
    const r = await claimReel(uid, reel, settings.rewards)
    if (r.ok) { haptic('heavy'); play('coin'); setConfetti((x) => x + 1) }
    else if (r.reason === 'limit') toast(tr('كمّلت الحد تاع اليوم', 'Daily limit reached'))
  }

  return (
    <div className="reels">
      <Confetti run={confetti} key={confetti} />
      <div className="reels-top" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.55), transparent)' }}>
        <button className="back" onClick={nav.back}><ArrowLeft size={20} /></button>
        <h2>{tr('شوف واربح', 'Watch & earn')}</h2>
        <button className="bal" onClick={() => nav.push('rewards')}><span className="coin"><Coin size={18} /></span><span className="num">{num(user.points || 0)}</span><small style={{ opacity: 0.8, fontWeight: 500 }}>{tr('نقطة', 'pts')}</small></button>
      </div>
      <div className="reels-scroll" ref={scroller}>
        {reels.map((r, i) => (
          <Reel key={r.id} i={i} reel={r} active={i === active} near={Math.abs(i - active) <= 2} seen={!!views[r.id]} total={reels.length} onComplete={onComplete} />
        ))}
      </div>
      {hint && <div className="swipe-hint"><ChevronsUp size={30} /><span>{tr('اسحب للفوق باش تشوف الإشهار الجاي', 'Swipe up for the next ad')}</span></div>}
      <div className="reels-foot">
        <span><Eye size={13} /> {tr(`باقي اليوم ${left} إشهار`, `${left} ads left today`)}</span>
      </div>
    </div>
  )
}

function Reel({ i, reel, active, near, seen, total, onComplete }) {
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [earn, setEarn] = useState(false)
  const [muted, setMuted] = useState(true)
  const done = useRef(false)
  const holdT = useRef(null)
  const vid = useRef(null)
  const pausedRef = useRef(false)
  pausedRef.current = paused
  const dur = reel.duration || 15

  useEffect(() => {
    if (!active) { setElapsed(0); setPaused(false); done.current = false; vid.current?.pause(); return }
    if (vid.current) { vid.current.currentTime = 0; vid.current.play().catch(() => {}) }
    let raf, last = performance.now(), acc = 0
    const tick = (t) => {
      const dt = (t - last) / 1000
      last = t
      if (!document.hidden && !pausedRef.current) {
        acc = Math.min(dur, acc + dt)
        setElapsed(acc)
        if (acc >= dur && !done.current) {
          done.current = true
          if (!seen) { setEarn(true); setTimeout(() => setEarn(false), 2300); onComplete(reel) }
        }
        if (acc >= dur) acc = 0.0001
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
  useEffect(() => { if (vid.current) paused ? vid.current.pause() : active && vid.current.play().catch(() => {}) }, [paused])

  const pct = Math.min(1, elapsed / dur)
  const C = 2 * Math.PI * 27
  const claimed = seen || done.current
  const secsLeft = Math.ceil(dur - elapsed)
  const headline = reel.title || reel.advertiser

  return (
    <section className={`reel ${active && !paused ? 'playing' : ''}`} data-i={i}>
      {reel.video && near ? (
        <video ref={vid} className="rimg" src={reel.video} muted={muted} loop playsInline preload="metadata" poster={reel.image} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
      ) : (
        <div className="rimg" style={{ backgroundImage: near ? `url(${reel.image})` : 'none', backgroundColor: '#1a0b07' }} />
      )}
      <div className="tint" style={{ background: reel.tint || '#E8650A' }} />
      <div className="shade" />
      {!reel.video && (
        <div className="headline" key={active ? 'a' : 'b'}>
          <div className={active ? 'rise' : ''}>{headline}</div>
          <small className={active ? 'rise' : ''} style={{ animationDelay: '.15s' }}>{reel.caption?.split(/[.!؟?]/)[0]}</small>
        </div>
      )}
      <div className="bars"><i style={{ width: `${pct * 100}%` }} /></div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}
        onPointerDown={() => { holdT.current = setTimeout(() => setPaused(true), 250) }}
        onPointerUp={() => { clearTimeout(holdT.current); setPaused(false) }} onPointerLeave={() => { clearTimeout(holdT.current); setPaused(false) }} />
      {paused && active && <div className="paused-ico pop"><Pause size={36} fill="#fff" /></div>}

      <div className={`reward-ring ${claimed ? 'done' : ''}`}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill={claimed ? 'var(--success)' : 'rgba(0,0,0,.35)'} stroke="rgba(255,255,255,.2)" strokeWidth="5" />
          {!claimed && <circle cx="32" cy="32" r="27" fill="none" stroke="url(#rg2)" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />}
          <defs><linearGradient id="rg2"><stop offset="0" stopColor="#FFD36B" /><stop offset="1" stopColor="#FF8A2A" /></linearGradient></defs>
        </svg>
        <div className="rv">
          {claimed ? <span><Check size={18} strokeWidth={3} /><br />{seen && !earn ? tr('تمت', 'Done') : `+${reel.points}`}</span>
            : <span><span className="num" style={{ color: '#FFD36B' }}>+{reel.points}</span><br /><span className="num" style={{ fontSize: 11, opacity: 0.85 }}>{secsLeft}s</span></span>}
        </div>
      </div>
      {earn && (
        <div className="earn-pop">
          <div className="coinbig num">+{reel.points}</div>
          <b>{tr(`ربحت ${reel.points} نقطة`, `You earned ${reel.points} points`)}</b>
          <div className="small" style={{ opacity: 0.9 }}>{tr('تزادت في رصيد النقاط تاعك', 'Added to your points')}</div>
        </div>
      )}
      {reel.video && <button className="mute-btn" onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>}

      <div className="meta ad-meta">
        <div className="adv">
          <span className="av" style={{ background: reel.tint || 'var(--brand)' }}>{reel.advertiser?.[0]}</span>
          <div className="grow">
            <b>{reel.advertiser} <BadgeCheck size={15} fill="#3897f0" color="#fff" /></b>
            <small><span className="sponsored">{tr('إشهار', 'Ad')}</span> {reel.views ? <>• <Eye size={11} style={{ verticalAlign: -1 }} /> {compact(reel.views)}</> : null}</small>
          </div>
        </div>
        <div className="cap">{reel.caption}</div>
        {reel.music && <div className="music"><Music2 size={14} /><span>{reel.music}</span></div>}
        <a className={`cta ${elapsed > 3 || !active ? 'hot' : ''}`} href={reel.link || undefined} target="_blank" rel="noreferrer" onClick={(e) => { clickReel(reel.id); if (!reel.link) e.preventDefault() }}>
          <span className="flex" style={{ gap: 8 }}><Sparkles size={16} />{reel.cta || tr('اعرف أكثر', 'Learn more')}</span>
          <ChevronLeft size={18} style={{ transform: document.dir === 'rtl' ? '' : 'scaleX(-1)' }} />
        </a>
        <div className="tiny" style={{ opacity: 0.55, marginTop: 8, textAlign: 'center' }}><span className="num">{i + 1}/{total}</span></div>
      </div>
    </section>
  )
}
