import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { Textarea } from '@ds/components/forms/Textarea'
import { AppShell } from '../components/AppShell.tsx'
import { LocationPickerMap } from '../components/LocationPickerMap.tsx'
import { PasswordInput } from '../features/auth/PasswordInput.tsx'
import { createAvatarUploadUrl, getMyProfile, updateMyProfile } from '../api/users.ts'
import type { ProfileResponse } from '../api/users.ts'
import { changePassword } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { useProfileStore } from '../stores/useProfileStore.ts'
import { reverseGeocode } from '../utils/geocoding.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

// Whitelist khop dung common/storage/ImageContentTypes.java (avatar dung chung whitelist nay).
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Ho so ca nhan cua chinh minh - UC03. GET /users/me nem USR-404-PROFILE_NOT_FOUND neu chua
 * tung PATCH lan nao (lazy-create o backend, xem docs/PROGRESS-USER-MODULE.md Buoc 1) - man
 * nay coi truong hop do la "chua co ho so", hien form rong thay vi bao loi. Anh dai dien chi
 * upload len S3 ngay khi chon (public-read, xem ADR-003), nhung chi thuc su luu vao ho so khi
 * bam "Lưu thay đổi" cung cac truong khac - tranh PATCH rieng avatarUrl bi tu choi vi thieu
 * fullName/operatingArea bat buoc o lan tao ho so dau tien.
 */
export function ProfilePage() {
  const navigate = useNavigate()
  const accountId = useAuthStore((state) => state.session?.account.id)

  const [loading, setLoading] = useState(true)
  const [isNewProfile, setIsNewProfile] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [addressText, setAddressText] = useState('')
  const [bio, setBio] = useState('')
  const [operatingArea, setOperatingArea] = useState('')
  const [locationLat, setLocationLat] = useState('')
  const [locationLng, setLocationLng] = useState('')
  // Tang moi lan 1 lan chon toa do bi tu choi (ngoai Viet Nam/loi mang) - bao LocationPickerMap
  // keo ghim tro lai vi dung du lat/lng khong doi gia tri, xem LocationPickerMap.tsx.
  const [locationResetSignal, setLocationResetSignal] = useState(0)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string, operatingArea?: string }>({})
  const [formError, setFormError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{ currentPassword?: string, newPassword?: string, confirm?: string }>({})
  const [passwordFormError, setPasswordFormError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const applyProfile = (profile: ProfileResponse) => {
    setFullName(profile.fullName ?? '')
    setAvatarUrl(profile.avatarUrl)
    setAddressText(profile.addressText ?? '')
    setBio(profile.bio ?? '')
    setOperatingArea(profile.operatingArea ?? '')
    setLocationLat(profile.locationLat != null ? String(profile.locationLat) : '')
    setLocationLng(profile.locationLng != null ? String(profile.locationLng) : '')
    // Dong bo sang store dung chung de AppShell hien dung avatar/ten tren thanh tren ngay,
    // khong doi trang sau moi hien lai dung.
    useProfileStore.getState().setProfile(profile)
  }

  useEffect(() => {
    let cancelled = false
    getMyProfile()
      .then((profile) => {
        if (cancelled) return
        applyProfile(profile)
        setIsNewProfile(false)
      })
      .catch((error) => {
        if (cancelled) return
        if (error instanceof ApiError && error.code === 'USR-404-PROFILE_NOT_FOUND') {
          setIsNewProfile(true)
        } else {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được hồ sơ. Kiểm tra mạng rồi thử lại.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleAvatarSelect = async (file: File) => {
    setAvatarError('')
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Chỉ nhận ảnh JPEG, PNG hoặc WEBP.')
      return
    }
    setAvatarUploading(true)
    try {
      const { uploadUrl, publicUrl } = await createAvatarUploadUrl(file.type)
      await uploadFileToPresignedUrl(uploadUrl, file)
      setAvatarUrl(publicUrl)
    } catch (error) {
      setAvatarError(error instanceof ApiError || error instanceof Error ? error.message : 'Tải ảnh lên thất bại.')
    } finally {
      setAvatarUploading(false)
    }
  }

  /**
   * Ap dung 1 toa do vua chon (tu ban do, keo ghim, hoac nut "Dung vi tri hien tai") - CHI
   * luu vao "Toa do"/"Dia chi"/"Khu vuc hoat dong" SAU KHI xac nhan qua reverse geocode la
   * toa do nam trong Viet Nam (xem utils/geocoding.ts "supported"). Ngoai Viet Nam (bien,
   * nuoc khac) hoac loi mang khong xac minh duoc: khong doi field nao ca, chi bao loi va keo
   * ghim tro ve vi tri hop le gan nhat qua resetSignal - ung dung chi co y nghia nghiep vu
   * trong pham vi Viet Nam (01-domain-glossary.md, 5 nhom dich vu dien-nuoc noi dia).
   */
  const applyPickedLocation = async (latValue: number, lngValue: number) => {
    setGeocodeError('')
    setGeocoding(true)
    try {
      const result = await reverseGeocode(latValue, lngValue)
      if (!result.supported) {
        setGeocodeError('Vị trí này nằm ngoài phạm vi hỗ trợ — ứng dụng chỉ hỗ trợ khu vực Việt Nam. Toạ độ chưa được lưu, bạn chọn lại vị trí khác trên bản đồ.')
        setLocationResetSignal((n) => n + 1)
        return
      }
      setLocationLat(latValue.toFixed(6))
      setLocationLng(lngValue.toFixed(6))
      if (result.addressText) setAddressText(result.addressText)
      if (result.operatingArea) setOperatingArea(result.operatingArea)
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : 'Không xác minh được khu vực do lỗi mạng. Toạ độ chưa được lưu, thử lại.')
      setLocationResetSignal((n) => n + 1)
    } finally {
      setGeocoding(false)
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Trình duyệt này không hỗ trợ lấy vị trí hiện tại.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => void applyPickedLocation(position.coords.latitude, position.coords.longitude),
      () => setFormError('Không lấy được vị trí hiện tại. Bạn nhập tay hoặc thử lại.'),
    )
  }

  const handleSubmit = async () => {
    const nextErrors: typeof fieldErrors = {}
    if (!fullName.trim()) nextErrors.fullName = 'Nhập họ tên.'
    if (!operatingArea.trim()) nextErrors.operatingArea = 'Nhập khu vực hoạt động.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setFormError('')
    setSavedMessage('')
    setBusy(true)
    try {
      const updated = await updateMyProfile({
        fullName: fullName.trim(),
        avatarUrl: avatarUrl ?? undefined,
        addressText: addressText.trim() || undefined,
        bio: bio.trim() || undefined,
        operatingArea: operatingArea.trim(),
        locationLat: locationLat.trim() ? Number(locationLat) : undefined,
        locationLng: locationLng.trim() ? Number(locationLng) : undefined,
      })
      applyProfile(updated)
      setIsNewProfile(false)
      setSavedMessage('Đã lưu hồ sơ.')
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Không lưu được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Doi mat khau khi da dang nhap - can mat khau hien tai, khac han luong "quen mat khau"
   * (dung OTP email, khong dang nhap). Backend thu hoi toan bo refresh token sau khi doi
   * thanh cong (xem AuthService.changePassword), nen FE tu logout va dua ve /dang-nhap,
   * khong the tiep tuc dung phien hien tai vi cookie refresh_token da bi vo hieu.
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
    <AppShell navValue="profile" title="Hồ sơ cá nhân" subtitle="Thông tin này hiển thị khi bạn đăng việc hoặc nhận việc">
      {loading
        ? null
        : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,var(--content-max)) 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
            <div className="flex flex-col gap-6">
              {loadError && <Alert tone="danger" title="Không tải được hồ sơ">{loadError}</Alert>}
              {isNewProfile && (
                <Alert tone="info" title="Bạn chưa có hồ sơ">
                  Điền thông tin bên dưới và lưu lại để tạo hồ sơ lần đầu.
                </Alert>
              )}
              {formError && <Alert tone="danger" title="Không lưu được hồ sơ">{formError}</Alert>}
              {savedMessage && <Alert tone="success" title={savedMessage} />}

              <Card padding="var(--sp-6)" style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center' }}>
                <div className="relative flex-none">
                  <Avatar name={fullName || 'Chưa đặt tên'} src={avatarUrl ?? undefined} size={80} />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <Button variant="secondary" size="sm" icon="image-up" disabled={avatarUploading} onClick={() => document.getElementById('avatar-file-input')?.click()}>
                    {avatarUploading ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}
                  </Button>
                  <input
                    id="avatar-file-input"
                    type="file"
                    accept={ALLOWED_AVATAR_TYPES.join(',')}
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleAvatarSelect(file)
                      e.target.value = ''
                    }}
                  />
                  {avatarError && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{avatarError}</span>}
                  {accountId && (
                    <Link to={`/ho-so/${accountId}`} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)' }}>
                      Xem hồ sơ công khai của bạn
                    </Link>
                  )}
                </div>
              </Card>

              <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <Field label="Họ và tên" required error={fieldErrors.fullName}>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} error={!!fieldErrors.fullName} />
                </Field>

                <Field label="Khu vực hoạt động" required error={fieldErrors.operatingArea} hint="Ví dụ: Quận 3, TP. Hồ Chí Minh">
                  <Input value={operatingArea} onChange={(e) => setOperatingArea(e.target.value)} disabled={busy} error={!!fieldErrors.operatingArea} />
                </Field>

                <Field label="Địa chỉ" hint="Không bắt buộc, chỉ bạn nhìn thấy">
                  <Textarea rows={2} value={addressText} onChange={(e) => setAddressText(e.target.value)} disabled={busy} />
                </Field>

                <Field label="Giới thiệu bản thân" hint="Không bắt buộc, hiển thị công khai trên hồ sơ của bạn">
                  <Textarea rows={4} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} disabled={busy} />
                </Field>

                <Field label="Toạ độ" hint="Chọn trên bản đồ bên phải hoặc dùng vị trí hiện tại — không gõ tay được. Không bắt buộc.">
                  <div className="flex gap-3 items-start flex-wrap">
                    <Input
                      style={{ maxWidth: 160 }}
                      placeholder="Vĩ độ"
                      numeric
                      value={locationLat}
                      readOnly
                      disabled={busy}
                    />
                    <Input
                      style={{ maxWidth: 160 }}
                      placeholder="Kinh độ"
                      numeric
                      value={locationLng}
                      readOnly
                      disabled={busy}
                    />
                    <Button variant="ghost" size="md" icon="locate-fixed" onClick={handleUseCurrentLocation} disabled={busy}>
                      Dùng vị trí hiện tại
                    </Button>
                  </div>
                  {geocoding && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Đang tra địa chỉ từ toạ độ…</span>
                  )}
                  {geocodeError && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{geocodeError}</span>
                  )}
                </Field>

                <Button variant="primary" size="lg" disabled={busy} onClick={handleSubmit} style={{ alignSelf: 'flex-start' }}>
                  {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                </Button>
              </Card>

              <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <div className="flex flex-col gap-1">
                  <strong style={{ fontSize: 'var(--fs-h3)' }}>Đổi mật khẩu</strong>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đổi xong bạn sẽ cần đăng nhập lại trên thiết bị này.</span>
                </div>

                {passwordFormError && <Alert tone="danger" title="Không đổi được mật khẩu">{passwordFormError}</Alert>}

                <div className="flex flex-col gap-4" onKeyDown={(e) => { if (e.key === 'Enter' && !passwordBusy) void handleChangePassword() }}>
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
                  <Button variant="secondary" size="lg" disabled={passwordBusy} onClick={handleChangePassword} style={{ alignSelf: 'flex-start' }}>
                    {passwordBusy ? 'Đang đổi…' : 'Đổi mật khẩu'}
                  </Button>
                </div>
              </Card>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', position: 'sticky', top: 'var(--sp-5)' }}>
              <Card padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div className="tc-label">Chọn vị trí trên bản đồ</div>
                <LocationPickerMap
                  lat={locationLat.trim() ? Number(locationLat) : null}
                  lng={locationLng.trim() ? Number(locationLng) : null}
                  resetSignal={locationResetSignal}
                  onPick={(pickedLat, pickedLng) => void applyPickedLocation(pickedLat, pickedLng)}
                />
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Bấm vào bản đồ hoặc kéo ghim để chọn vị trí — hệ thống tự điền "Địa chỉ" và
                  "Khu vực hoạt động", bạn sửa lại được nếu chưa đúng.
                </p>
              </Card>
            </div>
            </div>
          )}
    </AppShell>
  )
}
