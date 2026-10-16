import React, { useEffect, useState } from 'react'
import { Play, Trophy, Flame, Eye, Car, Users, Crown, Sparkles, Gift, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Page, useNav } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { Coin } from '@/ui/art.jsx'
import { tr, money, dateTime, num } from '@/core/util.js'
import { watchTx, watchRiderRides } from '@/core/api.js'

export const LEVELS = [
  { id: 'bronze', ar: 'برونزي', en: 'Bronze', min: 0, c: '#C27C4E' },
  { id: 'silver', ar: 'فضي', en: 'Silver', min: 100, c: '#94A3B8' },
  { id: 'gold', ar: 'ذهبي', en: 'Gold', min: 500, c: '#F4B740' },
  { id: 'plat', ar: 'بلاتيني', en: 'Platinum', min: 1500, c: '#7DD3FC' },
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
  const avg = 12
  const lvl = levelOf(user.earnedTotal)
  const next = LEVELS[LEVELS.indexOf(lvl) + 1]
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = user.viewsDay === today ? user.viewsToday || 0 : 0
  const pts = tx.filter((t) => t.currency === 'points')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    return { label: d.toLocaleDateString('ar-LY', { weekday: 'short' }), on: pts.some((t) => t.kind === 'reel' && new Date(t.at).toISOString().slice(0, 10) === key) }
  })
  const streak = (() => { let s = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i].on) s++; else if (i !== days.length - 1) break } return s })()
  const weekRides = rides.filter((r) => r.status === 'completed' && Date.now() - r.createdAt < 7 * 86400000).length
  const missions = [
    { icon: Eye, c: '#E8650A', t: tr('شاهد 5 ريلز اليوم', 'Watch 5 reels today'), p: todayCount, n: 5, r: '🏅' },
    { icon: Flame, c: '#ef4444', t: tr('شاهد 15 ريلز اليوم', 'Watch 15 reels today'), p: todayCount, n: 15, r: '🔥' },
    { icon: Car, c: '#2E90FA', t: tr('أكمل 3 رحلات هذا الأسبوع', 'Complete 3 rides this week'), p: weekRides, n: 3, r: '🚗' },
    { icon: Users, c: '#12B76A', t: tr('ادعُ صديقًا للتسجيل', 'Invite a friend'), p: user.referrals || 0, n: 1, r: '🤝' },
  ]
  return (
    <Page title={tr('المكافآت', 'Rewards')}>
      <div className="rw-hero rise">
        <div className="between" style={{ position: 'relative' }}>
          <span className="lvl"><Crown size={14} color={lvl.c} fill={lvl.c} />{tr(`مستوى ${lvl.ar}`, `${lvl.en} level`)}</span>
          <span className="lvl"><Flame size={14} />{tr(`${streak} أيام`, `${streak} days`)}</span>
        </div>
        <div style={{ position: 'relative', marginTop: 14, opacity: 0.9, fontSize: 14 }}>{tr('رصيد المكافآت', 'Rewards balance')}</div>
        <div className="big" style={{ position: 'relative' }}><span className="num">{num(points)}</span><small>{tr('دينار', 'LYD')}</small></div>
        <div style={{ position: 'relative', fontSize: 13.5 }}>
          {points >= avg ? tr(`🎉 يكفي لـ ${Math.floor(points / avg)} رحلة مجانية تقريبًا`, `🎉 Enough for ~${Math.floor(points / avg)} free rides`) : tr(`باقي ${money(avg - points)} لأول رحلة مجانية`, `${money(avg - points)} to your first free ride`)}
        </div>
        <div className="bar"><i style={{ width: Math.min(100, (points / avg) * 100) + '%' }} /></div>
        {next && <div className="tiny" style={{ position: 'relative', opacity: 0.85 }}>{tr(`${money(next.min - (user.earnedTotal || 0))} للوصول إلى المستوى ${next.ar}`, `${money(next.min - (user.earnedTotal || 0))} to ${next.en}`)}</div>}
      </div>

      <button className="watch-cta rise" style={{ animationDelay: '.08s' }} onClick={() => nav.push('reels')}>
        <span className="thumbs">{[0, 1, 2].map((i) => <div key={i} style={{ backgroundImage: 'url(reels/ad.jpg)', filter: `hue-rotate(${i * 25}deg)` }} />)}</span>
        <span><b>{tr('شاهد واربح الآن', 'Watch & earn now')}</b><small>{tr(`${settings.rewards.perReel} دينار لكل ريل • ${settings.rewards.watchSeconds} ثانية فقط`, `${settings.rewards.perReel} LYD per reel • ${settings.rewards.watchSeconds}s`)}</small></span>
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

      <div className="section-title">{tr('كيف تركب مجانًا؟', 'How to ride free?')}</div>
      <div className="card pad steps3">
        <div className="s"><i>1</i><span>{tr('افتح الريلز وشاهد الإعلان حتى نهايته', 'Open reels and watch an ad to the end')}</span></div>
        <div className="s"><i>2</i><span>{tr(`يُضاف ${settings.rewards.perReel} دينار فورًا لرصيد مكافآتك`, `${settings.rewards.perReel} LYD is added instantly`)}</span></div>
        <div className="s"><i>3</i><span>{tr('عند طلب رحلة اختر الدفع بالنقاط لتكون مجانية', 'Pay with points at checkout for a free ride')}</span></div>
      </div>

      <div className="section-title">{tr('المستويات', 'Levels')}</div>
      <div className="hscroll">
        {LEVELS.map((l) => (
          <div key={l.id} className="card pad" style={{ minWidth: 130, textAlign: 'center', border: l.id === lvl.id ? `2px solid ${l.c}` : undefined }}>
            <Trophy size={26} color={l.c} />
            <div className="bold" style={{ marginTop: 4 }}>{tr(l.ar, l.en)}</div>
            <div className="tiny muted"><span className="num">{money(l.min)}+</span></div>
          </div>
        ))}
      </div>

      <div className="section-title">{tr('سجل النقاط', 'Points history')}</div>
      <div className="list">
        {pts.length === 0 && <div className="empty" style={{ padding: 26 }}><b>{tr('لا توجد حركات بعد', 'No activity yet')}</b><div className="small">{tr('شاهد أول ريل واربح', 'Watch your first reel')}</div></div>}
        {pts.slice(0, 30).map((t) => (
          <div key={t.id} className="tx">
            <span className="txi" style={{ background: t.amount > 0 ? 'var(--success-bg)' : 'var(--brand-50)', color: t.amount > 0 ? 'var(--success)' : 'var(--brand)' }}>{t.kind === 'reel' ? <Sparkles size={18} /> : t.amount > 0 ? <ArrowDownLeft size={18} /> : <Gift size={18} />}</span>
            <div className="txb"><b>{t.title}</b><small>{dateTime(t.at)}</small></div>
            <span className={`amt num ${t.amount > 0 ? 'pos' : ''}`}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</span>
          </div>
        ))}
      </div>
    </Page>
  )
}
