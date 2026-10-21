import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, ChevronLeft, Star, Inbox } from 'lucide-react'
import { initials, tr } from '@/core/util.js'

// ===== الإشعارات المنبثقة =====
let pushToast = () => {}
export function toast(text, type = '', icon = null, ms = 2600) { pushToast({ text, type, icon, ms }) }
export function Toasts() {
  const [list, setList] = useState([])
  useEffect(() => {
    pushToast = (t) => {
      const id = Math.random()
      setList((l) => [...l.slice(-2), { ...t, id }])
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), t.ms)
    }
  }, [])
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>{t.icon}{t.text}</div>
      ))}
    </div>
  )
}

// ===== التنقل بين الصفحات (مكدس + زر الرجوع في أندرويد والمتصفح) =====
const NavCtx = createContext(null)
export const useNav = () => useContext(NavCtx)
export function NavProvider({ children, render }) {
  const [stack, setStack] = useState([])
  const stackRef = useRef(stack)
  stackRef.current = stack
  const backHandlers = useRef([])

  const push = useCallback((name, params = {}) => {
    history.pushState({ w: stackRef.current.length + 1 }, '')
    setStack((s) => [...s, { name, params, key: Math.random() }])
  }, [])
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), [])
  const back = useCallback(() => { if (stackRef.current.length) history.back() }, [])
  const reset = useCallback(() => {
    const n = stackRef.current.length
    setStack([])
    if (n) history.go(-n)
  }, [])
  const replace = useCallback((name, params = {}) => setStack((s) => [...s.slice(0, -1), { name, params, key: Math.random() }]), [])

  useEffect(() => {
    const onPop = () => {
      const h = backHandlers.current[backHandlers.current.length - 1]
      if (h && h()) { history.pushState({ w: 1 }, ''); return }
      setStack((s) => s.slice(0, -1))
    }
    window.addEventListener('popstate', onPop)
    let sub
    import('@capacitor/app').then(({ App }) => {
      sub = App.addListener('backButton', () => {
        const h = backHandlers.current[backHandlers.current.length - 1]
        if (h && h()) return
        if (stackRef.current.length) history.back()
        else App.minimizeApp?.()
      })
    }).catch(() => {})
    return () => { window.removeEventListener('popstate', onPop); sub?.then?.((s) => s.remove()) }
  }, [])

  const api = { stack, push, back, pop, reset, replace, backHandlers }
  return (
    <NavCtx.Provider value={api}>
      {children}
      {stack.map((p, i) => (
        <div key={p.key} style={{ position: 'fixed', inset: 0, zIndex: 30 + i }}>{render(p, i)}</div>
      ))}
    </NavCtx.Provider>
  )
}
// يعترض زر الرجوع (لإغلاق ورقة سفلية مثلًا)
export function useBackHandler(active, fn) {
  const nav = useNav()
  useEffect(() => {
    if (!active || !nav) return
    const h = () => { fn(); return true }
    nav.backHandlers.current.push(h)
    return () => { nav.backHandlers.current = nav.backHandlers.current.filter((x) => x !== h) }
  }, [active])
}

export function Page({ title, children, foot, actions, noBack, className = '', bodyStyle, onBack }) {
  const nav = useNav()
  return (
    <div className={`page ${className}`}>
      <div className="appbar">
        {!noBack && (
          <button className="back" onClick={onBack || nav.back} aria-label="back"><ArrowLeft size={20} /></button>
        )}
        <h1>{title}</h1>
        {actions}
      </div>
      <div className="page-body" style={bodyStyle}>{children}</div>
      {foot && <div className="page-foot">{foot}</div>}
    </div>
  )
}

// ===== الورقة السفلية =====
export function Sheet({ open, onClose, children, title, sub, style }) {
  const [closing, setClosing] = useState(false)
  const [shown, setShown] = useState(open)
  useEffect(() => {
    if (open) { setShown(true); setClosing(false) }
    else if (shown) { setClosing(true); const t = setTimeout(() => { setShown(false); setClosing(false) }, 240); return () => clearTimeout(t) }
  }, [open])
  useBackHandler(open, onClose)
  const startY = useRef(null)
  const ref = useRef(null)
  if (!shown) return null
  const onTouchStart = (e) => { if (ref.current.scrollTop <= 0) startY.current = e.touches[0].clientY }
  const onTouchMove = (e) => {
    if (startY.current == null) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) ref.current.style.transform = `translateY(${dy}px)`
  }
  const onTouchEnd = (e) => {
    if (startY.current == null) return
    const dy = e.changedTouches[0].clientY - startY.current
    ref.current.style.transform = ''
    startY.current = null
    if (dy > 110) onClose?.()
  }
  return (
    <>
      <div className={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={onClose} />
      <div ref={ref} className={`sheet ${closing ? 'closing' : ''}`} style={style} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="grabber" />
        {title && <h3>{title}</h3>}
        {sub && <p className="sub">{sub}</p>}
        {children}
      </div>
    </>
  )
}


export function Avatar({ name, src, size = 48, style }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, ...style }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </div>
  )
}

export function Stars({ value = 5, size = 16, onChange }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={1.6} style={{ color: i <= Math.round(value) ? 'var(--gold)' : 'var(--faint)', cursor: onChange ? 'pointer' : 'default', transition: 'transform .2s' }} onClick={() => onChange?.(i)} />
      ))}
    </span>
  )
}

export function Switch({ on, onChange }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
}

export function Row({ icon, color = 'var(--brand)', bg, title, sub, onClick, right, chevron = true }) {
  const C = onClick ? 'button' : 'div'
  return (
    <C className="row" onClick={onClick}>
      {icon && <span className="ri" style={{ color, background: bg || `color-mix(in srgb, ${color} 13%, transparent)` }}>{icon}</span>}
      <span className="rt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right}
      {onClick && chevron && <ChevronLeft size={18} className="chev" style={{ transform: document.dir === 'rtl' ? 'none' : 'scaleX(-1)' }} />}
    </C>
  )
}

export function Empty({ icon, title, sub, action }) {
  return (
    <div className="empty rise">
      <div className="ei">{icon || <Inbox size={36} />}</div>
      <b>{title}</b>
      {sub && <div className="small">{sub}</div>}
      {action && <div className="mt">{action}</div>}
    </div>
  )
}

export function Splash({ done }) {
  const [out, setOut] = useState(false)
  useEffect(() => { if (done) { setOut(true) } }, [done])
  const [gone, setGone] = useState(false)
  useEffect(() => { if (out) { const t = setTimeout(() => setGone(true), 450); return () => clearTimeout(t) } }, [out])
  if (gone) return null
  return (
    <div className={`splash ${out ? 'out' : ''}`}>
      <span className="ring" /><span className="ring" style={{ animationDelay: '.8s' }} /><span className="ring" style={{ animationDelay: '1.6s' }} />
      <img src="brand/logo.svg" alt="وصلني" />
    </div>
  )
}

export function Drawer({ open, onClose, head, children, foot }) {
  useBackHandler(open, onClose)
  if (!open) return null
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">{head}</div>
        <div className="drawer-body">{children}</div>
        {foot}
      </aside>
    </>
  )
}
export function DrawerItem({ icon, color, label, onClick, tag }) {
  return (
    <button className="drawer-item" onClick={onClick}>
      <span className="di" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{icon}</span>
      {label}
      {tag && <span className="tag">{tag}</span>}
    </button>
  )
}

export function Loader({ label }) {
  return <div className="empty"><span className="spinner" style={{ color: 'var(--brand)', width: 34, height: 34 }} />{label && <div className="mt small">{label}</div>}</div>
}

// سيارة من الأعلى (للخريطة)
export function carSvg(color = '#ffffff', accent = '#E8650A') {
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${color}"/><stop offset=".5" stop-color="#f4f4f4"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect x="14" y="5" width="20" height="38" rx="8" fill="url(#g)" stroke="#1d1d1f" stroke-opacity=".25"/><path d="M16.5 15.5c2-2.6 13-2.6 15 0l-1.2 6.2h-12.6z" fill="#1f2937"/><path d="M17.5 34.5h13l1 3.6c-3.5 2-11.5 2-15 0z" fill="#1f2937"/><rect x="17.8" y="22.5" width="12.4" height="11" rx="2.5" fill="${color}" stroke="#000" stroke-opacity=".08"/><rect x="15.6" y="6.6" width="4.2" height="2.4" rx="1.2" fill="#fff7cc"/><rect x="28.2" y="6.6" width="4.2" height="2.4" rx="1.2" fill="#fff7cc"/><rect x="15.6" y="39.4" width="4.2" height="2" rx="1" fill="#ef4444"/><rect x="28.2" y="39.4" width="4.2" height="2" rx="1" fill="#ef4444"/><rect x="22" y="23.5" width="4" height="9" rx="1.2" fill="${accent}"/></svg>`
}

export function useSettle(value, ms = 400) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function Confetti({ run }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!run) return
    const c = ref.current, ctx = c.getContext('2d')
    c.width = innerWidth; c.height = innerHeight
    const colors = ['#E8650A', '#FF8A2A', '#F4B740', '#12B76A', '#ffffff', '#7B0E13']
    const parts = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.55, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 6, r: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, s: Math.random() > 0.5 }))
    let f = 0, raf
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of parts) {
        p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.a += 0.12
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c
        if (p.s) ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, 7); ctx.fill() }
        ctx.restore()
      }
      if (++f < 150) raf = requestAnimationFrame(loop); else ctx.clearRect(0, 0, c.width, c.height)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [run])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300 }} />
}

export const T = tr

// شاشة الصيانة (تُفعّل من لوحة التحكم)
export function Maintenance({ message, support }) {
  return (
    <div className="page fade" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 30, gap: 14 }}>
      <img src="brand/mark.svg" alt="" style={{ width: 84 }} className="pop" />
      <h2 style={{ margin: 0 }}>{tr('راجعين قريب 🛠️', 'Back soon 🛠️')}</h2>
      <p className="muted" style={{ maxWidth: 320, margin: 0 }}>{message}</p>
      {support?.whatsapp && <a className="btn btn-ghost" href={`https://wa.me/${support.whatsapp}`}>{tr('تواصل مع الدعم', 'Contact support')}</a>}
    </div>
  )
}
