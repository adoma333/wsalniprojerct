// وضع العرض: قاعدة بيانات داخل المتصفح بنفس واجهة Firestore المبسطة.
// كل مستند مفتاح مستقل في localStorage، والتغييرات تُبث بين التبويبات (زبون/سائق/لوحة) عبر BroadcastChannel.
const P = 'wdb:'
const INC = '__inc'
const UNION = '__union'
const docW = new Map() // path -> Set(cb)
const colW = new Map() // colPath -> Set({q, cb})
let bc = null
try { bc = new BroadcastChannel('wasalni-db') } catch {}

const read = (path) => {
  try { const s = localStorage.getItem(P + path); return s ? JSON.parse(s) : null } catch { return null }
}
const write = (path, v) => {
  try {
    if (v === null) localStorage.removeItem(P + path)
    else localStorage.setItem(P + path, JSON.stringify(v))
  } catch (e) {
    console.warn('storage full', e)
    throw new Error('مساحة التخزين ممتلئة')
  }
}
const parent = (path) => path.split('/').slice(0, -1).join('/')
const idOf = (path) => path.split('/').pop()

function resolve(prev, patch) {
  const out = { ...(prev || {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && v[INC] !== undefined) out[k] = (Number(out[k]) || 0) + v[INC]
    else if (v && typeof v === 'object' && v[UNION] !== undefined) out[k] = [...new Set([...(out[k] || []), ...v[UNION]])]
    else if (v === undefined) delete out[k]
    else out[k] = v
  }
  return out
}
function deepMerge(prev, patch) {
  const out = { ...(prev || {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v[INC] === undefined && v[UNION] === undefined && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], v)
    else Object.assign(out, resolve(out, { [k]: v }))
  }
  return out
}

function emit(path, remote = false) {
  const d = docW.get(path)
  if (d) { const v = get_(path); d.forEach((cb) => cb(v)) }
  const c = colW.get(parent(path))
  if (c) c.forEach((w) => w.cb(query_(parent(path), w.q)))
  if (!remote && bc) bc.postMessage(path)
}
if (bc) bc.onmessage = (e) => emit(e.data, true)
window.addEventListener('storage', (e) => { if (e.key?.startsWith(P)) emit(e.key.slice(P.length), true) })

const get_ = (path) => { const v = read(path); return v ? { id: idOf(path), ...v } : null }

function match(doc, [f, op, val]) {
  const x = f.split('.').reduce((o, k) => (o == null ? o : o[k]), doc)
  switch (op) {
    case '==': return x === val
    case '!=': return x !== val
    case '>': return x > val
    case '>=': return x >= val
    case '<': return x < val
    case '<=': return x <= val
    case 'in': return val.includes(x)
    case 'array-contains': return Array.isArray(x) && x.includes(val)
    default: return true
  }
}
function query_(col, q = {}) {
  const depth = col.split('/').length + 1
  let rows = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(P + col + '/')) continue
    const path = k.slice(P.length)
    if (path.split('/').length !== depth) continue
    const d = get_(path)
    if (d) rows.push(d)
  }
  for (const w of q.where || []) rows = rows.filter((d) => match(d, w))
  if (q.orderBy) {
    const [f, dir = 'asc'] = q.orderBy
    rows.sort((a, b) => ((a[f] ?? 0) > (b[f] ?? 0) ? 1 : -1) * (dir === 'desc' ? -1 : 1))
  }
  if (q.limit) rows = rows.slice(0, q.limit)
  return rows
}

const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const store = {
  mode: 'local',
  inc: (n) => ({ [INC]: n }),
  union: (...v) => ({ [UNION]: v }),
  async get(path) { return get_(path) },
  async set(path, data, merge = false) {
    write(path, merge ? deepMerge(read(path), data) : resolve({}, data)); emit(path)
  },
  async update(path, patch) {
    const prev = read(path)
    if (!prev) throw new Error('not-found: ' + path)
    write(path, resolve(prev, patch)); emit(path)
  },
  async add(col, data) { const id = rid(); await this.set(`${col}/${id}`, data); return id },
  async remove(path) { write(path, null); emit(path) },
  async list(col, q) { return query_(col, q) },
  watch(path, cb) {
    if (!docW.has(path)) docW.set(path, new Set())
    docW.get(path).add(cb); cb(get_(path))
    return () => docW.get(path)?.delete(cb)
  },
  watchList(col, q, cb) {
    const w = { q, cb }
    if (!colW.has(col)) colW.set(col, new Set())
    colW.get(col).add(w); cb(query_(col, q))
    return () => colW.get(col)?.delete(w)
  },
  async tx(fn) {
    return fn({ get: (p) => get_(p), set: (p, d, m) => store.set(p, d, m), update: (p, d) => store.update(p, d) })
  },
}

// ===== المصادقة المحلية =====
const sha = async (s) => {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('wasalni::' + s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
const authW = new Set()
export const auth = {
  async init() {
    let uid = localStorage.getItem('w_uid')
    if (!uid) { uid = 'u' + rid(); localStorage.setItem('w_uid', uid) }
    return uid
  },
  uid: () => localStorage.getItem('w_uid'),
  async reset() { localStorage.removeItem('w_uid'); return this.init() },
  async adminStatus() {
    return { initialized: !!localStorage.getItem('w_admin_hash'), signedIn: localStorage.getItem('w_admin_session') === localStorage.getItem('w_admin_hash') && !!localStorage.getItem('w_admin_hash') }
  },
  async adminSetup(email, pw) {
    if (localStorage.getItem('w_admin_hash')) throw new Error('كلمة السر محددة مسبقًا')
    const h = await sha(email.toLowerCase() + ':' + pw)
    localStorage.setItem('w_admin_hash', h); localStorage.setItem('w_admin_session', h)
    authW.forEach((f) => f(true))
  },
  async adminLogin(email, pw) {
    const h = await sha(email.toLowerCase() + ':' + pw)
    if (h !== localStorage.getItem('w_admin_hash')) throw new Error('البريد أو كلمة السر غير صحيحة')
    localStorage.setItem('w_admin_session', h); authW.forEach((f) => f(true))
  },
  async adminChangePassword(email, oldPw, pw) {
    await this.adminLogin(email, oldPw)
    const h = await sha(email.toLowerCase() + ':' + pw)
    localStorage.setItem('w_admin_hash', h); localStorage.setItem('w_admin_session', h)
  },
  async adminLogout() { localStorage.removeItem('w_admin_session'); authW.forEach((f) => f(false)) },
}
