import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@ds/components/core/Button'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { PhoneVerificationFlow } from '../features/auth/PhoneVerificationFlow.tsx'
import { updatePhone } from '../api/auth.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { useToastStore } from '../stores/useToastStore.ts'

/**
 * Man hinh yeu cau xac minh so dien thoai qua Firebase Phone Auth, hien DUNG MOT LAN sau lan
 * dang nhap thanh cong dau tien cua tai khoan (dieu huong toi day tu finishLoginAndRedirect()
 * khi TokenResponse.firstLogin === true) - co the bo qua. Khong can gate boi RoleGuard (giong
 * /xac-minh) vi day khong phai route phan quyen theo vai tro, chi tu kiem tra co session hay
 * khong o duoi de chan truy cap truc tiep khi chua dang nhap.
 */
export function PhoneVerificationGatePage() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)

  if (!session) {
    return <Navigate to="/dang-nhap" replace />
  }

  // Go co needsPhoneVerification (xem useAuthStore.ts) ngay khi roi trang nay - GuestGuard
  // dung co nay de dieu huong nguoi vua dang nhap lan dau ve day thay vi /tong-quan; giu no
  // "true" mai se khien lan sau lo lai /dang-nhap (vd F5 sau khi da bo qua/xac minh xong roi
  // dieu huong that bai giua chung) bi GuestGuard keo nham ve day lan nua.
  const handleVerified = async (phoneLocal: string, firebaseIdToken: string) => {
    await updatePhone(phoneLocal, firebaseIdToken)
    useAuthStore.getState().clearPhoneVerificationGate()
    useToastStore.getState().pushToast('success', 'Đã xác minh số điện thoại.')
    navigate('/tong-quan', { replace: true })
  }

  const handleSkip = () => {
    useAuthStore.getState().clearPhoneVerificationGate()
    navigate('/tong-quan', { replace: true })
  }

  return (
    <AuthLayout variant="login">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Xác minh số điện thoại
          </h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Thêm và xác minh số điện thoại để dễ liên lạc khi đăng hoặc nhận việc. Bạn có thể bỏ qua và làm việc này sau trong trang Hồ sơ.
          </p>
        </div>

        <PhoneVerificationFlow
          onVerified={handleVerified}
          secondaryAction={(
            <Button variant="secondary" size="md" onClick={handleSkip}>
              Bỏ qua
            </Button>
          )}
        />
      </div>
    </AuthLayout>
  )
}
