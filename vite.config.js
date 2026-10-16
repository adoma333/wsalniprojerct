import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// تطبيق واحد في كل بناء: APP=landing | rider | driver | admin
const APP = process.env.APP || 'rider'
const r = (p) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: r(`./apps/${APP}`),
  base: './',
  publicDir: r('./public'),
  envDir: r('.'),
  plugins: [react()],
  resolve: { alias: { '@': r('./src') } },
  define: { __APP__: JSON.stringify(APP), __BUILD__: JSON.stringify(new Date().toISOString()) },
  build: {
    outDir: r(`./dist/${APP}`),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
    target: 'es2020',
  },
  server: { host: true, port: 5173 },
})
