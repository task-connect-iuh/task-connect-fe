import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { confirmGoogleLink, decodeGoogleEmail, loginWithGoogle } from '../../api/auth.ts'
import type { TokenResponse } from '../../api/auth.ts'
import { ApiError } from '../../api/client.ts'

// Chieu rong toi da @react-oauth/google cho phep custom qua prop "width" (gioi han cung cua
// Google, khong the vuot qua theo cach chinh thong) va chieu cao xap xi cua nut size="large"
// o chieu rong do - dung lam mau goc de scale CSS, xem ScaledGoogleLogin ben duoi.
const GOOGLE_BUTTON_BASE_WIDTH = 400
const GOOGLE_BUTTON_BASE_HEIGHT = 40
// Chieu cao nut chinh (Button size="lg", --control-h-lg trong spacing.css) - tran tren cho
// chieu cao nut Google sau khi scale, tranh scale het theo chieu rong form se ra qua to/qua
// cao so voi nut "Dang nhap"/"Dang ky" ben canh (form cang rong thi ty le 400:40 cua Google
// cang lech xa ty le thuc te cua Button).
const PRIMARY_BUTTON_HEIGHT = 56

/**
 * Boc nut Google chinh thuc (KHONG thay bang nut tu dung goi google.accounts.id.prompt() tu
 * su kien click - da thu va bo trong phien nay: prompt() (One Tap) chi dang nhap ngam duoc
 * cho nguoi DA SAN phien Google trong trinh duyet, khong phai nut dang nhap day du. Voi nguoi
 * chua dang nhap Google san (trinh duyet moi, che do an danh...), Google tra ve "Provider's
 * accounts list is empty" va prompt() luon luon skip - khong phai rui ro hiem, ma la hong han
 * voi phan lon nguoi dung chua co phien san. Nut GoogleLogin chinh thuc ben duoi dung co che
 * khac (mo cua so dang nhap Google day du), hoat dong dung cho MOI nguoi dung ke ca chua tung
 * dang nhap Google - danh doi la khong custom duoc text/bo goc tuy y, xem ghi chu tren
 * GoogleAuthButtonProps.text).
 */
function ScaledGoogleLogin(props: { onSuccess: (c: CredentialResponse) => void, onError: () => void, text: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (!width) return
      const widthScale = width / GOOGLE_BUTTON_BASE_WIDTH
      const heightCapScale = PRIMARY_BUTTON_HEIGHT / GOOGLE_BUTTON_BASE_HEIGHT
      setScale(Math.min(widthScale, heightCapScale))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: GOOGLE_BUTTON_BASE_HEIGHT * scale, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: GOOGLE_BUTTON_BASE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <GoogleLogin
          onSuccess={props.onSuccess}
          onError={props.onError}
          size="large"
          width={GOOGLE_BUTTON_BASE_WIDTH}
          text={props.text}
          // Google tu ve nut nay qua renderButton(), khong phai DOM minh style duoc - chi
          // chon duoc 1 trong 4 kieu dung san (rectangular/pill/circle/square), khong co muc
          // bo goc tuy y nhu --r-lg (16px) cua 2 nut "Dang nhap"/"Dang ky". "rectangular" la
          // kieu gan voi bo goc cua Button nhat trong 4 lua chon, khong the khop tuyet doi.
          shape="rectangular"
        />
      </div>
    </div>
  )
}

interface GoogleAuthButtonProps {
  /** Dang nhap Google thanh cong (truc tiep hoac sau khi xac nhan lien ket) - trang cha tu
   *  set session va dieu huong, giong het nhanh thanh cong cua dang nhap bang mat khau. */
  onSuccess: (tokens: TokenResponse) => void
  /** Loi khong phai "can xac nhan lien ket" (token khong hop le, tai khoan bi khoa/dinh chi...)
   *  - trang cha tu quyet dinh hien thi the nao, giong het cach xu ly loi dang nhap mat khau. */
  onError: (error: unknown) => void
  /** Nhan nut Google: "continue_with" (Dang nhap, mac dinh) hoac "signup_with" (Dang ky) -
   *  Google tu dich/hien theo ngon ngu trinh duyet ("Tiếp tục với Google" ~ hoac ban dai hon
   *  "Tiếp tục sử dụng dịch vụ bằng Google" tuy phien ban GSI; "Đăng ký bằng Google" khop dung
   *  design). Chi 4 gia tri co dinh Google cho phep, khong custom duoc chuoi tuy y. */
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

/**
 * Nut "Tiep tuc voi Google" dung chung cho LoginPage va RegisterPage, tu quan ly ca buoc xac
 * nhan lien ket tai khoan khi email trung mot tai khoan mat khau da co san (xem
 * AuthService.loginWithGoogle() o backend - khong tu lien ket ngam dinh nua).
 *
 * Hai che do hien thi:
 * - "idle" (mac dinh): divider "hoac" (bam sat token mau/spacing cua AuthScreens.dc.html) roi
 *   toi nut Google chinh thuc, boc qua ScaledGoogleLogin de scale CSS to bang dung chieu rong
 *   nut "Dang nhap"/"Dang ky" - van la nut that cua Google, khong tu ve lai giao dien.
 * - "confirm": panel hoi lai kieu GitHub ("Add new sign in method"), chi hien email (decode
 *   ngay tu ID token vua nhan, khong qua backend) - KHONG bao gio hien bat ky thong tin gi ve
 *   mat khau (bcrypt la hash mot chieu, khong the suy nguoc, va he lo du mot phan mat khau
 *   that van la anti-pattern bao mat).
 */
export function GoogleAuthButton({ onSuccess, onError, text = 'continue_with' }: GoogleAuthButtonProps) {
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleCredential = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential
    if (!idToken) return

    setBusy(true)
    try {
      const tokens = await loginWithGoogle(idToken)
      onSuccess(tokens)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH-409-GOOGLE_LINK_CONFIRMATION_REQUIRED') {
        // Khong tu goi lai lan nua - cho nguoi dung bam "Lien ket tai khoan" o panel confirm.
        setPendingIdToken(idToken)
        setPendingEmail(decodeGoogleEmail(idToken))
      } else {
        onError(error)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmLink = async () => {
    if (!pendingIdToken) return
    setBusy(true)
    try {
      const tokens = await confirmGoogleLink(pendingIdToken)
      onSuccess(tokens)
    } catch (error) {
      onError(error)
    } finally {
      setBusy(false)
      setPendingIdToken(null)
      setPendingEmail(null)
    }
  }

  const cancelLink = () => {
    setPendingIdToken(null)
    setPendingEmail(null)
  }

  if (pendingIdToken) {
    return (
      <Alert tone="info" title="Email này đã có tài khoản">
        <div className="flex flex-col gap-3">
          <p className="m-0">
            {pendingEmail ? <strong>{pendingEmail}</strong> : 'Email Google này'} đã có tài khoản trên
            TaskConnect. Bạn có muốn bật đăng nhập bằng Google cho tài khoản này không?
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="md" block disabled={busy} onClick={handleConfirmLink}>
              {busy ? 'Đang liên kết…' : 'Liên kết tài khoản'}
            </Button>
            <button
              type="button"
              onClick={cancelLink}
              disabled={busy}
              style={{ alignSelf: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        hoặc
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <ScaledGoogleLogin
        onSuccess={handleCredential}
        onError={() => onError(new Error('Không kết nối được với Google. Vui lòng thử lại.'))}
        text={text}
      />
    </div>
  )
}
