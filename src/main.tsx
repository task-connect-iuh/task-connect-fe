import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
// Thu tu import quyet dinh: Tailwind (layout) truoc, Design System (mau/font/base) sau,
// de token DS thang khi trung selector (body, h1...). Xem 21-react-frontend.md.
import './index.css'
import '@ds/styles.css'
import App from './app/App.tsx'

// Client ID public (khong phai secret) cua OAuth 2.0 Client tao trong Google Cloud Console,
// dung chung voi GOOGLE_CLIENT_ID ben task-connect-be - xem GoogleAuthButton.tsx.
//
// locale="vi": khong co prop nay, Google tu doan ngon ngu nut theo trinh duyet/tai khoan
// nguoi dung (co the ra tieng Anh du app toan tieng Viet) - ep co dinh "vi" de nut Google
// luon dung tieng Viet, khop voi phan con lai cua giao dien.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''} locale="vi">
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
