// الوضع الحقيقي: Firestore + Firebase Auth بنفس واجهة store-local.
import { initializeApp } from 'firebase/app'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, getDoc, getDocs, setDoc,
  updateDoc, addDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, runTransaction, increment, arrayUnion, deleteField,
} from 'firebase/firestore'
import {
  getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth'
import { FIREBASE } from './config.js'

const app = initializeApp(FIREBASE)
let db
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), ignoreUndefinedProperties: true })
} catch {
  db = initializeFirestore(app, { ignoreUndefinedProperties: true })
}
const fa = getAuth(app)

const snap = (s) => (s.exists() ? { id: s.id, ...s.data() } : null)
const clean = (o) => {
  const out = {}
  for (const [k, v] of Object.entries(o)) out[k] = v === undefined ? deleteField() : v
  return out
}
function buildQ(col, q = {}) {
  const parts = []
  for (const [f, op, v] of q.where || []) parts.push(where(f, op, v))
  if (q.orderBy) parts.push(orderBy(q.orderBy[0], q.orderBy[1] || 'asc'))
  if (q.limit) parts.push(limit(q.limit))
  return query(collection(db, col), ...parts)
}
const onErr = (e) => console.warn('[firestore]', e?.code || e)

export const store = {
  mode: 'firebase',
  inc: (n) => increment(n),
  union: (...v) => arrayUnion(...v),
  async get(path) { return snap(await getDoc(doc(db, path))) },
  async set(path, data, merge = false) { await setDoc(doc(db, path), data, { merge }) },
  async update(path, patch) { await updateDoc(doc(db, path), clean(patch)) },
  async add(col, data) { return (await addDoc(collection(db, col), data)).id },
  async remove(path) { await deleteDoc(doc(db, path)) },
  async list(col, q) { return (await getDocs(buildQ(col, q))).docs.map(snap) },
  watch(path, cb) { return onSnapshot(doc(db, path), (s) => cb(snap(s)), onErr) },
  watchList(col, q, cb) { return onSnapshot(buildQ(col, q), (s) => cb(s.docs.map(snap)), onErr) },
  async tx(fn) {
    return runTransaction(db, (t) => fn({
      get: async (p) => snap(await t.get(doc(db, p))),
      set: (p, d, m) => t.set(doc(db, p), d, { merge: !!m }),
      update: (p, d) => t.update(doc(db, p), clean(d)),
    }))
  },
}

const ready = new Promise((res) => { const u = onAuthStateChanged(fa, (x) => { u(); res(x) }) })

const msg = (e) => {
  const c = e?.code || ''
  if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) return 'البريد أو كلمة السر غير صحيحة'
  if (c.includes('too-many-requests')) return 'محاولات كثيرة، انتظر قليلًا'
  if (c.includes('weak-password')) return 'كلمة السر ضعيفة (6 أحرف على الأقل)'
  if (c.includes('network')) return 'تحقق من الاتصال بالإنترنت'
  if (c.includes('operation-not-allowed') || c.includes('admin-restricted')) return 'فعّل Email/Password و Anonymous في Firebase Authentication'
  return e?.message || 'حدث خطأ'
}

export const auth = {
  async init() {
    const u = await ready
    if (u) return u.uid
    try { return (await signInAnonymously(fa)).user.uid } catch (e) { throw new Error(msg(e)) }
  },
  uid: () => fa.currentUser?.uid,
  async reset() { await signOut(fa); return (await signInAnonymously(fa)).user.uid },
  async adminStatus() {
    const u = await ready
    const meta = await store.get('meta/admin').catch(() => null)
    return { initialized: !!meta?.initialized, signedIn: !!u && !u.isAnonymous && u.email?.toLowerCase() === FIREBASE_ADMIN() }
  },
  async adminSetup(email, pw) {
    try {
      await createUserWithEmailAndPassword(fa, email, pw)
    } catch (e) {
      if (String(e?.code).includes('email-already-in-use')) throw new Error('الحساب موجود مسبقًا، سجّل الدخول بكلمة السر')
      throw new Error(msg(e))
    }
    await store.set('meta/admin', { initialized: true, email, at: Date.now() })
  },
  async adminLogin(email, pw) {
    try {
      await signInWithEmailAndPassword(fa, email, pw)
      await store.set('meta/admin', { initialized: true, email }, true).catch(() => {})
    } catch (e) { throw new Error(msg(e)) }
  },
  async adminChangePassword(email, oldPw, pw) {
    try {
      await reauthenticateWithCredential(fa.currentUser, EmailAuthProvider.credential(email, oldPw))
      await updatePassword(fa.currentUser, pw)
    } catch (e) { throw new Error(msg(e)) }
  },
  async adminLogout() { await signOut(fa) },
}
function FIREBASE_ADMIN() { return 'contwais@gmail.com' }
