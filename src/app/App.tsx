import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.tsx'
import { HomePage } from '../pages/HomePage.tsx'
import { LoginPage } from '../pages/LoginPage.tsx'
import { PrivacyPage } from '../pages/PrivacyPage.tsx'
import { RegisterPage } from '../pages/RegisterPage.tsx'
import { ResetPasswordPage } from '../pages/ResetPasswordPage.tsx'
import { TermsPage } from '../pages/TermsPage.tsx'
import { VerifyEmailPage } from '../pages/VerifyEmailPage.tsx'
import { AuthBootstrap } from './AuthBootstrap.tsx'
import { RoleGuard } from './RoleGuard.tsx'

function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <Routes>
        <Route
          path="/"
          element={(
            <RoleGuard allow={['poster', 'tasker', 'admin']}>
              <HomePage />
            </RoleGuard>
          )}
        />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
        <Route path="/xac-minh" element={<VerifyEmailPage />} />
        <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
        <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
        <Route path="/dieu-khoan" element={<TermsPage />} />
        <Route path="/chinh-sach-quyen-rieng-tu" element={<PrivacyPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
