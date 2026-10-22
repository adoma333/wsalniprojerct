import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, XCircle, ThumbsDown, User, Mail, Shuffle, Car, FileText, Languages, Settings as SetIco, LogOut, UserX, Camera, Copy, Share2, Gift,
  Users, CalendarClock, ArrowDownLeft, ArrowUpRight, TrendingUp, Clock, Wallet as WalletIco, MapPin, Banknote, Info,
  Plus, AlertTriangle, Landmark, Smartphone, CreditCard, Hash, ShieldCheck, Bus,
} from 'lucide-react'
import { watchLines, demoLines, linePath, measure, project, pushBus, stopBus } from '@/core/bus.js'
import { watchPosition, currentPosition } from '@/core/geo.js'
import { Page, Empty, Row, Sheet, toast, Avatar, Stars, useNav } from '@/ui/kit.jsx'
import Scanner from '@/ui/Scanner.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { ClassCar } from '@/ui/art.jsx'
import { StatusBadge, RouteSummary, Plate, ChatPage } from '@/ui/ride-ui.jsx'
import { tr, money, dateTime, km, mins, copy, shareLink, compressImage, isAr, LANG } from '@/core/util.js'
import { CITIES, SITE_URL } from '@/core/config.js'
import { driverNet } from '@/core/pricing.js'
import { watchDriverRides, updateDriver, deleteAccount, store, updateRide, watchTx, watchMyWithdrawals, watchMyTopupsAs, requestWithdraw, WITHDRAW_METHODS } from '@/core/api.js'
import { DOC_LIST } from './App.jsx'
import { rating } from './Home.jsx'
export { Notifications, Support, Settings } from '@/ui/common-pages.jsx'
export { ChatPage }

function useMyRides() {
  const { uid } = useApp()
  const [rides, setRides] = useState(null)
  useEffect(() => watchDriverRides(uid, setRides), [uid])
  return rides
}
const netOf = (r, p) => (r.driverNet ?? driverNet(r.fare?.total || 0, p).net) + (r.tip || 0)

export function Trips() {
  const rides = useMyRides()
  const nav = useNav()
  const { settings } = useApp()
  const [tab, setTab] = useState('done')
  const list = (rides || []).filter((r) => (tab === 'done' ? r.status === 'completed' : r.status === 'cancelled'))
  return (
    <Page title={tr('الكورسات', 'Trips')}>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>{tr('الكاملين', 'Completed')}</button>
        <button className={tab === 'cancel' ? 'active' : ''} onClick={() => setTab('cancel')}>{tr('الملغيين', 'Cancelled')}</button>
      </div>
      {rides && list.length === 0 && <Empty icon={<Car size={36} />} title={tr('ما كاين حتى كورسة', 'No trips')} sub={tr('تكونيكتا واستقبل أول طلب', 'Go online to get your first request')} />}
      <div className="col" style={{ gap: 10 }}>
        {list.map((r) => (
          <button key={r.id} className="card pad" style={{ textAlign: 'start' }} onClick={() => nav.push('trip', { id: r.id })}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span><b>{r.riderName}</b><div className="tiny muted">{dateTime(r.createdAt)}</div></span>
              <span style={{ textAlign: 'end' }}><b className="num" style={{ color: 'var(--success)' }}>+{money(netOf(r, settings.pricing))}</b><div><StatusBadge s={r.status} /></div></span>
            </div>
            <RouteSummary ride={r} compact />
          </button>
        ))}
      </div>
    </Page>
  )
}

export function TripDetail({ id }) {
  const [r, setR] = useState(null)
  const { settings } = useApp()
  useEffect(() => store.watch(`rides/${id}`, setR), [id])
  if (!r) return <Page title={tr('تفاصيل الكورسة', 'Trip')} />
  const { net, commission } = driverNet(r.fare?.total || 0, settings.pricing)
  return (
    <Page title={tr('تفاصيل الكورسة', 'Trip')}>
      <div className="card pad">
        <div className="between"><StatusBadge s={r.status} /><span className="tiny muted">{dateTime(r.createdAt)}</span></div>
        <div className="mt"><RouteSummary ride={r} compact /></div>
        <div className="grid3 mt" style={{ background: 'var(--card-2)', borderRadius: 16 }}>
          <div className="stat"><b className="num">{km(r.route?.distanceKm || 0)}</b><small>{tr('المسافة', 'Distance')}</small></div>
          <div className="stat"><b className="num">{mins(r.route?.durationMin || 0)}</b><small>{tr('المدة', 'Time')}</small></div>
          <div className="stat"><b>{r.className}</b><small>{tr('الفئة', 'Class')}</small></div>
        </div>
      </div>
      <div className="section-title">{tr('المدخول', 'Earnings')}</div>
      <div className="list">
        <Row title={tr('سومة الكورسة', 'Fare')} right={<span className="num">{money(r.fare?.total)}</span>} chevron={false} />
        <Row title={tr(`عمولة التطبيق (${settings.pricing.commission}%)`, 'Commission')} right={<span className="num" style={{ color: 'var(--danger)' }}>-{money(r.commission ?? commission)}</span>} chevron={false} />
        {r.tip > 0 && <Row title={tr('بوربوار', 'Tip')} right={<span className="num">{money(r.tip)}</span>} chevron={false} />}
        <Row title={<b>{tr('الصافي تاعك', 'Your net')}</b>} sub={r.payment === 'cash' ? tr('تم التحصيل كاش', 'Collected in cash') : tr('يضاف لمحفظتك', 'Added to wallet')} right={<b className="num" style={{ color: 'var(--success)', fontSize: 18 }}>{money((r.driverNet ?? net) + (r.tip || 0))}</b>} chevron={false} />
      </div>
      {r.ratingByRider && <div className="card pad mt center"><div className="small muted">{tr('تقييم الزبون ليك', 'Rider rating')}</div><Stars value={r.ratingByRider} size={24} />{r.riderComment && <div className="small mt">"{r.riderComment}"</div>}</div>}
    </Page>
  )
}

export function Scheduled() {
  const { uid, driver } = useApp()
  const [list, setList] = useState([])
  useEffect(() => store.watchList('rides', { where: [['status', '==', 'scheduled']] }, (r) => setList(r.sort((a, b) => a.scheduledAt - b.scheduledAt))), [])
  const take = async (r) => {
    await updateRide(r.id, { driverId: uid, driver: { id: uid, name: driver.name, phone: driver.phone, rating: rating(driver), car: `${driver.vehicle?.make} ${driver.vehicle?.model}`, color: driver.vehicle?.color, plate: driver.vehicle?.plate } })
    toast(tr('الكورسة تحجزت ليك ✅', 'Booked for you ✅'), 'success')
  }
  const start = async (r) => { await updateRide(r.id, { status: 'accepted', acceptedAt: Date.now(), phaseAt: Date.now() }); history.back() }
  return (
    <Page title={tr('كورسات مبرمجة', 'Scheduled rides')}>
      {list.length === 0 && <Empty icon={<CalendarClock size={36} />} title={tr('ما كاين حتى حجز دروك', 'No bookings')} sub={tr('هنا يبانو الكورسات المحجوزة في ولايتك', 'Pre-booked rides appear here')} />}
      <div className="col" style={{ gap: 10 }}>
        {list.map((r) => (
          <div key={r.id} className="card pad">
            <div className="between"><span className="badge blue"><CalendarClock size={12} />{dateTime(r.scheduledAt)}</span><b className="num">{money(r.fare?.total)}</b></div>
            <div className="mt"><RouteSummary ride={r} compact /></div>
            {!r.driverId && <button className="btn btn-primary btn-block btn-sm mt" onClick={() => take(r)}>{tr('احجزهالي', 'Take it')}</button>}
            {r.driverId === uid && <button className="btn btn-success btn-block btn-sm mt" onClick={() => start(r)}>{tr('روح للزبون دروك', 'Start now')}</button>}
            {r.driverId && r.driverId !== uid && <div className="badge gray mt">{tr('محجوزة لشيفور آخر', 'Taken')}</div>}
          </div>
        ))}
      </div>
    </Page>
  )
}

export function Earnings() {
  const rides = useMyRides() || []
  const { settings, driver } = useApp()
  const [range, setRange] = useState('week')
  const done = rides.filter((r) => r.status === 'completed')
  const since = { day: Date.now() - 86400000, week: Date.now() - 7 * 86400000, month: Date.now() - 30 * 86400000 }[range]
  const inRange = done.filter((r) => (r.completedAt || r.createdAt) >= since)
  const total = inRange.reduce((s, r) => s + netOf(r, settings.pricing), 0)
  const gross = inRange.reduce((s, r) => s + (r.fare?.total || 0), 0)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    const v = done.filter((r) => new Date(r.completedAt || r.createdAt).toISOString().slice(0, 10) === key).reduce((s, r) => s + netOf(r, settings.pricing), 0)
    return { label: d.toLocaleDateString(isAr ? 'ar-DZ' : 'en', { weekday: 'short' }), v, today: i === 6 }
  })
  const max = Math.max(10, ...days.map((d) => d.v))
  return (
    <Page title={tr('المدخول', 'Earnings')}>
      <div className="tabs">
        {[['day', tr('اليوم', 'Today')], ['week', tr('السمانة', 'Week')], ['month', tr('الشهر', 'Month')]].map(([k, l]) => <button key={k} className={range === k ? 'active' : ''} onClick={() => setRange(k)}>{l}</button>)}
      </div>
      <div className="wallet-card mt rise">
        <div className="small" style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>{tr('صافي الأرباح', 'Net earnings')}</div>
        <div className="wbig num" style={{ position: 'relative', zIndex: 1 }}>{money(total)}</div>
        <div className="wrow">
          <div><small>{tr('الكورسات', 'Trips')}</small><b className="num">{inRange.length}</b></div>
          <div><small>{tr('المجموع', 'Gross')}</small><b className="num">{money(gross)}</b></div>
          <div><small>{tr('التقييم', 'Rating')}</small><b className="num">★ {rating(driver)}</b></div>
        </div>
      </div>
      <div className="section-title">{tr('آخر 7 أيام', 'Last 7 days')}</div>
      <div className="card pad">
        <div className="chart">
          {days.map((d, i) => (
            <div key={i}>
              <span className="tiny num" style={{ color: 'var(--muted)' }}>{d.v ? Math.round(d.v) : ''}</span>
              <i className={d.v ? '' : 'dim'} style={{ height: `${(d.v / max) * 100}%` }} />
              <small style={d.today ? { color: 'var(--brand)', fontWeight: 700 } : null}>{d.label}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="grid2 mt">
        <div className="card stat"><TrendingUp size={20} color="var(--success)" /><b className="num">{money(inRange.length ? total / inRange.length : 0)}</b><small>{tr('متوسط الكورسة', 'Avg per trip')}</small></div>
        <div className="card stat"><Clock size={20} color="var(--info)" /><b className="num">{Math.round(((driver.onlineMs || 0) / 3600000) * 10) / 10}h</b><small>{tr('سوايع اليوم', 'Hours today')}</small></div>
      </div>
      <div className="card pad mt flex small" style={{ background: 'var(--info-bg)', border: 0 }}><Info size={18} color="var(--info)" />{tr(`عمولة وصلني ${settings.pricing.commission}% فقط من كل كورسة. الإكراميات لك بالكامل.`, `Only ${settings.pricing.commission}% commission. Tips are 100% yours.`)}</div>
    </Page>
  )
}

export function Wallet() {
  const { uid, driver, settings } = useApp()
  const nav = useNav()
  const rides = useMyRides() || []
  const [txs, setTxs] = useState([])
  const [wds, setWds] = useState([])
  const [tops, setTops] = useState([])
  useEffect(() => watchTx(uid, setTxs, 'driver'), [uid])
  useEffect(() => watchMyWithdrawals(uid, setWds), [uid])
  useEffect(() => watchMyTopupsAs(uid, (t) => setTops(t.filter((x) => x.status !== 'paid'))), [uid])
  const dw = settings.driverWallet || {}
  const bal = driver.wallet || 0
  const low = bal < (dw.minBalance ?? -1000)
  // الحركات: الكورسات + الشحن + السحب + المكافآت، مرتبة بالوقت
  const items = useMemo(() => {
    const out = rides.filter((r) => r.status === 'completed').slice(0, 60).map((r) => {
      const { net, commission } = driverNet(r.fare?.total || 0, settings.pricing)
      const cash = r.payment === 'cash'
      return { at: r.completedAt || r.createdAt, title: cash ? tr('عمولة كورسة كاش', 'Cash trip commission') : tr('مدخول كورسة مخلّصة', 'Prepaid trip earnings'), sub: r.riderName, amount: cash ? -(r.commission ?? commission) : r.driverNet ?? net, kind: cash ? 'out' : 'in' }
    })
    for (const t of txs) out.push({ at: t.at, title: t.title, sub: { topup: tr('شحن', 'Top-up'), withdraw: tr('سحب', 'Withdrawal'), bonus: tr('مكافأة', 'Bonus'), refund: tr('إرجاع', 'Refund') }[t.kind] || '', amount: t.amount, kind: t.amount >= 0 ? 'in' : 'out' })
    return out.sort((a, b) => b.at - a.at).slice(0, 80)
  }, [rides, txs])
  const pendingW = wds.filter((w) => w.status === 'pending')
  return (
    <Page title={tr('البورتفاي', 'Wallet')}>
      <div className="wallet-card rise">
        <div className="small" style={{ opacity: 0.75, position: 'relative', zIndex: 1 }}>{tr('رصيد البورتفاي', 'Wallet balance')}</div>
        <div className="wbig num" style={{ position: 'relative', zIndex: 1, color: bal < 0 ? '#ffb4a8' : '#fff' }}>{money(bal)}</div>
        <div className="small" style={{ position: 'relative', zIndex: 1, opacity: 0.85 }}>{bal < 0 ? tr('عمولات لازم تخلصها للتطبيق من الكورسات كاش', 'Commission owed from cash trips') : tr('الدراهم تاعك من الكورسات المخلّصة والمكافآت', 'Your earnings from prepaid trips & bonuses')}</div>
        <div className="flex" style={{ position: 'relative', zIndex: 1, gap: 10, marginTop: 14 }}>
          {dw.topup !== false && <button className="btn grow" style={{ background: '#fff', color: 'var(--ink)' }} onClick={() => nav.push('topup')}><Plus size={18} />{tr('اشحن', 'Top up')}</button>}
          {dw.withdraw !== false && <button className="btn grow" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }} disabled={bal < (dw.withdrawMin || 0)} onClick={() => nav.push('withdraw')}><ArrowUpRight size={18} />{tr('اسحب', 'Withdraw')}</button>}
        </div>
      </div>
      {low && <div className="card pad mt small flex" style={{ background: 'var(--danger-bg)', border: 0 }}><AlertTriangle size={20} color="var(--danger)" /><span><b>{tr('الرصيد تحت الحد المسموح', 'Balance below the limit')}</b><br />{tr(`ما تقدرش تتكونيكتا حتى تشحن البورتفاي (الحد: ${money(dw.minBalance)})`, `Top up to go online (limit ${money(dw.minBalance)})`)}</span></div>}
      {!low && bal >= 0 && bal < (dw.withdrawMin || 0) && <div className="card pad mt tiny muted flex" style={{ boxShadow: 'none', background: 'var(--card-2)' }}><Info size={16} />{tr(`أقل مبلغ للسحب ${money(dw.withdrawMin)}`, `Minimum withdrawal ${money(dw.withdrawMin)}`)}</div>}
      {(pendingW.length > 0 || tops.length > 0) && (
        <>
          <div className="section-title">{tr('في الانتظار', 'Pending')}</div>
          <div className="list">
            {pendingW.map((w) => <div key={w.id} className="tx"><span className="txi" style={{ background: 'var(--warning-bg)', color: '#a16207' }}><Clock size={18} /></span><div className="txb"><b>{tr('طلب سحب', 'Withdrawal')} • {WITHDRAW_METHODS[w.method]}</b><small>{dateTime(w.at)} • {tr('يتحوّل خلال 24–48 ساعة', 'Processed within 24–48h')}</small></div><span className="amt num">-{money(w.amount)}</span></div>)}
            {tops.map((t) => <div key={t.id} className="tx"><span className="txi" style={{ background: t.status === 'rejected' ? 'var(--danger-bg)' : 'var(--warning-bg)', color: t.status === 'rejected' ? 'var(--danger)' : '#a16207' }}><Clock size={18} /></span><div className="txb"><b>{tr('شحن', 'Top-up')} • {t.status === 'rejected' ? tr('مرفوض', 'Rejected') : tr('في المراجعة', 'Under review')}</b><small>{dateTime(t.at)}{t.note ? ' • ' + t.note : ''}</small></div><span className="amt num">{money(t.amount)}</span></div>)}
          </div>
        </>
      )}
      <div className="section-title">{tr('الحركات', 'Transactions')}</div>
      <div className="list">
        {items.length === 0 && <div className="empty" style={{ padding: 24 }}><b>{tr('ما كاين حتى حركة', 'No transactions')}</b></div>}
        {items.map((x, i) => (
          <div key={i} className="tx">
            <span className="txi" style={{ background: x.kind === 'out' ? 'var(--danger-bg)' : 'var(--success-bg)', color: x.kind === 'out' ? 'var(--danger)' : 'var(--success)' }}>{x.kind === 'out' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
            <div className="txb"><b>{x.title}</b><small>{dateTime(x.at)}{x.sub ? ' • ' + x.sub : ''}</small></div>
            <span className={`amt num ${x.amount >= 0 ? 'pos' : ''}`}>{x.amount >= 0 ? '+' : '-'}{money(Math.abs(x.amount))}</span>
          </div>
        ))}
      </div>
    </Page>
  )
}

// ===== سحب الأرباح =====
export function Withdraw() {
  const { uid, driver, settings } = useApp()
  const nav = useNav()
  const dw = settings.driverWallet || {}
  const bal = Math.floor(driver.wallet || 0)
  const [f, setF] = useState(() => ({ amount: bal, method: driver.payout?.method || 'ccp', account: driver.payout?.account || '', name: driver.payout?.name || driver.name || '' }))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const okAcc = f.method === 'ccp' ? /^\d{6,12}\s*\d{2}$/.test(f.account.replace(/[^\d ]/g, '').trim()) || f.account.replace(/\D/g, '').length >= 8 : f.account.replace(/\D/g, '').length >= 18
  const ok = f.amount >= (dw.withdrawMin || 0) && f.amount <= bal && okAcc && f.name.trim().length >= 3
  const submit = async () => {
    setBusy(true)
    try {
      await requestWithdraw(uid, f, dw)
      updateDriver(uid, { payout: { method: f.method, account: f.account, name: f.name } }).catch(() => {})
      setDone(f.amount)
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  if (done) return (
    <Page title={tr('سحب الأرباح', 'Withdraw')} foot={<button className="btn btn-dark btn-block btn-lg" onClick={() => nav.back()}>{tr('رجوع للبورتفاي', 'Back to wallet')}</button>}>
      <div className="center col rise" style={{ paddingTop: 30, alignItems: 'center' }}>
        <div className="pop" style={{ width: 96, height: 96, borderRadius: 48, background: 'var(--success-bg)', color: 'var(--success)', display: 'grid', placeItems: 'center' }}><CheckCircle2 size={52} /></div>
        <h2 style={{ margin: '14px 0 4px' }}>{tr('الطلب تبعث ✅', 'Request sent ✅')}</h2>
        <b className="num" style={{ fontSize: 30 }}>{money(done)}</b>
        <div className="small muted" style={{ maxWidth: 300 }}>{tr('المبلغ تحجز من رصيدك، ويتحوّل لحسابك خلال 24–48 ساعة. إذا ترفض الطلب يرجع للبورتفاي وحدو.', 'Funds are held and transferred within 24–48h. Refunded automatically if rejected.')}</div>
      </div>
    </Page>
  )
  return (
    <Page title={tr('سحب الأرباح', 'Withdraw')} foot={<button className="btn btn-primary btn-block btn-lg" disabled={!ok || busy} onClick={submit}>{busy ? <span className="spinner" /> : <>{tr('اسحب', 'Withdraw')} <span className="num">{money(f.amount || 0)}</span></>}</button>}>
      <div className="topup-bal"><small>{tr('متاح للسحب', 'Available')}</small><b className="num">{money(bal)}</b></div>
      <div className="field mt"><label>{tr('المبلغ', 'Amount')}</label>
        <div className="input-wrap"><Banknote size={18} /><input className="input num" inputMode="numeric" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: Math.min(bal, +e.target.value.replace(/\D/g, '') || 0) })} /><span className="suffix muted small" style={{ padding: '0 12px' }}>{tr('دج', 'DA')}</span></div>
        <div className="flex" style={{ gap: 6, marginTop: 8 }}>{[0.25, 0.5, 1].map((x) => <button key={x} className="chip" onClick={() => setF({ ...f, amount: Math.floor(bal * x) })}>{x === 1 ? tr('الكل', 'All') : `${x * 100}%`}</button>)}</div>
      </div>
      <div className="section-title">{tr('وين نحوّلولك؟', 'Payout method')}</div>
      <div className="col" style={{ gap: 8 }}>
        {Object.entries(WITHDRAW_METHODS).map(([k, l]) => (
          <button key={k} className={`method ${f.method === k ? 'active' : ''}`} onClick={() => setF({ ...f, method: k })}>
            <span className="m-ico" style={{ background: k === 'ccp' ? '#FEF3C7' : k === 'baridimob' ? '#DBEAFE' : '#E0F2F1', color: k === 'ccp' ? '#B8860B' : k === 'baridimob' ? '#1D4ED8' : '#0F766E' }}>{k === 'bank' ? <Landmark size={20} /> : k === 'baridimob' ? <Smartphone size={20} /> : <CreditCard size={20} />}</span>
            <span className="grow" style={{ textAlign: 'start' }}><b>{l}</b></span>
            <span className={`radio ${f.method === k ? 'on' : ''}`} />
          </button>
        ))}
      </div>
      <div className="field mt"><label>{f.method === 'ccp' ? tr('رقم CCP والمفتاح', 'CCP number + key') : tr('رقم RIP (20 رقم)', 'RIP (20 digits)')}</label><div className="input-wrap"><Hash size={18} /><input className="input num" dir="ltr" inputMode="numeric" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value.slice(0, 26) })} placeholder={f.method === 'ccp' ? '0012345678 90' : '00799999 0012345678 90'} /></div></div>
      <div className="field"><label>{tr('اسم صاحب الحساب', 'Account holder')}</label><div className="input-wrap"><User size={18} /><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div></div>
      <div className="secure-note mt"><ShieldCheck size={16} />{tr('المعلومات تتحفظ للمرات الجاية، والمبلغ يتحجز حتى يتحوّل.', 'Saved for next time; funds held until transferred.')}</div>
    </Page>
  )
}

export function Invite() {
  const { driver } = useApp()
  const link = `${SITE_URL || location.origin}/driver/`
  const share = async () => {
    const r = await shareLink({ title: 'وصلني كابتن', text: tr(`انضم لكباتن وصلني واربح بسيارتك 🚗 استخدم كودي ${driver.referralCode}`, `Drive with Wasalni. Use my code ${driver.referralCode}`), url: link })
    if (r === 'copied') toast(tr('تم النسخ', 'Copied'))
  }
  return (
    <Page title={tr('عرّض الشيفورات', 'Invite drivers')}>
      <div className="rw-hero center rise"><Gift size={54} style={{ position: 'relative' }} /><div style={{ position: 'relative', fontSize: 21, fontWeight: 700, marginTop: 10 }}>{tr('عرّض شيفورات واربح كادوات', 'Invite drivers, earn bonuses')}</div><div style={{ position: 'relative', opacity: 0.9, fontSize: 14 }}>{tr('كادو على كل شيفور يكمّل أول 10 كورسات', 'Bonus for every driver who completes 10 trips')}</div></div>
      <div className="card pad mt center">
        <div className="small muted">{tr('كود الدعوة', 'Invite code')}</div>
        <div className="brand-text num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, margin: '6px 0' }}>{driver.referralCode}</div>
        <div className="grid2">
          <button className="btn btn-ghost" onClick={async () => { await copy(driver.referralCode); toast(tr('تم النسخ', 'Copied')) }}><Copy size={18} />{tr('نسخ', 'Copy')}</button>
          <button className="btn btn-primary" onClick={share}><Share2 size={18} />{tr('بارتاجي', 'Share')}</button>
        </div>
      </div>
    </Page>
  )
}

export function Referrals() {
  const { driver } = useApp()
  const [list, setList] = useState([])
  useEffect(() => store.watchList('drivers', { where: [['referredBy', '==', driver.referralCode]] }, setList), [driver.referralCode])
  return (
    <Page title={tr('الإحالات تاعي', 'My referrals')}>
      {list.length === 0 && <Empty icon={<Users size={36} />} title={tr('ما كاين حتى إحالة', 'No referrals yet')} sub={tr('بارتاجي الكود تاعك مع الشيفورات', 'Share your code with drivers')} />}
      <div className="list">{list.map((d) => <Row key={d.id} icon={<User size={19} />} title={d.name} sub={`${d.trips || 0} ${tr('كورسة', 'trips')}`} right={<StatusBadge s={d.status === 'approved' ? 'completed' : 'searching'} />} />)}</div>
    </Page>
  )
}

export function Profile() {
  const { uid, driver } = useApp()
  const nav = useNav()
  const [del, setDel] = useState(false)
  const rides = useMyRides() || []
  const city = CITIES.find((c) => c.id === driver.city)
  return (
    <Page title={tr('البروفيل', 'My profile')}>
      <div className="profile-head rise">
        <Avatar name={driver.name} src={driver.photo} size={104} />
        <h2>{driver.name}</h2>
        <div style={{ marginTop: 4 }}><Stars value={rating(driver)} size={18} /></div>
      </div>
      <div className="stats3">
        <div><CheckCircle2 size={20} /><b className="num">{rides.filter((r) => r.status === 'completed').length}</b><small>{tr('الكاملين', 'Completed')}</small></div>
        <div><XCircle size={20} /><b className="num">{driver.cancelled || 0}</b><small>{tr('الملغيين', 'Cancelled')}</small></div>
        <div><ThumbsDown size={20} /><b className="num">{driver.declined || 0}</b><small>{tr('مرفوض', 'Declined')}</small></div>
      </div>
      <div className="section-title" />
      <div className="list">
        <Row icon={<User size={19} />} color="#2E90FA" title={tr('بدّل البروفيل', 'Edit profile')} onClick={() => nav.push('edit')} />
        <Row icon={<Mail size={19} />} color="#12B76A" title={tr('البريد الإلكتروني', 'Email')} sub={driver.email || '—'} onClick={() => nav.push('edit')} />
        <Row icon={<Shuffle size={19} />} color="#a16207" title={tr('بدّل الولاية', 'Change city')} sub={city ? (isAr ? city.ar : city.en) : ''} onClick={() => nav.push('city')} />
        <Row icon={<Car size={19} />} color="#06b6d4" title={tr('الطوموبيلات', 'Vehicles')} sub={`${driver.vehicle?.make || ''} ${driver.vehicle?.model || ''}`} onClick={() => nav.push('vehicle')} />
        <Row icon={<FileText size={19} />} color="#64748b" title={tr('الوثائق', 'Documents')} onClick={() => nav.push('documents')} />
        <Row icon={<Languages size={19} />} color="#0f172a" title={tr('لغة', 'Language')} sub={LANG === 'ar' ? 'arabic' : 'english'} onClick={() => nav.push('settings')} />
        <Row icon={<SetIco size={19} />} color="#7c3aed" title={tr('إعدادات', 'Settings')} onClick={() => nav.push('settings')} />
        <Row icon={<LogOut size={19} />} color="#92400e" title={tr('اخرج', 'Log out')} onClick={async () => { await updateDriver(uid, { online: false }).catch(() => {}); const { auth } = await import('@/core/store.js'); await auth.reset(); location.reload() }} />
        <Row icon={<UserX size={19} />} color="#e5484d" title={<span style={{ color: 'var(--danger)' }}>{tr('احذف حسابي', 'Delete account')}</span>} onClick={() => setDel(true)} />
      </div>
      <Sheet open={del} onClose={() => setDel(false)} title={tr('تحذف الحساب نهائيًا؟', 'Delete account?')}>
        <div className="flex">
          <button className="btn btn-ghost grow" onClick={() => setDel(false)}>{tr('ألغي', 'Cancel')}</button>
          <button className="btn grow" style={{ background: 'var(--danger)', color: '#fff' }} onClick={async () => { await deleteAccount('drivers', uid); location.reload() }}>{tr('احذف', 'Delete')}</button>
        </div>
      </Sheet>
    </Page>
  )
}

export function EditProfile() {
  const { uid, driver } = useApp()
  const nav = useNav()
  const [f, setF] = useState({ name: driver.name || '', email: driver.email || '', phone: driver.phone || '', photo: driver.photo || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Page title={tr('بدّل البروفيل', 'Edit profile')} foot={<button className="btn btn-primary btn-block" onClick={async () => { await updateDriver(uid, f); toast(tr('تسجّل', 'Saved'), 'success'); nav.back() }}>{tr('حفظ', 'Save')}</button>}>
      <label className="center" style={{ display: 'block', margin: '10px auto 20px', width: 110, position: 'relative', cursor: 'pointer' }}>
        <Avatar name={f.name} src={f.photo} size={110} />
        <span style={{ position: 'absolute', bottom: 2, insetInlineEnd: 2, width: 36, height: 36, borderRadius: 18, background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', border: '3px solid var(--bg)' }}><Camera size={16} /></span>
        <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setF({ ...f, photo: await compressImage(e.target.files[0], 320, 0.8) })} />
      </label>
      <div className="col">
        <div className="field"><label>{tr('الاسم', 'Name')}</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>{tr('الهاتف', 'Phone')}</label><input className="input" value={f.phone} onChange={set('phone')} style={{ direction: 'ltr' }} /></div>
        <div className="field"><label>{tr('البريد', 'Email')}</label><input className="input" value={f.email} onChange={set('email')} /></div>
      </div>
    </Page>
  )
}

export function City() {
  const { uid, driver } = useApp()
  const nav = useNav()
  return (
    <Page title={tr('بدّل الولاية', 'Change city')}>
      <div className="list">
        {CITIES.map((c) => <Row key={c.id} icon={<MapPin size={19} />} title={isAr ? c.ar : c.en} right={driver.city === c.id && <CheckCircle2 color="var(--success)" />} chevron={false} onClick={async () => { await updateDriver(uid, { city: c.id }); toast(tr('الولاية تبدّلت', 'City updated'), 'success'); nav.back() }} />)}
      </div>
    </Page>
  )
}

export function Vehicle() {
  const { uid, driver } = useApp()
  const nav = useNav()
  const [v, setV] = useState(driver.vehicle || {})
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  return (
    <Page title={tr('المركبة', 'Vehicle')} foot={<button className="btn btn-primary btn-block" onClick={async () => { await updateDriver(uid, { vehicle: v }); toast(tr('تسجّل', 'Saved'), 'success'); nav.back() }}>{tr('حفظ', 'Save')}</button>}>
      <div className="card pad center"><ClassCar type={v.class} w={140} /><div className="mt"><Plate value={v.plate} /></div></div>
      <div className="grid2 mt">
        {[['make', tr('الشركة', 'Make')], ['model', tr('الموديل', 'Model')], ['year', tr('السنة', 'Year')], ['color', tr('اللون', 'Color')]].map(([k, l]) => <div key={k} className="field"><label>{l}</label><input className="input" value={v[k] || ''} onChange={set(k)} /></div>)}
      </div>
      <div className="field mt"><label>{tr('رقم الماتريكول', 'Plate')}</label><input className="input" value={v.plate || ''} onChange={set('plate')} style={{ direction: 'ltr' }} /></div>
    </Page>
  )
}

export function Documents() {
  const { uid, driver } = useApp()
  const docs = driver.docs || {}
  const [scan, setScan] = useState(null)
  const save = async (img) => {
    const k = scan
    setScan(null)
    await updateDriver(uid, { docs: { ...docs, [k]: img }, docsUpdatedAt: Date.now() })
    toast(tr('الوثيقة تبدّلت ✓', 'Document updated ✓'), 'success')
  }
  return (
    <Page title={tr('الوثائق', 'Documents')}>
      <div className="col">
        {DOC_LIST.map(([k, label, I]) => (
          <button key={k} className="card" style={{ overflow: 'hidden', textAlign: 'start', padding: 0 }} onClick={() => setScan(k)}>
            {docs[k] ? <img src={docs[k]} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} /> : <div style={{ height: 110, display: 'grid', placeItems: 'center', background: 'var(--card-2)' }}><I size={34} color="var(--faint)" /></div>}
            <div className="between" style={{ padding: 14 }}><b>{label}</b>{docs[k] ? <span className="badge green"><CheckCircle2 size={12} />{tr('موثّقة', 'Verified')}</span> : <span className="badge red">{tr('لازم', 'Required')}</span>}</div>
          </button>
        ))}
      </div>
      <Scanner open={!!scan} onClose={() => setScan(null)} onDone={save} shape={scan === 'carPhoto' ? 'wide' : 'card'} title={DOC_LIST.find(([k]) => k === scan)?.[1]}
        steps={[tr('قراءة الوثيقة', 'Reading document'), tr('التحقق من الصلاحية', 'Checking validity'), tr('تحديث الملف', 'Updating profile')]} successText={tr('الوثيقة مقبولة ✓', 'Document accepted ✓')} />
    </Page>
  )
}

// ===== وضع سائق الحافلة: يبث موقع الحافلة للزبائن مباشرة =====
export function BusMode() {
  const { uid, driver, settings } = useApp()
  const city = CITIES.find((c) => c.id === driver.city) || CITIES[0]
  const [lines, setLines] = useState(null)
  const [line, setLine] = useState(() => localStorage.getItem('w_busline') || '')
  const [on, setOn] = useState(false)
  const [info, setInfo] = useState(null)
  useEffect(() => watchLines((l) => setLines(l.filter((x) => !x.city || x.city === driver.city))), [])
  const all = lines && (lines.length || settings.bus?.demo === false ? lines : city.id === 'sba' ? demoLines(city.center) : [])
  const L = all?.find((l) => l.id === line)
  useEffect(() => {
    if (!on || !L) return
    let stop = () => {}, lastD = null, dir = 1, alive = true, m = null, pos = null
    // نبعثو آخر موقع كل 5 ثواني (حتى كي تكون الحافلة واقفة في محطة)
    const send = () => {
      if (!alive || !pos) return
      // المسار مازال ما تحمّلش: نبعثو الموقع برك، والزبون يحسب البلاصة على الخط
      if (!m) { pushBus(uid, { line: L.id, coords: pos.coords, heading: pos.heading || 0, dir, name: driver.name, plate: driver.vehicle?.plate || '' }).catch(() => {}); return }
      const pr = project(m, pos.coords)
      if (lastD != null && Math.abs(pr.d - lastD) > 0.015) dir = pr.d > lastD ? 1 : -1
      lastD = pr.d
      setInfo({ off: pr.off, d: pr.d, len: m.len, dir })
      pushBus(uid, { line: L.id, coords: pos.coords, heading: pos.heading || 0, d: pr.d, dir, name: driver.name, plate: driver.vehicle?.plate || '' }).catch(() => {})
    }
    linePath(L).then((p) => { m = measure(p); send() })
    watchPosition((p) => { pos = p }).then((s) => (stop = s))
    currentPosition().then((p) => { if (p && !pos) { pos = p; send() } })
    const t = setInterval(send, 5000)
    return () => { alive = false; clearInterval(t); stop(); stopBus(uid) }
  }, [on, L?.id])
  return (
    <Page title={tr('وضع سائق الحافلة', 'Bus driver mode')}>
      <div className="card pad flex" style={{ background: 'var(--brand-50)', boxShadow: 'none' }}><Info size={20} color="var(--brand)" /><span className="small">{tr('كي تشغّل البث، الزبائن يشوفو الحافلة تاعك مباشرة في الخريطة ووقت وصولها لكل محطة. خلّي التطبيق مفتوح وانت تسوق.', 'While broadcasting, riders see your bus live with arrival times. Keep the app open while driving.')}</span></div>
      <div className="section-title">{tr('اختار الخط', 'Choose your line')}</div>
      {all === null && <div className="center"><span className="spinner" /></div>}
      {all?.length === 0 && <Empty title={tr('ما كاين حتى خط في ولايتك', 'No lines in your city')} />}
      <div className="col" style={{ gap: 8 }}>
        {all?.map((l) => (
          <button key={l.id} className={`method ${line === l.id ? 'active' : ''}`} disabled={on} onClick={() => { setLine(l.id); localStorage.setItem('w_busline', l.id) }}>
            <span className="line-badge" style={{ '--lc': l.color }}>{l.number}</span>
            <span className="grow" style={{ textAlign: 'start' }}><b>{l.name}</b><small>{(l.stops || []).length} {tr('محطات', 'stops')} • <span dir="ltr">{l.start} – {l.end}</span></small></span>
            <span className={`radio ${line === l.id ? 'on' : ''}`} />
          </button>
        ))}
      </div>
      {on && info && (
        <div className="card pad mt">
          <div className="between small"><span className="muted">{tr('الحالة', 'Status')}</span><span className="badge green"><i className="pulse-dot" style={{ width: 8, height: 8 }} />{tr('البث شغّال', 'Broadcasting')}</span></div>
          <div className="between small mt"><span className="muted">{tr('على المسار', 'On route')}</span><b className="num">{Math.round((info.d / Math.max(0.01, info.len)) * 100)}% {info.dir > 0 ? '→' : '←'}</b></div>
          {info.off > 0.3 && <div className="tiny mt" style={{ color: 'var(--danger)' }}>{tr(`راك بعيد على مسار الخط بـ ${info.off.toFixed(1)} كم`, `You are ${info.off.toFixed(1)} km off the route`)}</div>}
        </div>
      )}
      <button className={`btn btn-block btn-lg mt ${on ? 'btn-dark' : 'btn-primary'}`} disabled={!L} onClick={() => { setOn(!on); toast(on ? tr('وقّفت البث', 'Broadcast stopped') : tr('البث بدا، طريق السلامة 🚌', 'Broadcast started 🚌'), on ? '' : 'success') }}>
        <Bus size={20} />{on ? tr('وقّف البث', 'Stop broadcasting') : tr('ابدا البث', 'Start broadcasting')}
      </button>
    </Page>
  )
}
