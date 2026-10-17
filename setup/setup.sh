#!/usr/bin/env bash
# =====================================================================
#  وصلني — أمر الإعداد الواحد (يُشغَّل على السيرفر مرة واحدة)
#  bash <(curl -fsSL https://raw.githubusercontent.com/adoma333/wsalniprojerct/HEAD/setup/setup.sh)
#
#  السيرفر لا يشغّل أي خدمة؛ هذا الأمر فقط:
#   1) يجلب معرّف المحادثة (Chat ID) لبوت تلجرام تلقائيًا
#   2) ينشئ/يجلب توكن surge.sh ويختار رابط الموقع ولوحة التحكم
#   3) ينشئ مفتاح توقيع دائم لملفات APK
#   4) (اختياري) يربط Firebase لتتصل كل الأجهزة ببعض
#   5) يحفظ كل شيء كأسرار في GitHub ويشغّل البناء — والنتيجة تصلك على تلجرام
#  إعادة تشغيله آمنة: يتذكر القيم السابقة ويسأل فقط عن الناقص.
# =====================================================================
set -uo pipefail

REPO="${WASALNI_REPO:-adoma333/wsalniprojerct}"
CONF_DIR=/etc/wasalni
CONF="$CONF_DIR/setup.env"
TOOLS=/opt/wasalni-tools
mkdir -p "$CONF_DIR" "$TOOLS" && chmod 700 "$CONF_DIR"
[ -f "$CONF" ] && . "$CONF"

O=$'\e[38;5;208m'; G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[1m'; D=$'\e[2m'; N=$'\e[0m'
say()  { echo -e "${O}▸${N} $*" >&2; }
ok()   { echo -e "${G}✓${N} $*" >&2; }
warn() { echo -e "${Y}⚠${N} $*" >&2; }
die()  { echo -e "${R}✗ $*${N}"; exit 1; }
ask()  { local v; read -rp "$(echo -e "${B}$1${N} ")" v </dev/tty; echo "$v"; }
asks() { local v; read -rsp "$(echo -e "${B}$1${N} ")" v </dev/tty; echo >&2; echo "$v"; }
save() { # save KEY VALUE
  touch "$CONF"; chmod 600 "$CONF"
  grep -v "^$1=" "$CONF" > "$CONF.tmp" 2>/dev/null || true
  printf '%s=%q\n' "$1" "$2" >> "$CONF.tmp" && mv "$CONF.tmp" "$CONF"
  printf -v "$1" '%s' "$2"
}

clear 2>/dev/null || true
cat <<EOF
${O}
   ██╗    ██╗ █████╗ ███████╗ █████╗ ██╗     ███╗   ██╗██╗
   ██║    ██║██╔══██╗██╔════╝██╔══██╗██║     ████╗  ██║██║
   ██║ █╗ ██║███████║███████╗███████║██║     ██╔██╗ ██║██║
   ██║███╗██║██╔══██║╚════██║██╔══██║██║     ██║╚██╗██║██║
   ╚███╔███╔╝██║  ██║███████║██║  ██║███████╗██║ ╚████║██║
    ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝${N}
   ${B}وصلني — إعداد البناء والنشر${N}   ${D}(${REPO})${N}

EOF

# ---------- الأدوات ----------
need() { command -v "$1" >/dev/null 2>&1; }
if ! need curl || ! need openssl || ! need tar; then
  say "تثبيت curl و openssl…"
  (need apt-get && apt-get update -qq && apt-get install -y -qq curl openssl tar ca-certificates >/dev/null) || (need yum && yum install -y -q curl openssl tar) || die "ثبّت curl و openssl يدويًا"
fi
ARCH=$(uname -m); case "$ARCH" in x86_64|amd64) A=amd64; NA=x64 ;; aarch64|arm64) A=arm64; NA=arm64 ;; *) die "معمارية غير مدعومة: $ARCH" ;; esac

GH="$TOOLS/gh"
if [ ! -x "$GH" ]; then
  say "تنزيل GitHub CLI…"
  V=$(curl -fsSL https://api.github.com/repos/cli/cli/releases/latest 2>/dev/null | grep -m1 '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/'); V=${V:-2.63.2}
  curl -fsSL "https://github.com/cli/cli/releases/download/v${V}/gh_${V}_linux_${A}.tar.gz" | tar xz -C /tmp && cp /tmp/gh_${V}_linux_${A}/bin/gh "$GH" && chmod +x "$GH" || die "تعذر تنزيل gh"
fi
ok "GitHub CLI جاهز"

ensure_node() {
  if need npx; then return; fi
  if [ ! -x "$TOOLS/node/bin/npx" ]; then
    say "تنزيل Node.js (مؤقت للأدوات فقط)…"
    curl -fsSL "https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-${NA}.tar.gz" | tar xz -C "$TOOLS" && mv "$TOOLS/node-v22.11.0-linux-${NA}" "$TOOLS/node" || die "تعذر تنزيل Node.js"
  fi
  export PATH="$TOOLS/node/bin:$PATH"
}

# ---------- 1) GitHub ----------
echo; echo -e "${B}【1/5】 GitHub${N}"
# التوكن يجب أن يصل للمستودع ويستطيع كتابة الأسرار (بدونها لا يُنشر الموقع ولا تصل ملفات تلجرام)
gh_ok() {
  GH_TOKEN="$1" "$GH" api "repos/$REPO" >/dev/null 2>&1 || { warn "التوكن لا يصل إلى $REPO"; return 1; }
  printf 'ok' | GH_TOKEN="$1" "$GH" secret set WASALNI_CHECK -R "$REPO" >/dev/null 2>&1 || { warn "التوكن لا يملك صلاحية Secrets: Read and write"; return 1; }
  GH_TOKEN="$1" "$GH" secret delete WASALNI_CHECK -R "$REPO" >/dev/null 2>&1 || true
}
if [ -z "${GH_TOKEN:-}" ] || ! gh_ok "$GH_TOKEN"; then
  echo -e "${D}أنشئ توكن من: https://github.com/settings/personal-access-tokens/new"
  echo -e "Repository access: Only select repositories ← ${REPO}"
  echo -e "Repository permissions: ${N}${B}Secrets = Read and write${N}${D} • Actions = Read and write • Contents = Read-only${N}"
  echo -e "${D}(أو توكن Classic بصلاحية repo + workflow)${N}"
  while :; do
    T=$(asks "الصق توكن GitHub:")
    gh_ok "$T" && break
  done
  save GH_TOKEN "$T"
fi
export GH_TOKEN
BRANCH=$("$GH" api "repos/$REPO" --jq .default_branch 2>/dev/null); BRANCH=${BRANCH:-main}
ok "متصل بـ $REPO (الفرع: $BRANCH)"
secret() { [ -z "$2" ] && return 0; printf '%s' "$2" | "$GH" secret set "$1" -R "$REPO" >/dev/null && ok "سرّ $1" || warn "تعذر حفظ $1 (تحقق من صلاحية Secrets في التوكن)"; }

# ---------- 2) تلجرام ----------
echo; echo -e "${B}【2/5】 بوت تلجرام${N}"
tg() { curl -fsS "https://api.telegram.org/bot$TG_TOKEN/$1" "${@:2}"; }
if [ -z "${TG_TOKEN:-}" ] || ! tg getMe >/dev/null 2>&1; then
  echo -e "${D}أنشئ بوتًا من @BotFather واحصل على التوكن${N}"
  while :; do
    TG_TOKEN=$(ask "توكن البوت:")
    tg getMe >/dev/null 2>&1 && break
    warn "التوكن غير صحيح"
  done
  save TG_TOKEN "$TG_TOKEN"
fi
BOT=$(tg getMe | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
ok "البوت: @$BOT"
if [ -z "${TG_CHAT:-}" ]; then
  tg deleteWebhook >/dev/null 2>&1 || true
  OFF=$(tg getUpdates | grep -o '"update_id":[0-9]*' | tail -1 | cut -d: -f2); OFF=$(( ${OFF:-0} + 1 ))
  echo -e "${O}➜ افتح https://t.me/$BOT واضغط Start أو أرسل أي رسالة${N}"
  echo -e "${D}  (لمجموعة/قناة: أضف البوت إليها كمشرف ثم أرسل رسالة هناك)${N}"
  for i in $(seq 1 90); do
    U=$(tg getUpdates -d offset=$OFF -d timeout=2 2>/dev/null || true)
    C=$(echo "$U" | grep -o '"chat":{"id":-\?[0-9]*' | tail -1 | grep -o '\-\?[0-9]*$')
    [ -n "$C" ] && break
    printf "\r${D}بانتظار رسالتك… %ss${N}" $((i*2))
  done; echo >&2
  [ -z "${C:-}" ] && C=$(ask "لم تصل رسالة. أدخل Chat ID يدويًا:")
  save TG_CHAT "$C"
fi
tg sendMessage -d chat_id="$TG_CHAT" --data-urlencode text="✅ تم ربط بوت وصلني بنجاح. ستصلك هنا روابط الموقع ولوحة التحكم وملفات APK بعد كل بناء." >/dev/null && ok "Chat ID: $TG_CHAT (أُرسلت رسالة تجريبية)" || warn "تعذر الإرسال إلى $TG_CHAT"

# ---------- 3) surge.sh ----------
echo; echo -e "${B}【3/5】 surge.sh (استضافة الموقع ولوحة التحكم)${N}"
if [ -z "${SURGE_TOKEN:-}" ]; then
  echo -e "${D}إن لم يكن لديك حساب سيُنشأ تلقائيًا بنفس البريد وكلمة السر${N}"
  SURGE_LOGIN=$(ask "بريد surge:")
  SP=$(asks "كلمة سر surge:")
  R=$(curl -fsS -X POST -u "$SURGE_LOGIN:$SP" https://surge.surge.sh/token 2>/dev/null || true)
  SURGE_TOKEN=$(echo "$R" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$SURGE_TOKEN" ]; then
    warn "سنسجّل عبر أداة surge الرسمية"
    ensure_node
    npx --yes surge@0.44.6 login </dev/tty || true
    SURGE_TOKEN=$(npx --yes surge@0.44.6 token 2>/dev/null | grep -oE '[a-f0-9]{32,}' | tail -1)
  fi
  [ -z "$SURGE_TOKEN" ] && die "تعذر الحصول على توكن surge"
  save SURGE_TOKEN "$SURGE_TOKEN"; save SURGE_LOGIN "$SURGE_LOGIN"
fi
ok "توكن surge جاهز"
if [ -z "${SURGE_DOMAIN:-}" ]; then
  SUG="wasalni-$(openssl rand -hex 3).surge.sh"
  D_=$(ask "رابط الموقع [Enter = $SUG]:"); D_=${D_:-$SUG}
  D_=$(echo "$D_" | tr '[:upper:]' '[:lower:]' | sed -e 's#^https\?://##' -e 's#/$##'); [[ "$D_" == *.* ]] || D_="$D_.surge.sh"
  save SURGE_DOMAIN "$D_"
fi
ok "الموقع: https://$SURGE_DOMAIN • لوحة التحكم: https://$SURGE_DOMAIN/admin/"

# ---------- 4) مفتاح توقيع APK ----------
echo; echo -e "${B}【4/5】 مفتاح توقيع تطبيقات أندرويد${N}"
KS="$CONF_DIR/wasalni-release.p12"
if [ ! -f "$KS" ]; then
  KS_PASS=$(openssl rand -hex 16)
  openssl req -x509 -newkey rsa:2048 -nodes -days 10000 -subj "/CN=Wasalni/O=Wasalni/C=LY" -keyout /tmp/w.key -out /tmp/w.crt >/dev/null 2>&1
  openssl pkcs12 -export -inkey /tmp/w.key -in /tmp/w.crt -name wasalni -out "$KS" -passout pass:"$KS_PASS" -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256 >/dev/null 2>&1 \
    || openssl pkcs12 -export -inkey /tmp/w.key -in /tmp/w.crt -name wasalni -out "$KS" -passout pass:"$KS_PASS"
  rm -f /tmp/w.key /tmp/w.crt; chmod 600 "$KS"
  save KS_PASS "$KS_PASS"
  curl -fsS "https://api.telegram.org/bot$TG_TOKEN/sendDocument" -F chat_id="$TG_CHAT" -F document=@"$KS" -F caption="🔐 نسخة احتياطية لمفتاح توقيع APK — كلمة السر: $KS_PASS (احتفظ بها، بدونها لا يمكن تحديث التطبيق المثبت)" >/dev/null 2>&1 || true
  ok "أُنشئ مفتاح دائم (نسخة احتياطية في $KS وعلى تلجرام)"
else ok "المفتاح موجود مسبقًا"; fi

# ---------- 5) Firebase (اختياري) ----------
echo; echo -e "${B}【5/5】 Firebase — قاعدة بيانات مباشرة تربط كل الأجهزة (اختياري)${N}"
echo -e "${D}بدونه: كل شيء يعمل بوضع العرض (البيانات داخل كل جهاز + أسطول محاكاة)."
echo -e "معه: الزبون والسائق ولوحة التحكم على أجهزة مختلفة يرون نفس البيانات لحظيًا.${N}"
if [ -z "${FB_API_KEY:-}" ]; then
  YN=$(ask "ربط Firebase الآن؟ [y/N]:")
  if [[ "$YN" =~ ^[yYنن] ]]; then
    cat <<EOF
${D}  1. https://console.firebase.google.com ← Add project (مجاني)
  2. Build ← Firestore Database ← Create database (production)
  3. Build ← Authentication ← Get started ← فعّل Email/Password و Anonymous
  4. ⚙ Project settings ← Your apps ← Web (</>) ← انسخ firebaseConfig كاملًا${N}
EOF
    echo -e "${B}الصق firebaseConfig ثم اضغط Enter مرتين:${N}"
    CFG=""; while IFS= read -r L </dev/tty; do [ -z "$L" ] && [ -n "$CFG" ] && break; CFG+="$L"$'\n'; done
    g() { echo "$CFG" | grep -o "$1[\"']\?[[:space:]]*:[[:space:]]*[\"'][^\"']*" | head -1 | sed -E "s/.*[\"']([^\"']*)$/\1/"; }
    FB_API_KEY=$(g apiKey); FB_PROJECT=$(g projectId)
    if [ -n "$FB_API_KEY" ] && [ -n "$FB_PROJECT" ]; then
      save FB_API_KEY "$FB_API_KEY"; save FB_PROJECT "$FB_PROJECT"
      save FB_AUTH_DOMAIN "$(g authDomain)"; save FB_BUCKET "$(g storageBucket)"; save FB_SENDER "$(g messagingSenderId)"; save FB_APP_ID "$(g appId)"
      ok "Firebase: $FB_PROJECT"
      YN2=$(ask "نشر قواعد الأمان تلقائيًا مع كل بناء؟ (يتطلب تسجيل دخول Google) [Y/n]:")
      if [[ ! "$YN2" =~ ^[nN]$ ]]; then
        ensure_node
        FT=$(npx --yes firebase-tools@13 login:ci --no-localhost </dev/tty | tee /dev/tty | grep -oE '1//[A-Za-z0-9_-]+' | tail -1)
        [ -n "$FT" ] && save FB_TOKEN "$FT" && ok "توكن Firebase محفوظ" || warn "تخطّي — انسخ firebase/firestore.rules يدويًا إلى Firestore ← Rules"
      fi
    else warn "تعذر قراءة الإعدادات، يمكنك إعادة تشغيل الأمر لاحقًا"; fi
  else say "تخطّي Firebase (يمكنك إعادة تشغيل الأمر لاحقًا لإضافته)"; fi
else ok "Firebase: $FB_PROJECT"; fi

# ---------- حفظ الأسرار وتشغيل البناء ----------
echo; say "حفظ الأسرار في GitHub…"
secret TELEGRAM_BOT_TOKEN "$TG_TOKEN"
secret TELEGRAM_CHAT_ID "$TG_CHAT"
secret SURGE_TOKEN "$SURGE_TOKEN"
secret SURGE_LOGIN "${SURGE_LOGIN:-}"
secret SURGE_DOMAIN "$SURGE_DOMAIN"
secret ANDROID_KEYSTORE_B64 "$(base64 -w0 "$KS" 2>/dev/null || base64 "$KS" | tr -d '\n')"
secret ANDROID_KEYSTORE_PASSWORD "$KS_PASS"
if [ -n "${FB_API_KEY:-}" ]; then
  secret FIREBASE_API_KEY "$FB_API_KEY"; secret FIREBASE_PROJECT_ID "$FB_PROJECT"; secret FIREBASE_AUTH_DOMAIN "${FB_AUTH_DOMAIN:-$FB_PROJECT.firebaseapp.com}"
  secret FIREBASE_STORAGE_BUCKET "${FB_BUCKET:-}"; secret FIREBASE_SENDER_ID "${FB_SENDER:-}"; secret FIREBASE_APP_ID "${FB_APP_ID:-}"
  [ -n "${FB_TOKEN:-}" ] && secret FIREBASE_TOKEN "$FB_TOKEN"
fi

HAVE=$("$GH" secret list -R "$REPO" 2>/dev/null)
for k in SURGE_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do echo "$HAVE" | grep -q "^$k" || die "لم يُحفظ $k في GitHub — تحقق من صلاحية Secrets في التوكن ثم أعد تشغيل الأمر"; done
ok "تم التحقق من حفظ الأسرار في GitHub"

say "تشغيل البناء على خوادم GitHub…"
"$GH" workflow run build.yml -R "$REPO" --ref "$BRANCH" >/dev/null 2>&1 && ok "بدأ البناء (10–15 دقيقة)" || warn "شغّله يدويًا: Actions ← Wasalni Build & Deploy ← Run workflow"

U="https://$SURGE_DOMAIN"
tg sendMessage -d chat_id="$TG_CHAT" -d parse_mode=HTML --data-urlencode text="⚙️ <b>اكتمل إعداد وصلني</b>
بدأ البناء الآن، وستصلك ملفات APK والروابط هنا خلال دقائق.

🌐 ${U}
🛠 لوحة التحكم: ${U}/admin/
📧 المدير: contwais@gmail.com
🔑 كلمة السر تُطلب عند أول فتح للوحة وتُحفظ للأبد" >/dev/null 2>&1 || true

cat <<EOF

${G}${B}════════════ تم ════════════${N}
  🌐 الموقع:        ${B}$U${N}
  📱 تطبيق الزبون:  $U/app/
  🧑‍✈️ تطبيق السائق:  $U/driver/
  🛠 لوحة التحكم:   ${B}$U/admin/${N}   (contwais@gmail.com — اختر كلمة السر عند أول فتح)
  ⬇️ APK:           $U/downloads/wasalni.apk • $U/downloads/wasalni-captain.apk
  📨 كل بناء جديد يُرسل تلقائيًا إلى تلجرام @$BOT
  ${D}الإعدادات محفوظة في $CONF — أعد تشغيل الأمر نفسه لأي تعديل.${N}

EOF
