import React from 'react'
import { createRoot } from 'react-dom/client'
import '@/ui/ui.css'
import '@/admin/admin.css'
import { boot } from '@/ui/app-ctx.jsx'
import App from '@/admin/App.jsx'

boot()
createRoot(document.getElementById('root')).render(<App />)
