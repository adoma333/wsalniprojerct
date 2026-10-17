// خريطة MapLibre بنمط مخصص للهوية (فاتح/داكن)، أسماء عربية، مبانٍ ثلاثية الأبعاد، قمر صناعي، سيارات متحركة بسلاسة ومسارات.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { isAr, isDark } from '@/core/util.js'
import { carSvg } from '@/ui/kit.jsx'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const FALLBACK = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

let rtlSet = false
function ensureRTL() {
  if (rtlSet) return
  rtlSet = true
  try { maplibregl.setRTLTextPlugin(new URL('rtl-text.js', location.href).href, true) } catch {}
}

const PALETTE = {
  light: { bg: '#f2eee9', water: '#c9e0ec', green: '#dfead3', building: '#e6e0da', b3d: '#e9e3dd', road: '#ffffff', roadMinor: '#fbf9f7', casing: '#e2dbd4', major: '#fff3e6', majorCase: '#f3cfa9', text: '#4a423c', halo: '#ffffff', rail: '#d8d1ca' },
  dark: { bg: '#141110', water: '#0f1d27', green: '#17201a', building: '#1e1a17', b3d: '#25201c', road: '#2b2521', roadMinor: '#231e1b', casing: '#191513', major: '#3a2a1e', majorCase: '#4b3322', text: '#bdb3aa', halo: '#141110', rail: '#2a2420' },
}

function restyle(map, dark) {
  const P = dark ? PALETTE.dark : PALETTE.light
  const layers = map.getStyle()?.layers || []
  const set = (id, prop, v) => { try { map.setPaintProperty(id, prop, v) } catch {} }
  for (const l of layers) {
    const id = l.id.toLowerCase()
    if (l.type === 'background') set(l.id, 'background-color', P.bg)
    else if (l.type === 'fill') {
      if (id.includes('water')) set(l.id, 'fill-color', P.water)
      else if (id.includes('park') || id.includes('wood') || id.includes('grass') || id.includes('landcover')) set(l.id, 'fill-color', P.green)
      else if (id.includes('building')) set(l.id, 'fill-color', P.building)
      else if (id.includes('landuse') || id.includes('residential')) set(l.id, 'fill-color', P.bg)
    } else if (l.type === 'line') {
      if (id.includes('water') || id.includes('river')) set(l.id, 'line-color', P.water)
      else if (id.includes('rail')) set(l.id, 'line-color', P.rail)
      else if (id.includes('boundary') || id.includes('admin')) continue
      else if (id.includes('casing')) set(l.id, 'line-color', id.includes('major') || id.includes('motorway') || id.includes('trunk') || id.includes('primary') ? P.majorCase : P.casing)
      else if (id.includes('motorway') || id.includes('trunk') || id.includes('primary') || id.includes('major')) set(l.id, 'line-color', P.major)
      else if (id.includes('highway') || id.includes('road') || id.includes('street') || id.includes('path') || id.includes('minor') || id.includes('service') || id.includes('bridge') || id.includes('tunnel')) set(l.id, 'line-color', id.includes('minor') || id.includes('service') || id.includes('path') ? P.roadMinor : P.road)
    } else if (l.type === 'symbol') {
      set(l.id, 'text-color', P.text)
      set(l.id, 'text-halo-color', P.halo)
      set(l.id, 'text-halo-width', 1.4)
      try {
        const tf = map.getLayoutProperty(l.id, 'text-field')
        if (tf) map.setLayoutProperty(l.id, 'text-field', isAr ? ['coalesce', ['get', 'name:ar'], ['get', 'name']] : ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']])
      } catch {}
    }
  }
  // مبانٍ ثلاثية الأبعاد عند التقريب
  const src = Object.entries(map.getStyle().sources || {}).find(([, s]) => s.type === 'vector')?.[0]
  if (src && !map.getLayer('w-3d')) {
    const firstSymbol = layers.find((l) => l.type === 'symbol')?.id
    try {
      map.addLayer({
        id: 'w-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 15,
        paint: {
          'fill-extrusion-color': P.b3d,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['to-number', ['coalesce', ['get', 'render_height'], 8], 8]],
          'fill-extrusion-base': ['to-number', ['coalesce', ['get', 'render_min_height'], 0], 0],
          'fill-extrusion-opacity': 0.75,
        },
      }, firstSymbol)
    } catch {}
  } else if (map.getLayer('w-3d')) set('w-3d', 'fill-extrusion-color', P.b3d)
}

function el(html, cls) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d }

function markerEl(m) {
  if (m.type === 'car') {
    const d = el(carSvg(m.color || '#ffffff'), 'car-marker')
    d.style.width = d.style.height = (m.size || 44) + 'px'
    return d
  }
  if (m.type === 'me') return el('', 'me-dot')
  const label = m.label ? `<div class="pin-label">${m.eta ? `<span class="eta">${m.eta}</span>` : ''}<span>${escape(m.label)}</span></div>` : ''
  const dot = m.type === 'pickup' ? '<div class="dot-pickup"></div>' : m.type === 'stop' ? '<div class="dot-drop" style="border-color:var(--warning)"></div>' : '<div class="dot-drop"></div>'
  return el(label + dot, 'pin-marker')
}
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const MapView = forwardRef(function MapView({ center = [13.1913, 32.8872], zoom = 14, markers = [], routes = [], onMoveStart, onMoveEnd, interactive = true, padding, satellite = false, onReady, className = '' }, ref) {
  const box = useRef(null)
  const map = useRef(null)
  const mk = useRef(new Map())
  const [ready, setReady] = useState(false)
  const pad = useRef(padding)
  pad.current = padding
  const cb = useRef({})
  cb.current = { onMoveStart, onMoveEnd, onReady }

  useImperativeHandle(ref, () => ({
    flyTo: (c, z, opts = {}) => map.current?.flyTo({ center: c, zoom: z ?? map.current.getZoom(), duration: 1100, essential: true, padding: pad.current, ...opts }),
    fit: (coords, extra = {}) => {
      if (!map.current || !coords?.length) return
      const b = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
      map.current.fitBounds(b, { padding: { top: 90, bottom: 90, left: 50, right: 50, ...(pad.current || {}), ...extra }, duration: 1000, maxZoom: 16.5 })
    },
    center: () => map.current?.getCenter().toArray(),
    map: () => map.current,
  }))

  useEffect(() => {
    ensureRTL()
    const m = new maplibregl.Map({ container: box.current, style: STYLE, center, zoom, attributionControl: { compact: true }, interactive, pitchWithRotate: false, dragRotate: false, fadeDuration: 150 })
    map.current = m
    m.touchZoomRotate.disableRotation()
    let failed = false
    m.on('error', (e) => {
      if (!failed && !m.isStyleLoaded() && String(e?.error?.message || '').match(/style|fetch|Failed/i)) { failed = true; m.setStyle(FALLBACK) }
    })
    m.on('style.load', () => { restyle(m, isDark()); setReady(true); cb.current.onReady?.(m) })
    m.on('movestart', (e) => { if (e.originalEvent) cb.current.onMoveStart?.() })
    m.on('moveend', (e) => cb.current.onMoveEnd?.(m.getCenter().toArray(), !!e.originalEvent))
    const onTheme = () => m.isStyleLoaded() && restyle(m, isDark())
    window.addEventListener('w-theme', onTheme)
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(box.current)
    return () => { window.removeEventListener('w-theme', onTheme); ro.disconnect(); m.remove() }
  }, [])

  // القمر الصناعي
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    if (satellite && !m.getSource('sat')) {
      m.addSource('sat', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Esri' })
      const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id
      m.addLayer({ id: 'sat', type: 'raster', source: 'sat' }, firstSymbol)
    }
    if (m.getLayer('sat')) m.setLayoutProperty('sat', 'visibility', satellite ? 'visible' : 'none')
  }, [satellite, ready])

  // المسارات
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    const ids = new Set(routes.map((r) => r.id))
    for (const l of m.getStyle().layers) {
      if (l.id.startsWith('rt-') && !ids.has(l.id.replace(/^rt-(case-|main-)/, ''))) m.removeLayer(l.id)
    }
    for (const id of Object.keys(m.getStyle().sources)) if (id.startsWith('rs-') && !ids.has(id.slice(3))) m.removeSource(id)
    for (const r of routes) {
      const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords || [] } }
      const s = m.getSource('rs-' + r.id)
      if (s) s.setData(data)
      else {
        m.addSource('rs-' + r.id, { type: 'geojson', data, lineMetrics: true })
        m.addLayer({ id: 'rt-case-' + r.id, type: 'line', source: 'rs-' + r.id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': r.casing || (isDark() ? '#000' : '#7B0E13'), 'line-width': (r.width || 6) + 4, 'line-opacity': r.dashed ? 0 : 0.35 } })
        m.addLayer({
          id: 'rt-main-' + r.id, type: 'line', source: 'rs-' + r.id, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: r.dashed
            ? { 'line-color': r.color || '#18120e', 'line-width': r.width || 4, 'line-dasharray': [0.5, 2] }
            : { 'line-width': r.width || 6, 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, r.from || '#12B76A', 0.5, r.color || '#E8650A', 1, r.to || '#C2410C'] },
        })
      }
    }
  }, [routes, ready])

  // العلامات
  useEffect(() => {
    const m = map.current
    if (!m) return
    const seen = new Set()
    for (const x of markers) {
      if (!x?.coords) continue
      seen.add(x.id)
      let e = mk.current.get(x.id)
      const sig = `${x.type}|${x.label || ''}|${x.eta || ''}|${x.color || ''}`
      if (e && e.sig !== sig) { e.marker.remove(); mk.current.delete(x.id); e = null }
      if (!e) {
        const node = markerEl(x)
        const marker = new maplibregl.Marker({ element: node, anchor: x.type === 'car' || x.type === 'me' ? 'center' : 'bottom', rotationAlignment: x.type === 'car' ? 'map' : 'viewport' }).setLngLat(x.coords).addTo(m)
        if (x.onClick) node.addEventListener('click', x.onClick)
        e = { marker, node, sig, pos: x.coords, anim: null }
        mk.current.set(x.id, e)
      } else if (x.type === 'car') {
        // تحريك ناعم بين الموقعين
        const from = e.marker.getLngLat().toArray(), to = x.coords, t0 = performance.now(), dur = x.smooth ?? 1300
        cancelAnimationFrame(e.anim)
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur)
          e.marker.setLngLat([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k])
          if (k < 1) e.anim = requestAnimationFrame(step)
        }
        e.anim = requestAnimationFrame(step)
      } else e.marker.setLngLat(x.coords)
      if (x.type === 'car') e.marker.setRotation(x.heading || 0)
    }
    for (const [id, e] of mk.current) if (!seen.has(id)) { e.marker.remove(); mk.current.delete(id) }
  }, [markers])

  return <div ref={box} className={`map ${className}`} />
})
export default MapView
