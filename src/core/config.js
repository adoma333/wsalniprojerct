// إعدادات عامة للهوية والخدمات. مفاتيح Firebase تأتي من أسرار GitHub وقت البناء.
export const BRAND = {
  name: 'وصلني',
  nameEn: 'Wasalni',
  orange: '#E8650A',
  maroon: '#7B0E13',
  currency: 'ل.د',
  currencyEn: 'LYD',
  adminEmail: 'contwais@gmail.com',
  country: 'ly',
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

export const SITE_URL = import.meta.env.VITE_SITE_URL || ''

export const CITIES = [
  { id: 'tripoli', ar: 'طرابلس', en: 'Tripoli', center: [13.1913, 32.8872] },
  { id: 'benghazi', ar: 'بنغازي', en: 'Benghazi', center: [20.0868, 32.1167] },
  { id: 'misrata', ar: 'مصراتة', en: 'Misrata', center: [15.0925, 32.3754] },
  { id: 'sabha', ar: 'سبها', en: 'Sabha', center: [14.4283, 27.0377] },
  { id: 'zawiya', ar: 'الزاوية', en: 'Zawiya', center: [12.7278, 32.7571] },
  { id: 'bayda', ar: 'البيضاء', en: 'Bayda', center: [21.7551, 32.7627] },
  { id: 'tobruk', ar: 'طبرق', en: 'Tobruk', center: [23.9764, 32.0836] },
  { id: 'sirte', ar: 'سرت', en: 'Sirte', center: [16.5887, 31.2089] },
]

export const DEFAULT_SETTINGS = {
  pricing: {
    classes: [
      { id: 'eco', ar: 'اقتصادي', en: 'Economy', desc: 'رحلات يومية بسعر أقل', descEn: 'Everyday rides', base: 3, perKm: 1.1, perMin: 0.2, min: 5, seats: 4, icon: 'eco' },
      { id: 'comfort', ar: 'مريح', en: 'Comfort', desc: 'سيارات أحدث ومساحة أكبر', descEn: 'Newer cars, more room', base: 4, perKm: 1.4, perMin: 0.25, min: 7, seats: 4, icon: 'comfort' },
      { id: 'family', ar: 'عائلي', en: 'Family', desc: 'حتى 7 ركاب', descEn: 'Up to 7 riders', base: 5, perKm: 1.7, perMin: 0.3, min: 9, seats: 7, icon: 'family' },
      { id: 'vip', ar: 'VIP', en: 'VIP', desc: 'فخامة وخدمة مميزة', descEn: 'Premium service', base: 8, perKm: 2.4, perMin: 0.4, min: 15, seats: 4, icon: 'vip' },
      { id: 'moto', ar: 'توصيل', en: 'Delivery', desc: 'طرود ومشتريات بسرعة', descEn: 'Parcels & errands', base: 2, perKm: 0.8, perMin: 0.1, min: 4, seats: 0, icon: 'moto' },
    ],
    nightMult: 1.2, // 11 مساءً – 6 صباحًا
    peakMult: 1.15, // ذروة الصباح والمساء
    commission: 12, // نسبة التطبيق %
    waitPerMin: 0.25,
    cancelFee: 2,
    roundTo: 0.5,
  },
  rewards: {
    perReel: 5,
    watchSeconds: 15,
    dailyLimit: 20,
    builtinReels: true,
    referralBonus: 10,
  },
  fleetSimulation: true,
  autoApproveDrivers: true,
  support: { phone: '+218910000000', whatsapp: '218910000000', email: 'contwais@gmail.com' },
  announcement: '',
}
