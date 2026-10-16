// رسومات مخصصة: سيارات الفئات (جانبية)، رسومات الترحيب، العملة.
import React from 'react'

const Wheel = ({ x }) => (
  <g>
    <circle cx={x} cy="41" r="6.6" fill="#1b1b1d" />
    <circle cx={x} cy="41" r="3.4" fill="#c9cdd3" />
    <circle cx={x} cy="41" r="1.2" fill="#6b7280" />
  </g>
)

export function ClassCar({ type = 'eco', w = 66 }) {
  const shadow = <ellipse cx="33" cy="47.5" rx="27" ry="2.6" fill="#000" opacity=".14" />
  if (type === 'family')
    return (
      <svg width={w} viewBox="0 0 66 50">
        {shadow}
        <path d="M6 40V22c0-4 2-8 7-9l26-2c5 0 9 2 12 6l7 9c2 1 3 3 3 6v8z" fill="#ECEFF3" />
        <path d="M14 15l25-2c3 0 6 1 8 4l5 8H12z" fill="#2B3440" />
        <path d="M29 14v11M41 13.5V25" stroke="#ECEFF3" strokeWidth="1.6" />
        <rect x="6" y="31" width="55" height="2.4" fill="#E8650A" />
        <rect x="56" y="29" width="5" height="3" rx="1.5" fill="#FFE8A3" />
        <Wheel x={17} /><Wheel x={50} />
      </svg>
    )
  if (type === 'vip')
    return (
      <svg width={w} viewBox="0 0 66 50">
        {shadow}
        <path d="M3 39v-6c0-3 2-5 5-6l9-2 8-8c2-2 5-3 8-3h9c3 0 6 1 8 3l7 7 5 1c2 1 3 3 3 5v9z" fill="#17171A" />
        <path d="M19 26l7-7c1-1 3-2 5-2h10c2 0 4 1 5 2l6 7z" fill="#5B6270" />
        <path d="M35 17v9" stroke="#17171A" strokeWidth="1.6" />
        <path d="M5 33h56" stroke="#C9A24A" strokeWidth="1.2" />
        <rect x="58" y="30" width="5" height="2.6" rx="1.3" fill="#FFF3C4" />
        <Wheel x={15} /><Wheel x={50} />
      </svg>
    )
  if (type === 'moto')
    return (
      <svg width={w} viewBox="0 0 66 50">
        {shadow}
        <rect x="8" y="12" width="20" height="18" rx="4" fill="#E8650A" />
        <path d="M12 18h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 33h28l6-10h6l4 6c3 1 5 4 5 8v3H10z" fill="#2B3440" />
        <path d="M44 23l-3-8h5" stroke="#2B3440" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <rect x="53" y="30" width="4" height="2.4" rx="1.2" fill="#FFE8A3" />
        <Wheel x={17} /><Wheel x={50} />
      </svg>
    )
  const comfort = type === 'comfort'
  return (
    <svg width={w} viewBox="0 0 66 50">
      {shadow}
      <path d={comfort ? 'M3 39v-6c0-3 2-5 5-6l9-2 8-8c2-2 5-3 8-3h9c3 0 6 1 8 3l7 7 5 1c2 1 3 3 3 5v9z' : 'M4 39v-7c0-3 2-5 5-6l8-2 7-8c2-2 4-3 7-3h10c3 0 5 1 7 3l8 9c3 1 5 3 5 6v8z'} fill={comfort ? '#FFFFFF' : '#E8650A'} stroke={comfort ? '#d6dae0' : 'none'} />
      <path d={comfort ? 'M19 26l7-7c1-1 3-2 5-2h10c2 0 4 1 5 2l6 7z' : 'M19 25l6-7c1-1 3-2 5-2h10c2 0 4 1 5 3l6 6z'} fill="#2B3440" />
      <path d="M35 17v9" stroke={comfort ? '#fff' : '#E8650A'} strokeWidth="1.6" />
      <rect x="58" y="30" width="5" height="2.6" rx="1.3" fill="#FFF3C4" />
      <rect x="3" y="31" width="3" height="2.6" rx="1.3" fill="#ef4444" />
      <Wheel x={15} /><Wheel x={50} />
    </svg>
  )
}

export function Coin({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#F4A425" />
      <circle cx="12" cy="12" r="8.4" fill="#FFD36B" />
      <path d="M12 6.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L12 15.1 8.6 16.9l.7-3.8-2.8-2.6 3.8-.5z" fill="#E08E0B" />
    </svg>
  )
}

// رسومات الترحيب
export function OnbArt({ i }) {
  if (i === 0)
    return (
      <svg viewBox="0 0 300 300" className="art">
        <rect x="70" y="18" width="160" height="270" rx="30" fill="#18120e" />
        <rect x="80" y="30" width="140" height="246" rx="22" fill="#f6f3f0" />
        <path d="M80 120 Q150 90 220 140 M80 200 Q140 160 220 210 M120 30 Q140 150 110 276 M180 30 Q170 160 200 276" stroke="#e2dbd4" strokeWidth="9" fill="none" />
        <path d="M110 230 C130 190 170 190 150 140 S180 90 190 70" stroke="#E8650A" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="1 0">
          <animate attributeName="stroke-dasharray" from="0 400" to="400 0" dur="2.2s" repeatCount="indefinite" />
        </path>
        <circle cx="110" cy="230" r="9" fill="#fff" stroke="#12B76A" strokeWidth="6" />
        <g transform="translate(176 46)"><path d="M14 0C6 0 0 6 0 14c0 10 14 24 14 24s14-14 14-24C28 6 22 0 14 0z" fill="#7B0E13" /><circle cx="14" cy="14" r="5.5" fill="#fff" /></g>
        <rect x="92" y="236" width="116" height="30" rx="12" fill="#E8650A" />
        <rect x="112" y="248" width="76" height="6" rx="3" fill="#fff" opacity=".9" />
      </svg>
    )
  if (i === 1)
    return (
      <svg viewBox="0 0 300 300" className="art">
        <rect x="88" y="14" width="124" height="230" rx="24" fill="#111" />
        <rect x="96" y="24" width="108" height="210" rx="18" fill="url(#rg)" />
        <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a120a" /><stop offset=".6" stop-color="#E8650A" /><stop offset="1" stop-color="#1a0b07" /></linearGradient></defs>
        <rect x="104" y="32" width="92" height="3" rx="2" fill="#fff" opacity=".4" /><rect x="104" y="32" width="56" height="3" rx="2" fill="#fff" />
        <path d="M184 150c0-8 9-12 13-5 4-7 13-3 13 5 0 9-13 16-13 16s-13-7-13-16z" fill="#ff3b5c" />
        <circle cx="150" cy="128" r="22" fill="none" stroke="#fff" strokeWidth="5" opacity=".9" />
        <path d="M144 117l17 11-17 11z" fill="#fff" />
        <g>
          <circle cx="232" cy="74" r="30" fill="#FFD36B" stroke="#F4A425" strokeWidth="6"><animate attributeName="cy" values="74;64;74" dur="2s" repeatCount="indefinite" /></circle>
          <text x="232" y="83" textAnchor="middle" fontSize="24" fontWeight="800" fill="#7a3d00">+5<animate attributeName="y" values="83;73;83" dur="2s" repeatCount="indefinite" /></text>
        </g>
        <circle cx="62" cy="196" r="20" fill="#FFD36B" stroke="#F4A425" strokeWidth="5"><animate attributeName="cy" values="196;186;196" dur="2.4s" repeatCount="indefinite" /></circle>
        <ellipse cx="150" cy="276" rx="90" ry="10" fill="#000" opacity=".08" />
      </svg>
    )
  return (
    <svg viewBox="0 0 300 300" className="art">
      <circle cx="150" cy="140" r="104" fill="#fff" opacity=".18" />
      <path d="M150 54l70 26v52c0 46-30 78-70 92-40-14-70-46-70-92V80z" fill="#fff" />
      <path d="M150 74l52 19v40c0 35-22 59-52 70-30-11-52-35-52-70V93z" fill="#12B76A" />
      <path d="M126 140l17 17 33-35" stroke="#fff" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="150" cy="276" rx="90" ry="10" fill="#000" opacity=".08" />
    </svg>
  )
}
