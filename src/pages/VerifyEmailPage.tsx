import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { forgotPassword, resendVerification, verifyEmail } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'

interface VerifyLocationState {
  mode: 'signup' | 'reset'
  email: string
  name?: string
  phone?: string
}

const RESEND_COOLDOWN_SECONDS = 60

/**
 * Man Nhap ma xac minh, dung chung cho 2 luong:
 * - mode "signup": goi that POST /auth/verify-email, thanh cong thi hien man "Dang ky thanh cong".
 * - mode "reset": KHONG co endpoint xac minh OTP rieng o backend - reset-password nhan
 *   {email, otp, newPassword, confirmNewPassword} trong CUNG mot loi goi. Man nay chi kiem
 *   dinh dang 6 so roi mang otp sang man Dat lai mat khau, xac minh that dien ra o do.
 */
export function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const setAccountStatus = useAuthStore((state) => state.setAccountStatus)
  const state = location.state as VerifyLocationState | null

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (resendCooldown === 0) return
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  if (!state?.email) {
    return <Navigate to="/dang-nhap" replace />
  }

  const backPath = state.mode === 'signup' ? '/dang-ky' : '/quen-mat-khau'

  const handleSubmit = async () => {
    setNotice('')
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('Nhập đủ 6 chữ số.')
      return
    }
    setOtpError('')
    setBusy(true)
    try {
      if (state.mode === 'signup') {
        await verifyEmail({ email: state.email, otp })
        setAccountStatus('ACTIVE')
        setVerified(true)
      } else {
        navigate('/dat-lai-mat-khau', { state: { email: state.email, otp }, replace: true })
      }
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setOtpError('')
    setNotice('')
    setBusy(true)
    try {
      const response = state.mode === 'signup'
        ? await resendVerification({ email: state.email })
        : await forgotPassword({ email: state.email })
      setResendCooldown(response.retryAfterSeconds)
      setNotice('Đã gửi mã mới. Kiểm tra hộp thư email của bạn.')
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  if (verified) {
    return (
      <AuthLayout variant="signup">
        <div className="flex flex-col gap-5">
          <span
            className="flex items-center justify-center"
            style={{ width: 60, height: 60, borderRadius: 'var(--r-pill)', background: 'var(--teal-50)', border: 'var(--bw) solid var(--teal-200)', color: 'var(--teal-600)' }}
          >
            <Icon name="badge-check" size={28} />
          </span>
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 'var(--fw-bold)', color: 'var(--text-faint)' }}>
              Bước 3 / 3 · hoàn tất
            </span>
            <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
              Đăng ký thành công
            </h2>
            <p className="m-0" style={{ color: 'var(--text-muted)' }}>
              Email đã được xác minh và tài khoản của bạn đã sẵn sàng. Bắt đầu đăng việc hoặc tìm việc quanh bạn.
            </p>
          </div>

          <div className="flex flex-col" style={{ border: 'var(--bw) solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface-card-alt)', overflow: 'hidden' }}>
            {[
              ['Họ và tên', state.name || '—'],
              ['Email', state.email],
              ['Số điện thoại', state.phone || 'Chưa cung cấp'],
            ].map(([label, value], index) => (
              <div key={label}>
                {index > 0 && <div style={{ height: 1, background: 'var(--border)' }} />}
                <div className="flex items-baseline justify-between gap-4 p-4">
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-title)', textAlign: 'right' }}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          <Alert tone="info" icon="shield-question" title="Xác minh danh tính làm sau">
            Đăng việc thì chưa cần xác minh. Muốn nhận việc hoặc rút tiền từ ví, bạn gửi ảnh CCCD trong mục Hồ sơ sau khi vào trang chủ.
          </Alert>

          <Button variant="primary" size="lg" block onClick={() => navigate('/', { replace: true })}>
            Vào trang chủ
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout variant={state.mode === 'signup' ? 'signup' : 'login'}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Nhập mã xác minh
          </h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Chúng tôi vừa gửi 6 chữ số đến <strong style={{ color: 'var(--text-title)' }}>{state.email}</strong>.{' '}
            <Link to={backPath} style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Sửa lại</Link>
          </p>
        </div>

        {notice && !otpError && <Alert tone="info" title="Đã gửi mã mới">{notice}</Alert>}
        {otpError && <Alert tone="danger" title="Mã chưa đúng">{otpError}</Alert>}

        <Field label="Mã xác minh">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            numeric
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={!!otpError}
            disabled={busy}
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Mã có hiệu lực 5 phút.</span>
          <Button variant="ghost" size="sm" disabled={busy || resendCooldown > 0} onClick={handleResend}>
            {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : 'Gửi lại mã'}
          </Button>
        </div>

        <Button variant="primary" size="lg" block disabled={busy || otp.length < 6} onClick={handleSubmit}>
          {busy ? 'Đang xác minh…' : 'Xác nhận'}
        </Button>

        <p className="m-0" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          Không thấy email? Kiểm tra thư mục spam. Mã hết hạn thì bấm "Gửi lại mã" để nhận mã mới.
        </p>
      </div>
    </AuthLayout>
  )
}
