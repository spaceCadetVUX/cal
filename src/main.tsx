import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSeedIfNeeded } from './db/seed'

// Chạy seed trước khi render — chỉ có effect lần đầu tiên
runSeedIfNeeded().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
