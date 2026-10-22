#!/usr/bin/env bash
# =====================================================================
#  وصلني — أمر الإعداد الواحد (يُشغَّل على السيرفر مرة واحدة)
#  bash <(curl -fsSL https://raw.githubusercontent.com/adoma333/wsalniprojerct/HEAD/setup/setup.sh)
#
#  هذا الأمر الواحد:
#   1) يجلب معرّف المحادثة (Chat ID) لبوت تلجرام تلقائيًا
#   2) ينشئ/يجلب توكن surge.sh ويختار رابط الموقع ولوحة التحكم
#   3) ينشئ مفتاح توقيع دائم لملفات APK
#   4) يثبّت خادم قاعدة البيانات (SQLite) مع HTTPS تلقائي — يربط كل الهواتف ولوحة التحكم لحظيًا
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

# ---------- 5) خادم قاعدة البيانات (SQLite) ----------
# يربط كل الهواتف ولوحة التحكم ببعض لحظيًا. خدمة خفيفة جدًا (Node.js + SQLite) تشتغل وحدها وتعاود تشتغل بعد إعادة التشغيل.
echo; echo -e "${B}【5/5】 خادم قاعدة البيانات — يربط كل الهواتف ولوحة التحكم${N}"
SRV=/opt/wasalni-server; DATA=/var/lib/wasalni; NODE_V=22.12.0
mkdir -p "$SRV" "$DATA"
if [ ! -x "$SRV/node/bin/node" ] || ! "$SRV/node/bin/node" -v 2>/dev/null | grep -q "v$NODE_V"; then
  say "تنزيل Node.js $NODE_V…"
  rm -rf "$SRV/node"; curl -fsSL "https://nodejs.org/dist/v${NODE_V}/node-v${NODE_V}-linux-${NA}.tar.gz" | tar xz -C "$SRV" && mv "$SRV/node-v${NODE_V}-linux-${NA}" "$SRV/node" || die "تعذر تنزيل Node.js"
fi
say "تنزيل كود الخادم من المستودع…"
"$GH" api "repos/$REPO/contents/server/server.mjs?ref=$BRANCH" -H "Accept: application/vnd.github.raw" > "$SRV/server.mjs.new" 2>/dev/null && [ -s "$SRV/server.mjs.new" ] && mv "$SRV/server.mjs.new" "$SRV/server.mjs" || die "تعذر تنزيل server/server.mjs"
cat > "$SRV/env" <<EOV
PORT=8787
DB_PATH=$DATA/wasalni.db
ADMIN_EMAIL=contwais@gmail.com
TELEGRAM_BOT_TOKEN=$TG_TOKEN
TELEGRAM_CHAT_ID=$TG_CHAT
EOV
chmod 600 "$SRV/env"
HAS_SYSTEMD=0; need systemctl && [ -d /run/systemd/system ] && HAS_SYSTEMD=1
unit() { # unit NAME DESCRIPTION EXEC
  cat > "/etc/systemd/system/$1.service" <<EOU
[Unit]
Description=$2
After=network-online.target
Wants=network-online.target
[Service]
EnvironmentFile=-$SRV/env
ExecStart=$3
Restart=always
RestartSec=3
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
EOU
  systemctl daemon-reload; systemctl enable "$1" >/dev/null 2>&1; systemctl restart "$1"
}
run_bg() { # run_bg NAME CMD (بدون systemd)
  pkill -x "$1" 2>/dev/null; (exec -a "$1" bash -c "$2" >>"$DATA/$1.log" 2>&1 &)
  (crontab -l 2>/dev/null | grep -v "#$1"; echo "@reboot bash -c '$2' >>$DATA/$1.log 2>&1 #$1") | crontab - 2>/dev/null || true
}
NODE_CMD="$SRV/node/bin/node --experimental-sqlite --no-warnings $SRV/server.mjs"
if [ "$HAS_SYSTEMD" = 1 ]; then unit wasalni-server "Wasalni API (SQLite)" "$NODE_CMD"
else set -a; . "$SRV/env"; set +a; run_bg wasalni-server "set -a; . $SRV/env; set +a; exec $NODE_CMD"; fi
for i in $(seq 1 20); do curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1 && ok "خادم قاعدة البيانات يخدم (محليًا)" || die "الخادم ما خدمش — شوف: journalctl -u wasalni-server -n 50"

# HTTPS: التطبيقات على https فلازم الخادم يكون https.
# الطريقة 1: Caddy + نطاق مجاني <IP>.sslip.io بشهادة Let's Encrypt (يحتاج المنفذين 80 و 443)
# الطريقة 2 (احتياطية): نفق Cloudflare مجاني بلا منافذ
PUB_IP=$(curl -fsS4 https://api.ipify.org 2>/dev/null || curl -fsS4 https://ifconfig.me 2>/dev/null)
API_DOMAIN="${WASALNI_API_DOMAIN:-${PUB_IP//./-}.sslip.io}"
port_busy() { (ss -ltnH 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}' | grep -qE "[:.]$1\$"; }
NEW_API=""
if [ -n "$PUB_IP" ] && { pgrep -x caddy >/dev/null || { ! port_busy 80 && ! port_busy 443; }; }; then
  if [ ! -x /usr/local/bin/caddy ]; then
    say "تنزيل Caddy (HTTPS تلقائي)…"
    CV=2.8.4; curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CV}/caddy_${CV}_linux_${A}.tar.gz" | tar xz -C /tmp caddy && mv /tmp/caddy /usr/local/bin/caddy && chmod +x /usr/local/bin/caddy || warn "تعذر تنزيل Caddy"
  fi
  if [ -x /usr/local/bin/caddy ]; then
    mkdir -p /etc/caddy "$DATA/caddy"
    cat > /etc/caddy/Caddyfile <<EOC
{
	email contwais@gmail.com
	storage file_system $DATA/caddy
}
$API_DOMAIN {
	reverse_proxy 127.0.0.1:8787 {
		flush_interval -1
	}
}
EOC
    need ufw && ufw status 2>/dev/null | grep -q active && { ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; }
    if [ "$HAS_SYSTEMD" = 1 ]; then unit wasalni-caddy "Wasalni HTTPS (Caddy)" "/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"
    else run_bg wasalni-caddy "exec /usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"; fi
    say "طلب شهادة HTTPS لـ $API_DOMAIN …"
    for i in $(seq 1 45); do curl -fsS "https://$API_DOMAIN/health" >/dev/null 2>&1 && { NEW_API="https://$API_DOMAIN"; break; }; sleep 2; done
    [ -n "$NEW_API" ] && ok "HTTPS جاهز: $NEW_API" || warn "الشهادة ما تخرجتش (المنافذ 80/443 مسدودة؟) — نجرّب نفق Cloudflare"
  fi
fi
if [ -z "$NEW_API" ]; then
  [ "$HAS_SYSTEMD" = 1 ] && systemctl disable --now wasalni-caddy >/dev/null 2>&1
  if [ ! -x "$SRV/cloudflared" ]; then
    say "تنزيل نفق Cloudflare…"
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${A}" -o "$SRV/cloudflared" && chmod +x "$SRV/cloudflared" || die "تعذر تنزيل cloudflared"
  fi
  : > "$DATA/tunnel.log"
  TUN="$SRV/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8787 --logfile $DATA/tunnel.log"
  if [ "$HAS_SYSTEMD" = 1 ]; then unit wasalni-tunnel "Wasalni tunnel" "$TUN"; else run_bg wasalni-tunnel "exec $TUN"; fi
  for i in $(seq 1 40); do U=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$DATA/tunnel.log" | tail -1); [ -n "$U" ] && curl -fsS "$U/health" >/dev/null 2>&1 && { NEW_API="$U"; break; }; sleep 2; done
  [ -n "$NEW_API" ] || die "تعذر تشغيل النفق — شوف $DATA/tunnel.log"
  ok "النفق جاهز: $NEW_API"
  # رابط النفق يتبدّل كي يعاود السيرفر يشتغل: مراقب صغير يحدّث التطبيقات وحدو
  cat > "$SRV/url-watch.sh" <<EOW
#!/usr/bin/env bash
. $CONF
while sleep 60; do
  U=\$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' $DATA/tunnel.log | tail -1)
  [ -n "\$U" ] && [ "\$U" != "\$API_URL" ] && curl -fsS "\$U/health" >/dev/null 2>&1 || continue
  printf '%s' "\$U" | GH_TOKEN="\$GH_TOKEN" $GH secret set API_URL -R $REPO >/dev/null 2>&1 && GH_TOKEN="\$GH_TOKEN" $GH workflow run build.yml -R $REPO --ref $BRANCH >/dev/null 2>&1 && {
    sed -i "/^API_URL=/d" $CONF; echo "API_URL=\$U" >> $CONF; API_URL="\$U"
  }
done
EOW
  chmod +x "$SRV/url-watch.sh"
  if [ "$HAS_SYSTEMD" = 1 ]; then unit wasalni-urlwatch "Wasalni tunnel URL watcher" "$SRV/url-watch.sh"; else run_bg wasalni-urlwatch "exec $SRV/url-watch.sh"; fi
fi
save API_URL "$NEW_API"

# ---------- حفظ الأسرار وتشغيل البناء ----------
echo; say "حفظ الأسرار في GitHub…"
secret TELEGRAM_BOT_TOKEN "$TG_TOKEN"
secret TELEGRAM_CHAT_ID "$TG_CHAT"
secret SURGE_TOKEN "$SURGE_TOKEN"
secret SURGE_LOGIN "${SURGE_LOGIN:-}"
secret SURGE_DOMAIN "$SURGE_DOMAIN"
secret ANDROID_KEYSTORE_B64 "$(base64 -w0 "$KS" 2>/dev/null || base64 "$KS" | tr -d '\n')"
secret ANDROID_KEYSTORE_PASSWORD "$KS_PASS"
secret API_URL "$API_URL"

HAVE=$("$GH" secret list -R "$REPO" 2>/dev/null)
for k in SURGE_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID API_URL; do echo "$HAVE" | grep -q "^$k" || die "لم يُحفظ $k في GitHub — تحقق من صلاحية Secrets في التوكن ثم أعد تشغيل الأمر"; done
ok "تم التحقق من حفظ الأسرار في GitHub"

say "تشغيل البناء على خوادم GitHub…"
"$GH" workflow run build.yml -R "$REPO" --ref "$BRANCH" >/dev/null 2>&1 && ok "بدأ البناء (10–15 دقيقة)" || warn "شغّله يدويًا: Actions ← Wasalni Build & Deploy ← Run workflow"

U="https://$SURGE_DOMAIN"
tg sendMessage -d chat_id="$TG_CHAT" -d parse_mode=HTML --data-urlencode text="⚙️ <b>اكتمل إعداد وصلني</b>
بدأ البناء الآن، وستصلك ملفات APK والروابط هنا خلال دقائق.

🌐 ${U}
🛠 لوحة التحكم: ${U}/admin/
📧 المدير: contwais@gmail.com
🔑 كلمة السر تُطلب عند أول فتح للوحة وتُحفظ للأبد
🗄 قاعدة البيانات: ${API_URL} (نسخة احتياطية يومية تصلك هنا)" >/dev/null 2>&1 || true

cat <<EOF

${G}${B}════════════ تم ════════════${N}
  🌐 الموقع:        ${B}$U${N}
  📱 تطبيق الزبون:  $U/app/
  🧑‍✈️ تطبيق السائق:  $U/driver/
  🛠 لوحة التحكم:   ${B}$U/admin/${N}   (contwais@gmail.com — اختر كلمة السر عند أول فتح)
  ⬇️ APK:           $U/downloads/wasalni.apk • $U/downloads/wasalni-captain.apk
  🗄 قاعدة البيانات: ${B}$API_URL${N}  (SQLite في $DATA — نسخة احتياطية يومية لتلجرام)
  📨 كل بناء جديد يُرسل تلقائيًا إلى تلجرام @$BOT
  ${D}الإعدادات محفوظة في $CONF — أعد تشغيل الأمر نفسه لأي تعديل.${N}

EOF
