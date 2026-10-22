// شحن البورتفاي: البطاقة الذهبية (بريد الجزائر) • CIB (ساتيم) • بريدي موب • كارطة شحن
import { play } from '@/core/sound.js'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CreditCard, Landmark, Smartphone, Ticket, ShieldCheck, Lock, Check, ChevronLeft, Copy, Upload, Clock, Wifi, Receipt, Info } from 'lucide-react'
import { Page, useNav, toast, Confetti } from '@/ui/kit.jsx'
import { useApp } from '@/ui/app-ctx.jsx'
import { tr, money, num, copy, compressImage, dateTime, haptic } from '@/core/util.js'
import { topUp, redeemVoucher } from '@/core/api.js'

const METHODS = [
  { id: 'edahabia', ar: 'البطاقة الذهبية', sub: 'بريد الجزائر • Edahabia', icon: CreditCard, c: '#B8860B' },
  { id: 'cib', ar: 'بطاقة CIB', sub: 'كل البنوك • SATIM', icon: Landmark, c: '#0F766E' },
  { id: 'baridimob', ar: 'بريدي موب', sub: 'تحويل لـ RIP ورفع الوصل', icon: Smartphone, c: '#1D4ED8' },
  { id: 'voucher', ar: 'كارطة شحن', sub: 'كود من نقاط البيع', icon: Ticket, c: '#E8650A' },
]

export function BankCard({ type = 'edahabia', number = '', name = '', exp = '', flipped = false, cvv = '' }) {
  const n = (number.replace(/\D/g, '') + '•'.repeat(16)).slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  return (
    <div className={`bank-card ${type} ${flipped ? 'flipped' : ''}`}>
      <div className="bc-inner">
        <div className="bc-front">
          <div className="bc-top">
            <span className="bc-brand">{type === 'edahabia' ? <><b>الذهبية</b><small>EDAHABIA</small></> : <><b>CIB</b><small>Carte Interbancaire</small></>}</span>
            <span className="bc-issuer">{type === 'edahabia' ? 'Algérie Poste' : 'SATIM'}</span>
          </div>
          <div className="bc-mid"><span className="bc-chip" /><Wifi size={22} style={{ transform: 'rotate(90deg)', opacity: 0.85 }} /></div>
          <div className="bc-num num">{n}</div>
          <div className="bc-bot">
            <span><small>{tr('صاحب البطاقة', 'Card holder')}</small><b>{name || 'NOM PRÉNOM'}</b></span>
            <span><small>{tr('تنتهي', 'Expires')}</small><b className="num">{exp || 'MM/AA'}</b></span>
          </div>
        </div>
        <div className="bc-back">
          <div className="bc-strip" />
          <div className="bc-cvv"><span>CVV2</span><b className="num">{cvv || '•••'}</b></div>
          <div className="bc-note">{type === 'edahabia' ? 'Algérie Poste — Carte de paiement' : 'GIE Monétique — Carte CIB'}</div>
        </div>
      </div>
    </div>
  )
}

export default function TopUp({ initial }) {
  const nav = useNav()
  const { uid, user, settings, kind } = useApp()
  const who = kind === 'driver' ? 'driver' : 'rider'
  const pay = settings.payments
  const [amount, setAmount] = useState(initial || pay.presets?.[1] || 1000)
  const [method, setMethod] = useState(null)
  const [step, setStep] = useState('pick') // pick | card | otp | baridimob | voucher | done
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvv: '' })
  const [focusCvv, setFocusCvv] = useState(false)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [receipt, setReceipt] = useState('')
  const [code, setCode] = useState('')
  const methods = METHODS.filter((m) => pay[m.id] !== false)
  const valid = amount >= (pay.min || 200) && amount <= (pay.max || 50000)
  const cardOk = card.number.replace(/\D/g, '').length === 16 && /^\d{2}\/\d{2}$/.test(card.exp) && card.cvv.length === 3 && card.name.trim().length >= 3

  const next = () => {
    if (method === 'voucher') return setStep('voucher')
    if (!valid) return toast(tr(`المبلغ بين ${money(pay.min)} و ${money(pay.max)}`, 'Invalid amount'), 'error')
    if (method === 'baridimob') return setStep('baridimob')
    setStep('card')
  }
  const fmtNum = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const fmtExp = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d }

  const confirmOtp = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 1600))
    try {
      const r = await topUp(uid, { amount, method, last4: card.number.replace(/\D/g, '').slice(-4) }, pay, who)
      setResult(r); setStep('done'); haptic('heavy')
    } catch (e) { toast(e.message, 'error') }
    setBusy(false)
  }
  const sendBaridi = async () => {
    if (!receipt) return toast(tr('حمّل تصويرة الوصل', 'Upload the receipt'), 'error')
    setBusy(true)
    const r = await topUp(uid, { amount, method: 'baridimob', receipt }, pay, who).catch((e) => toast(e.message, 'error'))
    setBusy(false)
    if (r) { setResult(r); setStep('done') }
  }
  const sendVoucher = async () => {
    setBusy(true)
    const r = await redeemVoucher(uid, code, who).catch((e) => ({ ok: false, msg: e.message }))
    setBusy(false)
    if (r.ok) { setResult({ status: 'paid', amount: r.amount, id: code }); setStep('done') } else toast(r.msg, 'error')
  }

  const title = { pick: tr('شحن البورتفاي', 'Top up'), card: METHODS.find((m) => m.id === method)?.ar, otp: tr('تأكيد الخلاص', 'Verify payment'), baridimob: tr('بريدي موب', 'BaridiMob'), voucher: tr('كارطة شحن', 'Voucher'), done: tr('تم', 'Done') }[step]
  const back = () => (step === 'pick' || step === 'done' ? nav.back() : setStep(step === 'otp' ? 'card' : 'pick'))

  return (
    <Page title={title} onBack={back} foot={
      step === 'pick' ? <button className="btn btn-primary btn-block btn-lg" disabled={!method || (method !== 'voucher' && !valid)} onClick={next}>{method === 'voucher' ? tr('كمّل', 'Continue') : <>{tr('كمّل', 'Continue')} • <span className="num">{money(amount)}</span></>}</button>
        : step === 'card' ? <button className="btn btn-primary btn-block btn-lg" disabled={!cardOk} onClick={() => setStep('otp')}><Lock size={18} />{tr('خلّص', 'Pay')} <span className="num">{money(amount)}</span></button>
          : step === 'otp' ? <button className="btn btn-primary btn-block btn-lg" disabled={otp.length < 6 || busy} onClick={confirmOtp}>{busy ? <span className="spinner" /> : tr('أكّد', 'Confirm')}</button>
            : step === 'baridimob' ? <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={sendBaridi}>{busy ? <span className="spinner" /> : tr('ابعث للمراجعة', 'Submit')}</button>
              : step === 'voucher' ? <button className="btn btn-primary btn-block btn-lg" disabled={code.length < 6 || busy} onClick={sendVoucher}>{busy ? <span className="spinner" /> : tr('اشحن', 'Redeem')}</button>
                : <button className="btn btn-dark btn-block btn-lg" onClick={() => nav.back()}>{tr('رجوع للبورتفاي', 'Back to wallet')}</button>
    }>
      {step === 'pick' && (
        <div className="rise">
          <div className="topup-bal"><small>{tr('رصيدك دروك', 'Current balance')}</small><b className="num">{money(user.wallet || 0)}</b></div>
          <div className="section-title">{tr('المبلغ', 'Amount')}</div>
          <div className="amount-grid">
            {(pay.presets || [500, 1000, 2000, 5000]).map((v) => <button key={v} className={amount === v ? 'active' : ''} onClick={() => setAmount(v)}><b className="num">{num(v)}</b><small>{tr('دج', 'DA')}</small></button>)}
          </div>
          <div className="input-wrap mt"><span className="suffix muted small" style={{ insetInlineEnd: 16, position: 'absolute' }}>{tr('دج', 'DA')}</span><input className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)} style={{ fontSize: 20, fontWeight: 700 }} /></div>
          <div className="section-title">{tr('طريقة الخلاص', 'Payment method')}</div>
          <div className="col" style={{ gap: 10 }}>
            {methods.map((m) => (
              <button key={m.id} className={`method ${method === m.id ? 'active' : ''}`} onClick={() => setMethod(m.id)}>
                <span className={`m-art ${m.id}`}>{m.id === 'edahabia' || m.id === 'cib' ? <span className="mini-card"><i /></span> : <m.icon size={22} />}</span>
                <span className="grow"><b>{m.ar}</b><small>{m.sub}</small></span>
                <span className="radio">{method === m.id && <Check size={14} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>
          <div className="secure-note"><ShieldCheck size={16} />{tr('خلاص آمن ومشفّر عبر بوابة SATIM و بريد الجزائر', 'Secure payment via SATIM & Algérie Poste')}</div>
          {pay.demo && <div className="demo-note"><Info size={14} />{tr('وضع تجريبي: الخلاص يتحاكى والرصيد يتزاد مباشرة', 'Demo mode: payments are simulated')}</div>}
        </div>
      )}

      {step === 'card' && (
        <div className="rise">
          <BankCard type={method} number={card.number} name={card.name} exp={card.exp} cvv={card.cvv} flipped={focusCvv} />
          <div className="col mt2">
            <div className="field"><label>{tr('رقم البطاقة', 'Card number')}</label><input className="input num" inputMode="numeric" autoComplete="cc-number" placeholder="6280 0000 0000 0000" value={card.number} onChange={(e) => setCard({ ...card, number: fmtNum(e.target.value) })} style={{ letterSpacing: 2, direction: 'ltr' }} /></div>
            <div className="field"><label>{tr('الاسم على البطاقة', 'Name on card')}</label><input className="input" autoComplete="cc-name" placeholder="MOHAMED AMINE" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })} style={{ direction: 'ltr' }} /></div>
            <div className="grid2">
              <div className="field"><label>{tr('تاريخ الانتهاء', 'Expiry')}</label><input className="input num" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={card.exp} onChange={(e) => setCard({ ...card, exp: fmtExp(e.target.value) })} style={{ direction: 'ltr' }} /></div>
              <div className="field"><label>CVV2</label><input className="input num" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={3} value={card.cvv} onFocus={() => setFocusCvv(true)} onBlur={() => setFocusCvv(false)} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })} style={{ direction: 'ltr' }} /></div>
            </div>
          </div>
          <div className="secure-note"><Lock size={15} />{tr('معلومات البطاقة ما تتسجلش عندنا', 'Card details are never stored')}</div>
        </div>
      )}

      {step === 'otp' && <OtpStep amount={amount} method={method} last4={card.number.replace(/\D/g, '').slice(-4)} otp={otp} setOtp={setOtp} demo={pay.demo} busy={busy} />}

      {step === 'baridimob' && (
        <div className="rise col">
          <div className="card pad">
            <div className="small muted">{tr('حوّل المبلغ لهاد الحساب من تطبيق بريدي موب:', 'Transfer the amount to:')}</div>
            <div className="rip-box">
              <div><small>RIP</small><b className="num">{pay.rip}</b></div>
              <button className="icon-btn sm flat" onClick={async () => { await copy(pay.rip.replace(/\s/g, '')); toast(tr('تنسخ', 'Copied')) }}><Copy size={16} /></button>
            </div>
            <div className="between small"><span className="muted">{tr('باسم', 'Name')}</span><b>{pay.ripName}</b></div>
            <div className="between small mt"><span className="muted">{tr('المبلغ', 'Amount')}</span><b className="num">{money(amount)}</b></div>
          </div>
          <label className="upload-box">
            {receipt ? <img src={receipt} alt="" /> : <><Upload size={28} /><b>{tr('حمّل تصويرة الوصل', 'Upload receipt')}</b><small>{tr('سكرين شوت من بريدي موب', 'Screenshot from BaridiMob')}</small></>}
            <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setReceipt(await compressImage(e.target.files[0], 900, 0.7))} />
          </label>
          <div className="secure-note"><Clock size={15} />{tr('الرصيد يتزاد كي يراجع الفريق الوصل (عادة في أقل من ساعة)', 'Credited after review (usually < 1h)')}</div>
        </div>
      )}

      {step === 'voucher' && (
        <div className="rise">
          <div className="center" style={{ padding: '20px 0' }}><span className="m-art voucher" style={{ width: 72, height: 72, margin: '0 auto' }}><Ticket size={34} /></span></div>
          <input className="input num center" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WSXXXXXXXX" style={{ letterSpacing: 4, fontSize: 20, fontWeight: 700, textAlign: 'center' }} />
          <div className="tiny muted center mt">{tr('الكود مكتوب في الكارطة اللي شريتها من نقطة البيع', 'The code printed on your voucher')}</div>
        </div>
      )}

      {step === 'done' && <Done result={result} method={method} />}
    </Page>
  )
}

function OtpStep({ amount, method, last4, otp, setOtp, demo, busy }) {
  const refs = useRef([])
  const [left, setLeft] = useState(120)
  useEffect(() => { const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { refs.current[0]?.focus() }, [])
  const set = (i, v) => {
    const d = v.replace(/\D/g, '')
    const arr = otp.padEnd(6, ' ').split('')
    if (d.length > 1) { setOtp(d.slice(0, 6)); refs.current[Math.min(5, d.length)]?.focus(); return }
    arr[i] = d || ' '
    setOtp(arr.join('').trimEnd())
    if (d && i < 5) refs.current[i + 1]?.focus()
  }
  return (
    <div className="rise">
      <div className="otp-head">
        <span className="otp-logo">{method === 'edahabia' ? 'Algérie Poste' : 'SATIM'} <small>3-D Secure</small></span>
        <div className="between small mt"><span className="muted">{tr('التاجر', 'Merchant')}</span><b>WASALNI</b></div>
        <div className="between small"><span className="muted">{tr('المبلغ', 'Amount')}</span><b className="num">{money(amount)}</b></div>
        <div className="between small"><span className="muted">{tr('البطاقة', 'Card')}</span><b className="num">•••• {last4}</b></div>
      </div>
      <div className="center mt2"><b>{tr('دخّل الرمز اللي وصلك في SMS', 'Enter the SMS code')}</b><div className="tiny muted">{tr('بعثناه للرقم المربوط بالبطاقة', 'Sent to your card phone number')}</div></div>
      <div className="otp-boxes" dir="ltr">
        {Array.from({ length: 6 }, (_, i) => <input key={i} ref={(el) => (refs.current[i] = el)} inputMode="numeric" maxLength={6} value={(otp[i] || '').trim()} onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && refs.current[i - 1]?.focus()} disabled={busy} />)}
      </div>
      <div className="tiny muted center">{left > 0 ? tr(`يفوت وقت الرمز في ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, `Expires in ${left}s`) : tr('فات الوقت، عاود', 'Code expired')}</div>
      {demo && <div className="demo-note" style={{ justifyContent: 'center' }}><Info size={14} />{tr('تجريبي: دخّل أي 6 أرقام (مثلا 123456)', 'Demo: enter any 6 digits')}</div>}
      {busy && <div className="center mt"><span className="spinner" style={{ color: 'var(--brand)' }} /><div className="small muted mt">{tr('راهو يتأكد الخلاص…', 'Processing…')}</div></div>}
    </div>
  )
}

function Done({ result, method }) {
  const [fire, setFire] = useState(false)
  const paid = result?.status === 'paid'
  useEffect(() => { setTimeout(() => setFire(true), 200); play(paid ? 'coin' : 'info') }, [])
  return (
    <div className="center rise" style={{ paddingTop: 20 }}>
      {paid && <Confetti run={fire} />}
      <div className="pop" style={{ width: 96, height: 96, borderRadius: 32, margin: '0 auto 16px', display: 'grid', placeItems: 'center', background: paid ? 'var(--success-bg)' : 'var(--warning-bg)', color: paid ? 'var(--success)' : '#b7791f' }}>{paid ? <Check size={50} strokeWidth={3} /> : <Clock size={46} />}</div>
      <h2 style={{ margin: 0 }}>{paid ? tr('تشحن البورتفاي بنجاح!', 'Top-up successful!') : tr('الطلب راهو يتراجع', 'Under review')}</h2>
      <div style={{ fontSize: 34, fontWeight: 800, margin: '6px 0' }} className="num brand-text">{money(result?.amount)}</div>
      <div className="small muted">{paid ? tr('الدراهم راهي في البورتفاي تاعك', 'Added to your wallet') : tr('نخبروك كي يتزاد الرصيد', 'We will notify you once credited')}</div>
      <div className="card pad mt2" style={{ textAlign: 'start' }}>
        <div className="between small"><span className="muted"><Receipt size={14} style={{ verticalAlign: -2 }} /> {tr('رقم العملية', 'Reference')}</span><b className="num">{result?.id}</b></div>
        <div className="between small mt"><span className="muted">{tr('الطريقة', 'Method')}</span><b>{METHODS.find((m) => m.id === method)?.ar}</b></div>
        <div className="between small mt"><span className="muted">{tr('التاريخ', 'Date')}</span><b>{dateTime(Date.now())}</b></div>
      </div>
    </div>
  )
}
