import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Heart, MessageCircle, Send, Bookmark, Music2, BadgeCheck, ChevronLeft, Pause, Volume2, VolumeX, Check } from 'lucide-react'
import { useNav, Sheet, Avatar, toast, Confetti } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { Coin } from '@/ui/art.jsx'
import { tr, money, compact, haptic, shareLink, timeAgo } from '@/core/util.js'
import { builtinReels, fakeComments } from '@/core/reels.js'
import { SITE_URL } from '@/core/config.js'
import { watchViews, watchLikes, watchReelStats, watchCustomReels, claimReel, likeReel, shareReel, watchComments, addComment } from '@/core/api.js'

export function useReels() {
  const { settings } = useApp()
  const [custom, setCustom] = useState([])
  useEffect(() => watchCustomReels(setCustom), [])
  return useMemo(() => {
    const rw = settings.rewards
    const c = custom.map((r) => ({ duration: rw.watchSeconds, reward: rw.perReel, image: 'reels/ad.jpg', baseLikes: 0, baseComments: 0, baseShares: 0, ...r })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return [...c, ...(rw.builtinReels ? builtinReels(rw) : [])]
  }, [custom, settings.rewards])
}

export default function Reels({ start }) {
  const nav = useNav()
  const { uid, user, settings } = useApp()
  const reels = useReels()
  const [views, setViews] = useState({})
  const [likes, setLikes] = useState({})
  const [stats, setStats] = useState({})
  const [active, setActive] = useState(0)
  const [commentsFor, setCommentsFor] = useState(null)
  const [confetti, setConfetti] = useState(0)
  const scroller = useRef(null)
  const startedAt = useRef(false)

  useEffect(() => watchViews(uid, (v) => setViews(Object.fromEntries(v.map((x) => [x.id, x])))), [uid])
  useEffect(() => watchLikes(uid, (v) => setLikes(Object.fromEntries(v.map((x) => [x.id, true])))), [uid])
  useEffect(() => watchReelStats((v) => setStats(Object.fromEntries(v.map((x) => [x.id, x])))), [])

  // ابدأ من أول ريل لم يُشاهد
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

  const watched = Object.keys(views).length
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = user.viewsDay === today ? user.viewsToday || 0 : 0
  const left = Math.max(0, settings.rewards.dailyLimit - todayCount)

  const onComplete = async (reel) => {
    if (views[reel.id]) return
    if (left <= 0) { toast(tr('وصلت للحد اليومي للمكافآت، عُد غدًا 🌙', 'Daily reward limit reached'), '', null, 3200); return }
    const r = await claimReel(uid, reel, settings.rewards)
    if (r.ok) { haptic('heavy'); setConfetti((x) => x + 1) }
    else if (r.reason === 'limit') toast(tr('وصلت للحد اليومي للمكافآت', 'Daily limit reached'))
  }

  return (
    <div className="reels">
      <Confetti run={confetti} key={confetti} />
      <div className="reels-top" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.5), transparent)' }}>
        <button className="back" onClick={nav.back}><ArrowLeft size={20} /></button>
        <h2>{tr('ريلز وصلني', 'Wasalni Reels')}</h2>
        <button className="bal" onClick={() => nav.push('rewards')}><span className="coin"><Coin size={18} /></span><span className="num">{money(user.points || 0)}</span></button>
      </div>
      <div className="reels-scroll" ref={scroller}>
        {reels.map((r, i) => (
          <Reel key={r.id} i={i} reel={r} active={i === active} near={Math.abs(i - active) <= 2} seen={!!views[r.id]} liked={!!likes[r.id]} stats={stats[r.id]}
            uid={uid} total={reels.length} onComplete={onComplete} onComments={() => setCommentsFor(r)} />
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 'calc(var(--safe-b) + 4px)', insetInline: 0, textAlign: 'center', fontSize: 11, opacity: 0.6, pointerEvents: 'none', zIndex: 5 }}>
        {tr(`شاهدت ${watched} من ${reels.length} • متبقي اليوم ${left}`, `Watched ${watched}/${reels.length} • ${left} left today`)}
      </div>
      <CommentsSheet reel={commentsFor} onClose={() => setCommentsFor(null)} uid={uid} name={user.name} stats={commentsFor && stats[commentsFor.id]} />
    </div>
  )
}

function Reel({ i, reel, active, near, seen, liked, stats, uid, total, onComplete, onComments }) {
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [heart, setHeart] = useState(0)
  const [earn, setEarn] = useState(false)
  const [follow, setFollow] = useState(false)
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('w_saved') || '[]').includes(reel.id) } catch { return false } })
  const [muted, setMuted] = useState(true)
  const done = useRef(false)
  const lastTap = useRef(0)
  const holdT = useRef(null)
  const vid = useRef(null)
  const dur = reel.duration || 15

  useEffect(() => {
    if (!active) { setElapsed(0); setPaused(false); done.current = false; vid.current?.pause(); return }
    if (vid.current) { vid.current.currentTime = 0; vid.current.play().catch(() => {}) }
    let raf, last = performance.now()
    const tick = (t) => {
      const dt = (t - last) / 1000
      last = t
      if (!document.hidden && !pausedRef.current) {
        setElapsed((e) => {
          const n = Math.min(dur, e + dt)
          if (n >= dur && !done.current) {
            done.current = true
            if (!seen) { setEarn(true); setTimeout(() => setEarn(false), 2300); onComplete(reel) }
          }
          return n >= dur ? 0.0001 + (seen || done.current ? n % dur : n) : n
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
  const pausedRef = useRef(false)
  pausedRef.current = paused
  useEffect(() => { if (vid.current) paused ? vid.current.pause() : active && vid.current.play().catch(() => {}) }, [paused])

  const tap = () => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      setHeart((h) => h + 1); haptic()
      if (!liked) likeReel(uid, reel.id, true)
      lastTap.current = 0
    } else {
      lastTap.current = now
      setTimeout(() => { if (lastTap.current === now) setPaused((p) => !p) }, 290)
    }
  }
  const share = async () => {
    const r = await shareLink({ title: reel.advertiser, text: `${reel.caption}\n— ${tr('شاهد واربح مع وصلني', 'Watch & earn with Wasalni')}`, url: SITE_URL || location.origin })
    if (r) { shareReel(reel.id); if (r === 'copied') toast(tr('الرابط تنسخ', 'Link copied')) }
  }
  const toggleSave = () => {
    const s = !saved
    setSaved(s)
    try {
      const arr = JSON.parse(localStorage.getItem('w_saved') || '[]')
      localStorage.setItem('w_saved', JSON.stringify(s ? [...arr, reel.id] : arr.filter((x) => x !== reel.id)))
    } catch {}
    toast(s ? tr('تسجّل', 'Saved') : tr('تنحّى من المحفوظات', 'Removed'))
  }

  const likes = (reel.baseLikes || 0) + (stats?.likes || 0)
  const comments = (reel.baseComments || 0) + (stats?.comments || 0)
  const shares = (reel.baseShares || 0) + (stats?.shares || 0)
  const pct = Math.min(1, elapsed / dur)
  const C = 2 * Math.PI * 27
  const claimed = seen || (done.current && !seen)
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
          <small className={active ? 'rise' : ''} style={{ animationDelay: '.15s' }}>{reel.cta} ←</small>
        </div>
      )}
      <div className="bars"><i style={{ width: `${pct * 100}%` }} /></div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 3 }} onClick={tap}
        onPointerDown={() => { holdT.current = setTimeout(() => setPaused(true), 350) }}
        onPointerUp={() => clearTimeout(holdT.current)} onPointerLeave={() => clearTimeout(holdT.current)} />
      {paused && active && <div className="paused-ico pop"><Pause size={36} fill="#fff" /></div>}
      {heart > 0 && <Heart key={heart} className="big-heart" size={120} fill="#ff3b5c" />}

      <div className={`reward-ring ${claimed ? 'done' : ''}`}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill={claimed ? 'var(--success)' : 'rgba(0,0,0,.35)'} stroke="rgba(255,255,255,.2)" strokeWidth="5" />
          {!claimed && <circle cx="32" cy="32" r="27" fill="none" stroke="url(#rg2)" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />}
          <defs><linearGradient id="rg2"><stop offset="0" stopColor="#FFD36B" /><stop offset="1" stopColor="#FF8A2A" /></linearGradient></defs>
        </svg>
        <div className="rv">
          {claimed ? <span><Check size={18} strokeWidth={3} /><br />{seen && !done.current ? tr('تمت', 'Done') : `+${reel.reward}`}</span>
            : <span><span className="num" style={{ color: '#FFD36B' }}>+{reel.reward}</span><br /><span className="num" style={{ fontSize: 11, opacity: 0.85 }}>{secsLeft}s</span></span>}
        </div>
      </div>
      {earn && (
        <div className="earn-pop">
          <div className="coinbig num">+{reel.reward}</div>
          <b>{tr(`ربحت ${money(reel.reward)}`, `You earned ${money(reel.reward)}`)}</b>
          <div className="small" style={{ opacity: 0.9 }}>{tr('تزادت في رصيد الكادوات', 'Added to your rewards')}</div>
        </div>
      )}

      <div className="side">
        <button className={liked ? 'liked' : ''} onClick={() => { likeReel(uid, reel.id, !liked); haptic() }}><Heart size={31} />{compact(likes)}</button>
        <button onClick={onComments}><MessageCircle size={30} />{compact(comments)}</button>
        <button onClick={share}><Send size={28} />{compact(shares)}</button>
        <button className={saved ? 'saved' : ''} onClick={toggleSave}><Bookmark size={28} /></button>
        {reel.video && <button onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={26} /> : <Volume2 size={26} />}</button>}
        <div className="disc"><img src="brand/mark.svg" alt="" /></div>
      </div>

      <div className="meta">
        <a className={`cta ${elapsed > 3 || !active ? 'hot' : ''}`} href={reel.link || undefined} target="_blank" rel="noreferrer" onClick={(e) => !reel.link && e.preventDefault()}>
          {reel.cta}<ChevronLeft size={18} style={{ transform: document.dir === 'rtl' ? '' : 'scaleX(-1)' }} />
        </a>
        <div className="adv">
          <span className="av" style={{ background: reel.tint || 'var(--brand)' }}>{reel.advertiser?.[0]}</span>
          <div>
            <b>{reel.advertiser} <BadgeCheck size={15} fill="#3897f0" color="#fff" /></b>
            <small>{reel.handle ? '@' + reel.handle : ''} • <span className="sponsored">{tr('سبونسو', 'Sponsored')}</span></small>
          </div>
          <button className={`follow ${follow ? 'on' : ''}`} onClick={() => setFollow(!follow)}>{follow ? tr('راك تتابعو', 'Following') : tr('تابع', 'Follow')}</button>
        </div>
        <div className="cap">{reel.caption}</div>
        <div className="music"><Music2 size={14} /><span>{reel.music || tr('صوت أصلي', 'Original audio')} • {reel.advertiser}</span></div>
        <div className="tiny" style={{ opacity: 0.6, marginTop: 6 }}><span className="num">{i + 1}/{total}</span></div>
      </div>
    </section>
  )
}

function CommentsSheet({ reel, onClose, uid, name, stats }) {
  const [list, setList] = useState([])
  const [text, setText] = useState('')
  useEffect(() => { if (reel) return watchComments(reel.id, setList) }, [reel?.id])
  const fake = useMemo(() => (reel ? fakeComments(reel.id, 8) : []), [reel?.id])
  const all = [...list, ...(reel?.builtin ? fake : [])]
  const send = async () => {
    if (!text.trim()) return
    await addComment(reel.id, uid, name, text.trim())
    setText('')
  }
  return (
    <Sheet open={!!reel} onClose={onClose} title={tr('التعليقات', 'Comments')} style={{ maxHeight: '75vh' }}>
      <div className="comments-sheet">
        {all.length === 0 && <div className="empty" style={{ padding: 24 }}><b>{tr('ما كاين حتى تعليق', 'No comments yet')}</b><div className="small">{tr('كون الأول اللي يعلّق', 'Be the first to comment')}</div></div>}
        {all.map((c) => (
          <div key={c.id} className="comment">
            <Avatar name={c.name} size={36} />
            <div className="cb"><b>{c.name}</b><span>{timeAgo(c.at)}</span><p>{c.text}</p></div>
            <Heart size={14} color="var(--faint)" />
          </div>
        ))}
        <div className="comment-input">
          <Avatar name={name} size={36} />
          <input className="input" style={{ height: 46 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={tr('زيد تعليق…', 'Add a comment…')} />
          <button className="btn btn-primary btn-sm" onClick={send} disabled={!text.trim()}>{tr('انشر', 'Post')}</button>
        </div>
      </div>
    </Sheet>
  )
}
