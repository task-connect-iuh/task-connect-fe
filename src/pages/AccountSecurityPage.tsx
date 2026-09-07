import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { Icon } from '@ds/components/core/Icon'
import { AppShell } from '../components/AppShell.tsx'
import { EmailChangeDialog } from '../components/EmailChangeDialog.tsx'
import { PasswordInput } from '../features/auth/PasswordInput.tsx'
import { getMyProfile } from '../api/users.ts'
import { changePassword } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { useProfileStore } from '../stores/useProfileStore.ts'
import { useToastStore } from '../stores/useToastStore.ts'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

/**
 * Tai khoan & bao mat - tach rieng khoi ProfilePage (UC03) vi day la thong tin dang nhap
 * dung chung cho moi vai tro (poster/tasker deu cung mot email/mat khau), khac han "thong
 * tin ca nhan" hien theo tung vai tro o ProfilePage. Doi mat khau/email deu la thao tac co
 * xac thuc rieng (mat khau hien tai, hoac OTP hai buoc voi email) nen o day chi hien gia
 * tri dang che (email that, mat khau dang ***) va CHI mo form/dialog khi bam nut - khong co
 * "che do sua" thuong truc nhu ProfilePage.
 */
export function AccountSecurityPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{ currentPassword?: string, newPassword?: string, confirm?: string }>({})
  const [passwordFormError, setPasswordFormError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyProfile()
      .then((profile) => {
        if (cancelled) return
        setEmail(profile.email)
        // Dong bo store dung chung voi AppShell/ProfilePage - tranh goi lai GET /users/me
        // neu nguoi dung quay lai trang Ho so ngay sau do.
        useProfileStore.getState().setProfile(profile)
      })
      .catch((error) => {
        if (cancelled) return
        if (!(error instanceof ApiError && error.code === 'USR-404-PROFILE_NOT_FOUND')) {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được thông tin tài khoản. Kiểm tra mạng rồi thử lại.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const resetPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordErrors({})
    setPasswordFormError('')
    setShowPassword(false)
  }

  /**
   * Doi mat khau khi da dang nhap - can mat khau hien tai, khac han luong "quen mat khau"
   * (dung OTP email, khong dang nhap). Backend thu hoi toan bo refresh token sau khi doi
   * thanh cong (xem AuthService.changePassword), nen FE tu logout va dua ve /dang-nhap.
   */
  const handleChangePassword = async () => {
    const nextErrors: typeof passwordErrors = {}
    if (!currentPassword) nextErrors.currentPassword = 'Nhập mật khẩu hiện tại.'
    if (!newPassword) nextErrors.newPassword = 'Nhập mật khẩu mới.'
    else if (!PASSWORD_PATTERN.test(newPassword)) nextErrors.newPassword = 'Cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số.'
    if (!confirmNewPassword) nextErrors.confirm = 'Nhập lại mật khẩu mới.'
    else if (confirmNewPassword !== newPassword) nextErrors.confirm = 'Hai mật khẩu chưa khớp nhau.'
    setPasswordErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setPasswordFormError('')
    setPasswordBusy(true)
    try {
      await changePassword({ currentPassword, newPassword, confirmNewPassword })
      useAuthStore.getState().logout()
      navigate('/dang-nhap', { state: { justReset: true }, replace: true })
    } catch (error) {
      setPasswordFormError(error instanceof ApiError ? error.message : 'Không đổi được mật khẩu. Kiểm tra mạng rồi thử lại.')
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <AppShell navValue="profile" title="Tài khoản & bảo mật" subtitle="Email đăng nhập và mật khẩu — dùng chung cho mọi vai trò trên tài khoản này">
      <div style={{ maxWidth: 'var(--content-max)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <Link to="/ho-so" className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)', width: 'fit-content' }}>
          <Icon name="arrow-left" size={16} />Quay lại hồ sơ
        </Link>

        {loadError && <Alert tone="danger" title="Không tải được thông tin">{loadError}</Alert>}

        {!loading && !loadError && (
          <>
            <Alert tone="warning" title="Đổi email hoặc mật khẩu cần xác minh lại">
              Đổi mật khẩu sẽ đăng xuất bạn khỏi thiết bị này. Đổi email cần xác minh cả email hiện tại và email mới.
            </Alert>

            <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <strong style={{ fontSize: 'var(--fs-h3)' }}>Email đăng nhập</strong>
              <Field label="Email" hint="Nhận biên nhận và thông báo bảo mật.">
                <div className="flex gap-3 items-center flex-wrap">
                  <Input style={{ flex: 1, minWidth: 200 }} value={email ?? ''} readOnly disabled />
                  <Button variant="secondary" size="md" icon="shield-check" onClick={() => setShowEmailChangeDialog(true)}>
                    Đổi email
                  </Button>
                </div>
              </Field>
            </Card>

            <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div className="flex flex-col gap-1">
                <strong style={{ fontSize: 'var(--fs-h3)' }}>Mật khẩu</strong>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đổi xong bạn sẽ cần đăng nhập lại trên thiết bị này.</span>
              </div>

              {!showPasswordForm
                ? (
                    <Field label="Mật khẩu">
                      <div className="flex gap-3 items-center flex-wrap">
                        <Input style={{ flex: 1, minWidth: 200 }} type="password" value="••••••••••" readOnly disabled />
                        <Button variant="secondary" size="md" icon="key-round" onClick={() => setShowPasswordForm(true)}>
                          Đổi mật khẩu
                        </Button>
                      </div>
                    </Field>
                  )
                : (
                    <div className="flex flex-col gap-4" onKeyDown={(e) => { if (e.key === 'Enter' && !passwordBusy) void handleChangePassword() }}>
                      {passwordFormError && <Alert tone="danger" title="Không đổi được mật khẩu">{passwordFormError}</Alert>}
                      <PasswordInput
                        label="Mật khẩu hiện tại"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        error={passwordErrors.currentPassword}
                        disabled={passwordBusy}
                        show={showPassword}
                        onToggleShow={() => setShowPassword((v) => !v)}
                      />
                      <PasswordInput
                        label="Mật khẩu mới"
                        placeholder="Ít nhất 8 ký tự, có chữ hoa, chữ thường và số"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        error={passwordErrors.newPassword}
                        disabled={passwordBusy}
                        show={showPassword}
                        onToggleShow={() => setShowPassword((v) => !v)}
                      />
                      <PasswordInput
                        label="Nhập lại mật khẩu mới"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        error={passwordErrors.confirm}
                        disabled={passwordBusy}
                        show={showPassword}
                        onToggleShow={() => setShowPassword((v) => !v)}
                      />
                      <div className="flex gap-3">
                        <Button variant="primary" size="lg" disabled={passwordBusy} onClick={handleChangePassword}>
                          {passwordBusy ? 'Đang đổi…' : 'Đổi mật khẩu'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="lg"
                          disabled={passwordBusy}
                          onClick={() => { resetPasswordForm(); setShowPasswordForm(false) }}
                        >
                          Huỷ
                        </Button>
                      </div>
                    </div>
                  )}
            </Card>
          </>
        )}
      </div>

      {showEmailChangeDialog && email && (
        <EmailChangeDialog
          currentEmail={email}
          onClose={() => setShowEmailChangeDialog(false)}
          onChanged={(newEmail) => {
            setEmail(newEmail)
            setShowEmailChangeDialog(false)
            useToastStore.getState().pushToast('success', 'Đã đổi email thành công.')
          }}
        />
      )}
    </AppShell>
  )
}
