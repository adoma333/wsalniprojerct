// أزرار الخريطة: نوع الخريطة، ثلاثي الأبعاد، البوصلة، موقعي
import React, { useState } from 'react'
import { Layers, Crosshair, Navigation2, Box, Check } from 'lucide-react'
import { Sheet } from '@/ui/kit.jsx'
import { tr } from '@/core/util.js'

const TYPES = [
  { id: 'standard', ar: 'عادية', en: 'Standard', bg: 'linear-gradient(135deg,#F3F0EB 0 40%,#FFE9C7 40% 48%,#F3F0EB 48% 70%,#A9D4EE 70%)' },
  { id: 'satellite', ar: 'قمر صناعي', en: 'Satellite', bg: 'linear-gradient(135deg,#3f5a3a,#6b7f4f 45%,#8a8670 60%,#2f4a5c)' },
  { id: 'dark', ar: 'ليلية', en: 'Night', bg: 'linear-gradient(135deg,#15120F 0 40%,#8A5A2B 40% 47%,#15120F 47% 70%,#0E2333 70%)' },
]

export function useMapPrefs() {
  const [mapType, setType] = useState(() => { try { return localStorage.getItem('w_maptype') || 'standard' } catch { return 'standard' } })
  const [pitch3d, set3d] = useState(() => { try { return localStorage.getItem('w_3d') === '1' } catch { return false } })
  return {
    mapType, pitch3d,
    setMapType: (t) => { setType(t); try { localStorage.setItem('w_maptype', t) } catch {} },
    setPitch3d: (v) => { set3d(v); try { localStorage.setItem('w_3d', v ? '1' : '0') } catch {} },
  }
}

export default function MapControls({ prefs, bearing = 0, pitch = 0, onNorth, onLocate, bottom, extra }) {
  const [open, setOpen] = useState(false)
  const rotated = Math.abs(bearing) > 2 || pitch > 5
  return (
    <>
      <div className="map-ctrls" style={{ bottom }}>
        {rotated && (
          <button className="icon-btn sm compass pop" onClick={onNorth} aria-label="north">
            <Navigation2 size={18} style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform .2s' }} fill="var(--danger)" color="var(--danger)" />
          </button>
        )}
        {extra}
        <div className="ctrl-stack">
          <button onClick={() => setOpen(true)} aria-label="layers"><Layers size={19} /></button>
          <button className={prefs.pitch3d ? 'on' : ''} onClick={() => prefs.setPitch3d(!prefs.pitch3d)} aria-label="3d"><Box size={19} /><small>3D</small></button>
        </div>
        <button className="icon-btn locate-btn" onClick={onLocate} aria-label="locate"><Crosshair size={21} /></button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('نوع الخريطة', 'Map type')}>
        <div className="map-types">
          {TYPES.map((t) => (
            <button key={t.id} className={prefs.mapType === t.id ? 'active' : ''} onClick={() => { prefs.setMapType(t.id); setOpen(false) }}>
              <span className="mt-thumb" style={{ background: t.bg }}>{prefs.mapType === t.id && <i><Check size={14} strokeWidth={3} /></i>}</span>
              {tr(t.ar, t.en)}
            </button>
          ))}
        </div>
        <label className="between card pad mt" style={{ boxShadow: 'none', background: 'var(--card-2)' }}>
          <span className="flex"><Box size={20} color="var(--brand)" /><span><b className="small">{tr('عرض ثلاثي الأبعاد', '3D view')}</b><div className="tiny muted">{tr('بنايات بالعلو وإمالة للخريطة', 'Tilted map with building heights')}</div></span></span>
          <button className={`switch ${prefs.pitch3d ? 'on' : ''}`} onClick={() => prefs.setPitch3d(!prefs.pitch3d)} />
        </label>
        <div className="tiny muted center mt">{tr('تقدر تدوّر الخريطة بزوج صوابع وتميلها بالسحب للفوق', 'Rotate with two fingers, tilt by dragging up')}</div>
      </Sheet>
    </>
  )
}
