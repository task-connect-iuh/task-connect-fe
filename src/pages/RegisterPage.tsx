import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Checkbox } from '@ds/components/forms/Checkbox'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { PasswordInput } from '../features/auth/PasswordInput.tsx'
import { register, resendVerification } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { submitOnEnter } from '../features/auth/submitOnEnter.ts'
import { suggestEmailDomain } from '../utils/emailSuggestion.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const PHONE_PATTERN = /^0\d{9}$/
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

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agree, setAgree] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  // true khi backend tra AUTH-409-EMAIL_EXISTS - hien them loi tat "gui lai ma xac minh"
  // phong truong hop day la chinh tai khoan cua nguoi dung, dang ky truoc do nhung chua
  // xac thuc email. resendVerification khong bao gio bao loi hay tiet lo trang thai that
  // cua tai khoan (chi thuc su gui lai khi tai khoan dang UNVERIFIED), nen an toan de goi
  // ngay ca khi khong chac email nay co dang UNVERIFIED hay khong.
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

    if (phone.trim() && !PHONE_PATTERN.test(phone.trim().replace(/[\s.]/g, ''))) {
      nextErrors.phone = 'Gồm 10 chữ số, bắt đầu bằng 0.'
    }

    if (!password) nextErrors.password = 'Tạo mật khẩu.'
    else if (!PASSWORD_PATTERN.test(password)) nextErrors.password = 'Cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số.'

    if (!confirmPassword) nextErrors.confirm = 'Nhập lại mật khẩu.'
    else if (confirmPassword !== password) nextErrors.confirm = 'Hai mật khẩu chưa khớp.'

    if (!agree) nextErrors.agree = 'Bạn cần đồng ý với điều khoản để tạo tài khoản.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    setFormError('')
    setEmailExists(false)
    if (!validate()) return

    setBusy(true)
    try {
      await register({
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        confirmPassword,
        roles: ['TASK_POSTER', 'TASKER'],
      })
      // Khong con session de tranh GuestGuard/RoleGuard, nen dieu huong thuong la du - tai
      // khoan moi tao la UNVERIFIED, chua co token nao ca.
      navigate('/xac-minh', {
        state: { mode: 'signup', email: email.trim(), name: name.trim(), phone: phone.trim() },
        replace: true,
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH-409-EMAIL_EXISTS') {
        setErrors((current) => ({ ...current, email: error.message }))
        setEmailExists(true)
      } else if (error instanceof ApiError && error.code === 'AUTH-409-PHONE_EXISTS') {
        setErrors((current) => ({ ...current, phone: error.message }))
      } else if (error instanceof ApiError) {
        setFormError(error.message)
      } else {
        setFormError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleResendForExisting = async () => {
    setBusy(true)
    try {
      await resendVerification({ email: email.trim() })
    } catch {
      // resendVerification khong bao gio bao loi that (chong do email ton tai hay khong) -
      // van dieu huong sang man xac minh ke ca khi request mang that bai, nguoi dung con nut
      // "Gui lai ma" o do de thu lai.
    }
    navigate('/xac-minh', {
      state: {
        mode: 'signup',
        email: email.trim(),
        entryNotice: 'Nếu email này chưa được xác thực, chúng tôi vừa gửi mã mới đến đó. Nhập mã để kích hoạt tài khoản.',
      },
    })
    setBusy(false)
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
    <AuthLayout variant="signup">
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
            <Input icon="user" placeholder="Nguyễn Thị Mai" value={name} onChange={(e) => setName(e.target.value)} error={!!errors.name} disabled={busy} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Field label="Số điện thoại" hint="Không bắt buộc" error={errors.phone}>
              <Input icon="phone" placeholder="0901 234 567" value={phone} onChange={(e) => setPhone(e.target.value)} error={!!errors.phone} disabled={busy} />
            </Field>
          </div>

          {emailExists && (
            <Alert tone="warning" title="Email chưa xác thực?">
              Nếu đây là tài khoản của bạn nhưng chưa xác thực email, bấm{' '}
              <button
                type="button"
                onClick={handleResendForExisting}
                disabled={busy}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)', textDecoration: 'underline' }}
              >
                gửi lại mã xác minh
              </button>.
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
        </div>
      </div>
    </AuthLayout>
  )
}
