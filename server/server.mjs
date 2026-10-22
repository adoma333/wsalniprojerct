// خادم وصلني: قاعدة بيانات SQLite مشتركة بين كل الهواتف ولوحة التحكم، مع تحديث لحظي (SSE).
// بدون أي مكتبات خارجية: Node.js 22+ (node:sqlite + node:http).
//   PORT=8787 DB_PATH=/var/lib/wasalni/wasalni.db ADMIN_EMAIL=contwais@gmail.com node --experimental-sqlite server.mjs
import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

const PORT = +(process.env.PORT || 8787)
const DB_PATH = process.env.DB_PATH || './data/wasalni.db'
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'contwais@gmail.com').toLowerCase()
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || ''
const MAX_BODY = 12 * 1024 * 1024
const VERSION = '1.0.0'

mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, col TEXT NOT NULL, data TEXT NOT NULL, v INTEGER NOT NULL DEFAULT 1, ts INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS docs_col ON docs(col);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid TEXT NOT NULL, role TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`)
const Q = {
  get: db.prepare('SELECT data, v FROM docs WHERE path = ?'),
  col: db.prepare('SELECT path, data, v FROM docs WHERE col = ?'),
  put: db.prepare('INSERT INTO docs (path, col, data, v, ts) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET data = excluded.data, v = excluded.v, ts = excluded.ts'),
  del: db.prepare('DELETE FROM docs WHERE path = ?'),
  ses: db.prepare('SELECT uid, role, created FROM sessions WHERE token = ?'),
  sesAdd: db.prepare('INSERT INTO sessions (token, uid, role, created, seen) VALUES (?, ?, ?, ?, ?)'),
  sesDel: db.prepare('DELETE FROM sessions WHERE token = ?'),
  sesDelRole: db.prepare('DELETE FROM sessions WHERE role = ?'),
  sesSeen: db.prepare('UPDATE sessions SET seen = ? WHERE token = ?'),
  metaGet: db.prepare('SELECT v FROM meta WHERE k = ?'),
  metaSet: db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
}

// ===== أدوات المستندات =====
const parent = (p) => p.split('/').slice(0, -1).join('/')
const idOf = (p) => p.split('/').pop()
const validPath = (p) => typeof p === 'string' && /^[\w\-.@]+(\/[\w\-.@]+)*$/.test(p) && p.split('/').length % 2 === 0 && p.length < 400
const validCol = (c) => typeof c === 'string' && /^[\w\-.@]+(\/[\w\-.@]+)*$/.test(c) && c.split('/').length % 2 === 1
function readDoc(p) {
  const r = Q.get.get(p)
  return r ? { data: JSON.parse(r.data), v: r.v } : null
}
const INC = '__inc', UNION = '__union', DEL = '__del'
const isOp = (v) => v && typeof v === 'object' && !Array.isArray(v) && (v[INC] !== undefined || v[UNION] !== undefined || v[DEL] !== undefined)
function resolve(prev, patch) {
  const out = { ...(prev || {}) }
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && v[INC] !== undefined) out[k] = (Number(out[k]) || 0) + Number(v[INC] || 0)
    else if (v && typeof v === 'object' && v[UNION] !== undefined) out[k] = [...new Set([...(Array.isArray(out[k]) ? out[k] : []), ...v[UNION]])]
    else if (v && typeof v === 'object' && v[DEL] !== undefined) delete out[k]
    else out[k] = v
  }
  return out
}
function deepMerge(prev, patch) {
  const out = { ...(prev || {}) }
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !isOp(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], v)
    else Object.assign(out, resolve(out, { [k]: v }))
  }
  return out
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function changedKeys(before, after) {
  const ks = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  return [...ks].filter((k) => !same(before?.[k], after?.[k]))
}
function match(doc, [f, op, val]) {
  const x = String(f).split('.').reduce((o, k) => (o == null ? o : o[k]), doc)
  switch (op) {
    case '==': return x === val
    case '!=': return x !== val
    case '>': return x > val
    case '>=': return x >= val
    case '<': return x < val
    case '<=': return x <= val
    case 'in': return Array.isArray(val) && val.includes(x)
    case 'array-contains': return Array.isArray(x) && x.includes(val)
    default: return false
  }
}

// ===== المصادقة =====
const tok = () => randomBytes(24).toString('base64url')
const rid = () => Date.now().toString(36) + randomBytes(5).toString('hex')
function authOf(req, url) {
  const h = req.headers.authorization || ''
  const t = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t')
  if (!t) return { uid: null, role: 'guest' }
  const s = Q.ses.get(t)
  if (!s) return { uid: null, role: 'guest' }
  if (s.role === 'admin' && Date.now() - s.created > 30 * 864e5) { Q.sesDel.run(t); return { uid: null, role: 'guest' } }
  if (Math.random() < 0.05) Q.sesSeen.run(Date.now(), t)
  return { uid: s.uid, role: s.role, token: t }
}
const hashPw = (email, pw, salt = randomBytes(16).toString('hex')) => salt + ':' + scryptSync(`${email.toLowerCase()}:${pw}`, salt, 64).toString('hex')
function checkPw(email, pw) {
  const stored = Q.metaGet.get('admin_hash')?.v
  if (!stored) return false
  const [salt, h] = stored.split(':')
  const a = Buffer.from(h, 'hex'), b = scryptSync(`${email.toLowerCase()}:${pw}`, salt, 64)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ===== قواعد الأمان (نفس منطق firestore.rules) =====
// نفس القيم الافتراضية في src/core/config.js (قبل ما يحفظ المدير أي إعداد)
const DEFAULTS = { autoApproveDrivers: true, kyc: { autoVerify: true }, students: { autoVerify: true }, payments: { demo: true, max: 50000 }, rewards: { pointValue: 5 } }
const settings = () => {
  const s = readDoc('settings/app')?.data || {}
  const out = { ...DEFAULTS, ...s }
  for (const k of ['kyc', 'students', 'payments', 'rewards']) out[k] = { ...DEFAULTS[k], ...(s[k] || {}) }
  return out
}
const n = (x) => Number(x) || 0
function canRead(a, path, d, mode) {
  if (a.role === 'admin') return true
  const s = path.split('/'), c = s[0], id = s[1]
  const signed = !!a.uid
  switch (c) {
    case 'settings': case 'meta': case 'reels': case 'notifications': return true
    case 'reelStats': return true
    case 'users':
      if (s.length === 2) return a.uid === id || (mode === 'refLookup' && signed)
      return a.uid === id
    case 'drivers': return s.length === 2 ? signed : a.uid === id
    case 'rides':
      if (s.length === 4) { const r = readDoc(`rides/${id}`)?.data; return !!r && (r.riderId === a.uid || r.driverId === a.uid) }
      return signed && (d.riderId === a.uid || d.driverId === a.uid || (['searching', 'scheduled'].includes(d.status) && !!readDoc(`drivers/${a.uid}`)))
    case 'promos': return signed && mode === 'get'
    case 'vouchers': return signed && mode === 'get'
    case 'tickets': case 'topups': case 'withdrawals': return signed && d.uid === a.uid
    case 'shares': return mode === 'get'
    default: return false
  }
}
// إخفاء البيانات الحساسة عن غير صاحبها
function redact(a, path, d, mode) {
  const s = path.split('/')
  if (a.role === 'admin') return d
  if (s[0] === 'drivers' && s.length === 2 && a.uid !== s[1]) { const { docs, wallet, earnings, ...rest } = d; return rest }
  if (s[0] === 'users' && s.length === 2 && a.uid !== s[1] && mode === 'refLookup') return { referralCode: d.referralCode }
  return d
}
// كل عملية كتابة تُفحص مع رؤية كاملة للدفعة (لمحاكاة existsAfter/getAfter)
function canWrite(a, w, batch) {
  if (a.role === 'admin') return true
  if (!a.uid) return false
  const { path, before: B, after: A } = w
  const s = path.split('/'), c = s[0], id = s[1]
  const me = (x) => a.uid === x
  const ch = changedKeys(B, A)
  const only = (keys) => ch.every((k) => keys.includes(k))
  const any = (keys) => ch.some((k) => keys.includes(k))
  const after = (p) => (batch.has(p) ? batch.get(p).after : readDoc(p)?.data || null)
  const existed = (p) => (batch.has(p) ? !!batch.get(p).before : !!readDoc(p))
  const del = A === null
  const cfg = settings()
  switch (c) {
    case 'users': {
      if (s.length === 4) {
        const sub = s[2]
        if (!me(id)) return false
        if (sub === 'views') return !B && !del
        if (sub === 'likes') return true
        if (sub === 'tx') return !B && !del
        return false
      }
      if (s.length !== 2 || del) return false
      if (!B) return me(id) && n(A.points) === 0 && n(A.wallet) === 0
      if (signedRating(ch)) return true
      if (!me(id)) return false
      if (!any(['wallet', 'points', 'earnedTotal', 'blocked', 'student', 'lastTopup', 'lastConvert'])) return true
      const dp = n(A.points) - n(B.points), dw = n(A.wallet) - n(B.wallet)
      // مكافأة إعلان: زيادة النقاط مع سجل مشاهدة جديد في نفس العملية
      if (only(['points', 'earnedTotal', 'viewsToday', 'viewsDay', 'lastView', 'updatedAt']) && dp > 0 && dp <= 1000) {
        const vp = `users/${id}/views/${A.lastView}`
        return batch.has(vp) && !batch.get(vp).before && !!batch.get(vp).after
      }
      // شحن بقسيمة غير مستعملة
      if (only(['wallet', 'lastVoucher', 'updatedAt']) && dw > 0) {
        const vp = `vouchers/${A.lastVoucher}`, vb = batch.get(vp)
        return !!vb && !!vb.before && !vb.before.used && vb.after?.used === true && vb.after?.usedBy === a.uid && dw === n(vb.before.amount)
      }
      // تحويل النقاط بسعر الصرف الحالي
      if (only(['points', 'wallet', 'lastConvert', 'updatedAt']) && dp < 0 && n(A.points) >= 0) {
        const pv = cfg.rewards?.pointValue ?? 5
        return dw <= (-dp * pv) / 100 + 0.01
      }
      // شحن بالبطاقة (الوضع التجريبي): عملية شحن جديدة مقبولة بنفس المبلغ
      if (only(['wallet', 'lastTopup', 'updatedAt']) && dw > 0) {
        const tp = `topups/${A.lastTopup}`, t = batch.get(tp)
        return !!t && !t.before && t.after?.uid === a.uid && t.after?.status === 'paid' && dw === n(t.after.amount)
      }
      // خصم الطالب
      if (only(['student', 'updatedAt'])) {
        const st = A.student?.status
        return st === 'pending' || (st === 'verified' && (cfg.students?.autoVerify ?? true) === true)
      }
      // الدفع: إنقاص فقط
      if (only(['wallet', 'points', 'trips', 'updatedAt'])) return dw <= 0 && dp <= 0
      return false
    }
    case 'drivers': {
      if (s.length === 4) return me(id) && s[2] === 'tx' && !B && !del
      if (s.length !== 2 || del) return false
      if (!B) return me(id) && (A.status === 'pending' || (A.status === 'approved' && (cfg.autoApproveDrivers || cfg.kyc?.autoVerify)))
      if (signedRating(ch)) return true
      if (!me(id)) return false
      if (any(['status', 'rejectReason', 'approvedAt', 'blocked'])) return false
      // شحن محفظة السائق بالبطاقة: نفس شرط الزبون
      if (ch.includes('lastTopup')) {
        const t = batch.get(`topups/${A.lastTopup}`)
        return !!t && !t.before && t.after?.uid === a.uid && t.after?.status === 'paid' && only(['wallet', 'lastTopup', 'updatedAt']) && n(A.wallet) - n(B.wallet) === n(t.after.amount)
      }
      return true
    }
    case 'rides': {
      if (s.length === 4) { const r = readDoc(`rides/${id}`)?.data; return !!r && (r.riderId === a.uid || r.driverId === a.uid) && !B && !del }
      if (del) return false
      if (!B) return A.riderId === a.uid || A.driverId === a.uid
      if (B.riderId === a.uid || B.driverId === a.uid) return true
      return ['searching', 'scheduled'].includes(B.status) && (A.driverId === a.uid || only(['declinedBy', 'updatedAt']))
    }
    case 'reelStats':
      if (s.length === 4) return !B && !del && A.uid === a.uid
      return !del
    case 'promos': return !!B && !del && only(['used'])
    case 'vouchers': return !!B && !del && !B.used && only(['used', 'usedBy', 'usedAt']) && A.usedBy === a.uid
    case 'tickets': return !B && !del
    case 'sos': case 'referrals': return !B && !del
    case 'topups': {
      if (B || del || A.uid !== a.uid) return false
      const p = cfg.payments || {}
      const amt = n(A.amount)
      if (amt <= 0 || amt > (p.max ?? 50000)) return false
      return A.status === 'pending' || (A.status === 'paid' && (p.demo ?? true) === true && ['edahabia', 'cib'].includes(A.method))
    }
    case 'withdrawals': {
      if (B || del || A.uid !== a.uid || A.status !== 'pending') return false
      const d = after(`drivers/${a.uid}`)
      return !!d && n(A.amount) > 0 && n(A.amount) <= n(readDoc(`drivers/${a.uid}`)?.data?.wallet)
    }
    case 'students': return me(id) && !del
    case 'shares': return !del && A.uid === a.uid && (!B || B.uid === a.uid)
    default: return false
  }
  function signedRating(keys) { return keys.length > 0 && keys.every((k) => ['ratingSum', 'ratingCount'].includes(k)) }
}

// ===== البث اللحظي =====
const watchers = new Map() // key (path or col) -> Set(w)
function addW(key, w) { if (!watchers.has(key)) watchers.set(key, new Set()); watchers.get(key).add(w) }
function delW(key, w) { watchers.get(key)?.delete(w); if (!watchers.get(key)?.size) watchers.delete(key) }
const pending = new Set()
let flushTimer = null
function notify(paths) {
  for (const p of paths) {
    watchers.get(p)?.forEach((w) => pending.add(w))
    watchers.get(parent(p))?.forEach((w) => pending.add(w))
  }
  if (!flushTimer) flushTimer = setTimeout(flush, 40)
}
function flush() {
  flushTimer = null
  const list = [...pending]; pending.clear()
  for (const w of list) { try { w.push() } catch {} }
}
function snapDoc(a, path) {
  const r = readDoc(path)
  if (!r) return null
  if (!canRead(a, path, r.data, 'get')) return null
  return { id: idOf(path), ...redact(a, path, r.data, 'get'), _v: r.v }
}
function runQuery(a, col, q = {}) {
  const ref = col === 'users' && (q.where || []).length === 1 && q.where[0][0] === 'referralCode' && q.where[0][1] === '=='
  const mode = ref ? 'refLookup' : 'list'
  let rows = []
  for (const r of Q.col.all(col)) {
    const d = JSON.parse(r.data)
    if (!(q.where || []).every((w) => match(d, w))) continue
    if (!canRead(a, r.path, d, mode)) continue
    rows.push({ id: idOf(r.path), ...redact(a, r.path, d, mode), _v: r.v })
  }
  if (q.orderBy) {
    const [f, dir = 'asc'] = q.orderBy
    rows.sort((x, y) => ((x[f] ?? 0) > (y[f] ?? 0) ? 1 : (x[f] ?? 0) < (y[f] ?? 0) ? -1 : 0) * (dir === 'desc' ? -1 : 1))
  }
  if (q.limit) rows = rows.slice(0, Math.min(2000, q.limit))
  return rows
}

// ===== الكتابة الذرية =====
class HttpErr extends Error { constructor(code, msg) { super(msg); this.code = code } }
function commit(a, reads = [], writes = []) {
  if (!Array.isArray(writes) || writes.length > 500) throw new HttpErr(400, 'bad writes')
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const r of reads) {
      if (!validPath(r.path)) throw new HttpErr(400, 'bad path')
      const cur = readDoc(r.path)
      if ((cur?.v || 0) !== (r.v || 0)) throw new HttpErr(409, 'conflict')
    }
    // تطبيق الكتابات على نسخة في الذاكرة أولًا
    const batch = new Map()
    for (const w of writes) {
      if (!validPath(w.path)) throw new HttpErr(400, 'bad path: ' + w.path)
      const prev = batch.has(w.path) ? batch.get(w.path) : (() => { const d = readDoc(w.path); return { before: d?.data || null, after: d?.data || null, v: d?.v || 0 } })()
      let next
      if (w.op === 'remove') next = null
      else if (w.op === 'update') { if (!prev.after) throw new HttpErr(404, 'not-found: ' + w.path); next = resolve(prev.after, w.data) }
      else if (w.op === 'set') next = w.merge ? deepMerge(prev.after, w.data) : resolve({}, w.data)
      else throw new HttpErr(400, 'bad op')
      batch.set(w.path, { ...prev, after: next })
    }
    for (const [path, w] of batch) if (!canWrite(a, { path, ...w }, batch)) throw new HttpErr(403, 'permission-denied: ' + path)
    const now = Date.now()
    for (const [path, w] of batch) {
      if (w.after === null) Q.del.run(path)
      else Q.put.run(path, parent(path), JSON.stringify(w.after), (w.v || 0) + 1, now)
    }
    db.exec('COMMIT')
    notify([...batch.keys()])
  } catch (e) { try { db.exec('ROLLBACK') } catch {} throw e }
}

// ===== HTTP =====
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...cors }); res.end(JSON.stringify(body)) }
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' }
function body(req) {
  return new Promise((ok, bad) => {
    let size = 0; const chunks = []
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { bad(new HttpErr(413, 'too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch { bad(new HttpErr(400, 'bad json')) } })
    req.on('error', bad)
  })
}
const anonHits = new Map()
function limitAnon(ip) {
  const h = (anonHits.get(ip) || []).filter((t) => Date.now() - t < 3600e3)
  if (h.length >= 40) return false
  h.push(Date.now()); anonHits.set(ip, h); return true
}

// اتصال SSE واحد لكل جهاز، والاشتراكات (مستند/استعلام) تُضاف وتُزال عبر POST
const streams = new Map() // sid -> {res, a, subs: Map(subId -> {key, w})}
function openStream(req, res, a) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no', ...cors })
  const sid = tok()
  const st = { res, a, subs: new Map() }
  streams.set(sid, st)
  // حشو أولي باش البروكسيات (نفق Cloudflare…) ما تخبّيش البث
  res.write(':' + ' '.repeat(4096) + '\n\n')
  res.write(`retry: 2000\nevent: hello\ndata: ${JSON.stringify({ sid })}\n\n`)
  const ping = setInterval(() => res.write(': ping\n\n'), 20000)
  req.on('close', () => {
    clearInterval(ping)
    st.subs.forEach(({ key, w }) => delW(key, w))
    streams.delete(sid)
  })
}
function addSub(a, b) {
  const st = streams.get(b.sid)
  if (!st) throw new HttpErr(410, 'stream gone')
  if ((st.a.token || '') !== (a.token || '')) throw new HttpErr(403, 'stream owner mismatch')
  const sub = String(b.sub || '')
  if (!sub || st.subs.size > 300) throw new HttpErr(400, 'bad sub')
  if (b.path ? !validPath(b.path) : !validCol(b.col)) throw new HttpErr(400, 'bad target')
  const old = st.subs.get(sub); if (old) delW(old.key, old.w)
  let last = ''
  const w = {
    push() {
      const data = b.path ? snapDoc(st.a, b.path) : runQuery(st.a, b.col, b.q || {})
      const str = JSON.stringify(data)
      if (str === last) return
      last = str
      st.res.write(`data: ${JSON.stringify({ s: sub, d: data })}\n\n`)
    },
  }
  const key = b.path || b.col
  st.subs.set(sub, { key, w })
  addW(key, w)
  w.push()
}
function delSub(a, b) {
  const st = streams.get(b.sid)
  if (!st || (st.a.token || '') !== (a.token || '')) return
  const x = st.subs.get(String(b.sub)); if (x) { delW(x.key, x.w); st.subs.delete(String(b.sub)) }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
  try {
    const a = authOf(req, url)
    const p = url.pathname.replace(/\/+$/, '')
    if (p === '' || p === '/health') return json(res, 200, { ok: true, name: 'wasalni', version: VERSION, docs: db.prepare('SELECT COUNT(*) n FROM docs').get().n, watchers: [...watchers.values()].reduce((s, x) => s + x.size, 0), streams: streams.size })
    if (req.method === 'GET' && p === '/db/stream') return openStream(req, res, a)
    if (req.method !== 'POST') throw new HttpErr(404, 'not found')
    const b = await body(req)
    switch (p) {
      case '/auth/anon': {
        if (b.token) { const s = Q.ses.get(b.token); if (s && s.role === 'user') return json(res, 200, { uid: s.uid, token: b.token }) }
        if (!limitAnon(ip)) throw new HttpErr(429, 'محاولات كثيرة، عاود بعد شوية')
        const t = tok(), uid = 'u' + rid()
        Q.sesAdd.run(t, uid, 'user', Date.now(), Date.now())
        return json(res, 200, { uid, token: t })
      }
      case '/auth/admin/status': return json(res, 200, { initialized: !!Q.metaGet.get('admin_hash'), signedIn: a.role === 'admin' })
      case '/auth/admin/setup': {
        if (Q.metaGet.get('admin_hash')) throw new HttpErr(400, 'كلمة السر محددة مسبقًا (موجود)')
        if (String(b.email || '').toLowerCase() !== ADMIN_EMAIL) throw new HttpErr(403, 'هذا البريد ليس بريد المدير')
        if (String(b.pw || '').length < 6) throw new HttpErr(400, 'كلمة السر 6 أحرف على الأقل')
        Q.metaSet.run('admin_hash', hashPw(ADMIN_EMAIL, b.pw))
        const t = tok(); Q.sesAdd.run(t, 'admin', 'admin', Date.now(), Date.now())
        return json(res, 200, { token: t })
      }
      case '/auth/admin/login': {
        await new Promise((r) => setTimeout(r, 400))
        if (String(b.email || '').toLowerCase() !== ADMIN_EMAIL || !checkPw(ADMIN_EMAIL, String(b.pw || ''))) throw new HttpErr(401, 'البريد أو كلمة السر غير صحيحة')
        const t = tok(); Q.sesAdd.run(t, 'admin', 'admin', Date.now(), Date.now())
        return json(res, 200, { token: t })
      }
      case '/auth/admin/password': {
        if (!checkPw(ADMIN_EMAIL, String(b.old || ''))) throw new HttpErr(401, 'كلمة السر الحالية غير صحيحة')
        if (String(b.pw || '').length < 6) throw new HttpErr(400, 'كلمة السر 6 أحرف على الأقل')
        Q.metaSet.run('admin_hash', hashPw(ADMIN_EMAIL, b.pw))
        Q.sesDelRole.run('admin')
        const t = tok(); Q.sesAdd.run(t, 'admin', 'admin', Date.now(), Date.now())
        return json(res, 200, { token: t })
      }
      case '/auth/logout': if (a.token) Q.sesDel.run(a.token); return json(res, 200, { ok: true })
      case '/db/get': {
        if (!validPath(b.path)) throw new HttpErr(400, 'bad path')
        return json(res, 200, { doc: snapDoc(a, b.path) })
      }
      case '/db/query': {
        if (!validCol(b.col)) throw new HttpErr(400, 'bad col')
        return json(res, 200, { rows: runQuery(a, b.col, b.q || {}) })
      }
      // عدة قراءات في طلب واحد (بديل البث اللحظي كي يكون مقطوع)
      case '/db/batch': {
        const items = Array.isArray(b.items) ? b.items.slice(0, 200) : []
        return json(res, 200, { results: items.map((it) => {
          try {
            if (it.path) return validPath(it.path) ? snapDoc(a, it.path) : null
            return validCol(it.col) ? runQuery(a, it.col, it.q || {}) : []
          } catch { return null }
        }) })
      }
      case '/db/sub': addSub(a, b); return json(res, 200, { ok: true })
      case '/db/unsub': delSub(a, b); return json(res, 200, { ok: true })
      case '/db/commit': {
        commit(a, b.reads || [], b.writes || [])
        return json(res, 200, { ok: true })
      }
      default: throw new HttpErr(404, 'not found')
    }
  } catch (e) {
    const code = e.code && typeof e.code === 'number' ? e.code : 500
    if (code === 500) console.error(e)
    if (!res.headersSent) json(res, code, { error: e.message || 'error' })
    else res.end()
  }
})
server.keepAliveTimeout = 65000
server.listen(PORT, '127.0.0.1', () => console.log(`wasalni server on 127.0.0.1:${PORT} (db: ${DB_PATH})`))

// ===== نسخة احتياطية يومية إلى تلجرام =====
async function backup() {
  if (!TG_TOKEN || !TG_CHAT) return
  const f = DB_PATH + '.backup'
  try {
    if (existsSync(f)) rmSync(f)
    db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`)
    const fd = new FormData()
    fd.append('chat_id', TG_CHAT)
    fd.append('caption', `🗄 نسخة احتياطية لقاعدة بيانات وصلني — ${new Date().toISOString().slice(0, 10)}`)
    fd.append('document', new Blob([readFileSync(f)]), `wasalni-${new Date().toISOString().slice(0, 10)}.sqlite`)
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendDocument`, { method: 'POST', body: fd })
    rmSync(f)
  } catch (e) { console.error('backup failed', e.message) }
}
setTimeout(() => { backup(); setInterval(backup, 24 * 3600e3) }, 60e3)
// تنظيف جلسات الضيوف القديمة جدًا (سنة بلا نشاط)
setInterval(() => { try { db.prepare("DELETE FROM sessions WHERE role = 'user' AND seen < ?").run(Date.now() - 365 * 864e5) } catch {} }, 6 * 3600e3)
process.on('SIGTERM', () => { try { db.close() } catch {} process.exit(0) })
