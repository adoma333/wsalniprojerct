// 100 ريل إعلاني مدمج (نفس الصورة مكررة كمعاينة) + ريلز يضيفها الأدمن من اللوحة.
import { seeded } from './util.js'

const ADS = [
  { adv: 'بيتزيريا الدزاير', handle: 'dzair.pizza', cap: 'بيتزا فاميلي تشبّع 5 أشخاص بسومة ما تتصدقش 🍕 اطلبها دروك والتوصيل مع وصلني!', cta: 'اطلب دروك', tint: '#E8650A' },
  { adv: 'فارماسي الشفاء', handle: 'chifa.pharma', cap: 'محلولين 24/24 💊 تخفيض 15٪ على كامل الفيتامينات هاد السمانة.', cta: 'اعرف أكثر', tint: '#12B76A' },
  { adv: 'معرض النخبة للطوموبيلات', handle: 'nokhba.auto', cap: 'طوموبيلتك الجديدة بالتقسيط المريح 🚗 بلا دفعة أولى لأول 50 زبون.', cta: 'احجز تجربة', tint: '#7B0E13' },
  { adv: 'أكاديمية المستقبل', handle: 'future.academy.dz', cap: 'كورسات برمجة وديزاين للشباب 💻 أول شهر بلاش!', cta: 'سجّل دروك', tint: '#2E90FA' },
  { adv: 'حلويات الأصالة', handle: 'assala.sweets', cap: 'مقروط، بقلاوة وقريوش طازجين كل يوم 🍯 ذوق تاع الدار.', cta: 'شوف المونيو', tint: '#F5A524' },
  { adv: 'صالة القمة الرياضية', handle: 'qemma.gym', cap: 'أبونمون 3 شهور + شهر كادو 💪 ابدا التحدي اليوم.', cta: 'اشترك', tint: '#E5484D' },
  { adv: 'تك ستور', handle: 'tech.store.dz', cap: 'آخر التيليفونات والأكسسوارات بالضمان عام 📱 توصيل في نفس النهار.', cta: 'تسوّق', tint: '#6E56CF' },
  { adv: 'قهوة الحومة', handle: 'houma.cafe', cap: 'قهوتك كيما تحبها ☕ الكاس الثاني بنص السومة.', cta: 'زورونا', tint: '#B4480A' },
  { adv: 'وصلني', handle: 'wasalni.dz', cap: 'شوف الريلز واجمع النقاط واركب بلاش 🎁 كل ريل كامل = 5 دينار.', cta: 'اطلب كورسة', tint: '#E8650A' },
  { adv: 'لافاج البريق', handle: 'bariq.wash', cap: 'نغسلولك الطوموبيل من الداخل والبرّا وانت في دارك ✨', cta: 'احجز موعد', tint: '#0EA5E9' },
]
const MUSIC = ['صوت أصلي', 'راي', 'شعبي', 'Chill Beats', 'Lofi Drive']
const NAMES = ['محمد', 'أمينة', 'ياسين', 'سارة', 'رياض', 'إيمان', 'وليد', 'خديجة', 'سفيان', 'نسرين', 'كريم', 'ليندة', 'بلال', 'ريم', 'هشام']
const COMMENTS = ['عرض شباب 👌', 'جربتو والله يستاهل', 'وين راكم بالضبط؟', 'وصلني أحسن تطبيق 🔥', 'جمعت 200 دينار من الريلز 😍', 'وقتاش يكمل العرض؟', 'يعطيكم الصحة', 'ركبت بلاش اليوم 🚗', 'السومة مليحة', 'ننصح بيه بزاف', '❤️❤️❤️', 'كاين توصيل لوهران؟']

export function builtinReels(rw) {
  const out = []
  for (let i = 0; i < 100; i++) {
    const a = ADS[i % ADS.length]
    const r = seeded(i + 11)
    out.push({
      id: `b${i + 1}`,
      builtin: true,
      advertiser: a.adv,
      handle: a.handle,
      caption: a.cap,
      cta: a.cta,
      tint: a.tint,
      image: 'reels/ad.jpg',
      music: MUSIC[i % MUSIC.length],
      duration: rw?.watchSeconds || 15,
      points: rw?.pointsPerReel ?? 100,
      views: Math.floor(2000 + r() * 90000),
      order: i,
      active: true,
    })
  }
  return out
}

export function fakeComments(reelId, n = 6) {
  const r = seeded([...reelId].reduce((s, c) => s + c.charCodeAt(0), 0))
  return Array.from({ length: n }, (_, i) => ({
    id: 'f' + i,
    name: NAMES[Math.floor(r() * NAMES.length)],
    text: COMMENTS[Math.floor(r() * COMMENTS.length)],
    at: Date.now() - Math.floor(r() * 5 * 86400000),
    likes: Math.floor(r() * 120),
    fake: true,
  }))
}
