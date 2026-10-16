import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/ui/ui.css'
import '@/rider/rider.css'
import '@/driver/driver.css'
import { boot } from '@/ui/app-ctx.jsx'
import { registerSW } from '@/ui/pwa.js'
import App from '@/driver/App.jsx'

boot()
registerSW()
createRoot(document.getElementById('root')).render(<App />)
