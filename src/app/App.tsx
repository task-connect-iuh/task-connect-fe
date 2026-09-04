import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.tsx'
import { LandingPage } from '../pages/LandingPage.tsx'
import { LoginPage } from '../pages/LoginPage.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'
import { OverviewPage } from '../pages/OverviewPage.tsx'
import { PrivacyPage } from '../pages/PrivacyPage.tsx'
import { ProfilePage } from '../pages/ProfilePage.tsx'
import { PublicProfilePage } from '../pages/PublicProfilePage.tsx'
import { RegisterPage } from '../pages/RegisterPage.tsx'
import { ResetPasswordPage } from '../pages/ResetPasswordPage.tsx'
import { TaskerSkillsPage } from '../pages/TaskerSkillsPage.tsx'
import { TermsPage } from '../pages/TermsPage.tsx'
import { VerifyEmailPage } from '../pages/VerifyEmailPage.tsx'
import { AuthBootstrap } from './AuthBootstrap.tsx'
import { GuestGuard } from './GuestGuard.tsx'
import { RoleGuard } from './RoleGuard.tsx'
import { ToastContainer } from './ToastContainer.tsx'

function App() {
  return (
    // useTransitions={false}: react-router v7 mac dinh boc moi cap nhat location trong
    // React.startTransition, khien navigate() ben trong flushSync (xem RegisterPage.tsx,
    // LoginPage.tsx) khong con dong bo nhu ky vong - GuestGuard chua kip go khoi cay truoc
    // khi setSession() chay, tu dieu huong nham thang ve /tong-quan thay vi /xac-minh.
    <BrowserRouter useTransitions={false}>
      <AuthBootstrap />
      <ToastContainer />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/tong-quan"
          element={(
            <RoleGuard allow={['poster', 'tasker', 'admin']}>
              <OverviewPage />
            </RoleGuard>
          )}
        />
        <Route
          path="/ho-so"
          element={(
            <RoleGuard allow={['poster', 'tasker', 'admin']}>
              <ProfilePage />
            </RoleGuard>
          )}
        />
        <Route
          path="/ho-so/:accountId"
          element={(
            <RoleGuard allow={['poster', 'tasker', 'admin']}>
              <PublicProfilePage />
            </RoleGuard>
          )}
        />
        {/* Xac thuc danh tinh (KYC) da gop vao trang Ho so ky nang (/ho-so-nang-luc) -
            giu redirect cho link/bookmark cu. */}
        <Route path="/xac-thuc-danh-tinh" element={<Navigate to="/ho-so-nang-luc" replace />} />
        <Route
          path="/ho-so-nang-luc"
          element={(
            <RoleGuard allow={['tasker']}>
              <TaskerSkillsPage />
            </RoleGuard>
          )}
        />
        <Route path="/dang-nhap" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="/dang-ky" element={<GuestGuard><RegisterPage /></GuestGuard>} />
        <Route path="/xac-minh" element={<VerifyEmailPage />} />
        <Route path="/quen-mat-khau" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />
        <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
        <Route path="/dieu-khoan" element={<TermsPage />} />
        <Route path="/chinh-sach-quyen-rieng-tu" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
