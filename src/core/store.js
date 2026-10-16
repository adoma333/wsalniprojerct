// يختار طبقة البيانات: Firebase إن وُجدت مفاتيحه، وإلا وضع العرض المحلي.
import { HAS_FIREBASE } from './config.js'

export let store = null
export let auth = null
export const MODE = HAS_FIREBASE ? 'firebase' : 'local'

export async function initStore() {
  if (store) return
  const m = HAS_FIREBASE ? await import('./store-firebase.js') : await import('./store-local.js')
  store = m.store
  auth = m.auth
}
