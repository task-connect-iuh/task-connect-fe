import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Checkbox } from '@ds/components/forms/Checkbox'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { GoogleAuthButton } from '../features/auth/GoogleAuthButton.tsx'
import { PasswordInput } from '../features/auth/PasswordInput.tsx'
import { register } from '../api/auth.ts'
import type { TokenResponse } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { finishLoginAndRedirect } from '../features/auth/postLoginRedirect.ts'
import { submitOnEnter } from '../features/auth/submitOnEnter.ts'
import { suggestEmailDomain } from '../utils/emailSuggestion.ts'
import { toTitleCase } from '../utils/formatName.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const STRENGTH_LABELS = [
  'Ít nhất 8 ký tự, có chữ hoa, chữ thường và số.',
  'Còn yếu — thêm độ dài và ký tự khác loại.',
  'Tạm ổn — thêm ký tự đặc biệt sẽ chắc hơn.',
  'Mật khẩu mạnh.',
]

function passwordStrength(value: string) {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) score++
  if (value.length >= 12 || /[^\w\s]/.test(value)) score++
  return score
}

/**
 * UC01 - tao tai khoan moi. Moi tai khoan tu dang ky luon mang ca 2 vai tro Task Poster
 * va Tasker (quyet dinh da chot) - khong hoi chon vai tro o day. Chon vai tro dang hoat
 * dong (Poster/Tasker) la viec cua man hinh khac sau dang nhap, chua lam trong phien nay.
 */
export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Du lieu mang ve tu man Nhap ma xac minh khi bam "Sua lai" - de khong bat nguoi dung go
  // lai tu dau (tru mat khau, khong mang qua lai vi ly do bao mat).
  const backState = location.state as { name?: string; email?: string } | null

  const [name, setName] = useState(backState?.name ?? '')
  const [email, setEmail] = useState(backState?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  // true khi backend tra AUTH-409-EMAIL_EXISTS - hien them goi y dang nhap/lay lai mat khau,
  // vi backend khong tiet lo trang thai that (ACTIVE hay UNVERIFIED) cua tai khoan trung email.
  const [emailExists, setEmailExists] = useState(false)
  // Goi y sua ten mien go nham (vd "gmail.comm") khi roi khoi o email - chi hien khi con
  // khop voi gia tri email hien tai, tu an neu nguoi dung go tiep hoac da ap dung goi y.
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null)

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Nhập họ và tên.'
    else if (name.trim().split(/\s+/).length < 2) nextErrors.name = 'Ghi đầy đủ họ và tên.'

    if (!email.trim()) nextErrors.email = 'Nhập email để nhận mã xác minh.'
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Email chưa đúng định dạng.'

    if (!password) nextErrors.password = 'Tạo mật khẩu.'
    else if (!PASSWORD_PATTERN.test(password)) nextErrors.password = 'Cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số.'

    if (!confirmPassword) nextErrors.confirm = 'Nhập lại mật khẩu.'
    else if (confirmPassword !== password) nextErrors.confirm = 'Hai mật khẩu chưa khớp.'

    if (!agree) nextErrors.agree = 'Bạn cần đồng ý với điều khoản để tạo tài khoản.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // Dang ky bang Google khac dang ky bang mat khau: tai khoan Google vao thang ACTIVE, khong
  // qua OTP - nen dang nhap that su ngay (finishLoginAndRedirect tu set session + dieu huong,
  // ke ca sang cong xac minh so dien thoai neu day la lan dang nhap dau tien) thay vi sang
  // /xac-minh nhu register() thuong. Toast "dang nhap" (khong phai "dang ky") vi nhanh xac
  // nhan lien ket (email da co tai khoan tu truoc) thuc chat la dang nhap vao tai khoan cu,
  // khong phai tao moi - "dang ky thanh cong" se sai trong truong hop do.
  const handleGoogleSuccess = (tokens: TokenResponse) => {
    finishLoginAndRedirect(tokens, navigate)
  }

  const handleGoogleError = (error: unknown) => {
    setFormError(error instanceof ApiError ? error.message : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  }

  const handleSubmit = async () => {
    setFormError('')
    setEmailExists(false)
    if (!validate()) return

    const normalizedName = toTitleCase(name)
    setBusy(true)
    try {
      await register({
        fullName: normalizedName,
        email: email.trim(),
        password,
        confirmPassword,
        roles: ['TASK_POSTER', 'TASKER'],
      })
      // Khong con session de tranh GuestGuard/RoleGuard, nen dieu huong thuong la du - tai
      // khoan moi tao la UNVERIFIED, chua co token nao ca.
      navigate('/xac-minh', {
        state: {
          mode: 'signup',
          email: email.trim(),
          name: normalizedName,
          backPath: '/dang-ky',
          backState: { name: normalizedName, email: email.trim() },
        },
        replace: true,
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH-409-EMAIL_EXISTS') {
        setErrors((current) => ({ ...current, email: error.message }))
        setEmailExists(true)
      } else if (error instanceof ApiError) {
        setFormError(error.message)
      } else {
        setFormError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleEmailBlur = () => {
    setEmailSuggestion(suggestEmailDomain(email.trim()))
  }

  const applyEmailSuggestion = () => {
    if (!emailSuggestion) return
    setEmail(emailSuggestion)
    setEmailSuggestion(null)
  }

  const strength = passwordStrength(password)

  return (
    <AuthLayout variant="signup" homeLink>
      <div className="flex flex-col gap-6" onKeyDown={submitOnEnter(handleSubmit, busy)}>
        <div className="flex flex-col gap-2">
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Tạo tài khoản
          </h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Đã có tài khoản? <Link to="/dang-nhap" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Đăng nhập</Link>
          </p>
        </div>

        {formError && <Alert tone="danger" title="Không tạo được tài khoản">{formError}</Alert>}

        <div className="flex flex-col gap-4">
          <Field label="Họ và tên" error={errors.name}>
            <Input
              icon="user"
              placeholder="Nguyễn Thị Mai"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((current) => (current.trim() ? toTitleCase(current) : current))}
              error={!!errors.name}
              disabled={busy}
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <Input
              icon="at-sign"
              type="email"
              placeholder="mai.nguyen@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailSuggestion(null)
              }}
              onBlur={handleEmailBlur}
              error={!!errors.email}
              disabled={busy}
            />
            {emailSuggestion && (
              <p className="m-0 mt-1" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                Có phải bạn muốn nhập{' '}
                <button
                  type="button"
                  onClick={applyEmailSuggestion}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)', textDecoration: 'underline' }}
                >
                  {emailSuggestion}
                </button>
                ?
              </p>
            )}
          </Field>

          {emailExists && (
            <Alert tone="warning" title="Email này đã có tài khoản">
              Nếu đây là tài khoản của bạn, hãy{' '}
              <Link to="/dang-nhap" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)', textDecoration: 'underline' }}>đăng nhập</Link>{' '}
              hoặc{' '}
              <Link to="/quen-mat-khau" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)', textDecoration: 'underline' }}>lấy lại mật khẩu</Link>.
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PasswordInput
              label="Mật khẩu"
              placeholder="Ít nhất 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={busy}
              show={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
            />
            <PasswordInput
              label="Xác nhận mật khẩu"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirm}
              disabled={busy}
              show={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5" style={{ width: 96, flexShrink: 0 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="flex-1"
                  style={{ height: 4, borderRadius: 'var(--r-pill)', background: i < strength ? 'var(--teal-500)' : 'var(--paper-2)' }}
                />
              ))}
            </div>
            <span style={{ fontSize: 'var(--fs-xs)', color: strength >= 3 ? 'var(--teal-600)' : 'var(--text-muted)' }}>
              {STRENGTH_LABELS[strength]}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <Checkbox
              label={(
                <>
                  Tôi đồng ý với{' '}
                  <Link to="/dieu-khoan" target="_blank" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Điều khoản sử dụng</Link>{' '}
                  và{' '}
                  <Link to="/chinh-sach-quyen-rieng-tu" target="_blank" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>Chính sách quyền riêng tư</Link>
                </>
              )}
              checked={agree}
              onChange={() => setAgree((v) => !v)}
              disabled={busy}
            />
            {errors.agree && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{errors.agree}</span>}
          </div>

          <Button variant="primary" size="lg" block disabled={busy} onClick={handleSubmit}>
            {busy ? 'Đang gửi mã…' : 'Tạo tài khoản'}
          </Button>

          <GoogleAuthButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} text="signup_with" />
        </div>
      </div>
    </AuthLayout>
  )
}
