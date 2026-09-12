import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ConfirmationResult } from 'firebase/auth'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { Button } from '@ds/components/core/Button'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { ApiError } from '../../api/client.ts'
import { firebaseAuth } from './firebase.ts'

const PHONE_PATTERN = /^0\d{9}$/
const RESEND_COOLDOWN_SECONDS = 60

/** Quy doi so dang dia phuong (0xxxxxxxxx) sang E.164 (+84xxxxxxxxx) - dang Firebase yeu cau. */
function toE164(localPhone: string) {
  return `+84${localPhone.slice(1)}`
}

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'Số điện thoại không hợp lệ.',
  'auth/too-many-requests': 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
  'auth/invalid-verification-code': 'Mã xác minh không đúng.',
  'auth/code-expired': 'Mã xác minh đã hết hạn, gửi lại mã mới.',
}

/** Anh xa loi thanh thong bao tieng Viet - uu tien ApiError.message (loi tu backend, vd
 *  AUTH-409-PHONE_EXISTS nem tu onVerified()), roi den ma loi Firebase Auth (vd
 *  "auth/invalid-phone-number"), fallback chung neu khong khop truong hop nao ca. */
function firebaseErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  const code = (error as { code?: string } | null)?.code
  if (code && FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code]
  return 'Không xác minh được số điện thoại. Kiểm tra mạng rồi thử lại.'
}

interface PhoneVerificationFlowProps {
  initialPhone?: string
  /** Goi sau khi Firebase xac nhan OTP thanh cong, kem so dien thoai (dang dia phuong) va
   *  ID token vua lay duoc - component nay KHONG tu goi API backend, de noi dung (man gate hay
   *  dialog doi so) tu quyet dinh buoc tiep theo. */
  onVerified: (phoneLocal: string, firebaseIdToken: string) => void | Promise<void>
  /** Nut phu (vd "Bo qua" cua PhoneVerificationGatePage.tsx) hien cung hang voi nut submit
   *  cua tung buoc - PhoneChangeDialog.tsx khong truyen, khong anh huong layout cua no. */
  secondaryAction?: ReactNode
  /** Khi true, khoa initialPhone - an o nhap so va nut "Sua lai", chi con nut "Gui ma xac minh"
   *  gui thang toi so do. Dung cho buoc xac minh so HIEN TAI truoc khi cho doi sang so moi
   *  (xem PhoneChangeDialog.tsx) - so nay phai dung so dang luu trong tai khoan, khong the cho
   *  nguoi dung go tay so khac. Bat buoc kem initialPhone khi dung co nay. */
  lockPhone?: boolean
}

type Step = 'phone' | 'otp'

/**
 * Luong xac minh so dien thoai qua Firebase Phone Auth (dung tinh nang "Phone numbers for
 * testing" cua Firebase de demo, khong gui SMS that) - dung chung cho man gate sau lan dang
 * nhap dau tien (PhoneVerificationGatePage.tsx) va dialog doi so o Ho so (PhoneChangeDialog.tsx).
 */
export function PhoneVerificationFlow({ initialPhone, onVerified, secondaryAction, lockPhone }: PhoneVerificationFlowProps) {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaContainerRef = useRef<HTMLDivElement>(null)

  // Dem nguoc 60s truoc khi cho phep "Gui lai ma" - chi chay khi dang o buoc otp.
  useEffect(() => {
    if (step !== 'otp') return
    const timer = setInterval(() => {
      setResendCountdown((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  const handleSendCode = async () => {
    const trimmed = phone.trim()
    if (!PHONE_PATTERN.test(trimmed)) {
      setPhoneError('Gồm 10 chữ số, bắt đầu bằng 0.')
      return
    }
    setPhoneError('')
    setOtp('')
    setOtpError('')
    setBusy(true)
    try {
      if (!recaptchaContainerRef.current) throw new Error('missing recaptcha container')
      // Tao verifier moi cho moi lan gui - tranh tai su dung mot widget da render/het han tu
      // lan truoc (vd nguoi dung bam "Sua lai" hoac "Gui lai ma" roi gui lai).
      const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, { size: 'invisible' })
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, toE164(trimmed), verifier)
      setStep('otp')
      setResendCountdown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setPhoneError(firebaseErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmCode = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('Nhập đủ 6 chữ số.')
      return
    }
    if (!confirmationRef.current) return
    setOtpError('')
    setBusy(true)
    try {
      const credential = await confirmationRef.current.confirm(otp)
      const idToken = await credential.user.getIdToken()
      await onVerified(phone.trim(), idToken)
    } catch (error) {
      setOtpError(firebaseErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Container reCAPTCHA an hinh (size "invisible") - bat buoc phai co du la so test
          whitelist hay so that, Firebase tu dong xu ly ngam voi so whitelist. */}
      <div ref={recaptchaContainerRef} />

      {step === 'phone' && (
        lockPhone
          ? (
              <>
                <p style={{ margin: 0, color: 'var(--text-body)' }}>
                  Chúng tôi sẽ gửi mã xác minh đến số điện thoại hiện tại của bạn (<strong>{phone}</strong>)
                  để xác nhận chính bạn là người yêu cầu đổi số.
                </p>
                {phoneError && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{phoneError}</span>}
                <div className="flex items-center" style={{ justifyContent: secondaryAction ? 'space-between' : 'flex-end' }}>
                  {secondaryAction}
                  <Button variant="primary" size="md" disabled={busy} onClick={() => void handleSendCode()}>
                    {busy ? 'Đang gửi…' : 'Gửi mã xác minh'}
                  </Button>
                </div>
              </>
            )
          : (
              <>
                <Field label="Số điện thoại" error={phoneError}>
                  <Input
                    icon="phone"
                    placeholder="0901 234 567"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                    error={!!phoneError}
                    disabled={busy}
                  />
                </Field>
                <div className="flex items-center" style={{ justifyContent: secondaryAction ? 'space-between' : 'flex-end' }}>
                  {secondaryAction}
                  <Button variant="primary" size="md" disabled={busy} onClick={() => void handleSendCode()}>
                    {busy ? 'Đang gửi…' : 'Gửi mã xác minh'}
                  </Button>
                </div>
              </>
            )
      )}

      {step === 'otp' && (
        <>
          <p style={{ margin: 0, color: 'var(--text-body)' }}>
            Chúng tôi đã gửi mã xác minh đến <strong>{phone.trim()}</strong>.{' '}
            {!lockPhone && (
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setOtpError('') }}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)', textDecoration: 'underline' }}
              >
                Sửa lại
              </button>
            )}
          </p>
          <p style={{ margin: 0, color: 'var(--text-body)' }}>
            {resendCountdown > 0 ? (
              `Gửi lại mã sau ${resendCountdown}s.`
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSendCode()}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)', textDecoration: 'underline' }}
              >
                Gửi lại mã
              </button>
            )}
          </p>
          <Field label="Mã xác minh" error={otpError}>
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
          <div className="flex items-center" style={{ justifyContent: secondaryAction ? 'space-between' : 'flex-end' }}>
            {secondaryAction}
            <Button variant="primary" size="md" disabled={busy || otp.length < 6} onClick={() => void handleConfirmCode()}>
              {busy ? 'Đang xác minh…' : 'Xác nhận'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
