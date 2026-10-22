// طبقة البيانات المشتركة: خادم وصلني (SQLite على السيرفر) بنفس واجهة store المحلية.
// كل الهواتف ولوحة التحكم تقرأ وتكتب في نفس القاعدة، والتغييرات تصل لحظيًا عبر SSE.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const INC = '__inc'
const UNION = '__union'
const DEL = '__del'
let KIND = 'rider'
const tkey = () => (KIND === 'admin' ? 'w_atok' : `w_tok_${KIND}`)
const ukey = () => `w_uid_${KIND}`
const getTok = () => { try { return localStorage.getItem(tkey()) || '' } catch { return '' } }
const setTok = (t) => { try { t ? localStorage.setItem(tkey(), t) : localStorage.removeItem(tkey()) } catch {} }

export function setKind(k) { KIND = k || 'rider' }

async function call(path, body) {
  let r
  try {
    // مهلة قصوى باش التطبيق ما يبقاش يستنى للأبد إذا الخادم ما جاوبش
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), 15000)
    r = await fetch(API + path, { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json', ...(getTok() ? { authorization: 'Bearer ' + getTok() } : {}) }, body: JSON.stringify(body || {}) }).finally(() => clearTimeout(to))
  } catch {
    throw Object.assign(new Error('ما قدرناش نتصلو بالخادم، تحقق من الأنترنت'), { code: 0 })
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || 'خطأ ' + r.status), { code: r.status })
  return j
}

// undefined في التحديث = حذف الحقل (نفس سلوك الوضع المحلي)
const enc = (d) => {
  const o = {}
  for (const [k, v] of Object.entries(d || {})) o[k] = v === undefined ? { [DEL]: 1 } : v
  return o
}
const strip = (d) => { if (!d) return d; const { _v, ...rest } = d; return rest }
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// ===== المراقبة اللحظية: اتصال SSE واحد للجهاز، وكل مستند/استعلام اشتراك داخله =====
const subs = new Map() // key -> {id, params, cbs:Set, last}
let es = null, sid = null, seq = 0
function connect() {
  es?.close()
  sid = null
  es = new EventSource(`${API}/db/stream?t=${encodeURIComponent(getTok())}`)
  es.addEventListener('hello', (e) => {
    sid = JSON.parse(e.data).sid
    subs.forEach((s) => sendSub(s))
  })
  es.onmessage = (e) => {
    let m
    try { m = JSON.parse(e.data) } catch { return }
    for (const s of subs.values()) if (s.id === m.s) deliver(s, m.d)
  }
}
function sendSub(s) {
  if (!sid) return
  call('/db/sub', { sid, sub: s.id, ...s.params }).catch((e) => { if (e.code === 410) connect() })
}
// جلب مباشر عبر HTTP: القيمة الأولى تصل حتى قبل ما يتفتح اتصال البث، وبديل إذا البث مقطوع
const deliver = (s, v) => {
  v = Array.isArray(v) ? v.map(strip) : strip(v)
  if (JSON.stringify(v) === JSON.stringify(s.last)) return
  s.last = v
  s.cbs.forEach((f) => { try { f(v) } catch (err) { console.error(err) } })
}
const fetchSub = (s) => (s.params.path ? call('/db/get', { path: s.params.path }).then((r) => r.doc) : call('/db/query', { col: s.params.col, q: s.params.q }).then((r) => r.rows))
  .then((v) => { if (subs.get(JSON.stringify(s.params)) === s) deliver(s, v ?? null) }).catch(() => {})
// إذا البث ما خدمش (بروكسي، شبكة ضعيفة…) نحدّثو كل 4 ثواني عبر HTTP
setInterval(() => {
  if (!subs.size) return
  const live = es && es.readyState === 1 && sid
  if (!live) { subs.forEach(fetchSub); if (!es || es.readyState === 2) connect() }
}, 4000)
function subscribe(params, cb) {
  const key = JSON.stringify(params)
  let s = subs.get(key)
  if (!s) {
    s = { id: 's' + ++seq, params, cbs: new Set(), last: undefined }
    subs.set(key, s)
    if (!es) connect(); else sendSub(s)
    fetchSub(s)
  }
  s.cbs.add(cb)
  if (s.last !== undefined) setTimeout(() => s.cbs.has(cb) && cb(s.last), 0)
  return () => {
    s.cbs.delete(cb)
    if (!s.cbs.size) setTimeout(() => {
      if (s.cbs.size || subs.get(key) !== s) return
      subs.delete(key)
      if (sid) call('/db/unsub', { sid, sub: s.id }).catch(() => {})
    }, 1500)
  }
}
// عند تغيّر الهوية (دخول المدير مثلًا) نعيد فتح الاتصال بالتوكن الجديد
const reopenAll = () => { if (es) connect() }
// عند الرجوع للتطبيق من الخلفية نعيد الاتصال فورًا إذا انقطع
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && es && es.readyState === 2) connect() })
window.addEventListener('online', () => { if (es && es.readyState !== 1) connect() })

export const store = {
  mode: 'server',
  inc: (n) => ({ [INC]: n }),
  union: (...v) => ({ [UNION]: v }),
  async get(path) { return strip((await call('/db/get', { path })).doc) },
  async set(path, data, merge = false) { await call('/db/commit', { writes: [{ op: 'set', path, data: enc(data), merge: !!merge }] }) },
  async update(path, patch) { await call('/db/commit', { writes: [{ op: 'update', path, data: enc(patch) }] }) },
  async add(col, data) { const id = rid(); await this.set(`${col}/${id}`, data); return id },
  async remove(path) { await call('/db/commit', { writes: [{ op: 'remove', path }] }) },
  async list(col, q) { return (await call('/db/query', { col, q: q || {} })).rows.map(strip) },
  watch(path, cb) { return subscribe({ path }, cb) },
  watchList(col, q, cb) { return subscribe({ col, q: q || {} }, cb) },
  // معاملة متفائلة: نقرأ النسخ، نجمّع الكتابات، والخادم يرفض إذا تغيّر شيء فنعيد المحاولة
  async tx(fn) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const reads = new Map()
      const writes = []
      const t = {
        get: async (p) => {
          const d = (await call('/db/get', { path: p })).doc
          reads.set(p, d?._v || 0)
          return strip(d)
        },
        set: (p, d, m) => writes.push({ op: 'set', path: p, data: enc(d), merge: !!m }),
        update: (p, d) => writes.push({ op: 'update', path: p, data: enc(d) }),
        remove: (p) => writes.push({ op: 'remove', path: p }),
      }
      const out = await fn(t)
      if (!writes.length) return out
      try {
        await call('/db/commit', { reads: [...reads].map(([path, v]) => ({ path, v })), writes })
        return out
      } catch (e) {
        if (e.code !== 409) throw e
        await new Promise((r) => setTimeout(r, 120 + Math.random() * 300 * (attempt + 1)))
      }
    }
    throw new Error('الخادم مشغول، عاود')
  },
}

// ===== الهوية =====
export const auth = {
  async init(kind) {
    if (kind) setKind(kind)
    let r
    for (let i = 0; ; i++) {
      try { r = await call('/auth/anon', { token: getTok() || undefined }); break }
      catch (e) { if (e.code !== 0 || i >= 4) throw e; await new Promise((ok) => setTimeout(ok, 800 * (i + 1))) }
    }
    setTok(r.token)
    try { localStorage.setItem(ukey(), r.uid) } catch {}
    return r.uid
  },
  uid: () => { try { return localStorage.getItem(ukey()) } catch { return null } },
  async reset() { await call('/auth/logout').catch(() => {}); setTok(''); try { localStorage.removeItem(ukey()) } catch {} return this.init() },
  async adminStatus() { setKind('admin'); return call('/auth/admin/status') },
  async adminSetup(email, pw) { setKind('admin'); const r = await call('/auth/admin/setup', { email, pw }); setTok(r.token); reopenAll() },
  async adminLogin(email, pw) { setKind('admin'); const r = await call('/auth/admin/login', { email, pw }); setTok(r.token); reopenAll() },
  async adminChangePassword(email, old, pw) { const r = await call('/auth/admin/password', { email, old, pw }); setTok(r.token); reopenAll() },
  async adminLogout() { await call('/auth/logout').catch(() => {}); setTok(''); reopenAll() },
}
