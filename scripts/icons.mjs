// يولّد أيقونات التطبيقات (ويب + أندرويد) من شعار SVG.
//   node scripts/icons.mjs            → public/icons
//   node scripts/icons.mjs android rider android/app/src/main/res
import sharp from 'sharp'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const mark = readFileSync('public/brand/mark.svg', 'utf8')
const vb = mark.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
const inner = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

const THEMES = {
  rider: { bg: ['#FF8A2A', '#E8650A', '#C2410C'], badge: null },
  driver: { bg: ['#2A1A12', '#18120E', '#0B0807'], badge: '#E8650A' },
}
function iconSvg(app, size, { pad = 0.2, round = true, bgOnly = false, fgOnly = false } = {}) {
  const t = THEMES[app]
  const s = size, inset = s * pad, box = s - inset * 2
  const scale = Math.min(box / vb[2], box / vb[3])
  const w = vb[2] * scale, h = vb[3] * scale
  const x = (s - w) / 2 - vb[0] * scale, y = (s - h) / 2 - vb[1] * scale
  const r = round ? s * 0.22 : 0
  const bg = fgOnly ? '' : `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg[0]}"/><stop offset=".55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/></linearGradient></defs><rect width="${s}" height="${s}" rx="${r}" fill="url(#b)"/>`
  const ring = !fgOnly && t.badge ? `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.43}" fill="none" stroke="${t.badge}" stroke-width="${s * 0.025}" opacity=".9"/>` : ''
  const fg = bgOnly ? '' : `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${bg}${ring}${fg}</svg>`)
}
const png = (buf, out) => sharp(buf).png().toFile(out)

const [, , mode, app, res] = process.argv
if (mode === 'android') {
  const D = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [d, s] of Object.entries(D)) {
    const dir = `${res}/mipmap-${d}`
    mkdirSync(dir, { recursive: true })
    await png(iconSvg(app, s, { pad: 0.16, round: true }), `${dir}/ic_launcher.png`)
    await png(iconSvg(app, s, { pad: 0.16, round: false }), `${dir}/ic_launcher_round.png`).then(() => sharp(iconSvg(app, s, { pad: 0.16, round: false })).composite([{ input: Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`), blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`))
    const fs = Math.round(s * 2.25)
    await png(iconSvg(app, fs, { pad: 0.3, fgOnly: true }), `${dir}/ic_launcher_foreground.png`)
  }
  // خلفية الأيقونة التكيفية
  mkdirSync(`${res}/values`, { recursive: true })
  writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${THEMES[app].bg[1]}</color>\n</resources>\n`)
  // شاشة البداية
  const sizes = { 'drawable': [480, 800], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280] }
  const logo = readFileSync('public/brand/logo.svg', 'utf8')
  const lvb = logo.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
  const linner = logo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  for (const [d, [w, h]] of Object.entries(sizes)) {
    mkdirSync(`${res}/${d}`, { recursive: true })
    const box = Math.min(w, h) * 0.42, sc = Math.min(box / lvb[2], box / lvb[3])
    const lw = lvb[2] * sc, lh = lvb[3] * sc
    const t = THEMES[app].bg
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t[0]}"/><stop offset=".55" stop-color="${t[1]}"/><stop offset="1" stop-color="${t[2]}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#b)"/><g transform="translate(${(w - lw) / 2 - lvb[0] * sc} ${(h - lh) / 2 - lvb[1] * sc}) scale(${sc})">${linner}</g></svg>`
    await png(Buffer.from(svg), `${res}/${d}/splash.png`)
  }
  console.log('android icons →', res)
} else {
  mkdirSync('public/icons', { recursive: true })
  for (const app of ['rider', 'driver']) {
    await png(iconSvg(app, 192), `public/icons/${app}-192.png`)
    await png(iconSvg(app, 180, { round: false }), `public/icons/${app}-180.png`)
    await png(iconSvg(app, 512), `public/icons/${app}-512.png`)
    await png(iconSvg(app, 512, { pad: 0.28, round: false }), `public/icons/${app}-maskable.png`)
  }
  await png(iconSvg('rider', 1024, { pad: 0.18 }), 'public/icons/store-1024.png')
  console.log('web icons → public/icons')
}
