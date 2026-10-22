// صفحات مشتركة بين التطبيقين: الإشعارات، الدعم، الإعدادات، عن التطبيق
import React, { useEffect, useState } from 'react'
import { Bell, MessageCircle, Phone, Mail, ChevronDown, Moon, Sun, Monitor, Languages, Info, Shield, FileText, Send, Headphones } from 'lucide-react'
import { Page, Empty, Row, Sheet, toast } from './kit.jsx'
import { useApp } from './app-ctx.jsx'
import { tr, timeAgo, setLang, LANG, getTheme, setTheme, dateTime } from '@/core/util.js'
import { watchNotifications, createTicket, watchMyTickets } from '@/core/api.js'
import { MODE } from '@/core/store.js'

export function Notifications({ audience = 'riders' }) {
  const [list, setList] = useState(null)
  useEffect(() => watchNotifications((n) => { setList(n.filter((x) => !x.target || x.target === 'all' || x.target === audience)); localStorage.setItem('w_notif_seen', String(Date.now())) }), [])
  return (
    <Page title={tr('الإشعارات', 'Notifications')}>
      {list && list.length === 0 && <Empty icon={<Bell size={36} />} title={tr('ما كاين حتى إشعار', 'No notifications')} sub={tr('هنا نخبروك بالبروموسيونات والجديد', 'Offers and updates will appear here')} />}
      <div className="col" style={{ gap: 10 }}>
        {list?.map((n, i) => (
          <div key={n.id} className="card pad rise" style={{ animationDelay: i * 40 + 'ms', display: 'flex', gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--brand-50)', color: 'var(--brand)', display: 'grid', placeItems: 'center', flex: 'none' }}><Bell size={19} /></span>
            <div className="grow">
              <div className="between"><b>{n.title}</b><span className="tiny muted">{timeAgo(n.at)}</span></div>
              <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
              {n.image && <img src={n.image} alt="" style={{ borderRadius: 12, marginTop: 8 }} />}
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}

const FAQ = [
  ['كيفاش نركب بلاش؟', 'شوف ريلز الإشهار من قسم الكادوات. كل ريل تكمّلو يزيدلك 5 دينار في الرصيد، وكي تطلب اختار الخلاص بالنقاط.'],
  ['كيفاش تتحسب سومة الكورسة؟', 'حلّان العداد + سومة على كل كيلومتر + سومة على كل دقيقة على حساب نوع الطوموبيل، وتزيد شوية في الليل ووقت الزحمة. السومة تبان قبل ما تأكد وما تتبدّلش.'],
  ['كيفاش نشحن البورتفاي؟', 'من صفحة البورتفاي دخّل كود كارطة الشحن اللي تاخذها من نقاط البيع ولا من الدعم.'],
  ['نسيت حاجة في الطوموبيل، واش ندير؟', 'حل تفاصيل الكورسة من "كورساتي" وتواصل مع الشيفور، ولا ابعث للدعم ونعاونوك دغيا.'],
  ['نقدر نلغي الكورسة؟', 'إيه، بلاش قبل ما يقبل الشيفور. من بعد القبول ممكن تخلص شوية دراهم.'],
  ['كيفاش نولي شيفور؟', 'حمّل تطبيق شيفور وصلني، دخّل المعلومات تاعك وتاع الطوموبيل وحمّل الوثائق، ومن بعد الموافقة تبدا تخدم.'],
]
export function Support() {
  const { settings, uid, user } = useApp()
  const s = settings.support
  const [open, setOpen] = useState(-1)
  const [form, setForm] = useState(false)
  const [msg, setMsg] = useState('')
  const [tickets, setTickets] = useState([])
  useEffect(() => watchMyTickets(uid, setTickets), [uid])
  const send = async () => {
    await createTicket({ uid, name: user?.name || '', phone: user?.phone || '', message: msg, app: __APP__ })
    setMsg(''); setForm(false)
    toast(tr('الميساج وصل، نردو عليك قريب', 'Message sent'), 'success')
  }
  return (
    <Page title={tr('المساعدة والدعم', 'Help & support')}>
      <div className="card pad rise" style={{ background: 'var(--grad)', color: '#fff', border: 0, display: 'flex', gap: 14, alignItems: 'center' }}>
        <Headphones size={40} />
        <div className="grow"><b style={{ fontSize: 17 }}>{tr('راحنا هنا نعاونوك 24/24', 'We are here 24/7')}</b><div className="small" style={{ opacity: 0.9 }}>{tr('تواصل معانا كيما يعجبك', 'Reach us your way')}</div></div>
      </div>
      <div className="grid3 mt">
        <a className="card pad center" href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }}><MessageCircle size={24} color="#25D366" /><div className="small mt">{tr('واتساب', 'WhatsApp')}</div></a>
        <a className="card pad center" href={`tel:${s.phone}`} style={{ color: 'var(--ink)' }}><Phone size={24} color="var(--info)" /><div className="small mt">{tr('عيّط', 'Call')}</div></a>
        <a className="card pad center" href={`mailto:${s.email}`} style={{ color: 'var(--ink)' }}><Mail size={24} color="var(--brand)" /><div className="small mt">{tr('بريد', 'Email')}</div></a>
      </div>
      <button className="btn btn-dark btn-block mt" onClick={() => setForm(true)}><Send size={18} />{tr('ابعث ميساج للدعم', 'Message support')}</button>
      {tickets.length > 0 && (
        <>
          <div className="section-title">{tr('الميساجات تاعي', 'My tickets')}</div>
          <div className="col" style={{ gap: 8 }}>
            {tickets.map((t) => (
              <div key={t.id} className="card pad">
                <div className="between"><span className={`badge ${t.status === 'closed' ? 'green' : 'yellow'}`}>{t.status === 'closed' ? tr('تحلّ', 'Resolved') : tr('راهو يتعالج', 'Open')}</span><span className="tiny muted">{dateTime(t.at)}</span></div>
                <div className="small mt">{t.message}</div>
                {t.replies?.map((r, i) => <div key={i} className="small" style={{ marginTop: 8, padding: 10, borderRadius: 12, background: 'var(--brand-50)' }}><b>{tr('الدعم:', 'Support:')}</b> {r.text}</div>)}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="section-title">{tr('الأسئلة الشائعة', 'FAQ')}</div>
      <div className="list">
        {FAQ.map(([q, a], i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
            <button className="between" style={{ width: '100%', padding: '15px 16px', textAlign: 'start', fontWeight: 500 }} onClick={() => setOpen(open === i ? -1 : i)}>
              {q}<ChevronDown size={18} style={{ transition: 'transform .3s', transform: open === i ? 'rotate(180deg)' : '' }} />
            </button>
            {open === i && <div className="small muted rise" style={{ padding: '0 16px 16px' }}>{a}</div>}
          </div>
        ))}
      </div>
      <Sheet open={form} onClose={() => setForm(false)} title={tr('ميساج للدعم', 'Contact support')}>
        <textarea className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tr('شرح المشكل ولا السؤال تاعك…', 'Describe your issue…')} />
        <button className="btn btn-primary btn-block mt" disabled={msg.trim().length < 5} onClick={send}>{tr('ابعث', 'Send')}</button>
      </Sheet>
    </Page>
  )
}

export function Settings({ extra }) {
  const [theme, setT] = useState(getTheme())
  const [langOpen, setLangOpen] = useState(false)
  const pickTheme = (t) => { setT(t); setTheme(t) }
  return (
    <Page title={tr('الإعدادات', 'Settings')}>
      <div className="section-title">{tr('الشكل', 'Appearance')}</div>
      <div className="tabs">
        {[['light', Sun, tr('فاتح', 'Light')], ['dark', Moon, tr('مظلم', 'Dark')], ['auto', Monitor, tr('أوتوماتيك', 'Auto')]].map(([k, I, l]) => (
          <button key={k} className={theme === k ? 'active' : ''} onClick={() => pickTheme(k)}><I size={15} style={{ verticalAlign: -3, marginInlineEnd: 6 }} />{l}</button>
        ))}
      </div>
      <div className="section-title">{tr('عام', 'General')}</div>
      <div className="list">
        <Row icon={<Languages size={19} />} color="#0f172a" title={tr('اللغة', 'Language')} sub={LANG === 'ar' ? 'العربية' : 'English'} onClick={() => setLangOpen(true)} />
        {extra}
        <Row icon={<Shield size={19} />} color="#12B76A" title={tr('الخصوصية والأمان', 'Privacy & security')} sub={tr('بياناتك مشفرة ولا تُباع', 'Your data is encrypted')} />
        <Row icon={<FileText size={19} />} color="#64748b" title={tr('الشروط والأحكام', 'Terms')} />
        <Row icon={<Info size={19} />} color="#2E90FA" title={tr('على التطبيق', 'About')} sub={`v1.0 • ${MODE !== 'local' ? tr('مكونيكتي', 'Online') : tr('وضع العرض', 'Demo mode')}`} />
      </div>
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={tr('اختار اللغة', 'Choose language')}>
        <div className="col">
          <button className={`btn btn-block ${LANG === 'ar' ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setLang('ar')}>العربية</button>
          <button className={`btn btn-block ${LANG === 'en' ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setLang('en')}>English</button>
        </div>
      </Sheet>
    </Page>
  )
}

export function About() {
  return (
    <Page title={tr('عن وصلني', 'About')}>
      <div className="center" style={{ padding: 30 }}>
        <div style={{ width: 120, height: 120, borderRadius: 34, background: 'var(--grad)', display: 'grid', placeItems: 'center', margin: '0 auto', boxShadow: 'var(--shadow-brand)' }}><img src="brand/mark.svg" style={{ width: 70 }} alt="" /></div>
        <h2>وصلني • Wasalni</h2>
        <p className="muted">{tr('تطبيق النقل الذكي في الجزائر. اركب بسومة معقولة، ولا بلاش كي تشوف الريلز.', 'Smart mobility in Algeria.')}</p>
      </div>
    </Page>
  )
}
