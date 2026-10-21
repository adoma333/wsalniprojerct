// خصم الطالب: تصوير بطاقة الطالب الجامعي بالماسح والتفعيل الفوري (في الوضع التجريبي/التحقق التلقائي)
import React, { useState } from 'react'
import { GraduationCap, ScanLine, ShieldCheck, Check, Clock, ChevronDown, School, Hash, User, Percent, Sparkles, XCircle } from 'lucide-react'
import { useApp } from '@/ui/app-ctx.jsx'
import { Page, Sheet, toast, useNav } from '@/ui/kit.jsx'
import Scanner from '@/ui/Scanner.jsx'
import { tr, money } from '@/core/util.js'
import { submitStudent, studentActive, UNIVERSITIES } from '@/core/api.js'

export default function Student() {
  const { uid, user, settings } = useApp()
  const nav = useNav()
  const st = settings.students || {}
  const s = user.student
  const [f, setF] = useState({ fullName: s?.fullName || user.name || '', university: s?.university || '', matricule: s?.matricule || '' })
  const [uniOpen, setUniOpen] = useState(false)
  const [scan, setScan] = useState(false)
  const [q, setQ] = useState('')
  const [redo, setRedo] = useState(false)
  const active = studentActive(user, st)
  const ok = f.fullName.trim().length >= 3 && f.university && f.matricule.trim().length >= 4

  if (st.enabled === false || settings.features?.students === false) {
    return <Page title={tr('خصم الطالب', 'Student discount')}><div className="empty"><GraduationCap size={42} /><b>{tr('الخدمة هذي موقّفة دروك', 'Not available right now')}</b></div></Page>
  }

  const done = async (card) => {
    try {
      const r = await submitStudent(uid, { ...f, card }, st)
      setScan(false); setRedo(false)
      toast(r.status === 'verified' ? tr(`مبروك! عندك ${r.discount}% تخفيض 🎓`, `You get ${r.discount}% off 🎓`) : tr('تبعثت للمراجعة ✅', 'Sent for review ✅'), 'success')
    } catch (e) { toast(e.message, 'error'); setScan(false) }
  }

  const showCard = active && !redo
  return (
    <Page title={tr('خصم الطالب', 'Student discount')}>
      {showCard ? (
        <div className="col rise">
          <div className="stu-card">
            <div className="holo" />
            <div className="sc-row"><span className="flex" style={{ gap: 8 }}><GraduationCap size={26} /><b>{tr('طالب وصلني', 'Wasalni Student')}</b></span><span className="verified"><ShieldCheck size={13} />{tr('موثّق', 'Verified')}</span></div>
            <div className="sc-row" style={{ marginTop: 14 }}><span className="pct num">-{s.discount ?? st.discount}%</span><span className="tiny" style={{ opacity: .8, textAlign: 'end' }}>{tr('على كل كورسة', 'every ride')}<br />{tr('حتى', 'up to')} <span className="num">{money(st.maxDiscount)}</span></span></div>
            <div className="nm">{s.fullName}</div>
            <div className="un">{s.university} • <span className="num">{s.matricule}</span></div>
          </div>
          <div className="card pad">
            <div className="between small"><span className="muted">{tr('الحالة', 'Status')}</span><span className="badge green"><Check size={12} />{tr('مفعّل', 'Active')}</span></div>
            <div className="between small mt"><span className="muted">{tr('صالحة حتى', 'Valid until')}</span><b className="num" dir="ltr">{new Date(s.expires).toLocaleDateString('fr-DZ')}</b></div>
            <div className="between small mt"><span className="muted">{tr('التخفيض', 'Discount')}</span><b className="num">{s.discount ?? st.discount}% ({tr('حتى', 'max')} {money(st.maxDiscount)})</b></div>
          </div>
          <div className="card pad flex" style={{ background: 'var(--brand-50)', boxShadow: 'none' }}><Sparkles size={22} color="var(--brand)" /><span className="small">{tr('التخفيض يتطبّق وحدو كي تطلب كورسة، وتقدر تجمعو مع النقاط وكود التخفيض.', 'Applied automatically on every ride, stacks with promos.')}</span></div>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => nav.back()}>{tr('اطلب كورسة دروك', 'Book a ride')}</button>
          <button className="btn btn-ghost btn-block" onClick={() => setRedo(true)}>{tr('بدّل البطاقة', 'Update card')}</button>
        </div>
      ) : (
        <div className="col rise">
          <div className="stu-hero">
            <GraduationCap size={34} />
            <h2>{tr('راك طالب؟ تنقّل بسومة أرخص', 'Student? Ride for less')}</h2>
            <div className="flex" style={{ alignItems: 'flex-end', gap: 10 }}><span className="big num">-{st.discount}%</span><p style={{ paddingBottom: 6 }}>{tr('على كل الكورسات طول العام الدراسي', 'on all rides for the whole academic year')}</p></div>
            <div className="stu-perks">
              <div><b>⚡</b>{tr('تفعيل فوري', 'Instant activation')}</div>
              <div><b className="num">{money(st.maxDiscount)}</b>{tr('أقصى تخفيض', 'Max off')}</div>
              <div><b>🎁</b>{tr('مع النقاط', 'Stacks with points')}</div>
            </div>
          </div>

          {s?.status === 'pending' && !redo && <div className="card pad flex" style={{ background: 'var(--warning-bg, #FEF7E6)', boxShadow: 'none' }}><Clock size={22} color="#a16207" /><span className="small"><b>{tr('البطاقة تاعك في المراجعة', 'Under review')}</b><br />{tr('راح نردّو عليك في أقل من 24 ساعة', 'We will reply within 24h')}</span></div>}
          {s?.status === 'rejected' && <div className="card pad flex" style={{ background: 'var(--danger-bg)', boxShadow: 'none' }}><XCircle size={22} color="var(--danger)" /><span className="small"><b>{tr('البطاقة ما تقبلتش', 'Card rejected')}</b><br />{s.note || tr('عاود صوّرها بوضوح', 'Please rescan clearly')}</span></div>}

          {(s?.status !== 'pending' || redo) && (
            <div className="card col" style={{ padding: 18 }}>
              <div className="field"><label>{tr('الاسم واللقب كيما في البطاقة', 'Full name as on card')}</label><div className="input-wrap"><User size={18} /><input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div></div>
              <div className="field"><label>{tr('الجامعة', 'University')}</label>
                <button className="input between" style={{ textAlign: 'start' }} onClick={() => setUniOpen(true)}><span className="flex" style={{ gap: 8, minWidth: 0 }}><School size={18} color="var(--muted)" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: f.university ? 'var(--ink)' : 'var(--faint)' }}>{f.university || tr('اختار الجامعة', 'Choose university')}</span></span><ChevronDown size={18} /></button>
              </div>
              <div className="field"><label>{tr('رقم التسجيل (الماتريكول)', 'Student ID')}</label><div className="input-wrap"><Hash size={18} /><input className="input num" inputMode="numeric" value={f.matricule} onChange={(e) => setF({ ...f, matricule: e.target.value.replace(/[^\dA-Za-z/]/g, '').slice(0, 20) })} placeholder="202131234567" style={{ direction: 'ltr' }} /></div></div>
              <button className="scan-cta" disabled={!ok} style={{ opacity: ok ? 1 : 0.55 }} onClick={() => setScan(true)}>
                <span className="ic"><ScanLine size={26} /></span>
                <span><b>{tr('صوّر بطاقة الطالب', 'Scan your student card')}</b><div className="tiny muted">{tr('الكاميرا تكشف البطاقة وحدها وتتفعّل في ثانيتين', 'Auto-detected, activated in seconds')}</div></span>
              </button>
              <div className="tiny muted flex" style={{ gap: 6 }}><ShieldCheck size={14} />{tr('التصويرة محمية وما تستعملش غير للتحقق', 'Used only for verification')}</div>
            </div>
          )}
          <div className="card pad">
            <b className="small">{tr('كيفاش تخدم؟', 'How it works')}</b>
            {[[User, tr('عمّر الاسم والجامعة ورقم التسجيل', 'Fill your details')], [ScanLine, tr('صوّر البطاقة داخل الإطار', 'Scan the card in the frame')], [Percent, tr(`تاخذ ${st.discount}% تخفيض أوتوماتيك`, `Get ${st.discount}% off automatically`)]].map(([I, t], i) => (
              <div key={i} className="flex small mt"><span className="ri" style={{ width: 34, height: 34, background: 'var(--brand-50)', color: 'var(--brand)' }}><I size={17} /></span>{t}</div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={uniOpen} onClose={() => setUniOpen(false)} title={tr('اختار الجامعة', 'Choose university')}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('قلّب…', 'Search…')} style={{ marginBottom: 10 }} />
        <div className="uni-list">
          {UNIVERSITIES.filter((u) => !q || u.includes(q)).map((u) => (
            <button key={u} className={f.university === u ? 'active' : ''} onClick={() => { setF({ ...f, university: u }); setUniOpen(false) }}><School size={17} />{u}</button>
          ))}
        </div>
      </Sheet>
      <Scanner
        open={scan} onClose={() => setScan(false)} onDone={done}
        title={tr('بطاقة الطالب', 'Student card')} hint={tr('حط الوجه الأمامي للبطاقة داخل الإطار', 'Front side of the card inside the frame')}
        steps={[tr('قراءة بطاقة الطالب', 'Reading card'), tr('التحقق من الجامعة والسنة', 'Checking university & year'), st.autoVerify !== false ? tr('تفعيل خصم الطالب', 'Activating discount') : tr('إرسال للمراجعة', 'Sending for review')]}
        successText={st.autoVerify !== false ? tr(`تفعّل! -${st.discount}% على كل كورسة`, `Active! -${st.discount}% every ride`) : tr('تبعثت للمراجعة', 'Sent for review')}
      />
    </Page>
  )
}
