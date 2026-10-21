// ماسح احترافي للبطاقات والوثائق: كاميرا خلفية، إطار بمقاس البطاقة، كشف تلقائي (حواف + وضوح + ثبات)،
// التقاط تلقائي، فلاش، رفع من المعرض كبديل، ثم مرحلة تحقق متحركة قبل التفعيل.
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Zap, ZapOff, Image as ImageIco, Check, ScanLine, ShieldCheck } from 'lucide-react'
import { tr, compressImage } from '@/core/util.js'
import { Confetti } from './kit.jsx'

const RATIO = { card: 1.586, doc: 1.414, wide: 1.6 } // ISO ID-1 = 85.6 × 54 مم

// تحليل منطقة الإطار في كانفس صغير: قوة الحواف على أطراف الإطار، تباين المحتوى، والثبات بين لقطتين
function analyse(ctx, w, h, prev) {
  const d = ctx.getImageData(0, 0, w, h).data
  const g = new Float32Array(w * h)
  let sum = 0, sum2 = 0
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; g[j] = v; sum += v; sum2 += v * v }
  const n = w * h, mean = sum / n, variance = sum2 / n - mean * mean
  const grad = (x, y) => { const i = y * w + x; return Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]) }
  // حواف قرب الأطراف الأربعة (البطاقة لما تكون في الإطار تعطي خط قوي هنا)
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.12))
  const sides = [0, 0, 0, 0]
  for (let x = 2; x < w - 2; x++) {
    let a = 0, b = 0
    for (let y = 1; y < band; y++) { a = Math.max(a, grad(x, y)); b = Math.max(b, grad(x, h - 1 - y)) }
    sides[0] += a; sides[1] += b
  }
  for (let y = 2; y < h - 2; y++) {
    let a = 0, b = 0
    for (let x = 1; x < band; x++) { a = Math.max(a, grad(x, y)); b = Math.max(b, grad(w - 1 - x, y)) }
    sides[2] += a; sides[3] += b
  }
  sides[0] /= w - 4; sides[1] /= w - 4; sides[2] /= h - 4; sides[3] /= h - 4
  const edges = sides.filter((s) => s > 26).length
  // الوضوح: متوسط التدرّج في الداخل
  let sharp = 0, c = 0
  for (let y = band; y < h - band; y += 2) for (let x = band; x < w - band; x += 2) { sharp += grad(x, y); c++ }
  sharp /= Math.max(1, c)
  let motion = 0
  if (prev) { for (let j = 0; j < n; j += 3) motion += Math.abs(g[j] - prev[j]); motion /= n / 3 } else motion = 99
  return { gray: g, edges, sharp, variance, motion, mean }
}

export default function Scanner({ open, onClose, onDone, title, hint, shape = 'card', steps, verify = true, successText, demo = true }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)
  const [phase, setPhase] = useState('start') // start | live | nocam | captured | verifying | done
  const [status, setStatus] = useState('search') // search | close | hold | locked
  const [lock, setLock] = useState(0)
  const [torch, setTorch] = useState(null) // null = غير مدعوم
  const [shot, setShot] = useState('')
  const [step, setStep] = useState(0)
  const fileRef = useRef(null)
  const ratio = RATIO[shape] || RATIO.card
  const vSteps = steps || [tr('قراءة البطاقة', 'Reading card'), tr('التحقق من الصحة', 'Validating'), tr('تفعيل الحساب', 'Activating')]

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }

  // تشغيل الكاميرا
  useEffect(() => {
    if (!open) return
    setPhase('start'); setShot(''); setStep(0); setLock(0); setStatus('search')
    let dead = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam')
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        if (dead) { s.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = s
        const v = videoRef.current
        v.srcObject = s
        await v.play().catch(() => {})
        try {
          const caps = s.getVideoTracks()[0].getCapabilities?.() || {}
          if (caps.torch) setTorch(false)
          if (caps.focusMode?.includes('continuous')) s.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
        } catch {}
        setPhase('live')
      } catch { if (!dead) setPhase('nocam') }
    })()
    return () => { dead = true; stop() }
  }, [open])

  // منطقة الإطار بإحداثيات الفيديو الأصلية
  const frameRect = () => {
    const v = videoRef.current, f = frameRef.current
    if (!v || !f || !v.videoWidth) return null
    const vr = v.getBoundingClientRect(), fr = f.getBoundingClientRect()
    const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight) // object-fit: cover
    const ox = (vr.width - v.videoWidth * scale) / 2, oy = (vr.height - v.videoHeight * scale) / 2
    return { x: (fr.left - vr.left - ox) / scale, y: (fr.top - vr.top - oy) / scale, w: fr.width / scale, h: fr.height / scale }
  }

  const capture = () => {
    const v = videoRef.current, r = frameRect()
    if (!v || !r) return
    const pad = 0.04
    const sx = Math.max(0, r.x - r.w * pad), sy = Math.max(0, r.y - r.h * pad)
    const sw = Math.min(v.videoWidth - sx, r.w * (1 + pad * 2)), sh = Math.min(v.videoHeight - sy, r.h * (1 + pad * 2))
    const out = 1000, c = document.createElement('canvas')
    c.width = out; c.height = Math.round(out * sh / sw)
    const ctx = c.getContext('2d')
    ctx.filter = 'contrast(1.08) saturate(1.05)'
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height)
    try { navigator.vibrate?.(40) } catch {}
    stop()
    setShot(c.toDataURL('image/jpeg', 0.7))
    setPhase('captured')
  }

  // حلقة الكشف التلقائي
  useEffect(() => {
    if (phase !== 'live') return
    const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 / ratio)
    const ctx = c.getContext('2d', { willReadFrequently: true })
    let prev = null, good = 0, t0 = Date.now(), done = false
    const id = setInterval(() => {
      const v = videoRef.current, r = frameRect()
      if (!v || !r || done) return
      ctx.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height)
      const a = analyse(ctx, c.width, c.height, prev)
      prev = a.gray
      const content = a.variance > 180 && a.sharp > 5
      const steady = a.motion < 9
      let s = 'search'
      if (content && a.edges >= 2) s = steady ? 'locked' : 'hold'
      else if (content) s = 'close'
      // الوضع التجريبي: أي بطاقة/صورة واضحة قدام الكاميرا تتقبل بعد ثواني
      if (demo && content && steady && Date.now() - t0 > 2600) s = 'locked'
      good = s === 'locked' ? good + 1 : Math.max(0, good - 1)
      setStatus(s)
      setLock(Math.min(1, good / 4))
      if (good >= 4) { done = true; setTimeout(capture, 180) }
    }, 220)
    return () => clearInterval(id)
  }, [phase])

  // التحقق المتحرك
  useEffect(() => {
    if (phase !== 'captured') return
    if (!verify) { onDone?.(shot); return }
    const t = setTimeout(() => setPhase('verifying'), 650)
    return () => clearTimeout(t)
  }, [phase])
  useEffect(() => {
    if (phase !== 'verifying') return
    setStep(0)
    const ts = vSteps.map((_, i) => setTimeout(() => setStep(i + 1), 520 * (i + 1)))
    ts.push(setTimeout(() => setPhase('done'), 520 * vSteps.length + 350))
    return () => ts.forEach(clearTimeout)
  }, [phase])
  useEffect(() => {
    if (phase !== 'done') return
    try { navigator.vibrate?.([30, 60, 30]) } catch {}
    const t = setTimeout(() => onDone?.(shot), 1400)
    return () => clearTimeout(t)
  }, [phase])

  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    stop()
    setShot(await compressImage(f, 1000, 0.7))
    setPhase('captured')
  }
  const toggleTorch = async () => {
    const t = streamRef.current?.getVideoTracks()[0]
    if (!t) return
    try { await t.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch) } catch {}
  }
  const close = () => { stop(); onClose?.() }

  if (!open) return null
  const msgs = {
    search: hint || tr('حط البطاقة داخل الإطار', 'Place the card inside the frame'),
    close: tr('قرّب شوية باش تعمّر الإطار', 'Move closer to fill the frame'),
    hold: tr('ثبّت التيليفون…', 'Hold still…'),
    locked: tr('تمّ الكشف ✓', 'Detected ✓'),
  }
  const showVideo = phase === 'live' || phase === 'start'
  return createPortal(
    <div className={`scanner ph-${phase} st-${status}`} role="dialog">
      <video ref={videoRef} playsInline muted autoPlay className="sc-video" style={{ opacity: showVideo ? 1 : 0 }} />
      {!showVideo && shot && <div className="sc-blur" style={{ backgroundImage: `url(${shot})` }} />}

      <div className="sc-top">
        <button className="sc-btn" onClick={close} aria-label="close"><X size={22} /></button>
        <div className="sc-title"><b>{title || tr('صوّر البطاقة', 'Scan card')}</b><small>{phase === 'verifying' || phase === 'done' ? tr('التحقق الآمن', 'Secure verification') : tr('الكشف تلقائي، ما تضغطش', 'Auto-capture, no tap needed')}</small></div>
        {torch !== null && phase === 'live' ? <button className={`sc-btn ${torch ? 'on' : ''}`} onClick={toggleTorch} aria-label="torch">{torch ? <Zap size={20} /> : <ZapOff size={20} />}</button> : <span style={{ width: 44 }} />}
      </div>

      <div className="sc-stage">
        <div ref={frameRef} className="sc-frame" style={{ aspectRatio: String(ratio) }}>
          <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
          {phase === 'live' && <div className="sc-laser" />}
          {phase === 'live' && lock > 0 && <svg className="sc-lock" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="1" y="1" width="98" height="98" rx="6" pathLength="100" style={{ strokeDashoffset: 100 - lock * 100 }} /></svg>}
          {shot && !showVideo && <img src={shot} alt="" className="sc-shot" />}
          {phase === 'verifying' && <div className="sc-sweep" />}
          {phase === 'verifying' && <div className="sc-grid" />}
          {phase === 'done' && <div className="sc-ok pop"><Check size={44} strokeWidth={3} /></div>}
          {phase === 'nocam' && (
            <div className="sc-nocam">
              <ScanLine size={40} />
              <b>{tr('الكاميرا ما راهيش متاحة', 'Camera unavailable')}</b>
              <small>{tr('اختار تصويرة البطاقة من المعرض', 'Choose a photo of the card instead')}</small>
            </div>
          )}
        </div>
        {(phase === 'live' || phase === 'start') && <div className={`sc-msg ${status}`}>{status === 'locked' ? <Check size={16} strokeWidth={3} /> : <ScanLine size={16} />}{msgs[status]}</div>}
        {phase === 'captured' && <div className="sc-msg locked"><Check size={16} strokeWidth={3} />{tr('تصوّرت مليح', 'Captured')}</div>}
        {(phase === 'verifying' || phase === 'done') && (
          <div className="sc-steps">
            {vSteps.map((s, i) => (
              <div key={i} className={`sc-step ${step > i ? 'ok' : step === i && phase === 'verifying' ? 'run' : ''}`}>
                <span>{step > i ? <Check size={14} strokeWidth={3} /> : <i />}</span>{s}
              </div>
            ))}
            {phase === 'done' && <div className="sc-success pop"><ShieldCheck size={20} />{successText || tr('تفعّل بنجاح!', 'Verified!')}</div>}
          </div>
        )}
      </div>

      <div className="sc-bottom">
        {(phase === 'live' || phase === 'start' || phase === 'nocam') && (
          <>
            <button className="sc-btn lg" onClick={() => fileRef.current?.click()} aria-label="gallery"><ImageIco size={22} /><small>{tr('المعرض', 'Gallery')}</small></button>
            {phase === 'nocam'
              ? <button className="btn btn-primary btn-lg" style={{ flex: 1, maxWidth: 260 }} onClick={() => fileRef.current?.click()}><ImageIco size={20} />{tr('اختار تصويرة', 'Choose photo')}</button>
              : <button className={`sc-shutter ${status === 'locked' ? 'ready' : ''}`} onClick={capture} disabled={phase !== 'live'} aria-label="capture"><i /></button>}
            <span className="sc-btn lg ghost" />
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      <Confetti run={phase === 'done'} />
    </div>,
    document.body,
  )
}
