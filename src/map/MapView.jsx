// خريطة MapLibre عالية الجودة: نمط مخصص (فاتح/ليلي/قمر صناعي)، ثلاثي الأبعاد، دوران وإمالة، مسارات متحركة، سيارات بحركة وانعطاف ناعمين.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { isDark } from '@/core/util.js'
import { carSvg } from '@/ui/kit.jsx'
import { buildStyle } from './style.js'

let rtlSet = false
function ensureRTL() {
  if (rtlSet) return
  rtlSet = true
  try { maplibregl.setRTLTextPlugin(new URL('rtl-text.js', location.href).href, true)?.catch?.(() => {}) } catch {}
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function el(html, cls) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d }
function markerEl(m) {
  if (m.type === 'car') {
    const d = el(`<div class="car-body">${carSvg(m.color || '#ffffff')}</div>`, 'car-marker')
    d.style.width = d.style.height = (m.size || 44) + 'px'
    return d
  }
  if (m.type === 'bus') {
    // حافلة كبيرة وواضحة: جسم بلون الخط + رقم الخط + سهم الاتجاه
    return el(`<div class="bus-pin" style="--lc:${esc(m.color || '#E8650A')}"><span class="bi"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v2M16 18v2"/><circle cx="8" cy="14.5" r="1" fill="currentColor"/><circle cx="16" cy="14.5" r="1" fill="currentColor"/><path d="M8 6.5h8"/></svg></span><b>${esc(m.label || '')}</b>${m.live ? '<i class="live"></i>' : ''}</div><div class="bus-tail" style="--lc:${esc(m.color || '#E8650A')}"></div>`, 'bus-marker')
  }
  if (m.type === 'busstop') return el(`${m.label ? `<div class="pin-label sm"><span>${esc(m.label)}</span></div>` : ''}<div class="stop-pin ${m.near ? 'near' : ''}" style="--lc:${esc(m.color || '#18120e')}"><span>🚏</span></div>`, 'pin-marker stop-marker')
  if (m.type === 'me') return el('<span class="me-acc"></span><span class="me-cone"></span><span class="me-dot"></span>', 'me-marker')
  const label = m.label ? `<div class="pin-label">${m.eta ? `<span class="eta">${esc(m.eta)}</span>` : ''}<span>${esc(m.label)}</span></div>` : ''
  const dot = m.type === 'pickup' ? '<div class="pin-pulse"></div><div class="dot-pickup"></div>' : m.type === 'stop' ? '<div class="dot-drop" style="border-color:var(--warning)"></div>' : '<div class="dot-drop"></div>'
  return el(label + dot, 'pin-marker')
}
const lerpAngle = (a, b, t) => { const d = ((((b - a) % 360) + 540) % 360) - 180; return a + d * t }

const DASH = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]

const MapView = forwardRef(function MapView({ center = [-0.6309, 35.1899], zoom = 14, markers = [], routes = [], onMoveStart, onMoveEnd, onBearing, interactive = true, padding, mapType = 'standard', pitch3d = false, onReady, className = '' }, ref) {
  const box = useRef(null)
  const map = useRef(null)
  const mk = useRef(new Map())
  const [ready, setReady] = useState(false)
  const [ver, setVer] = useState(0)
  const pad = useRef(padding)
  pad.current = padding
  const cb = useRef({})
  cb.current = { onMoveStart, onMoveEnd, onReady, onBearing }
  const mtRef = useRef(mapType)
  mtRef.current = mapType
  const pitchRef = useRef(pitch3d ? 58 : 0)
  pitchRef.current = pitch3d ? 58 : 0
  const theme = () => (mtRef.current === 'dark' || (mtRef.current === 'standard' && isDark()) ? 'dark' : 'light')
  const styleKey = useRef('')

  useImperativeHandle(ref, () => ({
    flyTo: (c, z, opts = {}) => map.current?.flyTo({ center: c, zoom: z ?? map.current.getZoom(), duration: 1200, essential: true, padding: pad.current, curve: 1.3, pitch: pitchRef.current, ...opts }),
    easeTo: (opts) => map.current?.easeTo({ duration: 900, padding: pad.current, pitch: pitchRef.current, ...opts }),
    fit: (coords, extra = {}) => {
      if (!map.current || !coords?.length) return
      const b = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
      map.current.fitBounds(b, { padding: { top: 90, bottom: 90, left: 50, right: 50, ...(pad.current || {}), ...extra }, duration: 1100, maxZoom: 16.5, bearing: map.current.getBearing(), pitch: pitchRef.current })
    },
    center: () => map.current?.getCenter().toArray(),
    resetNorth: () => map.current?.easeTo({ bearing: 0, pitch: 0, duration: 700 }),
    zoomBy: (d) => map.current?.easeTo({ zoom: map.current.getZoom() + d, duration: 300 }),
    map: () => map.current,
  }))

  useEffect(() => {
    ensureRTL()
    const opts = { satellite: mapType === 'satellite' }
    styleKey.current = theme() + mapType
    const m = new maplibregl.Map({
      container: box.current, style: buildStyle(theme(), opts), center, zoom, interactive, attributionControl: { compact: true },
      antialias: true, maxPitch: 70, fadeDuration: 220, renderWorldCopies: false, maxTileCacheSize: 600, refreshExpiredTiles: false,
      pitchWithRotate: true, dragRotate: true, touchPitch: true, cooperativeGestures: false,
    })
    map.current = m
    m.on('style.load', () => { setReady(true); setVer((v) => v + 1); cb.current.onReady?.(m) })
    m.on('styleimagemissing', (e) => { if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }) })
    m.on('movestart', (e) => { if (e.originalEvent) cb.current.onMoveStart?.() })
    m.on('moveend', (e) => cb.current.onMoveEnd?.(m.getCenter().toArray(), !!e.originalEvent))
    m.on('rotate', () => cb.current.onBearing?.(m.getBearing(), m.getPitch()))
    m.on('pitch', () => cb.current.onBearing?.(m.getBearing(), m.getPitch()))
    const onTheme = () => restyle()
    window.addEventListener('w-theme', onTheme)
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(box.current)
    return () => { window.removeEventListener('w-theme', onTheme); ro.disconnect(); m.remove() }
  }, [])

  // تغيير النمط (فاتح/ليلي/قمر صناعي)
  const restyle = () => {
    const m = map.current
    if (!m) return
    const key = theme() + mtRef.current
    if (key === styleKey.current) return
    styleKey.current = key
    m.setStyle(buildStyle(theme(), { satellite: mtRef.current === 'satellite' }), { diff: false })
  }
  useEffect(() => { if (ready) restyle() }, [mapType])

  // الإمالة ثلاثية الأبعاد
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    m.easeTo({ pitch: pitch3d ? 58 : 0, duration: 900, zoom: pitch3d ? Math.max(m.getZoom(), 16) : m.getZoom() })
  }, [pitch3d, ready])

  // المسارات + حركة "تدفق" فوق المسار
  useEffect(() => {
    const m = map.current
    if (!ready || !m || !m.isStyleLoaded()) return
    const ids = new Set(routes.map((r) => r.id))
    for (const l of m.getStyle().layers) if (l.id.startsWith('rt-') && !ids.has(l.id.replace(/^rt-(case-|main-|flow-)/, ''))) m.removeLayer(l.id)
    for (const id of Object.keys(m.getStyle().sources)) if (id.startsWith('rs-') && !ids.has(id.slice(3))) m.removeSource(id)
    const dark = theme() === 'dark'
    for (const r of routes) {
      const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords || [] } }
      const s = m.getSource('rs-' + r.id)
      if (s) { s.setData(data); continue }
      m.addSource('rs-' + r.id, { type: 'geojson', data, lineMetrics: true })
      const before = m.getLayer('poi') ? 'poi' : undefined
      m.addLayer({ id: 'rt-case-' + r.id, type: 'line', source: 'rs-' + r.id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': r.casing || (dark ? '#000000' : '#5C0A0E'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, (r.width || 6) + 2, 17, (r.width || 6) + 7], 'line-opacity': r.dashed ? 0 : 0.35, 'line-blur': 0.5 } }, before)
      m.addLayer({
        id: 'rt-main-' + r.id, type: 'line', source: 'rs-' + r.id, layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: r.dashed
          ? { 'line-color': r.color || (dark ? '#ffffff' : '#18120e'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 17, 6], 'line-dasharray': [0.4, 1.8] }
          : { 'line-width': ['interpolate', ['linear'], ['zoom'], 10, r.width || 5, 17, (r.width || 6) + 4], 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, r.from || '#12B76A', 0.45, r.color || '#FF7A1A', 1, r.to || '#C2410C'] },
      }, before)
      if (!r.dashed && r.flow !== false) m.addLayer({ id: 'rt-flow-' + r.id, type: 'line', source: 'rs-' + r.id, layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 17, 3], 'line-dasharray': DASH[0] } }, before)
    }
  }, [routes, ready, ver])
  useEffect(() => {
    if (!ready) return
    let step = 0, raf, last = 0
    const anim = (t) => {
      const m = map.current
      if (m && t - last > 70) {
        last = t
        step = (step + 1) % DASH.length
        for (const r of routes) if (m.getLayer('rt-flow-' + r.id)) m.setPaintProperty('rt-flow-' + r.id, 'line-dasharray', DASH[step])
      }
      raf = requestAnimationFrame(anim)
    }
    if (routes.some((r) => !r.dashed && r.flow !== false)) raf = requestAnimationFrame(anim)
    return () => cancelAnimationFrame(raf)
  }, [routes, ready, ver])

  // العلامات: حركة وانعطاف ناعمان
  useEffect(() => {
    const m = map.current
    if (!m) return
    const seen = new Set()
    for (const x of markers) {
      if (!x?.coords) continue
      seen.add(x.id)
      let e = mk.current.get(x.id)
      const sig = `${x.type}|${x.label || ''}|${x.eta || ''}|${x.color || ''}|${x.size || ''}|${x.near ? 1 : 0}|${x.live ? 1 : 0}`
      if (e && e.sig !== sig) { e.marker.remove(); mk.current.delete(x.id); e = null }
      if (!e) {
        const node = markerEl(x)
        const marker = new maplibregl.Marker({ element: node, anchor: x.type === 'car' || x.type === 'me' ? 'center' : 'bottom', rotationAlignment: x.type === 'car' ? 'map' : 'viewport', pitchAlignment: x.type === 'car' ? 'map' : 'viewport' }).setLngLat(x.coords).addTo(m)
        node.addEventListener('click', (ev) => { const cur = mk.current.get(x.id); if (cur?.cb) { ev.stopPropagation(); cur.cb() } })
        if (x.type === 'car') marker.setRotation(x.heading || 0)
        e = { marker, node, sig, rot: x.heading || 0, anim: null, cb: x.onClick }
        mk.current.set(x.id, e)
      } else if (x.type === 'car' || x.type === 'bus') {
        e.cb = x.onClick
        const from = e.marker.getLngLat().toArray(), to = x.coords, t0 = performance.now(), dur = x.smooth ?? 1300
        const r0 = e.rot, r1 = x.heading ?? r0
        cancelAnimationFrame(e.anim)
        const stepF = (t) => {
          const k = Math.min(1, (t - t0) / dur), ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
          e.marker.setLngLat([from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease])
          if (x.type === 'car') { e.rot = lerpAngle(r0, r1, Math.min(1, k * 1.6)); e.marker.setRotation(e.rot) }
          if (k < 1) e.anim = requestAnimationFrame(stepF)
        }
        e.anim = requestAnimationFrame(stepF)
      } else {
        e.cb = x.onClick
        e.marker.setLngLat(x.coords)
        if (x.type === 'me') e.node.classList.toggle('has-heading', x.heading != null && !isNaN(x.heading)), e.node.style.setProperty('--hd', (x.heading || 0) + 'deg')
      }
    }
    for (const [id, e] of mk.current) if (!seen.has(id)) { cancelAnimationFrame(e.anim); e.marker.remove(); mk.current.delete(id) }
  }, [markers])

  return <div ref={box} className={`map ${className}`} />
})
export default MapView
