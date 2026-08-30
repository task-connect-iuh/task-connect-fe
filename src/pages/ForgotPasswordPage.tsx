import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@ds/components/core/Button'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import { forgotPassword } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/**
 * Yeu cau ma dat lai mat khau qua email. Backend luon tra ve thanh cong ngay ca khi email
 * khong ton tai (chong do email hop le) - UI vi vay khong bao gio bao "email khong ton tai",
 * chi bao loi khi that su khong ket noi duoc hoac sai dinh dang.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Nhập email của tài khoản.')
      return
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Email chưa đúng định dạng.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await forgotPassword({ email: email.trim() })
      navigate('/xac-minh', { state: { mode: 'reset', email: email.trim() }, replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout variant="login">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Quên mật khẩu
          </h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Nhập email của tài khoản. Chúng tôi gửi mã 6 chữ số để bạn đặt lại mật khẩu. Việc đang chạy và tiền đang tạm giữ không bị ảnh hưởng.
          </p>
        </div>

        <Field label="Email" error={error}>
          <Input
            icon="at-sign"
            type="email"
            placeholder="mai.nguyen@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!error}
            disabled={busy}
          />
        </Field>

        <Button variant="primary" size="lg" block disabled={busy} onClick={handleSubmit}>
          {busy ? 'Đang gửi…' : 'Gửi mã đặt lại'}
        </Button>
        <Link to="/dang-nhap" style={{ alignSelf: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)' }}>
          Quay lại đăng nhập
        </Link>
      </div>
    </AuthLayout>
  )
}
