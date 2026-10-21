// لوحة سفلية قابلة للسحب (مثل التطبيقات الكبيرة): مفتوحة ↔ مطوية، والخريطة تأخذ باقي الشاشة
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function DragPanel({ children, peek = 150, onVisible, resetKey, className = '' }) {
  const ref = useRef(null)
  const [collapsed, setCollapsed] = useState(false)
  const [drag, setDrag] = useState(null) // {y0, dy}
  const [h, setH] = useState(0)

  useEffect(() => { setCollapsed(false) }, [resetKey])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxOff = Math.max(0, h - peek)
  const base = collapsed ? maxOff : 0
  const off = drag ? Math.min(maxOff, Math.max(0, base + drag.dy)) : base
  useEffect(() => { onVisible?.(Math.max(peek, h - off)) }, [h, off, peek])

  const start = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY
    setDrag({ y0: y, dy: 0, t: Date.now() })
  }
  const move = (e) => {
    if (!drag) return
    const y = e.touches ? e.touches[0].clientY : e.clientY
    setDrag((d) => d && { ...d, dy: y - d.y0 })
  }
  const end = () => {
    if (!drag) return
    const { dy, t } = drag
    const fast = Math.abs(dy) / Math.max(1, Date.now() - t) > 0.5
    if (Math.abs(dy) < 6) setCollapsed((c) => !c)
    else if (dy > 50 || (fast && dy > 0)) setCollapsed(true)
    else if (dy < -50 || (fast && dy < 0)) setCollapsed(false)
    setDrag(null)
  }
  useEffect(() => {
    if (!drag) return
    const mm = (e) => move(e), mu = () => end()
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    window.addEventListener('touchmove', mm, { passive: true })
    window.addEventListener('touchend', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); window.removeEventListener('touchmove', mm); window.removeEventListener('touchend', mu) }
  }, [!!drag])

  return (
    <div ref={ref} className={`panel drag-panel ${collapsed ? 'collapsed' : ''} ${className}`} style={{ transform: `translateY(${off}px)`, transition: drag ? 'none' : 'transform .42s cubic-bezier(.22,1,.36,1)' }}>
      <div className="drag-zone" onPointerDown={(e) => { if (e.pointerType === 'mouse') start(e) }} onTouchStart={start}>
        <div className="grabber" />
      </div>
      <div className="panel-content" style={collapsed ? { overflow: 'hidden' } : null}>{children}</div>
    </div>
  )
}
