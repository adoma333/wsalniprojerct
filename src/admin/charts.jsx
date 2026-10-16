// رسوم بيانية خفيفة بـ SVG (بدون مكتبات)
import React, { useState } from 'react'

export function AreaChart({ data, height = 220, color = '#E8650A', format = (v) => v }) {
  const [hover, setHover] = useState(null)
  const W = 640, H = height, P = 28
  const max = Math.max(1, ...data.map((d) => d.v)) * 1.15
  const x = (i) => P + (i * (W - P * 2)) / Math.max(1, data.length - 1)
  const y = (v) => H - P - (v / max) * (H - P * 2)
  const pts = data.map((d, i) => [x(i), y(d.v)])
  const path = pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`
    const [px, py] = pts[i - 1]
    const cx = (px + p[0]) / 2
    return `C${cx},${py} ${cx},${p[1]} ${p[0]},${p[1]}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible', direction: 'ltr' }} onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".32" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={P} x2={W - P} y1={y(max * f / 1.15)} y2={y(max * f / 1.15)} stroke="var(--line)" />)}
      <path d={`${path} L${x(data.length - 1)},${H - P} L${x(0)},${H - P}Z`} fill="url(#ag)" />
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i} onMouseEnter={() => setHover(i)}>
          <rect x={x(i) - (W / data.length) / 2} y={0} width={W / data.length} height={H} fill="transparent" />
          {i % Math.ceil(data.length / 7) === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>}
        </g>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke={color} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(data[hover].v)} r="6" fill="#fff" stroke={color} strokeWidth="3" />
          <rect x={Math.min(W - 120, Math.max(0, x(hover) - 55))} y={Math.max(0, y(data[hover].v) - 46)} width="110" height="34" rx="9" fill="var(--ink)" />
          <text x={Math.min(W - 65, Math.max(55, x(hover)))} y={Math.max(22, y(data[hover].v) - 24)} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--bg)">{format(data[hover].v)} • {data[hover].label}</text>
        </g>
      )}
    </svg>
  )
}

export function Donut({ data, size = 170 }) {
  const total = data.reduce((s, d) => s + d.v, 0) || 1
  const R = 60, C = 2 * Math.PI * R
  let off = 0
  return (
    <div className="flex" style={{ gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line)" strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.v / total) * C
          const el = <circle key={i} cx="80" cy="80" r={R} fill="none" stroke={d.c} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 80 80)" style={{ transition: 'all .6s' }} />
          off += len
          return el
        })}
        <text x="80" y="76" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)">{total === 1 && !data.some((d) => d.v) ? 0 : total}</text>
        <text x="80" y="98" textAnchor="middle" fontSize="11" fill="var(--muted)">رحلة</text>
      </svg>
      <div className="col" style={{ gap: 8 }}>
        {data.map((d, i) => <div key={i} className="flex small"><i style={{ width: 10, height: 10, borderRadius: 3, background: d.c }} />{d.label}<b className="num" style={{ marginInlineStart: 'auto', paddingInlineStart: 12 }}>{d.v}</b></div>)}
      </div>
    </div>
  )
}

export function Bars({ data, height = 160, color = 'var(--brand)' }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }} title={`${d.label}: ${d.v}`}>
          <i style={{ width: '100%', maxWidth: 28, height: `${(d.v / max) * 100}%`, minHeight: 3, background: color, borderRadius: '8px 8px 3px 3px', transition: 'height .6s' }} />
          <small className="tiny muted">{d.label}</small>
        </div>
      ))}
    </div>
  )
}
