// 100 ريل إعلاني مدمج (نفس الصورة مكررة كمعاينة) + ريلز يضيفها الأدمن من اللوحة.
import { seeded } from './util.js'

const ADS = [
  { adv: 'مطعم الريف', handle: 'alreef.food', cap: 'وجبة عائلية تكفي 5 أشخاص بسعر خيالي 🍗 اطلبها الآن والتوصيل مع وصلني!', cta: 'اطلب الآن', tint: '#E8650A' },
  { adv: 'صيدلية الشفاء', handle: 'alshifa.pharma', cap: 'مفتوحين 24 ساعة 💊 خصم 15٪ على كل المكملات هذا الأسبوع.', cta: 'اعرف أكثر', tint: '#12B76A' },
  { adv: 'معرض النخبة للسيارات', handle: 'nokhba.cars', cap: 'سيارتك الجديدة بالتقسيط المريح 🚗 بدون دفعة أولى لأول 50 عميل.', cta: 'احجز تجربة', tint: '#7B0E13' },
  { adv: 'أكاديمية المستقبل', handle: 'future.academy', cap: 'دورات برمجة وتصميم للشباب 💻 أول شهر مجاني!', cta: 'سجّل الآن', tint: '#2E90FA' },
  { adv: 'حلويات الأصيل', handle: 'alaseel.sweets', cap: 'كعك وغريبة وبقلاوة طازجة كل يوم 🍰 جرّب طعم البيت.', cta: 'شاهد القائمة', tint: '#F5A524' },
  { adv: 'نادي القمة الرياضي', handle: 'alqemma.gym', cap: 'اشتراك 3 شهور + شهر هدية 💪 ابدأ التحدي اليوم.', cta: 'اشترك', tint: '#E5484D' },
  { adv: 'متجر تقنية', handle: 'taqnia.store', cap: 'أحدث الهواتف والإكسسوارات بضمان سنة 📱 توصيل في نفس اليوم.', cta: 'تسوّق', tint: '#6E56CF' },
  { adv: 'مقهى ليالي', handle: 'layali.cafe', cap: 'قهوتك المفضلة بطريقتنا ☕ المشروب الثاني بنصف السعر.', cta: 'زورونا', tint: '#B4480A' },
  { adv: 'وصلني', handle: 'wasalni.app', cap: 'شاهد الريلز واجمع النقاط واركب مجانًا 🎁 كل مشاهدة كاملة = 5 دينار.', cta: 'اطلب رحلة', tint: '#E8650A' },
  { adv: 'مغسلة اللمعة', handle: 'lamaa.wash', cap: 'غسيل سيارتك من الداخل والخارج وأنت في البيت ✨', cta: 'احجز موعد', tint: '#0EA5E9' },
]
const MUSIC = ['صوت أصلي', 'إيقاع ليبي', 'Chill Beats', 'Summer Vibes', 'Lofi Drive']
const NAMES = ['أحمد', 'سارة', 'محمد', 'مريم', 'علي', 'هدى', 'خالد', 'فاطمة', 'يوسف', 'نور', 'عمر', 'ليلى', 'سالم', 'رنا', 'طارق']
const COMMENTS = ['عرض ممتاز 👌', 'جربته والله يستاهل', 'وين مكانكم بالضبط؟', 'وصلني أفضل تطبيق 🔥', 'جمعت 50 دينار من الريلز 😍', 'متى ينتهي العرض؟', 'شكرًا على المعلومة', 'ركبت مجانًا اليوم 🚗', 'السعر حلو', 'أنصح فيه بقوة', '❤️❤️❤️', 'هل يوجد توصيل لبنغازي؟']

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
      reward: rw?.perReel ?? 5,
      baseLikes: Math.floor(800 + r() * 24000),
      baseComments: Math.floor(20 + r() * 900),
      baseShares: Math.floor(10 + r() * 600),
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
