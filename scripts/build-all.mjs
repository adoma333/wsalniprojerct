// يبني التطبيقات الأربعة ثم يجمعها في dist/site للنشر على surge:
//   /          صفحة الهبوط
//   /app/      تطبيق الزبون (ويب/PWA للآيفون)
//   /driver/   تطبيق السائق
//   /admin/    لوحة التحكم
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'

const apps = (process.argv[2] || 'landing,rider,driver,admin').split(',')
for (const app of apps) {
  console.log(`\n▶ building ${app}`)
  execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, APP: app } })
}

const site = 'dist/site'
rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })
const map = { landing: '', rider: 'app', driver: 'driver', admin: 'admin' }
for (const app of apps) if (existsSync(`dist/${app}`)) cpSync(`dist/${app}`, `${site}/${map[app]}`, { recursive: true })
if (existsSync('dist/downloads')) cpSync('dist/downloads', `${site}/downloads`, { recursive: true })
// صفحة 404 تعيد التوجيه للرئيسية
writeFileSync(`${site}/404.html`, '<!doctype html><meta charset="utf-8"><script>location.replace("/")</script>')
console.log('\n✓ site ready in dist/site')
