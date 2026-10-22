// يختار طبقة البيانات: خادم وصلني (SQLite) إن وُجد رابطه، ثم Firebase، وإلا وضع العرض المحلي.
import { HAS_FIREBASE, HAS_SERVER } from './config.js'

export let store = null
export let auth = null
export const MODE = HAS_SERVER ? 'server' : HAS_FIREBASE ? 'firebase' : 'local'

export async function initStore(kind) {
  if (store) return
  const m = MODE === 'server' ? await import('./store-remote.js') : MODE === 'firebase' ? await import('./store-firebase.js') : await import('./store-local.js')
  m.setKind?.(kind)
  store = m.store
  auth = m.auth
}
