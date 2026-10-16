import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/ui/ui.css'
import '@/rider/rider.css'
import '@/landing/landing.css'
import { applyDocLang, applyTheme, forceHttps } from '@/core/util.js'
import Landing from '@/landing/Landing.jsx'

forceHttps()
applyDocLang()
applyTheme()
createRoot(document.getElementById('root')).render(<Landing />)
