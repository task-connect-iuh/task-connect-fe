import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { forgotPassword, resendVerification, verifyEmail } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { submitOnEnter } from '../features/auth/submitOnEnter.ts'

interface VerifyLocationState {
  mode: 'signup' | 'reset'
  email: string
  name?: string
  phone?: string
  /** Thong bao ly do vao thang man nay - vd tu dang nhap voi tai khoan UNVERIFIED, hoac
   *  tu dang ky trung email chua xac thuc. Khac voi "notice" cuc bo (xac nhan da gui lai ma). */
  entryNotice?: string
  /** Duong dan ve khi bam "Sua lai" - do noi dieu huong toi day quyet dinh, KHONG suy tu
   *  mode, vi mode "signup" dung chung cho ca dang ky moi lan dang nhap tai khoan UNVERIFIED
   *  (2 truong hop can quay ve 2 trang khac nhau: /dang-ky vs /dang-nhap). */
  backPath: string
  /** State mang theo khi quay ve backPath, de trang do tu dien lai du lieu da nhap thay vi
   *  bat go lai tu dau. */
  backState?: Record<string, string>
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
  const state = location.state as VerifyLocationState | null

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (resendCooldown === 0) return
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  if (!state?.email) {
    return <Navigate to="/dang-nhap" replace />
  }

  const { backPath, backState } = state

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
        // register()/login() khong con cap token cho tai khoan UNVERIFIED nen toi day chac
        // chan chua co session nao ca - luon ve /dang-nhap de nguoi dung tu dang nhap that.
        navigate('/dang-nhap', { state: { justVerified: true }, replace: true })
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

  return (
    <AuthLayout variant={state.mode === 'signup' ? 'signup' : 'login'}>
      <div className="flex flex-col gap-6" onKeyDown={submitOnEnter(handleSubmit, busy || otp.length < 6)}>
        <div className="flex flex-col gap-2">
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Nhập mã xác minh
          </h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Chúng tôi vừa gửi 6 chữ số đến <strong style={{ color: 'var(--text-title)' }}>{state.email}</strong>.{' '}
            <Link to={backPath} state={backState} style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Sửa lại</Link>
          </p>
        </div>

        {state.entryNotice && (
          <Alert tone="warning" icon="shield-alert" title="Email chưa xác thực">{state.entryNotice}</Alert>
        )}

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
