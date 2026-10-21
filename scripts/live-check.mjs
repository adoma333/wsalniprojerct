// فحص الموقع المنشور: يفتح الصفحات في Chromium ويطبع الأخطاء ويحفظ لقطات في shots/
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.argv[2]
mkdirSync('shots', { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, geolocation: { latitude: 35.1899, longitude: -0.6309 }, permissions: ['geolocation'] })

async function visit(path, name, prep) {
  const p = await ctx.newPage()
  const log = (...a) => console.log(`[${name}]`, ...a)
  p.on('console', (m) => ['error', 'warning'].includes(m.type()) && log(m.type(), m.text().slice(0, 300)))
  p.on('pageerror', (e) => log('PAGEERROR', e.message))
  p.on('requestfailed', (r) => log('FAILED', r.url().slice(0, 160), r.failure()?.errorText))
  p.on('response', (r) => r.status() >= 400 && log('HTTP', r.status(), r.url().slice(0, 160)))
  await p.goto(base + path, { waitUntil: 'domcontentloaded' })
  if (prep) await prep(p)
  await p.waitForTimeout(9000)
  const info = await p.evaluate(() => {
    const c = document.querySelector('.maplibregl-canvas')
    const gl = document.createElement('canvas').getContext('webgl2')
    return { canvas: !!c, w: c?.width, h: c?.height, webgl2: !!gl, tiles: performance.getEntriesByType('resource').filter((e) => /openfreemap|arcgis|openstreetmap/.test(e.name)).length }
  })
  log('MAP', JSON.stringify(info))
  await p.screenshot({ path: `shots/${name}.png` })
  if (process.env.DUMP) {
    const jpg = (await p.screenshot({ type: 'jpeg', quality: 45, scale: 'css' })).toString('base64')
    for (let i = 0; i < jpg.length; i += 3000) console.log(`IMG:${name}:${jpg.slice(i, i + 3000)}`)
  }
  return p
}

const only = process.env.ONLY
const reg = async (p, extra = {}) => {
  await p.evaluate((x) => { localStorage.setItem('w_onb', '1'); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v) }, extra)
  await p.reload(); await p.waitForTimeout(2000)
  const n = await p.$('input[autocomplete=name]')
  if (n) { await n.fill('Test'); await p.fill('input[autocomplete=tel]', '550123456'); await p.click('.auth-card .btn-primary') }
}
if (!only || only === 'live') {
  await visit('/', 'landing')
  await visit('/app/', 'rider', (p) => reg(p))
  await visit('/admin/', 'admin')
}
if (only === 'map') {
  await visit('/app/', 'std', (p) => reg(p, { w_maptype: 'standard', w_3d: '0' }))
  await visit('/app/', 'm3d', (p) => reg(p, { w_maptype: 'standard', w_3d: '1' }))
  await visit('/app/', 'dark', (p) => reg(p, { w_maptype: 'dark', w_3d: '0' }))
}
await b.close()
