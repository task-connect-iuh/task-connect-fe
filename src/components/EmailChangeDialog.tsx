import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Dialog } from '@ds/components/feedback/Dialog'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import {
  confirmEmailChange,
  requestEmailChange,
  requestNewEmailForChange,
  verifyOldEmailForChange,
} from '../api/auth.ts'
import { ApiError } from '../api/client.ts'

interface EmailChangeDialogProps {
  currentEmail: string
  onClose: () => void
  /** Goi sau khi doi email thanh cong, kem email moi - ProfilePage tu cap nhat lai state hien thi. */
  onChanged: (newEmail: string) => void
}

type Step = 'intro' | 'verify-old' | 'new-email' | 'verify-new' | 'success'

// Cung 60s voi resendCooldown o VerifyEmailPage.tsx (dang ky/dang nhap) - dong bo UX, va
// khop voi OTP_RESEND_COOLDOWN phia backend (AuthService.requestEmailChange()).
const RESEND_COOLDOWN_SECONDS = 60

/** Ma loi bao token doi email da het hieu luc hoan toan (het han/sai qua nhieu lan) - phai bam "Gửi lại mã" tu buoc 1. */
const RESTART_REQUIRED_CODES = new Set([
  'AUTH-404-EMAIL_CHANGE_NOT_REQUESTED',
  'AUTH-429-TOO_MANY_EMAIL_CHANGE_OTP_ATTEMPTS',
])

/**
 * Modal doi email - luong 4 buoc: (1) nguoi dung tu bam "Gui ma xac minh" de gui OTP toi
 * email HIEN TAI (KHONG tu dong gui khi mo modal - tranh spam neu nguoi dung mo/dong modal
 * nhieu lan), (2) nhap OTP do de xac minh quyen so huu, (3) nhap email MOI, he thong gui OTP
 * rieng toi dia chi do, (4) nhap OTP email moi - thanh cong moi thuc su doi email. Nut "Gui
 * lai ma" o buoc 2 va 4 bi khoa 60s sau moi lan gui, cung co che voi man Nhap ma xac minh o
 * dang ky/dang nhap (xem VerifyEmailPage.tsx) - backend cung tu chan spam phia server (xem
 * AuthService.requestEmailChange()/requestNewEmailForChange()), day chi la UX, khong phai
 * lop chan duy nhat. Backend tu gui 2 thong bao rieng sau buoc 4 (email cu: "da doi sang
 * ***", email moi: "chuc mung") - khong lam o day, xem EmailChangedEvent.
 */
export function EmailChangeDialog({ currentEmail, onClose, onChanged }: EmailChangeDialogProps) {
  const [step, setStep] = useState<Step>('intro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [oldOtp, setOldOtp] = useState('')
  const [oldCooldown, setOldCooldown] = useState(0)
  const [newEmail, setNewEmail] = useState('')
  const [newEmailError, setNewEmailError] = useState('')
  const [newOtp, setNewOtp] = useState('')
  const [newCooldown, setNewCooldown] = useState(0)

  useEffect(() => {
    if (oldCooldown === 0) return
    const timer = setTimeout(() => setOldCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [oldCooldown])

  useEffect(() => {
    if (newCooldown === 0) return
    const timer = setTimeout(() => setNewCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [newCooldown])

  const handleSendOld = async () => {
    setError('')
    setBusy(true)
    try {
      await requestEmailChange()
      setStep('verify-old')
      setOldCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được mã xác minh. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOld = async () => {
    if (!/^\d{6}$/.test(oldOtp)) {
      setError('Nhập đủ 6 chữ số.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await verifyOldEmailForChange(oldOtp)
      setStep('new-email')
    } catch (err) {
      if (err instanceof ApiError && RESTART_REQUIRED_CODES.has(err.code ?? '')) {
        setError(err.message)
        setStep('intro')
        setOldCooldown(0)
      } else {
        setError(err instanceof ApiError ? err.message : 'Không xác minh được. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSendNew = async () => {
    if (!newEmail.trim()) {
      setNewEmailError('Nhập email mới.')
      return
    }
    setNewEmailError('')
    setError('')
    setBusy(true)
    try {
      await requestNewEmailForChange(newEmail.trim())
      setStep('verify-new')
      setNewCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      if (err instanceof ApiError && RESTART_REQUIRED_CODES.has(err.code ?? '')) {
        setError(err.message)
        setStep('intro')
        setOldCooldown(0)
        setNewCooldown(0)
      } else {
        setNewEmailError(err instanceof ApiError ? err.message : 'Không gửi được mã xác minh. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmNew = async () => {
    if (!/^\d{6}$/.test(newOtp)) {
      setError('Nhập đủ 6 chữ số.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await confirmEmailChange(newOtp)
      setStep('success')
      onChanged(newEmail.trim())
    } catch (err) {
      if (err instanceof ApiError && RESTART_REQUIRED_CODES.has(err.code ?? '')) {
        setError(err.message)
        setStep('intro')
        setOldCooldown(0)
        setNewCooldown(0)
      } else {
        setError(err instanceof ApiError ? err.message : 'Không xác minh được. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="Đổi email" subtitle={step === 'success' ? undefined : 'Xác minh quyền sở hữu email hiện tại và email mới trước khi đổi'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger" title="Có lỗi xảy ra">{error}</Alert>}

        {step === 'intro' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-body)' }}>
              Chúng tôi sẽ gửi mã xác minh đến email hiện tại của bạn (<strong>{currentEmail}</strong>)
              để xác nhận chính bạn là người yêu cầu đổi email.
            </p>
            <Button variant="primary" size="md" disabled={busy} onClick={() => void handleSendOld()} style={{ alignSelf: 'flex-end' }}>
              {busy ? 'Đang gửi…' : 'Gửi mã xác minh'}
            </Button>
          </>
        )}

        {step === 'verify-old' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-body)' }}>
              Chúng tôi đã gửi mã xác minh đến email hiện tại của bạn (<strong>{currentEmail}</strong>).
              Nhập mã đó để tiếp tục.
            </p>
            <Field label="Mã xác minh">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                numeric
                placeholder="000000"
                value={oldOtp}
                onChange={(e) => setOldOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" disabled={busy || oldCooldown > 0} onClick={() => void handleSendOld()}>
                {oldCooldown > 0 ? `Gửi lại mã (${oldCooldown}s)` : 'Gửi lại mã'}
              </Button>
              <Button variant="primary" size="md" disabled={busy || oldOtp.length < 6} onClick={() => void handleVerifyOld()}>
                {busy ? 'Đang xác minh…' : 'Xác nhận'}
              </Button>
            </div>
          </>
        )}

        {step === 'new-email' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-body)' }}>Đã xác minh email hiện tại. Nhập email mới bạn muốn đổi sang.</p>
            <Field label="Email mới" error={newEmailError}>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setNewEmailError('') }}
                error={!!newEmailError}
                disabled={busy}
              />
            </Field>
            <Button variant="primary" size="md" disabled={busy} onClick={() => void handleSendNew()} style={{ alignSelf: 'flex-end' }}>
              {busy ? 'Đang gửi…' : 'Gửi mã xác minh'}
            </Button>
          </>
        )}

        {step === 'verify-new' && (
          <>
            <p style={{ margin: 0, color: 'var(--text-body)' }}>
              Chúng tôi đã gửi mã xác minh đến <strong>{newEmail}</strong>. Nhập mã đó để hoàn tất đổi email.
            </p>
            <Field label="Mã xác minh">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                numeric
                placeholder="000000"
                value={newOtp}
                onChange={(e) => setNewOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" disabled={busy || newCooldown > 0} onClick={() => void handleSendNew()}>
                {newCooldown > 0 ? `Gửi lại mã (${newCooldown}s)` : 'Gửi lại mã'}
              </Button>
              <Button variant="primary" size="md" disabled={busy || newOtp.length < 6} onClick={() => void handleConfirmNew()}>
                {busy ? 'Đang xác minh…' : 'Xác nhận đổi email'}
              </Button>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <Alert tone="success" title="Đổi email thành công">
              Email của bạn đã được đổi sang {newEmail}. Chúng tôi đã gửi thông báo đến cả email cũ và email mới.
            </Alert>
            <Button variant="primary" size="md" onClick={onClose} style={{ alignSelf: 'flex-end' }}>Đóng</Button>
          </>
        )}
      </div>
    </Dialog>
  )
}
