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

        <div className="flex flex-col gap-4">
          <Field label="Email" error={emailError}>
            <Input
              icon="at-sign"
              type="email"
              placeholder="mai.nguyen@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
