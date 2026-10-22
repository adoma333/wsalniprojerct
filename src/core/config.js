// إعدادات عامة للهوية والخدمات. مفاتيح Firebase تأتي من أسرار GitHub وقت البناء.
export const BRAND = {
  name: 'وصلني',
  nameEn: 'Wasalni',
  orange: '#E8650A',
  maroon: '#7B0E13',
  currency: 'دج',
  currencyEn: 'DA',
  adminEmail: 'contwais@gmail.com',
  country: 'dz',
  locale: 'ar-DZ',
  phoneCode: '+213',
  flag: '🇩🇿',
  police: '17',
  civil: '14',
}

export const FIREBASE = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// بدون مفاتيح Firebase يعمل كل شيء بوضع العرض المحلي (التخزين داخل المتصفح)
export const HAS_FIREBASE = !!(FIREBASE.apiKey && FIREBASE.projectId)
export const API_URL = import.meta.env.VITE_API_URL || ''
export const HAS_SERVER = !!API_URL

export const SITE_URL = import.meta.env.VITE_SITE_URL || ''

export const CITIES = [
  { id: 'sba', ar: 'سيدي بلعباس', en: 'Sidi Bel Abbès', center: [-0.6309, 35.1899] },
  { id: 'alger', ar: 'الجزائر العاصمة', en: 'Algiers', center: [3.0588, 36.7538] },
  { id: 'oran', ar: 'وهران', en: 'Oran', center: [-0.6331, 35.6971] },
  { id: 'constantine', ar: 'قسنطينة', en: 'Constantine', center: [6.6147, 36.365] },
  { id: 'annaba', ar: 'عنابة', en: 'Annaba', center: [7.7667, 36.9] },
  { id: 'setif', ar: 'سطيف', en: 'Sétif', center: [5.4137, 36.1898] },
  { id: 'blida', ar: 'البليدة', en: 'Blida', center: [2.8289, 36.4703] },
  { id: 'tlemcen', ar: 'تلمسان', en: 'Tlemcen', center: [-1.315, 34.8783] },
  { id: 'batna', ar: 'باتنة', en: 'Batna', center: [6.1744, 35.5559] },
  { id: 'bejaia', ar: 'بجاية', en: 'Béjaïa', center: [5.0567, 36.7509] },
  { id: 'mostaganem', ar: 'مستغانم', en: 'Mostaganem', center: [0.0892, 35.9311] },
  { id: 'tiziouzou', ar: 'تيزي وزو', en: 'Tizi Ouzou', center: [4.0497, 36.7169] },
]

export const DEFAULT_SETTINGS = {
  pricing: {
    classes: [
      { id: 'eco', ar: 'اقتصادي', en: 'Economy', desc: 'كورسات يومية بسومة رخيصة', descEn: 'Everyday rides', base: 100, perKm: 35, perMin: 8, min: 200, seats: 4, icon: 'eco' },
      { id: 'comfort', ar: 'كونفور', en: 'Comfort', desc: 'طوموبيلات جديدة وبلاصة أكثر', descEn: 'Newer cars, more room', base: 150, perKm: 45, perMin: 10, min: 300, seats: 4, icon: 'comfort' },
      { id: 'family', ar: 'فاميلي', en: 'Family', desc: 'حتى 7 ركاب', descEn: 'Up to 7 riders', base: 200, perKm: 55, perMin: 12, min: 400, seats: 7, icon: 'family' },
      { id: 'vip', ar: 'VIP', en: 'VIP', desc: 'فخامة وخدمة ممتازة', descEn: 'Premium service', base: 300, perKm: 80, perMin: 15, min: 600, seats: 4, icon: 'vip' },
      { id: 'moto', ar: 'توصيل', en: 'Delivery', desc: 'كولي ومشتريات بالزربة', descEn: 'Parcels & errands', base: 80, perKm: 25, perMin: 5, min: 150, seats: 0, icon: 'moto' },
    ],
    nightMult: 1.2, // 11 مساءً – 6 صباحًا
    peakMult: 1.15, // ذروة الصباح والمساء
    commission: 12, // نسبة التطبيق %
    waitPerMin: 10,
    cancelFee: 100,
    roundTo: 10,
  },
  // النقاط: المستخدم يرى نقاطًا فقط؛ قيمتها بالدينار يحددها الأدمن ويمكن تعديلها دون أن يلاحظ المستخدم
  rewards: {
    pointsPerReel: 100,
    pointValue: 5, // كم دينار تساوي كل 100 نقطة
    watchSeconds: 15,
    dailyLimit: 60,
    builtinReels: true,
    autoConvert: false, // تحويل تلقائي للبورتفاي عند بلوغ الحد
    autoConvertAt: 2000,
    minConvert: 500,
    referralBonus: 1000,
  },
  // خصم الطلبة بعد التحقق من بطاقة الطالب
  students: { enabled: true, discount: 30, maxDiscount: 300, autoVerify: true },
  // التحقق من الهوية والوثائق
  kyc: { autoVerify: true },
  // طرق الشحن
  payments: { demo: true, edahabia: true, cib: true, baridimob: true, voucher: true, rip: '00799999 0000000000 00', ripName: 'SARL WASALNI', presets: [500, 1000, 2000, 5000], min: 200, max: 50000 },
  // الميزات (تشغيل/إيقاف من الأدمن)
  driverWallet: { minBalance: -1000, withdrawMin: 1000, topup: true, withdraw: true },
  quests: { enabled: true, list: [{ trips: 5, bonus: 200 }, { trips: 10, bonus: 500 }, { trips: 20, bonus: 1200 }] },
  home: { quick: ['ride', 'delivery', 'bus', 'reels'], banner: { on: false, title: '', sub: '', image: '', link: '' } },
  bus: { enabled: true, demo: true, simulate: true },
  content: { terms: '', privacy: '', about: '' },
  features: { bus: true, reels: true, delivery: true, schedule: true, offerPrice: true, womenDrivers: true, tripPin: true, rideForOther: true, students: true },
  // إعدادات كل ولاية: تفعيل، معامل سعر، زيادة مؤقتة
  zones: {},
  extraCities: [],
  maintenance: { on: false, message: 'التطبيق في صيانة، نرجعو قريب 🙏' },
  minVersion: '1.0',
  fleetSimulation: true,
  autoApproveDrivers: true,
  support: { phone: '+213550000000', whatsapp: '213550000000', email: 'contwais@gmail.com' },
  announcement: '',
}

// تحويل النقاط ↔ الدينار
export const pointsToDa = (pts, rw) => Math.floor(((pts || 0) * (rw?.pointValue ?? 5)) / 100 * 100) / 100
export const daToPoints = (da, rw) => Math.ceil(((da || 0) * 100) / (rw?.pointValue || 5))
