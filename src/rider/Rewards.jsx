import React, { useEffect, useState } from 'react'
import { Play, Trophy, Flame, Eye, Car, Users, Crown, Sparkles, Gift, ArrowDownLeft, ArrowUpRight, Repeat, Wallet, Zap } from 'lucide-react'
import { Page, useNav, Sheet, toast, Confetti } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { Coin } from '@/ui/art.jsx'
import { tr, money, dateTime, num } from '@/core/util.js'
import { watchTx, watchRiderRides, convertPoints } from '@/core/api.js'
import { pointsToDa, daToPoints } from '@/core/config.js'

export const LEVELS = [
  { id: 'bronze', ar: 'برونزي', en: 'Bronze', min: 0, c: '#C27C4E' },
  { id: 'silver', ar: 'فضي', en: 'Silver', min: 2000, c: '#94A3B8' },
  { id: 'gold', ar: 'ذهبي', en: 'Gold', min: 10000, c: '#F4B740' },
  { id: 'plat', ar: 'بلاتيني', en: 'Platinum', min: 30000, c: '#7DD3FC' },
]
export const levelOf = (earned = 0) => [...LEVELS].reverse().find((l) => earned >= l.min) || LEVELS[0]

export default function Rewards() {
  const nav = useNav()
  const { uid, user, settings } = useApp()
  const [tx, setTx] = useState([])
  const [rides, setRides] = useState([])
  useEffect(() => watchTx(uid, setTx), [uid])
  useEffect(() => watchRiderRides(uid, setRides), [uid])
  const points = user.points || 0
  const rw = settings.rewards
  const eco = settings.pricing.classes[0]
  const avg = daToPoints(Math.max(eco?.min || 200, 300), rw)
  const [conv, setConv] = useState(false)
  const [fire, setFire] = useState(0)
  const lvl = levelOf(user.earnedTotal)
  const next = LEVELS[LEVELS.indexOf(lvl) + 1]
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = user.viewsDay === today ? user.viewsToday || 0 : 0
  const pts = tx.filter((t) => t.currency === 'points')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    return { label: d.toLocaleDateString('ar-DZ', { weekday: 'short' }), on: pts.some((t) => t.kind === 'reel' && new Date(t.at).toISOString().slice(0, 10) === key) }
  })
  const streak = (() => { let s = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i].on) s++; else if (i !== days.length - 1) break } return s })()
  const weekRides = rides.filter((r) => r.status === 'completed' && Date.now() - r.createdAt < 7 * 86400000).length
  const missions = [
    { icon: Eye, c: '#E8650A', t: tr('شوف 5 ريلز اليوم', 'Watch 5 reels today'), p: todayCount, n: 5, r: '🏅' },
    { icon: Flame, c: '#ef4444', t: tr('شوف 15 ريلز اليوم', 'Watch 15 reels today'), p: todayCount, n: 15, r: '🔥' },
    { icon: Car, c: '#2E90FA', t: tr('كمّل 3 كورسات هاد السمانة', 'Complete 3 rides this week'), p: weekRides, n: 3, r: '🚗' },
    { icon: Users, c: '#12B76A', t: tr('عرّض صاحبك يسجّل', 'Invite a friend'), p: user.referrals || 0, n: 1, r: '🤝' },
  ]
  return (
    <Page title={tr('الكادوات', 'Rewards')}>
      <div className="rw-hero rise">
        <div className="between" style={{ position: 'relative' }}>
          <span className="lvl"><Crown size={14} color={lvl.c} fill={lvl.c} />{tr(`مستوى ${lvl.ar}`, `${lvl.en} level`)}</span>
          <span className="lvl"><Flame size={14} />{tr(`${streak} أيام`, `${streak} days`)}</span>
        </div>
        <div style={{ position: 'relative', marginTop: 14, opacity: 0.9, fontSize: 14 }}>{tr('رصيد النقاط', 'Points balance')}</div>
        <div className="big" style={{ position: 'relative' }}><span className="num">{num(points)}</span><small>{tr('نقطة', 'pts')}</small></div>
        <div style={{ position: 'relative', fontSize: 13.5 }}>
          {points >= avg ? tr(`🎉 يكفيو لـ ${Math.floor(points / avg)} كورسة بلاش تقريبًا`, `🎉 Enough for ~${Math.floor(points / avg)} free rides`) : tr(`باقي ${num(avg - points)} نقطة لأول كورسة بلاش`, `${num(avg - points)} pts to your first free ride`)}
        </div>
        <div className="bar"><i style={{ width: Math.min(100, (points / avg) * 100) + '%' }} /></div>
        {next && <div className="tiny" style={{ position: 'relative', opacity: 0.85 }}>{tr(`${num(next.min - (user.earnedTotal || 0))} نقطة باش توصل للمستوى ${next.ar}`, `${num(next.min - (user.earnedTotal || 0))} pts to ${next.en}`)}</div>}
      </div>

      <Confetti run={fire} key={fire} />
      <div className="convert-card rise">
        <span className="cv-ico"><Repeat size={22} /></span>
        <span className="grow">
          <b>{tr('حوّل النقاط لدراهم', 'Convert points to cash')}</b>
          <small>{rw.autoConvert ? tr(`التحويل أوتوماتيكي كي توصل ${num(rw.autoConvertAt)} نقطة`, `Auto-converts at ${num(rw.autoConvertAt)} pts`) : tr('يدخلو للبورتفاي في بلاصتهم', 'Goes straight to your wallet')}</small>
        </span>
        <button className="btn btn-primary btn-sm" disabled={points < (rw.minConvert || 0)} onClick={() => setConv(true)}>{tr('حوّل', 'Convert')}</button>
      </div>
      {points < (rw.minConvert || 0) && <div className="tiny muted center" style={{ marginTop: 6 }}>{tr(`أقل تحويل ${num(rw.minConvert)} نقطة`, `Minimum ${num(rw.minConvert)} pts`)}</div>}
      <ConvertSheet open={conv} onClose={() => setConv(false)} points={points} rw={rw} onDone={async (p) => {
        const r = await convertPoints(uid, rw, p)
        if (r.ok) { setConv(false); setFire((x) => x + 1); toast(tr(`تحوّلو ${num(r.points)} نقطة ← ${money(r.da)} في البورتفاي`, `${num(r.points)} pts → ${money(r.da)}`), 'success', <Wallet size={18} />, 3500, 'coin') }
        else toast(tr('ما قدرناش نحوّلو، عاود', 'Could not convert'), 'error')
      }} />

      <button className="watch-cta rise" style={{ animationDelay: '.08s' }} onClick={() => nav.push('reels')}>
        <span className="thumbs">{[0, 1, 2].map((i) => <div key={i} style={{ backgroundImage: 'url(reels/ad.jpg)', filter: `hue-rotate(${i * 25}deg)` }} />)}</span>
        <span><b>{tr('شوف واربح دروك', 'Watch & earn now')}</b><small>{tr(`${rw.pointsPerReel} نقطة على كل إشهار • ${rw.watchSeconds} ثانية برك`, `${rw.pointsPerReel} pts per ad • ${rw.watchSeconds}s`)}</small></span>
        <span className="play"><Play size={20} fill="#fff" /></span>
      </button>

      <div className="section-title">{tr('سلسلة المشاهدة', 'Watch streak')}</div>
      <div className="streak">{days.map((d, i) => <div key={i} className={d.on ? 'on' : ''}><b>{d.on ? '🔥' : '•'}</b>{d.label}</div>)}</div>

      <div className="section-title">{tr('المهام', 'Missions')}</div>
      <div className="list">
        {missions.map((m, i) => (
          <div key={i} className="mission">
            <span className="mi" style={{ background: `color-mix(in srgb, ${m.c} 14%, transparent)`, color: m.c }}><m.icon size={22} /></span>
            <div className="mb">
              <div className="between"><b>{m.t}</b><span className="badge">{m.r}</span></div>
              <div className="mbar"><i style={{ width: Math.min(100, (m.p / m.n) * 100) + '%' }} /></div>
              <div className="tiny muted" style={{ marginTop: 4 }}><span className="num">{Math.min(m.p, m.n)}/{m.n}</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">{tr('كيفاش تركب بلاش؟', 'How to ride free?')}</div>
      <div className="card pad steps3">
        <div className="s"><i>1</i><span>{tr('حل الريلز وشوف الإشهار حتى للخر', 'Open reels and watch an ad to the end')}</span></div>
        <div className="s"><i>2</i><span>{tr(`تتزادلك ${rw.pointsPerReel} نقطة في بلاصتها`, `${rw.pointsPerReel} points are added instantly`)}</span></div>
        <div className="s"><i>3</i><span>{tr('حوّل النقاط لدراهم في البورتفاي، ولا خلّص بيهم الكورسة مباشرة', 'Convert points to wallet cash or pay rides with them')}</span></div>
      </div>

      <div className="section-title">{tr('المستويات', 'Levels')}</div>
      <div className="hscroll">
        {LEVELS.map((l) => (
          <div key={l.id} className="card pad" style={{ minWidth: 130, textAlign: 'center', border: l.id === lvl.id ? `2px solid ${l.c}` : undefined }}>
            <Trophy size={26} color={l.c} />
            <div className="bold" style={{ marginTop: 4 }}>{tr(l.ar, l.en)}</div>
            <div className="tiny muted"><span className="num">{num(l.min)}+</span></div>
          </div>
        ))}
      </div>

      <div className="section-title">{tr('تاريخ النقاط', 'Points history')}</div>
      <div className="list">
        {pts.length === 0 && <div className="empty" style={{ padding: 26 }}><b>{tr('ما كاين حتى حركة', 'No activity yet')}</b><div className="small">{tr('شوف أول ريل واربح', 'Watch your first reel')}</div></div>}
        {pts.slice(0, 30).map((t) => (
          <div key={t.id} className="tx">
            <span className="txi" style={{ background: t.amount > 0 ? 'var(--success-bg)' : 'var(--brand-50)', color: t.amount > 0 ? 'var(--success)' : 'var(--brand)' }}>{t.kind === 'reel' ? <Sparkles size={18} /> : t.amount > 0 ? <ArrowDownLeft size={18} /> : <Gift size={18} />}</span>
            <div className="txb"><b>{t.title}</b><small>{dateTime(t.at)}</small></div>
            <span className={`amt num ${t.amount > 0 ? 'pos' : ''}`}>{t.amount > 0 ? '+' : ''}{num(t.amount)}</span>
          </div>
        ))}
      </div>
    </Page>
  )
}

function ConvertSheet({ open, onClose, points, rw, onDone }) {
  const [p, setP] = useState(points)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setP(points) }, [open, points])
  const min = rw.minConvert || 0
  const step = 100
  return (
    <Sheet open={open} onClose={onClose} title={tr('تحويل النقاط', 'Convert points')} sub={tr('اختار شحال من نقطة تحب تحوّل للبورتفاي', 'Choose how many points to convert')}>
      <div className="conv-box">
        <div className="conv-side"><Coin size={26} /><b className="num">{num(p)}</b><small>{tr('نقطة', 'pts')}</small></div>
        <span className="conv-arrow"><Zap size={18} /></span>
        <div className="conv-side"><Wallet size={26} color="var(--brand)" /><b className="num">{money(pointsToDa(p, rw))}</b><small>{tr('في البورتفاي', 'to wallet')}</small></div>
      </div>
      <input className="range mt" type="range" min={Math.min(min, points)} max={points} step={step} value={p} onChange={(e) => setP(+e.target.value)} />
      <div className="hscroll" style={{ margin: '10px 0' }}>
        {[0.25, 0.5, 1].map((f) => <button key={f} className="chip" onClick={() => setP(Math.max(min, Math.floor((points * f) / step) * step))}>{f === 1 ? tr('الكل', 'All') : `${f * 100}%`}</button>)}
      </div>
      <button className="btn btn-primary btn-block btn-lg" disabled={busy || p < min || p > points} onClick={async () => { setBusy(true); await onDone(p); setBusy(false) }}>{busy ? <span className="spinner" /> : tr('أكّد التحويل', 'Confirm')}</button>
    </Sheet>
  )
}
