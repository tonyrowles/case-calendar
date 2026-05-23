import './index.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { App } from './App.js'
import { WallpaperView } from './routes/wallpaper.js'
import { SettingsPage } from './routes/settings.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { queryClient } from './lib/queryClient.js'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/wallpaper" element={<WallpaperView />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
