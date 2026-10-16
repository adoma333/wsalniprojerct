import React, { createContext, useContext, useEffect, useState } from 'react'
import { initStore, MODE } from '@/core/store.js'
import { applyDocLang, applyTheme, forceHttps } from '@/core/util.js'
import { DEFAULT_SETTINGS } from '@/core/config.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// تهيئة مشتركة: اللغة، السمة، الحالة، الاتصال بقاعدة البيانات والهوية
export function boot() {
  forceHttps()
  applyDocLang()
  applyTheme()
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); window.dispatchEvent(new Event('w-theme')) })
  import('@capacitor/core').then(async ({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return
    document.documentElement.classList.add('native')
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    StatusBar.setStyle({ style: document.documentElement.dataset.theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {})
    const { SplashScreen } = await import('@capacitor/splash-screen')
    SplashScreen.hide().catch(() => {})
  }).catch(() => {})
}

export function AppProvider({ value, children }) { return <Ctx.Provider value={value}>{children}</Ctx.Provider> }

export function useBoot(kind) {
  const [st, setSt] = useState({ ready: false, uid: null, settings: DEFAULT_SETTINGS, error: null, mode: MODE })
  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      try {
        await initStore()
        const { auth } = await import('@/core/store.js')
        const { watchSettings } = await import('@/core/api.js')
        const uid = kind === 'admin' ? null : await auth.init()
        unsub = watchSettings((settings) => setSt((s) => ({ ...s, settings })))
        await new Promise((r) => setTimeout(r, 900))
        setSt((s) => ({ ...s, uid, ready: true }))
      } catch (e) {
        console.error(e)
        setSt((s) => ({ ...s, ready: true, error: e.message || String(e) }))
      }
    })()
    return () => unsub()
  }, [])
  return [st, setSt]
}
