import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  GraduationCap, ScanLine, CreditCard, Landmark, Ticket, KeyRound, UserRound, HandCoins, Share2, Trophy, SlidersHorizontal, ArrowUpRight, Layers, Box,
  Smartphone, Apple, Car, MapPin, ShieldCheck, Wallet, CalendarClock, Gift, Star, Heart, MessageCircle, Send, Zap, Navigation, Clock, Users,
  ChevronDown, Sun, Moon, Banknote, TrendingUp, Headphones, Sparkles, Play, Check, Languages, X,
} from 'lucide-react'
import qrcode from 'qrcode-generator'
import { ClassCar } from '@/ui/art.jsx'
import { DEFAULT_SETTINGS, CITIES } from '@/core/config.js'
import { quote } from '@/core/pricing.js'
import { tr, money, setTheme, isDark, setLang, LANG, isAr } from '@/core/util.js'

const APK_RIDER = 'downloads/wasalni.apk'
const APK_DRIVER = 'downloads/wasalni-captain.apk'

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
}
function Counter({ to, suffix = '', dur = 1800 }) {
  const [v, setV] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const f = (t) => { const k = Math.min(1, (t - t0) / dur); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(f) }
      requestAnimationFrame(f)
    })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [to])
  return <b ref={ref} className="num brand-text">{v}{suffix}</b>
}
const qr = (text) => { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(6, 2) }

export default function Landing() {
  useReveal()
  const [scrolled, setScrolled] = useState(false)
  const [prog, setProg] = useState(0)
  const [dark, setDark] = useState(isDark())
  const [ios, setIos] = useState(false)
  const glow = useRef(null)
  useEffect(() => {
    const f = () => { setScrolled(scrollY > 30); setProg(scrollY / Math.max(1, document.body.scrollHeight - innerHeight)) }
    const m = (e) => { if (glow.current) { glow.current.style.left = e.clientX + 'px'; glow.current.style.top = e.clientY + 'px' } }
    addEventListener('scroll', f, { passive: true }); addEventListener('pointermove', m)
    return () => { removeEventListener('scroll', f); removeEventListener('pointermove', m) }
  }, [])
  const appUrl = new URL('app/', location.href).href
  return (
    <div className="lp">
      <div className="lp-progress" style={{ transform: `scaleX(${prog})` }} />
      <div className="lp-glow" ref={glow} />
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="wrap bar">
          <a className="brand" href="#top"><span><img src="brand/mark.svg" alt="" /></span>{tr('وصلني', 'Wasalni')}</a>
          <div className="links">
            <a href="#features">{tr('المميزات', 'Features')}</a>
            <a href="#free">{tr('اركب بلاش', 'Ride free')}</a>
            <a href="#students">{tr('الطلبة', 'Students')}</a>
            <a href="#safety">{tr('الأمان', 'Safety')}</a>
            <a href="#prices">{tr('السومة', 'Prices')}</a>
            <a href="#drivers">{tr('الشيفورات', 'Drivers')}</a>
            <a href="#faq">{tr('الأسئلة', 'FAQ')}</a>
          </div>
          <span className="sp" />
          <button className="ghost hide-sm" onClick={() => setLang(LANG === 'ar' ? 'en' : 'ar')}><Languages size={16} />{LANG === 'ar' ? 'EN' : 'ع'}</button>
          <button className="ghost" onClick={() => { const n = !dark; setDark(n); setTheme(n ? 'dark' : 'light') }}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <a className="btn btn-primary btn-sm" href="#download">{tr('حمّل التطبيق', 'Get the app')}</a>
        </div>
      </nav>

      <Hero onIos={() => setIos(true)} />

      <div className="marquee"><div className="track">{[0, 1].map((k) => <span key={k}>{CITIES.map((c) => <React.Fragment key={c.id}>{isAr ? c.ar : c.en}<Sparkles size={16} /></React.Fragment>)}{tr('كورسات بلاش بالريلز', 'Free rides with reels')}<Sparkles size={16} /></span>)}</div></div>

      <section className="sec">
        <div className="wrap stats-row reveal">
          <div className="stat-box"><Counter to={CITIES.length} /><small>{tr('ولايات جزائرية', 'Algerian wilayas')}</small></div>
          <div className="stat-box"><Counter to={100} suffix={tr(' نقطة', ' pts')} /><small>{tr('على كل إعلان تشوفو', 'per ad watched')}</small></div>
          <div className="stat-box"><Counter to={DEFAULT_SETTINGS.students.discount} suffix="%" /><small>{tr('تخفيض للطلبة', 'Student discount')}</small></div>
          <div className="stat-box"><Counter to={24} suffix="/7" /><small>{tr('دعم ومتابعة', 'Support')}</small></div>
        </div>
      </section>

      <FreeRides />
      <Features />
      <Students />
      <Estimator />
      <Payments />
      <Safety />
      <Drivers />
      <Wilayas />
      <Testimonials />
      <Faq />

      <section className="sec" id="download" style={{ paddingBottom: 0 }}>
        <div className="wrap reveal">
          <div className="cta-final">
            <img src="brand/logo.svg" alt="" style={{ width: 120, margin: '0 auto 20px', position: 'relative' }} />
            <h2>{tr('الكورسة الجاية علينا', 'Your next ride is on us')}</h2>
            <p>{tr('حمّل وصلني دروك، شوف أول إشهار واربح 100 نقطة في بلاصتها', 'Download Wasalni, watch your first ad and earn 100 points')}</p>
            <div className="ctas" style={{ justifyContent: 'center' }}>
              <a className="store-btn glass" style={{ background: '#111' }} href={APK_RIDER} download><Smartphone size={26} /><span><small>{tr('حمّل للأندرويد', 'Download for')}</small><b>Android APK</b></span></a>
              <button className="store-btn glass" style={{ background: '#111' }} onClick={() => setIos(true)}><Apple size={26} /><span><small>{tr('حلّو على', 'Open on')}</small><b>iPhone</b></span></button>
            </div>
            <div className="qr"><img src={qr(appUrl)} alt="QR" /></div>
            <div className="small" style={{ marginTop: 8, opacity: 0.85 }}>{tr('سكاني الكود بكاميرا التيليفون', 'Scan with your phone camera')}</div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="wrap">
          <div className="cols">
            <div>
              <img src="brand/logo.svg" alt="" style={{ width: 110 }} />
              <p style={{ maxWidth: 320, lineHeight: 1.8 }}>{tr('وصلني تطبيق نقل ذكي مصمّم للجزائر: سومة معقولة، شيفورات مضمونين، وكورسات بلاش كي تشوف الإشهارات.', 'Smart mobility built for Algeria.')}</p>
            </div>
            <div><h5>{tr('التطبيقات', 'Apps')}</h5><a href="app/">{tr('تطبيق الزبون (ويب)', 'Rider web app')}</a><a href="driver/">{tr('تطبيق الشيفور (ويب)', 'Driver web app')}</a><a href={APK_RIDER} download>APK {tr('الزبون', 'Rider')}</a><a href={APK_DRIVER} download>APK {tr('الشيفور', 'Driver')}</a></div>
            <div><h5>{tr('الشركة', 'Company')}</h5><a href="#features">{tr('المميزات', 'Features')}</a><a href="#drivers">{tr('ولّي شيفور', 'Become a captain')}</a><a href="#faq">{tr('الأسئلة اللي تتعاود', 'FAQ')}</a></div>
            <div><h5>{tr('تواصل', 'Contact')}</h5><a href={`mailto:${DEFAULT_SETTINGS.support.email}`}>{DEFAULT_SETTINGS.support.email}</a><a href={`https://wa.me/${DEFAULT_SETTINGS.support.whatsapp}`}>WhatsApp</a></div>
          </div>
          <div className="bottom"><span>© {new Date().getFullYear()} Wasalni • وصلني</span><span>{tr('مصنوع بالحب في الجزائر 🇩🇿', 'Made with love in Algeria 🇩🇿')}</span></div>
        </div>
      </footer>

      {ios && (
        <div className="sheet-backdrop" onClick={() => setIos(false)} style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
          <div className="card pad pop" style={{ maxWidth: 420, width: '100%', padding: 26 }} onClick={(e) => e.stopPropagation()}>
            <div className="between"><h3 style={{ margin: 0 }}>{tr('وصلني في الآيفون', 'Wasalni on iPhone')}</h3><button onClick={() => setIos(false)}><X size={20} /></button></div>
            <p className="muted small">{tr('يخدم كتطبيق كامل من الشاشة الرئيسية بلا ستور:', 'Works as a full app from your home screen:')}</p>
            <div className="ios-steps small">
              <div>{tr('حل الرابط في Safari', 'Open the link in Safari')}</div>
              <div>{tr('اضغط على زر البارتاج ⬆️ لتحت', 'Tap the Share button ⬆️')}</div>
              <div>{tr('اختار "إضافة إلى الشاشة الرئيسية"', 'Choose "Add to Home Screen"')}</div>
            </div>
            <div className="center mt"><img src={qr(appUrl)} alt="" style={{ width: 150, margin: '0 auto', imageRendering: 'pixelated' }} /></div>
            <a className="btn btn-primary btn-block mt" href="app/">{tr('حل تطبيق الويب', 'Open web app')}</a>
            <a className="btn btn-ghost btn-block mt" href="driver/">{tr('تطبيق الشيفور للويب', 'Driver web app')}</a>
          </div>
        </div>
      )}
    </div>
  )
}

const WORDS = [['بكليكة', 'one tap'], ['في أمان', 'safely'], ['بسومة معقولة', 'fairly'], ['وبلاش', 'for free']]
function Hero({ onIos }) {
  const [w, setW] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  useEffect(() => { const t = setInterval(() => setW((x) => (x + 1) % WORDS.length), 2200); return () => clearInterval(t) }, [])
  return (
    <header className="hero" id="top" onPointerMove={(e) => setTilt({ x: (e.clientX / innerWidth - 0.5) * 14, y: (e.clientY / innerHeight - 0.5) * -10 })}>
      <div className="mesh"><i /><i /><i /></div>
      <div className="grid-bg" />
      <div className="wrap hero-in">
        <div>
          <span className="pill rise"><b>{tr('جديد', 'New')}</b>{tr(`خصم ${DEFAULT_SETTINGS.students.discount}% للطلبة • اقترح سومتك • شحن بالذهبية`, `${DEFAULT_SETTINGS.students.discount}% student discount • Offer your fare`)}</span>
          <h1 className="rise" style={{ animationDelay: '.1s' }}>
            {tr('كورستك', 'Your ride,')} <span className="rot"><span key={w} className="hl">{tr(...WORDS[w])}</span></span><br />
            {tr('مع وصلني', 'with Wasalni')}
          </h1>
          <p className="lead rise" style={{ animationDelay: '.2s' }}>{tr('اطلب كورستك في ثواني، اختار أي بلاصة على الخريطة، تبّع الشيفور مباشرة، وخلّص كاش ولا بالبطاقة الذهبية… ولا اركب بلاش بنقاط الإعلانات.', 'Request a ride in seconds, track your driver live, pay cash or wallet… or ride completely free with reel points.')}</p>
          <div className="ctas rise" style={{ animationDelay: '.3s' }}>
            <a className="store-btn primary" href={APK_RIDER} download><Smartphone size={28} /><span><small>{tr('حمّل دروك', 'Download')}</small><b>Android APK</b></span></a>
            <button className="store-btn glass" onClick={onIos}><Apple size={28} /><span><small>{tr('حلّو على', 'Open on')}</small><b>iPhone</b></span></button>
            <a className="store-btn glass" href="#drivers"><Car size={28} /><span><small>{tr('اخدم معانا', 'Earn with us')}</small><b>{tr('ولّي شيفور', 'Be a captain')}</b></span></a>
          </div>
          <div className="trust rise" style={{ animationDelay: '.4s' }}>
            <div><b className="num">4.9★</b><small>{tr('تقييم الزبائن', 'Rider rating')}</small></div>
            <div><b className="num">3 {tr('د', 'min')}</b><small>{tr('وقت وصول الشيفور', 'Avg pickup')}</small></div>
            <div><b className="num">-{DEFAULT_SETTINGS.students.discount}%</b><small>{tr('للطلبة الجامعيين', 'For students')}</small></div>
            <div><b className="num">0 {tr('دج', 'DA')}</b><small>{tr('كورسات بلاش بالنقاط', 'Free rides')}</small></div>
          </div>
        </div>
        <div className="phone-stage">
          <div className="phone" style={{ transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}>
            <div className="notch" />
            <div className="scr"><CityMap /></div>
          </div>
          <div className="float-card c1" style={{ top: 70, insetInlineStart: -10 }}><span className="fi" style={{ background: '#fff1e6', color: '#E8650A' }}><Gift size={20} /></span><span><b>+100 {tr('نقطة', 'pts')}</b><small>{tr('ربحتها من إشهار', 'Earned from an ad')}</small></span></div>
          <div className="float-card c2" style={{ top: 250, insetInlineEnd: -10, animationDelay: '-2s' }}><span className="fi" style={{ background: '#e8faf1', color: '#12B76A' }}><ShieldCheck size={20} /></span><span><b>{tr('شيفور موثّق', 'Verified driver')}</b><small>★ 4.9 • {tr('سامبول بيضاء', 'White Symbol')}</small></span></div>
          <div className="float-card c3" style={{ bottom: 60, insetInlineEnd: -16, animationDelay: '-1.2s' }}><span className="fi" style={{ background: '#EEF4FF', color: '#3538CD' }}><GraduationCap size={20} /></span><span><b>{tr(`-${DEFAULT_SETTINGS.students.discount}% طالب`, `-${DEFAULT_SETTINGS.students.discount}% student`)}</b><small>{tr('تفعّل في ثانيتين', 'Activated in 2s')}</small></span></div>
          <div className="float-card" style={{ bottom: 150, insetInlineStart: -20, animationDelay: '-3.5s' }}><span className="fi" style={{ background: '#eaf3ff', color: '#2E90FA' }}><Clock size={20} /></span><span><b>{tr('يوصل في 3 دقايق', 'Arrives in 3 min')}</b><small>{tr('اقتصادي • 350 دج', 'Economy • 350 DA')}</small></span></div>
        </div>
      </div>
    </header>
  )
}

// خريطة مدينة متحركة داخل الهاتف
function CityMap() {
  const path = 'M60 470 C 90 420, 120 400, 150 360 S 200 300, 170 250 S 150 170, 210 130'
  return (
    <>
      <svg className="city" viewBox="0 0 278 588" preserveAspectRatio="xMidYMid slice">
        <rect width="278" height="588" fill="#f2eee9" />
        <path d="M0 140 L278 90 M0 300 L278 250 M0 430 L278 400 M70 0 L40 588 M190 0 L230 588 M0 520 L278 540" stroke="#fff" strokeWidth="16" />
        <path d="M0 140 L278 90 M0 300 L278 250 M0 430 L278 400 M70 0 L40 588 M190 0 L230 588" stroke="#e7dfd6" strokeWidth="18" opacity=".5" />
        <path d="M0 140 L278 90 M0 300 L278 250 M0 430 L278 400 M70 0 L40 588 M190 0 L230 588" stroke="#fff" strokeWidth="13" />
        <rect x="90" y="170" width="70" height="55" rx="8" fill="#e6e0da" /><rect x="100" y="320" width="60" height="70" rx="8" fill="#dfead3" />
        <rect x="200" y="290" width="60" height="40" rx="8" fill="#e6e0da" /><rect x="10" y="190" width="45" height="80" rx="8" fill="#e6e0da" />
        <circle cx="220" cy="470" r="38" fill="#c9e0ec" />
        <path d={path} stroke="#7B0E13" strokeOpacity=".25" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d={path} stroke="#E8650A" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="520" strokeDashoffset="520">
          <animate attributeName="stroke-dashoffset" values="520;0;0" keyTimes="0;0.4;1" dur="9s" repeatCount="indefinite" />
        </path>
        <circle cx="60" cy="470" r="9" fill="#fff" stroke="#12B76A" strokeWidth="5" />
        <rect x="201" y="121" width="18" height="18" rx="4" fill="#fff" stroke="#18120e" strokeWidth="5" />
        <g>
          <g transform="translate(-14 -14)">
            <rect x="9" y="3" width="10" height="22" rx="4" fill="#fff" stroke="#000" strokeOpacity=".25" />
            <rect x="10.5" y="7" width="7" height="4" rx="1" fill="#1f2937" /><rect x="12" y="13" width="4" height="6" rx="1" fill="#E8650A" />
          </g>
          <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path={path} keyPoints="0;1;1" keyTimes="0;0.85;1" calcMode="linear" />
        </g>
      </svg>
      <div className="mini-panel">
        <div className="dr">
          <span className="av">م</span>
          <span><b style={{ fontSize: 14 }}>{tr('محمد أمين', 'Mohamed')}</b><div style={{ fontSize: 11, color: '#7a716b' }}>{tr('رونو سامبول • بيضاء', 'Renault Symbol • White')}</div></span>
          <span className="eta"><b>3</b>{tr('دقايق', 'min')}</span>
        </div>
        <div className="bar"><i /></div>
      </div>
    </>
  )
}

function FreeRides() {
  const [step, setStep] = useState(0)
  const [p, setP] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setP((x) => { if (x >= 100) { setStep((s) => (s + 1) % 3); return 0 } return x + 2 }), 90)
    return () => clearInterval(t)
  }, [])
  const C = 2 * Math.PI * 25
  const steps = [
    [tr('شوف إعلان قصير', 'Watch a short ad'), tr('إعلانات قصيرة بالشاشة كاملة من محلات ولايتك، تشوفها حتى للخر.', 'Full-screen short ads from local businesses.')],
    [tr('اربح 100 نقطة في بلاصتها', 'Earn 100 points instantly'), tr('كي تكمّل المشاهدة يتزاد الكادو في رصيدك مع احتفال صغير 🎉', 'Reward lands in your balance the moment it ends 🎉')],
    [tr('اطلب كورستك بلاش', 'Ride for free'), tr('اختار الخلاص بالنقاط كي تطلب، والكورسة تجيك بصفر دينار.', 'Choose points at checkout and pay nothing.')],
  ]
  return (
    <section className="sec alt" id="free">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="eyebrow"><Gift size={15} />{tr('حاجة جديدة', 'Exclusive')}</span>
          <h2>{tr('شوف. اربح. اركب بلاش.', 'Watch. Earn. Ride free.')}</h2>
          <p>{tr('أول تطبيق نقل في الجزائر يحوّل الوقت تاعك لكورسات بلاش. كل إشهار تكمّلو = 100 نقطة، وتبدّلهم بكورسات بلاش.', 'The first ride app in Algeria that turns your time into free rides.')}</p>
        </div>
        <div className="steps reveal">
          <div>
            {steps.map(([t, d], i) => (
              <div key={i} className={`step ${step === i ? 'on' : ''}`} onClick={() => { setStep(i); setP(0) }}>
                <span className="n">{i + 1}</span>
                <div className="grow"><h4>{t}</h4><p>{d}</p>{step === i && <div style={{ height: 4, borderRadius: 4, background: 'var(--line)', marginTop: 12, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: p + '%', background: 'var(--grad)' }} /></div>}</div>
              </div>
            ))}
          </div>
          <div className="reel-phone">
            <div className="scr">
              <div className="kb" style={{ backgroundImage: 'url(reels/ad.jpg)' }} />
              <div className="shade" />
              <div style={{ position: 'absolute', top: 14, insetInline: 14, height: 3, borderRadius: 3, background: 'rgba(255,255,255,.3)' }}><i style={{ display: 'block', height: '100%', width: (step === 0 ? p : 100) + '%', background: '#fff', borderRadius: 3 }} /></div>
              <div className="ring">
                <svg width="60" height="60"><circle cx="30" cy="30" r="25" fill={step > 0 ? '#12B76A' : 'rgba(0,0,0,.35)'} stroke="rgba(255,255,255,.2)" strokeWidth="5" /><circle cx="30" cy="30" r="25" fill="none" stroke="#FFC94A" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={step === 0 ? C * (1 - p / 100) : 0} /></svg>
                <b style={{ color: step > 0 ? '#fff' : '#ffd36b', fontSize: 12 }}>{step > 0 ? '✓' : '+100'}</b>
              </div>
              {step === 1 && <div className="coin" key={'c' + step} style={{ fontSize: 26 }}>+100</div>}
              {step === 2 && (
                <div className="pop" style={{ position: 'absolute', top: '36%', insetInline: 18, background: '#fff', color: '#18120e', borderRadius: 20, padding: 16, textAlign: 'center' }}>
                  <ClassCar type="eco" w={70} />
                  <b style={{ display: 'block', fontSize: 18, marginTop: 6 }}>{tr('كورسة بلاش 🎁', 'Free ride 🎁')}</b>
                  <small style={{ color: '#12B76A', fontWeight: 600 }}>{tr('مخلّصة بنقاط الكادوات', 'Paid with reward points')}</small>
                </div>
              )}
              <div className="meta"><b>{tr('بيتزيريا الدزاير', 'Dzair Pizza')}</b> <span style={{ fontSize: 10, background: 'rgba(255,255,255,.2)', padding: '1px 6px', borderRadius: 5 }}>{tr('سبونسو', 'Sponsored')}</span><div style={{ opacity: 0.9, marginTop: 4 }}>{tr('بيتزا فاميلي بسومة ما تتصدقش 🍕', 'Family pizza deal 🍕')}</div><div style={{ marginTop: 10, background: 'var(--grad)', borderRadius: 12, padding: '9px 12px', fontWeight: 700, textAlign: 'center' }}>{tr('اطلب دروك', 'Order now')}</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className="sec" id="features">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow"><Zap size={15} />{tr('كلش واجد', 'Everything you need')}</span><h2>{tr('تجربة نقل كاملة', 'A complete ride experience')}</h2><p>{tr('خدمنا كل تفصيلة باش تكون الكورسة أسرع وأوضح وأأمن.', 'Every detail designed for faster, clearer, safer rides.')}</p></div>
        <div className="bento reveal">
          <div className="b1">
            <span className="bi"><Navigation size={26} /></span>
            <h3>{tr('خريطة احترافية وتتبّع مباشر', 'Pro map & live tracking')}</h3>
            <p>{tr('اختار أي بلاصة بالدبوس، شوف الطوموبيل تتحرك في الطرقان الحقيقيين، وعندك خريطة عادية، قمر صناعي، ليلية و3D.', 'Pin any spot, watch your car move on real roads — standard, satellite, night and 3D.')}</p>
            <div style={{ position: 'absolute', insetInlineEnd: -20, bottom: -30, opacity: 0.95 }}><ClassCar type="comfort" w={260} /></div>
          </div>
          <div className="b2"><span className="bi"><HandCoins size={26} /></span><h3>{tr('اقترح سومتك', 'Offer your fare')}</h3><p>{tr('السومة تبان قبل ما تطلب، وإذا حبيت تقترح سومة أخرى والشيفورات يقبلو.', 'See the price upfront — or propose your own.')}</p></div>
          <div className="b3"><span className="bi"><UserRound size={26} /></span><h3>{tr('كورسة لشخص آخر', 'Ride for someone else')}</h3><p>{tr('اطلب لماما ولا لخوك، والتفاصيل ورابط التتبّع يوصلوهم في واتساب.', 'Book for family; they get details & tracking on WhatsApp.')}</p></div>
          <div className="b4"><span className="bi"><CalendarClock size={26} /></span><h3>{tr('برمج من قبل', 'Schedule ahead')}</h3><p>{tr('احجز كورسة المطار ولا الخدمة من قبل ونبعثولك الشيفور في الوقت.', 'Book airport or work rides in advance.')}</p></div>
          <div className="b5"><span className="bi"><Sparkles size={26} /></span><h3>{tr('تفضيلاتك', 'Your preferences')}</h3><p>{tr('❄️ كليماتيزور، 🤫 كورسة هادية، 🧳 شنطة كبيرة، 👶 كرسي طفل — الشيفور يشوفهم قبل ما يقبل.', 'A/C, quiet ride, luggage, child seat — shown to the driver.')}</p></div>
        </div>
      </div>
    </section>
  )
}

function Estimator() {
  const [km, setKm] = useState(7)
  const p = DEFAULT_SETTINGS.pricing
  const min = Math.round(km * 2.4 + 3)
  return (
    <section className="sec alt" id="prices">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow"><TrendingUp size={15} />{tr('سومة معقولة', 'Fair prices')}</span><h2>{tr('احسب سومة الكورسة', 'Estimate your fare')}</h2><p>{tr('حرّك المؤشر باش تشوف السومة التقريبية لكل نوع.', 'Move the slider to see estimated prices.')}</p></div>
        <div className="estimator reveal">
          <div>
            <div className="between"><b style={{ fontSize: 18 }}>{tr('المسافة', 'Distance')}</b><b className="num brand-text" style={{ fontSize: 30 }}>{km} {tr('كم', 'km')}</b></div>
            <input className="range-lg mt" type="range" min="1" max="40" value={km} onChange={(e) => setKm(+e.target.value)} />
            <div className="between tiny muted"><span>1 {tr('كم', 'km')}</span><span>40 {tr('كم', 'km')}</span></div>
            <div className="card pad mt flex small" style={{ background: 'var(--brand-50)', border: 0 }}><Clock size={18} color="var(--brand)" />{tr(`مدة تقديرية ${min} دقيقة. الأسعار قد ترتفع قليلًا ليلًا وفي أوقات الذروة.`, `~${min} min. Prices may rise at night and peak hours.`)}</div>
          </div>
          <div>
            {p.classes.map((c) => {
              const q = quote(c, { distanceKm: km, durationMin: min }, p, { when: new Date(2026, 0, 1, 12) })
              return (
                <div key={c.id} className="est-cls">
                  <ClassCar type={c.icon} w={64} />
                  <div><b>{isAr ? c.ar : c.en}</b><div className="tiny muted">{isAr ? c.desc : c.descEn}</div></div>
                  <b className="p num">{money(q.total)}</b>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function Drivers() {
  const [h, setH] = useState(8)
  const [d, setD] = useState(24)
  const perHour = 900
  const monthly = Math.round(h * d * perHour * (1 - DEFAULT_SETTINGS.pricing.commission / 100))
  return (
    <section className="sec dark" id="drivers">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow"><Car size={15} />{tr('شيفورات وصلني', 'Wasalni drivers')}</span><h2>{tr('طوموبيلتك تدخّلك الدراهم', 'Your car, your income')}</h2><p>{tr('اخدم في الوقت اللي يناسبك، بعمولة قليلة ومدخول واضح كل يوم.', 'Flexible hours, low commission, clear daily earnings.')}</p></div>
        <div className="driver-grid reveal">
          <div>
            <div className="perk"><span className="pi"><TrendingUp size={22} /></span><span><b>{tr(`عمولة ${DEFAULT_SETTINGS.pricing.commission}% فقط`, `Only ${DEFAULT_SETTINGS.pricing.commission}% commission`)}</b><small>{tr('والبوربوار ليك كامل', 'Tips are 100% yours')}</small></span></div>
            <div className="perk"><span className="pi"><Clock size={22} /></span><span><b>{tr('انت اللي تختار وقتك', 'You set your hours')}</b><small>{tr('زر واحد وتبدا تستقبل الطلبات', 'One tap to go online')}</small></span></div>
            <div className="perk"><span className="pi"><Wallet size={22} /></span><span><b>{tr('بورتفاي خاص بالشيفور', 'Driver wallet')}</b><small>{tr('اشحن بالذهبية ولا CIB، واسحب أرباحك لـ CCP ولا بريدي موب', 'Top up by card, withdraw to CCP or BaridiMob')}</small></span></div>
            <div className="perk"><span className="pi"><Trophy size={22} /></span><span><b>{tr('تحديات يومية ومكافآت', 'Daily challenges')}</b><small>{tr('كمّل عدد كورسات وتاخذ مكافأة في البورتفاي', 'Complete trips, earn bonuses')}</small></span></div>
            <div className="perk"><span className="pi"><ScanLine size={22} /></span><span><b>{tr('تفعيل الحساب في دقائق', 'Activate in minutes')}</b><small>{tr('صوّر الوثائق بالكاميرا وتتحقق في بلاصتها', 'Scan your documents, verified instantly')}</small></span></div>
            <div className="perk"><span className="pi"><SlidersHorizontal size={22} /></span><span><b>{tr('فلتر الطلبات', 'Request filters')}</b><small>{tr('أقصى مسافة، أقل سومة، وطريقة الدفع اللي تحبها', 'Max distance, min fare, payment type')}</small></span></div>
            <div className="perk"><span className="pi"><Headphones size={22} /></span><span><b>{tr('دعم دايم وأمان', 'Always-on support')}</b><small>{tr('فريق متابعة وزر طوارئ في كل كورسة', 'Support team and SOS')}</small></span></div>
            <div className="ctas mt">
              <a className="store-btn primary" href={APK_DRIVER} download><Smartphone size={26} /><span><small>{tr('تطبيق الشيفور', 'Driver app')}</small><b>Android APK</b></span></a>
              <a className="store-btn glass" href="driver/"><Play size={24} /><span><small>{tr('سجّل من', 'Sign up on')}</small><b>{tr('الويب', 'the web')}</b></span></a>
            </div>
          </div>
          <div className="earn-card">
            <div className="small" style={{ opacity: 0.7 }}>{tr('المدخول تاعك في الشهر (تقريبًا)', 'Estimated monthly earnings')}</div>
            <div className="big num">{money(monthly)}</div>
            <div className="mt">
              <div className="between small"><span>{tr('سوايع في النهار', 'Hours/day')}</span><b className="num">{h}</b></div>
              <input className="range-lg" type="range" min="2" max="14" value={h} onChange={(e) => setH(+e.target.value)} />
              <div className="between small mt"><span>{tr('أيام في الشهر', 'Days/month')}</span><b className="num">{d}</b></div>
              <input className="range-lg" type="range" min="4" max="30" value={d} onChange={(e) => setD(+e.target.value)} />
            </div>
            <div className="tiny" style={{ opacity: 0.55, marginTop: 14 }}>{tr('تقدير على حساب متوسط الطلب بعد العمولة، ويتبدّل على حساب الولاية والوقت.', 'Estimate after commission; varies by city and time.')}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

const TESTI = [
  ['أمينة • سيدي بلعباس', 'أحسن حاجة ركبت زوج خطرات بلاش هاد السمانة من الريلز! التطبيق سريع والشيفورات محترمين.'],
  ['ياسين • وهران', 'السومة تبان قبل ما نطلب وما كاش مفاوضات. خير من الطاكسي العادي بزاف.'],
  ['سارة • الجزائر العاصمة', 'نبارتاجي الكورسة مع دارنا ويشوفو الطوموبيل في الخريطة، نحس روحي في أمان.'],
  ['رياض • قسنطينة', 'كشيفور، المدخول تاعي واضح كل يوم والعمولة قليلة. نخدم في الوقت اللي يعجبني.'],
  ['إيمان • تلمسان', 'برمجت كورسة المطار من الليل وجا الشيفور في الدقيقة. شباب!'],
]
function Testimonials() {
  return (
    <section className="sec" style={{ overflow: 'hidden' }}>
      <div className="wrap sec-head reveal"><span className="eyebrow"><Heart size={15} />{tr('واش قالو الناس', 'Reviews')}</span><h2>{tr('الناس حبّو وصلني', 'People love Wasalni')}</h2></div>
      <div className="testi">{[...TESTI, ...TESTI].map(([n, t], i) => (
        <div key={i} className="t"><span className="stars">{[1, 2, 3, 4, 5].map((s) => <Star key={s} size={16} fill="var(--gold)" color="var(--gold)" />)}</span><p>“{t}”</p><b className="small">{n}</b></div>
      ))}</div>
    </section>
  )
}

const FAQS = [
  ['الكورسات البلاش صح ولا لا؟', 'صح. كل إعلان تشوفو حتى للخر يزيدلك 100 نقطة، وكي تكفي النقاط للسومة تختار الخلاص بالنقاط والكورسة تولي بلاش كاملة. وتقدر تبدّل النقاط لدراهم في البورتفاي.'],
  ['كيفاش نفعّل خصم الطالب؟', `من القائمة اختار "خصم الطالب"، عمّر الاسم والجامعة ورقم التسجيل، وصوّر بطاقة الطالب: الكاميرا تكشفها وحدها وتتفعّل في ثانيتين. التخفيض ${DEFAULT_SETTINGS.students.discount}% يتطبّق أوتوماتيك على كل كورسة طول العام الدراسي.`],
  ['كيفاش نشحن البورتفاي؟', 'اضغط + في البورتفاي واختار: البطاقة الذهبية (بريد الجزائر)، بطاقة CIB، تحويل بريدي موب مع رفع الوصل، ولا كارطة شحن من نقاط البيع.'],
  ['نقدر نطلب كورسة لواحد من العايلة؟', 'إيه. اختار "لشخص آخر" ودخّل الاسم والرقم. الشيفور يعيّطلو مباشرة، وتبعثلو التفاصيل ورابط التتبّع المباشر في واتساب بضغطة.'],
  ['كيفاش نحمّل التطبيق في الآيفون؟', 'حل رابط التطبيق في Safari، اضغط على زر البارتاج واختار "إضافة إلى الشاشة الرئيسية" ويخدم كتطبيق كامل.'],
  ['كيفاش تتحسب السومة؟', 'حلّان العداد + سومة على كل كيلومتر + سومة على كل دقيقة على حساب نوع الطوموبيل، مع زيادة صغيرة في الليل ووقت الزحمة. السومة تبان قبل ما تأكد، وتقدر تقترح سومتك.'],
  ['كيفاش نولي شيفور؟', 'حمّل تطبيق شيفور وصلني، دخّل المعلومات تاعك وتاع الطوموبيل، وصوّر الوثائق بالكاميرا. الحساب يتفعّل بعد التحقق وتبدا تخدم في بلاصتها.'],
  ['الشيفور كيفاش يسحب أرباحو؟', 'من البورتفاي يضغط "اسحب" ويختار CCP ولا بريدي موب ولا حساب بنكي. المبلغ يتحوّل خلال 24–48 ساعة، وإذا ترفض الطلب يرجع للرصيد وحدو.'],
]
function Faq() {
  const [o, setO] = useState(0)
  return (
    <section className="sec alt" id="faq">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow">{tr('الأسئلة اللي تتعاود', 'FAQ')}</span><h2>{tr('عندك سؤال؟', 'Questions?')}</h2></div>
        <div className="faq reveal">
          {FAQS.map(([q, a], i) => (
            <div key={i} className="faq-item">
              <button onClick={() => setO(o === i ? -1 : i)}>{q}<ChevronDown size={20} style={{ transition: 'transform .3s', transform: o === i ? 'rotate(180deg)' : '' }} /></button>
              {o === i && <div className="a">{a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ===== خصم الطلبة =====
function Students() {
  const [ph, setPh] = useState(0)
  useEffect(() => { const t = setInterval(() => setPh((x) => (x + 1) % 4), 1700); return () => clearInterval(t) }, [])
  const d = DEFAULT_SETTINGS.students
  return (
    <section className="sec" id="students">
      <div className="wrap stu-grid reveal">
        <div>
          <span className="eyebrow" style={{ display: 'inline-flex' }}><GraduationCap size={15} />{tr('للطلبة الجامعيين', 'For students')}</span>
          <h2 className="h2">{tr(`راك طالب؟ تنقّل بـ -${d.discount}%`, `Student? Ride for -${d.discount}%`)}</h2>
          <p className="muted lead2">{tr('صوّر بطاقة الطالب بالكاميرا، تتعرّف عليها وحدها وتتفعّل في ثانيتين. التخفيض يتطبّق أوتوماتيك على كل كورسة طول العام الدراسي، وتقدر تجمعو مع النقاط.', 'Scan your student card — detected and activated in seconds. Discount applies automatically all year.')}</p>
          <div className="stu-steps">
            {[[ScanLine, tr('صوّر البطاقة داخل الإطار', 'Scan the card in the frame')], [ShieldCheck, tr('التحقق الأوتوماتيكي', 'Automatic verification')], [Check, tr(`-${d.discount}% على كل كورسة (حتى ${d.maxDiscount} دج)`, `-${d.discount}% every ride (up to ${d.maxDiscount} DA)`)]].map(([I, t], i) => (
              <div key={i} className={ph >= i + 1 ? 'on' : ''}><span><I size={18} /></span>{t}</div>
            ))}
          </div>
          <a className="btn btn-primary btn-lg mt" href="app/"><GraduationCap size={20} />{tr('فعّل خصم الطالب', 'Get student discount')}</a>
        </div>
        <div className="scan-demo">
          <div className={`sd-frame ph${ph}`}>
            <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
            <div className="sd-card">
              <div className="sd-row"><GraduationCap size={22} /><b>{tr('بطاقة طالب', 'Student card')}</b></div>
              <div className="sd-photo" />
              <div className="sd-lines"><i /><i /><i /></div>
            </div>
            {ph === 1 && <div className="sd-laser" />}
            {ph >= 2 && <div className="sd-ok"><Check size={34} strokeWidth={3} /></div>}
          </div>
          <div className={`sd-msg ${ph >= 2 ? 'ok' : ''}`}>{ph === 0 ? tr('حط البطاقة داخل الإطار', 'Place the card in the frame') : ph === 1 ? tr('تمّ الكشف… نتحققو', 'Detected… verifying') : tr(`تفعّل! -${d.discount}% 🎓`, `Activated! -${d.discount}% 🎓`)}</div>
        </div>
      </div>
    </section>
  )
}

// ===== طرق الدفع =====
function Payments() {
  const M = [
    ['edahabia', CreditCard, tr('البطاقة الذهبية', 'Edahabia'), tr('بريد الجزائر — شحن فوري مع رمز التأكيد', 'Algérie Poste — instant with OTP'), 'linear-gradient(135deg,#C9A227,#8B6914)'],
    ['cib', Landmark, tr('بطاقة CIB', 'CIB card'), tr('كل البنوك الجزائرية عبر SATIM', 'All Algerian banks via SATIM'), 'linear-gradient(135deg,#0F766E,#064E3B)'],
    ['baridimob', Smartphone, tr('بريدي موب', 'BaridiMob'), tr('حوّل لـ RIP وارفع الوصل', 'Transfer to RIP & upload receipt'), 'linear-gradient(135deg,#1D4ED8,#1E3A8A)'],
    ['voucher', Ticket, tr('كارطة شحن', 'Voucher'), tr('كود من نقاط البيع', 'Code from retail points'), 'linear-gradient(135deg,#E8650A,#7B0E13)'],
  ]
  return (
    <section className="sec alt" id="pay">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow"><Wallet size={15} />{tr('الخلاص', 'Payments')}</span><h2>{tr('خلّص كيما تحب', 'Pay your way')}</h2><p>{tr('كاش للشيفور، ولا من البورتفاي اللي تشحنو بطرق الدفع الجزائرية المعروفة، ولا بالنقاط.', 'Cash, wallet topped up with Algerian payment methods, or points.')}</p></div>
        <div className="pay-grid reveal">
          {M.map(([k, I, t, d, bg]) => (
            <div key={k} className="pay-card">
              <div className="pc-art" style={{ background: bg }}><I size={30} /><span className="chip-g" /></div>
              <b>{t}</b><small>{d}</small>
            </div>
          ))}
          <div className="pay-card wide">
            <div className="flex" style={{ gap: 14 }}><span className="pc-ico"><Banknote size={24} /></span><span><b>{tr('كاش', 'Cash')}</b><small>{tr('خلّص الشيفور مباشرة', 'Pay the driver directly')}</small></span></div>
            <div className="flex" style={{ gap: 14 }}><span className="pc-ico" style={{ background: 'var(--grad)', color: '#fff' }}><Gift size={24} /></span><span><b>{tr('بالنقاط', 'Points')}</b><small>{tr('كورسة بلاش كاملة', 'A completely free ride')}</small></span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ===== الأمان =====
function Safety() {
  const S = [
    [KeyRound, tr('كود PIN للكورسة', 'Trip PIN'), tr('الشيفور ما يبداش حتى يدخّل الكود اللي عندك — تأكد بلي راكب مع الصحيح.', 'Driver must enter your PIN to start.')],
    [Share2, tr('تتبّع مباشر للعايلة', 'Live tracking for family'), tr('بارتاجي الكورسة ولا ابعث رابط التتبّع في واتساب.', 'Share your trip or a live link on WhatsApp.')],
    [ShieldCheck, tr('شيفورات موثّقين', 'Verified drivers'), tr('البيرمي، البطاقة والكارط قريز تتحقق قبل التفعيل.', 'License, ID and registration checked.')],
    [Users, tr('شيفورة مرا', 'Women drivers'), tr('خيار طلب شيفورة مرا للنساء.', 'Request a female driver.')],
    [Headphones, tr('زر طوارئ', 'SOS button'), tr('عيّط للشرطة 17 ولا خبّر فريق وصلني بضغطة.', 'Call 17 or alert our team in one tap.')],
    [Star, tr('تقييم متبادل', 'Two-way ratings'), tr('الزبون والشيفور يقيّمو بعضاهم بعد كل كورسة.', 'Riders and drivers rate each other.')],
  ]
  return (
    <section className="sec dark" id="safety">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow"><ShieldCheck size={15} />{tr('الأمان أولًا', 'Safety first')}</span><h2>{tr('تركب وانت مرتاح', 'Ride with peace of mind')}</h2><p>{tr('كل كورسة فيها أدوات أمان، ليك ولعايلتك.', 'Safety tools on every ride, for you and your family.')}</p></div>
        <div className="safe-grid reveal">
          {S.map(([I, t, d], i) => <div key={i} className="safe"><span><I size={24} /></span><b>{t}</b><small>{d}</small></div>)}
        </div>
      </div>
    </section>
  )
}

// ===== الولايات =====
function Wilayas() {
  return (
    <section className="sec" id="cities">
      <div className="wrap">
        <div className="sec-head reveal"><span className="eyebrow"><MapPin size={15} />{tr('وين نخدمو', 'Where we operate')}</span><h2>{tr(`${CITIES.length} ولاية وراهي تزيد`, `${CITIES.length} wilayas and growing`)}</h2><p>{tr('بدينا من سيدي بلعباس ورانا نوصلو لكل ولايات الوطن.', 'Started in Sidi Bel Abbès, expanding nationwide.')}</p></div>
        <div className="city-grid reveal">
          {CITIES.map((c, i) => <div key={c.id} className="city-chip" style={{ animationDelay: i * 60 + 'ms' }}><span className="dot" />{isAr ? c.ar : c.en}<small>{tr('متوفر', 'Live')}</small></div>)}
        </div>
      </div>
    </section>
  )
}
