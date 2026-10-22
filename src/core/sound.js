// أصوات الإشعارات: تُولَّد بالـ Web Audio (بلا ملفات) — نغمة لكل نوع إشعار.
// المتصفح يمنع الصوت قبل أول لمسة، فنفتح السياق الصوتي عند أول تفاعل.
let ctx = null
const getCtx = () => {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { ctx = null } }
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
const unlock = () => { getCtx(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock) }
addEventListener('pointerdown', unlock)
addEventListener('keydown', unlock)

export const soundOn = () => { try { return localStorage.getItem('w_sound') !== '0' } catch { return true } }
export const setSound = (on) => { try { localStorage.setItem('w_sound', on ? '1' : '0') } catch {} if (on) play('success') }

// نغمة: [تردد، بداية (ث)، مدة (ث)، شكل الموجة، شدة]
function tone(c, f, at, dur, type = 'sine', vol = 0.22) {
  const o = c.createOscillator(), g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, c.currentTime + at)
  g.gain.setValueAtTime(0.0001, c.currentTime + at)
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05)
}
const SOUNDS = {
  // نجاح: صعود مرح
  success: (c) => { tone(c, 784, 0, 0.18); tone(c, 1047, 0.1, 0.22); tone(c, 1319, 0.2, 0.3) },
  // خطأ: نغمتين نازلتين
  error: (c) => { tone(c, 440, 0, 0.18, 'triangle', 0.25); tone(c, 330, 0.16, 0.28, 'triangle', 0.25) },
  // معلومة عادية: نقرة ناعمة
  info: (c) => { tone(c, 988, 0, 0.12, 'sine', 0.16); tone(c, 1319, 0.08, 0.16, 'sine', 0.12) },
  // حالة الكورسة (وصل الشيفور…): جرس واضح
  brand: (c) => { [659, 880, 1109, 1319].forEach((f, i) => tone(c, f, i * 0.12, 0.4, 'sine', 0.22)) },
  // طلب جديد للسائق: رنّة قوية تتكرر
  request: (c) => { for (let r = 0; r < 3; r++) [880, 1175, 1568].forEach((f, i) => tone(c, f, r * 0.7 + i * 0.13, 0.35, 'square', 0.12)) },
  // رسالة دردشة
  message: (c) => { tone(c, 1568, 0, 0.09, 'sine', 0.18); tone(c, 2093, 0.09, 0.14, 'sine', 0.16) },
  // دراهم/نقاط: صوت قطعة نقدية
  coin: (c) => { tone(c, 1976, 0, 0.08, 'square', 0.08); tone(c, 2637, 0.07, 0.35, 'square', 0.08) },
  // إشعار من الإدارة
  notify: (c) => { tone(c, 1047, 0, 0.22, 'triangle', 0.2); tone(c, 1568, 0.14, 0.32, 'triangle', 0.18) },
}
let last = { k: '', t: 0 }
export function play(kind = 'info') {
  if (!soundOn()) return
  // نتفادى تكرار نفس الصوت في نفس اللحظة
  if (last.k === kind && Date.now() - last.t < 250) return
  last = { k: kind, t: Date.now() }
  const c = getCtx()
  if (!c) return
  try { (SOUNDS[kind] || SOUNDS.info)(c) } catch {}
  try { navigator.vibrate?.(kind === 'request' ? [200, 100, 200, 100, 300] : kind === 'error' ? [60, 40, 60] : 30) } catch {}
}
// نوع الصوت حسب نوع الإشعار المنبثق
export const soundFor = (type) => ({ success: 'success', error: 'error', brand: 'brand' }[type] || 'info')
