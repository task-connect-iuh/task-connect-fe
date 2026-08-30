import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Thu tu import quyet dinh: Tailwind (layout) truoc, Design System (mau/font/base) sau,
// de token DS thang khi trung selector (body, h1...). Xem 21-react-frontend.md.
import './index.css'
import '@ds/styles.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
