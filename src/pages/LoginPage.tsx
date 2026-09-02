import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { PasswordInput } from '../features/auth/PasswordInput.tsx'
import { login, resendVerification } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { submitOnEnter } from '../features/auth/submitOnEnter.ts'
import { broadcastSession } from '../stores/authBroadcast.ts'
import { sessionFromTokenResponse, useAuthStore } from '../stores/useAuthStore.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/**
 * Tu lan sai mat khau lien tiep thu 3 (o form nay, khong phai so lieu that tu backend -
 * xem ghi chu tai handleSubmit) canh bao truoc khi tai khoan bi khoa. KHONG doc so nay tu
 * backend: backend chi tra cung mot AUTH-401-INVALID_CREDENTIALS bat ke email co ton tai
 * hay khong, de khong lo cho ke tan cong biet email nao da dang ky (xem PROGRESS.md).
 */
const FAILED_ATTEMPT_WARNING_THRESHOLD = 3

/** UC02 - dang nhap bang email va mat khau, dieu huong theo vai tro sau khi thanh cong. */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((state) => state.setSession)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [locked, setLocked] = useState(false)
  const [formError, setFormError] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [busy, setBusy] = useState(false)
  const justReset = Boolean((location.state as { justReset?: boolean } | null)?.justReset)
  const justVerified = Boolean((location.state as { justVerified?: boolean } | null)?.justVerified)
  const sessionExpired = Boolean((location.state as { expired?: boolean } | null)?.expired)

  const validate = () => {
    let ok = true
    if (!email.trim()) {
      setEmailError('Nhập email của bạn.')
      ok = false
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError('Email chưa đúng định dạng.')
      ok = false
    } else {
      setEmailError('')
    }
    if (!password) {
      setPasswordError('Nhập mật khẩu.')
      ok = false
    } else {
      setPasswordError('')
    }
    return ok
  }

  const handleSubmit = async () => {
    setFormError('')
    setLocked(false)
    if (!validate()) return

    setBusy(true)
    try {
      const tokens = await login({ email: email.trim(), password })

      // /tong-quan boc RoleGuard, doi hoi session da co san moi cho vao - phai setSession
      // TRUOC roi moi navigate, neu dieu huong truoc se bi RoleGuard doc duoc session con
      // null va da nguoc ve /dang-nhap ngay lap tuc.
      const session = sessionFromTokenResponse(tokens)
      setSession(session)
      // Bao cac tab khac cung trinh duyet biet vua dang nhap, khong can F5 ben do nua -
      // xem authBroadcast.ts.
      broadcastSession(session)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/dang-nhap' ? from : '/tong-quan', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH-423-ACCOUNT_LOCKED') {
        setLocked(true)
      } else if (error instanceof ApiError && error.code === 'AUTH-403-EMAIL_NOT_VERIFIED') {
        // login() gio tu choi thang tai khoan UNVERIFIED (khong con cap token) - tu gui lai
        // OTP roi dua sang /xac-minh. Khong con session nao de set o day ca.
        try {
          await resendVerification({ email: email.trim() })
        } catch {
          // Bo qua loi gui lai o day - man xac minh van co nut "Gui lai ma" neu can dung lai.
        }
        navigate('/xac-minh', {
          state: {
            mode: 'signup',
            email: email.trim(),
            entryNotice: 'Tài khoản của bạn chưa xác thực email. Chúng tôi vừa gửi mã xác minh mới đến email này.',
          },
        })
      } else if (error instanceof ApiError) {
        setFormError(error.message)
        // Dem so lan sai lien tiep NGAY TAI FORM NAY de canh bao truoc khi khoa - khong
        // suy ra tu noi dung phan hoi backend (message luon giong nhau du email co ton tai
        // hay khong, tranh lo thong tin tai khoan - xem ghi chu tren FAILED_ATTEMPT_WARNING_THRESHOLD).
        if (error.code === 'AUTH-401-INVALID_CREDENTIALS') {
          setFailedAttempts((count) => count + 1)
        }
      } else {
        setFormError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout variant="login">
      <div className="flex flex-col gap-6" onKeyDown={submitOnEnter(handleSubmit, busy || locked)}>
        <div className="flex flex-col gap-2">
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Đăng nhập
          </h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Chưa có tài khoản? <Link to="/dang-ky" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Đăng ký</Link>
          </p>
        </div>

        {justReset && !locked && !formError && (
          <Alert tone="success" title="Đặt lại mật khẩu thành công">Đăng nhập lại bằng mật khẩu mới của bạn.</Alert>
        )}

        {justVerified && !locked && !formError && (
          <Alert tone="success" title="Xác thực email thành công">Đăng nhập để bắt đầu sử dụng TaskConnect.</Alert>
        )}

        {sessionExpired && !locked && !formError && (
          <Alert tone="warning" title="Phiên đăng nhập đã hết hạn">Đăng nhập lại để tiếp tục.</Alert>
        )}

        {locked && (
          <Alert tone="danger" icon="octagon-alert" title="Tài khoản tạm khoá 15 phút">
            Bạn đã nhập sai mật khẩu quá nhiều lần. Việc đang chạy và tiền đang tạm giữ không bị ảnh hưởng. Để vào lại ngay, hãy đặt lại mật khẩu bằng mã gửi qua email.
          </Alert>
        )}

        {formError && !locked && (
          <Alert tone="danger" title="Không đăng nhập được">{formError}</Alert>
        )}

        {formError && !locked && failedAttempts >= FAILED_ATTEMPT_WARNING_THRESHOLD && (
          <Alert tone="warning" title="Bạn đã nhập sai nhiều lần liên tiếp">
            Nếu tiếp tục sai, tài khoản sẽ bị tạm khoá 15 phút sau lần sai thứ 5. Kiểm tra lại mật khẩu hoặc dùng &quot;Quên mật khẩu?&quot; bên dưới.
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <Field label="Email" error={emailError}>
            <Input
              icon="at-sign"
              type="email"
              placeholder="mai.nguyen@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setFailedAttempts(0)
              }}
              error={!!emailError}
              disabled={locked || busy}
            />
          </Field>

          <PasswordInput
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
            disabled={locked || busy}
            show={showPassword}
            onToggleShow={() => setShowPassword((value) => !value)}
          />

          <Link to="/quen-mat-khau" style={{ alignSelf: 'flex-end', fontSize: 'var(--fs-sm)', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>
            Quên mật khẩu?
          </Link>

          <Button variant="primary" size="lg" block disabled={busy || locked} onClick={handleSubmit}>
            {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
          </Button>
        </div>

        <p className="m-0" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          Khi đăng nhập, bạn đồng ý với{' '}
          <Link to="/dieu-khoan" target="_blank" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Điều khoản sử dụng</Link>{' '}
          và{' '}
          <Link to="/chinh-sach-quyen-rieng-tu" target="_blank" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Chính sách quyền riêng tư</Link>.
        </p>
      </div>
    </AuthLayout>
  )
}
