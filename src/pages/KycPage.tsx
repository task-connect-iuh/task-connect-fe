import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Checkbox } from '@ds/components/forms/Checkbox'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Dialog } from '@ds/components/feedback/Dialog'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { IconButton } from '@ds/components/core/IconButton'
import { Input } from '@ds/components/forms/Input'
import { Select } from '@ds/components/forms/Select'
import { KycStatus } from '@ds/components/marketplace/KycStatus'
import { LifecycleTracker } from '@ds/components/marketplace/LifecycleTracker'
import type { LifecycleStep } from '@ds/components/marketplace/LifecycleTracker'
import { AppShell } from '../components/AppShell.tsx'
import { FileDropzone } from '../components/FileDropzone.tsx'
import { cancelMyKyc, createKycUploadUrl, getMyLatestKyc, getMyLatestKycDetail, submitKyc } from '../api/users.ts'
import type { Gender, KycDetailResponse, KycStatusResponse } from '../api/users.ts'
import { ApiError } from '../api/client.ts'
import { useProfileStore } from '../stores/useProfileStore.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'
import { formatDate } from '../utils/formatDate.ts'
import { toTitleCase } from '../utils/formatName.ts'

// Whitelist khop dung common/storage/ImageContentTypes.java.
const ALLOWED_ID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ID_NUMBER_PATTERN = /^\d{9}$|^\d{12}$/
const GENDER_OPTIONS: { value: Gender, label: string }[] = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
]
const GENDER_LABEL: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' }

// 4 buoc mo phong tien trinh nop KYC, dung cho LifecycleTracker o rail ben phai - khop STEPS
// cua @ds/ui_kits/tasker/KycScreen.jsx (man hinh tham chieu chuan cho UC05).
const KYC_STEPS: LifecycleStep[] = [
  { key: 'form', label: 'Nhập thông tin', icon: 'user-round-pen' },
  { key: 'doc', label: 'Tải ảnh CCCD', icon: 'id-card' },
  { key: 'review', label: 'Chờ duyệt', icon: 'shield-question' },
  { key: 'done', label: 'Được duyệt', icon: 'shield-check' },
]

/** Chi so buoc hien tai cho LifecycleTracker - VERIFYING dang o "Cho duyet", VERIFIED xong het 4 buoc, con lai (chua nop/REJECTED/CANCELLED) dang o buoc dau "Nhap thong tin". */
function kycStepIndex(status: KycStatusResponse['status'] | null): number {
  switch (status) {
    case 'VERIFYING': return 2
    case 'VERIFIED': return 4
    default: return 0
  }
}

/** Che giua so CCCD/CMND, chi lo 6 so dau va 2 so cuoi - vd "079203004512" -> "079203••••12". */
function maskIdNumber(value: string): string {
  if (value.length <= 8) return value
  return `${value.slice(0, 6)}${'•'.repeat(value.length - 8)}${value.slice(-2)}`
}

/** Ngay hom nay theo gio dia phuong trinh duyet, dang "yyyy-mm-dd" - dung lam max cho <input type="date"> ngay sinh (khop @Past o SubmitKycRequest, khong cho chon ngay tuong lai). */
function todayDateString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Ngay gio day du theo locale vi-VN - dung cho subtitle Dialog "Xem hồ sơ đã gửi" (khac formatDate, chi lay ngay). */
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN')
}

/** state cua KycStatus (@ds/components/marketplace/KycStatus) - khong khop 1-1 ten voi KycStatus BE. CANCELLED roi ve 'unverified' vi component thiet ke chi co 4 trang thai, va CANCELLED cho nop lai giong het chua tung nop. */
function toKycStatusState(status: KycStatusResponse['status'] | null): 'unverified' | 'pending' | 'approved' | 'rejected' {
  switch (status) {
    case 'VERIFYING': return 'pending'
    case 'VERIFIED': return 'approved'
    case 'REJECTED': return 'rejected'
    default: return 'unverified'
  }
}

/**
 * Xac thuc danh tinh (KYC) - UC05, trang rieng. Truoc day gop chung vao dau TaskerSkillsPage
 * (mot muc nav duy nhat) roi tach lai thanh trang/route rieng theo yeu cau tach giao dien -
 * xem AppShell.tsx (nav "kyc") va App.tsx (route "/xac-thuc-danh-tinh"). Logic gate giu dung
 * nhu ban gop truoc do: canSubmit = chua tung nop HOAC REJECTED HOAC CANCELLED (chinh chu tu
 * huy) - khop KycVerificationService o BE. VERIFYING cho huy (cancelMyKyc, khoa pessimistic o
 * BE tranh dua voi Admin duyet/tu choi cung luc). Chi Tasker vao duoc (RoleGuard o App.tsx).
 */
export function KycPage() {
  const profile = useProfileStore((state) => state.profile)
  const [loading, setLoading] = useState(true)
  const [latest, setLatest] = useState<KycStatusResponse | null>(null)
  const [loadError, setLoadError] = useState('')

  const [fullNameOnId, setFullNameOnId] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [idNumber, setIdNumber] = useState('')
  const [frontFile, setFrontFile] = useState<{ name: string, key: string } | null>(null)
  const [backFile, setBackFile] = useState<{ name: string, key: string } | null>(null)
  // Object URL cuc bo (URL.createObjectURL) de xem truoc anh CCCD vua chon - khac object
  // key tren S3 (frontFile.key), chi song trong trinh duyet, phai revoke khi thay hoac nop xong.
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null)
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null)
  const [uploadingSide, setUploadingSide] = useState<'FRONT' | 'BACK' | null>(null)
  // "agree" chi la cong tac o client (giong checkbox dieu khoan o RegisterPage) - khong gui
  // len BE, chi khoa nut gui cho den khi nguoi dung xac nhan anh/thong tin la cua ho.
  const [agree, setAgree] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ fullNameOnId?: string, dateOfBirth?: string, gender?: string, idNumber?: string, front?: string, back?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const [detail, setDetail] = useState<KycDetailResponse | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // Chi tiet ho so khi da VERIFIED - dung de hien Card "Thong tin da duoc duyet" day du (ho
  // ten/so CCCD/ngay sinh) thay vi chi mot Badge don gian. Tai rieng (khong dung chung voi
  // dialog "Xem hồ sơ đã gửi" o tren) vi VERIFIED khong con nut mo dialog do.
  const [verifiedDetail, setVerifiedDetail] = useState<KycDetailResponse | null>(null)

  // Trinh xem anh CCCD phong to/thu nho/xoay - mo khi bam vao anh trong dialog "Xem hồ sơ đã
  // gửi". viewerUrl null nghia la dang dong. Reset zoom/xoay ve mac dinh moi lan mo anh khac.
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerZoom, setViewerZoom] = useState(1)
  const [viewerRotation, setViewerRotation] = useState(0)

  const refresh = () => {
    setLoading(true)
    getMyLatestKyc()
      .then((response) => setLatest(response))
      .catch((error) => {
        if (error instanceof ApiError && error.code === 'USR-404-KYC_NOT_FOUND') {
          setLatest(null)
        } else {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được trạng thái xác thực. Kiểm tra mạng rồi thử lại.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  useEffect(() => {
    if (latest?.status !== 'VERIFIED') return
    getMyLatestKycDetail().then(setVerifiedDetail).catch(() => {})
  }, [latest?.status])

  const canSubmit = !latest || latest.status === 'REJECTED' || latest.status === 'CANCELLED'

  // Chi so buoc cho LifecycleTracker: khi form dang hien (canSubmit), phan anh tien do dien
  // tai cho tren client (chua co gi de hoi server) thay vi dung mai o buoc 0 cho den luc nop
  // that su - nguoi dung phan anh dung la dien xong thong tin/anh van thay tracker khong nhuc
  // nhich. Sau khi da nop that (khong con canSubmit), quay lai dung trang thai server qua
  // kycStepIndex(latest.status).
  const infoFilled = fullNameOnId.trim() !== '' && dateOfBirth !== '' && !!gender && ID_NUMBER_PATTERN.test(idNumber.trim())
  const imagesUploaded = !!frontFile && !!backFile
  const trackerStep = !canSubmit
    ? kycStepIndex(latest ? latest.status : null)
    : infoFilled && imagesUploaded ? 2 : infoFilled ? 1 : 0

  const handleCancel = async () => {
    if (!latest) return
    setCancelBusy(true)
    setCancelError('')
    try {
      await cancelMyKyc(latest.id)
      setShowCancelConfirm(false)
      useToastStore.getState().pushToast('success', 'Đã huỷ hồ sơ xác minh danh tính.')
      refresh()
    } catch (error) {
      setCancelError(error instanceof ApiError ? error.message : 'Không huỷ được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setCancelBusy(false)
    }
  }

  const openImageViewer = (url: string) => {
    setViewerUrl(url)
    setViewerZoom(1)
    setViewerRotation(0)
  }
  const closeImageViewer = () => setViewerUrl(null)
  const zoomIn = () => setViewerZoom((zoom) => Math.min(3, zoom + 0.25))
  const zoomOut = () => setViewerZoom((zoom) => Math.max(1, zoom - 0.25))
  const rotateImage = () => setViewerRotation((rotation) => (rotation + 90) % 360)

  const openDetail = () => {
    setDetailOpen(true)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    getMyLatestKycDetail()
      .then(setDetail)
      .catch((error) => setDetailError(error instanceof ApiError ? error.message : 'Không tải được hồ sơ đã gửi. Kiểm tra mạng rồi thử lại.'))
      .finally(() => setDetailLoading(false))
  }

  const handleUpload = async (side: 'FRONT' | 'BACK', file: File) => {
    setFieldErrors((prev) => ({ ...prev, [side === 'FRONT' ? 'front' : 'back']: undefined }))
    if (!ALLOWED_ID_IMAGE_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, [side === 'FRONT' ? 'front' : 'back']: 'Chỉ nhận ảnh JPEG, PNG hoặc WEBP.' }))
      return
    }
    const preview = URL.createObjectURL(file)
    if (side === 'FRONT') {
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl)
      setFrontPreviewUrl(preview)
    } else {
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl)
      setBackPreviewUrl(preview)
    }
    setUploadingSide(side)
    try {
      const { uploadUrl, objectKey } = await createKycUploadUrl(side, file.type)
      await uploadFileToPresignedUrl(uploadUrl, file)
      const picked = { name: file.name, key: objectKey }
      if (side === 'FRONT') setFrontFile(picked)
      else setBackFile(picked)
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : 'Tải ảnh lên thất bại.'
      setFieldErrors((prev) => ({ ...prev, [side === 'FRONT' ? 'front' : 'back']: message }))
    } finally {
      setUploadingSide(null)
    }
  }

  const handleSubmit = async () => {
    const nextErrors: typeof fieldErrors = {}
    if (!fullNameOnId.trim()) nextErrors.fullNameOnId = 'Nhập họ tên đúng như trên CCCD.'
    if (!dateOfBirth) nextErrors.dateOfBirth = 'Chọn ngày sinh.'
    else if (dateOfBirth >= todayDateString()) nextErrors.dateOfBirth = 'Ngày sinh phải ở trong quá khứ.'
    if (!gender) nextErrors.gender = 'Chọn giới tính.'
    if (!ID_NUMBER_PATTERN.test(idNumber.trim())) nextErrors.idNumber = 'Số CCCD/CMND gồm 9 hoặc 12 chữ số.'
    if (!frontFile) nextErrors.front = 'Tải ảnh mặt trước.'
    if (!backFile) nextErrors.back = 'Tải ảnh mặt sau.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !frontFile || !backFile || !gender) return

    const normalizedFullName = toTitleCase(fullNameOnId)
    setFormError('')
    setBusy(true)
    try {
      await submitKyc({
        fullNameOnId: normalizedFullName,
        dateOfBirth,
        gender,
        idNumber: idNumber.trim(),
        idCardFrontKey: frontFile.key,
        idCardBackKey: backFile.key,
      })
      setFullNameOnId('')
      setDateOfBirth('')
      setGender('')
      setIdNumber('')
      setFrontFile(null)
      setBackFile(null)
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl)
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl)
      setFrontPreviewUrl(null)
      setBackPreviewUrl(null)
      setAgree(false)
      useToastStore.getState().pushToast('success', 'Nộp hồ sơ xác minh danh tính thành công, đang chờ xét duyệt.')
      refresh()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Không nộp được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell navValue="kyc" title="Xác thực danh tính" subtitle="Bắt buộc trước khi khai báo kỹ năng và nhận việc">
      {loading
        ? null
        : (
            <div style={{ display: 'grid', gridTemplateColumns: '2.3fr 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
              <div className="flex flex-col gap-4">
                {loadError && <Alert tone="danger" title="Không tải được trạng thái">{loadError}</Alert>}

                {canSubmit && (
                  <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                    {formError && <Alert tone="danger" title="Không nộp được hồ sơ">{formError}</Alert>}
                    {latest?.status === 'REJECTED' && latest.rejectionReason && (
                      <Alert tone="danger" title="Hồ sơ trước bị từ chối">Lý do: {latest.rejectionReason}</Alert>
                    )}

                    <div className="flex gap-4 flex-wrap">
                      <Field label="Họ và tên trên CCCD" required error={fieldErrors.fullNameOnId} style={{ flex: 1, minWidth: 220 }}>
                        <Input
                          value={fullNameOnId}
                          onChange={(e) => setFullNameOnId(e.target.value)}
                          onBlur={() => setFullNameOnId((current) => (current.trim() ? toTitleCase(current) : current))}
                          disabled={busy}
                          error={!!fieldErrors.fullNameOnId}
                        />
                      </Field>
                      <Field label="Ngày sinh" required error={fieldErrors.dateOfBirth} style={{ flex: 1, minWidth: 200 }}>
                        <Input type="date" max={todayDateString()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={busy} error={!!fieldErrors.dateOfBirth} />
                      </Field>
                    </div>

                    <div className="flex gap-4 flex-wrap">
                      <Field label="Số CCCD/CMND" required hint="9 hoặc 12 chữ số" error={fieldErrors.idNumber} style={{ flex: 1, minWidth: 220 }}>
                        <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} disabled={busy} error={!!fieldErrors.idNumber} numeric inputMode="numeric" />
                      </Field>
                      <Field label="Giới tính" required error={fieldErrors.gender} style={{ flex: 1, minWidth: 200 }}>
                        <Select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as Gender)}
                          disabled={busy}
                          error={!!fieldErrors.gender}
                          options={[{ value: '', label: 'Chọn giới tính' }, ...GENDER_OPTIONS]}
                        />
                      </Field>
                    </div>

                    <Field label="Ảnh CCCD" hint="Hai mặt, chụp đủ sáng, không loá. Chỉ dùng để xác minh và xử lý khiếu nại.">
                      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <FileDropzone
                          label="Mặt trước"
                          hint="Kéo ảnh vào đây hoặc bấm để chọn"
                          accept={ALLOWED_ID_IMAGE_TYPES.join(',')}
                          fileName={frontFile?.name || (uploadingSide === 'FRONT' ? 'Đang tải…' : null)}
                          previewUrl={frontPreviewUrl}
                          error={fieldErrors.front}
                          disabled={busy || uploadingSide !== null}
                          height={220}
                          onSelect={(file) => void handleUpload('FRONT', file)}
                        />
                        <FileDropzone
                          label="Mặt sau"
                          hint="Kéo ảnh vào đây hoặc bấm để chọn"
                          accept={ALLOWED_ID_IMAGE_TYPES.join(',')}
                          fileName={backFile?.name || (uploadingSide === 'BACK' ? 'Đang tải…' : null)}
                          previewUrl={backPreviewUrl}
                          error={fieldErrors.back}
                          disabled={busy || uploadingSide !== null}
                          height={220}
                          onSelect={(file) => void handleUpload('BACK', file)}
                        />
                      </div>
                    </Field>

                    <Checkbox
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      disabled={busy}
                      label="Tôi xác nhận thông tin là của tôi"
                      description="TaskConnect chỉ dùng ảnh giấy tờ để xác minh danh tính và xử lý khiếu nại. Không hiển thị cho người dùng khác."
                    />

                    <Button size="lg" icon="shield-check" disabled={busy || uploadingSide !== null || !agree} onClick={handleSubmit} style={{ alignSelf: 'flex-start' }}>
                      {busy ? 'Đang gửi…' : (latest?.status === 'REJECTED' || latest?.status === 'CANCELLED') ? 'Gửi lại hồ sơ' : 'Gửi hồ sơ xác thực'}
                    </Button>
                  </Card>
                )}

                {!canSubmit && latest?.status === 'VERIFYING' && (
                  <Card padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    <Alert tone="info" title="Hồ sơ xác thực danh tính đang được xử lý">
                      Hồ sơ của bạn đang chờ xét duyệt, thường dưới 24 giờ làm việc.
                    </Alert>
                    {cancelError && <Alert tone="danger" title="Không huỷ được hồ sơ">{cancelError}</Alert>}
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon="eye" onClick={openDetail}>
                        Xem hồ sơ đã gửi
                      </Button>
                      <Button variant="danger" size="sm" icon="x" disabled={cancelBusy} onClick={() => setShowCancelConfirm(true)}>
                        Huỷ hồ sơ
                      </Button>
                    </div>
                  </Card>
                )}

                {!canSubmit && latest?.status === 'VERIFIED' && (
                  verifiedDetail ? (
                    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                      <div className="flex items-center gap-4">
                        <Avatar name={profile?.fullName || verifiedDetail.fullNameOnId} src={profile?.avatarUrl ?? undefined} size={64} verified />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 'var(--fs-h2)', display: 'block' }}>{profile?.fullName || verifiedDetail.fullNameOnId}</strong>
                          <span className="flex items-center gap-1" style={{ marginTop: 3, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            <Icon name="lock" size={12} />{verifiedDetail.fullNameOnId} · trên CCCD
                          </span>
                        </div>
                        <Badge tone="success" icon="shield-check">
                          {verifiedDetail.reviewedAt ? `Đã xác minh ${formatDate(verifiedDetail.reviewedAt)}` : 'Đã xác minh'}
                        </Badge>
                      </div>
                      <div>
                        <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Thông tin đã được duyệt · chỉ đọc</div>
                        <DataRow label="Họ tên trên CCCD" value={verifiedDetail.fullNameOnId} strong />
                        <DataRow label="Số CCCD/CMND" value={maskIdNumber(verifiedDetail.idNumber)} numeric />
                        <DataRow label="Ngày sinh" value={verifiedDetail.dateOfBirth ? formatDate(verifiedDetail.dateOfBirth) : '—'} numeric />
                        <DataRow label="Tỉnh / thành phố hoạt động" value={profile?.operatingArea || '—'} />
                        <DataRow label="Ảnh CCCD" value="2 mặt · đã lưu an toàn" style={{ borderBottom: 'none' }} />
                      </div>
                    </Card>
                  ) : (
                    <Card padding="var(--sp-5)" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                      <Badge tone="success" icon="shield-check">Đã xác thực danh tính</Badge>
                      {latest.reviewedAt && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Xác minh lúc {formatDate(latest.reviewedAt)}</span>
                      )}
                    </Card>
                  )
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', position: 'sticky', top: 'var(--sp-5)' }}>
                <KycStatus
                  state={toKycStatusState(latest ? latest.status : null)}
                  reason={latest?.status === 'REJECTED' ? latest.rejectionReason ?? undefined : undefined}
                />
                <Card padding="var(--sp-5)">
                  <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Các bước đã hoàn tất</div>
                  <LifecycleTracker vertical steps={KYC_STEPS} current={trackerStep} />
                </Card>
              </div>

              {detailOpen && (
                <Dialog
                  title="Hồ sơ xác thực danh tính đã gửi"
                  subtitle={detail ? `Nộp lúc ${formatDateTime(detail.submittedAt)}` : undefined}
                  onClose={() => setDetailOpen(false)}
                  style={{ maxWidth: 600 }}
                >
                  {detailLoading && <p>Đang tải…</p>}
                  {detailError && <Alert tone="danger" title="Không tải được hồ sơ">{detailError}</Alert>}
                  {detail && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={profile?.fullName || detail.fullNameOnId} src={profile?.avatarUrl ?? undefined} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 'var(--fs-body-lg)' }}>{profile?.fullName || detail.fullNameOnId}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>Đang chờ Admin xét duyệt</div>
                        </div>
                        <Badge tone="warning">Đang chờ duyệt</Badge>
                      </div>

                      <Card tone="sunken" padding="var(--sp-4) var(--sp-5)">
                        <div className="tc-label" style={{ marginBottom: 'var(--sp-1)' }}>Thông tin khai trên CCCD</div>
                        <DataRow label="Họ và tên trên CCCD" value={detail.fullNameOnId} strong />
                        <DataRow label="Ngày sinh" value={detail.dateOfBirth ? formatDate(detail.dateOfBirth) : '—'} numeric />
                        <DataRow label="Giới tính" value={detail.gender ? GENDER_LABEL[detail.gender] : '—'} />
                        <DataRow label="Số CCCD/CMND" value={detail.idNumber} numeric style={{ borderBottom: 'none' }} />
                      </Card>

                      <div>
                        <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Ảnh giấy tờ</div>
                        <div className="flex gap-3">
                          {([
                            { label: 'Mặt trước CCCD', url: detail.idCardFrontViewUrl },
                            { label: 'Mặt sau CCCD', url: detail.idCardBackViewUrl },
                          ]).map((image) => (
                            <div key={image.label} style={{ flex: 1 }}>
                              <img
                                src={image.url}
                                alt={image.label}
                                onClick={() => openImageViewer(image.url)}
                                style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 'var(--r-md)', border: 'var(--bw) solid var(--border)', cursor: 'zoom-in' }}
                              />
                              <div className="flex items-center gap-1" style={{ marginTop: 'var(--sp-2)', color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
                                <Icon name="zoom-in" size={13} />{image.label} · bấm để phóng to
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog>
              )}

              {showCancelConfirm && (
                <Dialog
                  title="Huỷ hồ sơ xác thực danh tính?"
                  subtitle="Bạn sẽ cần nộp lại từ đầu nếu muốn xác thực danh tính sau này."
                  onClose={() => setShowCancelConfirm(false)}
                  footer={(
                    <>
                      <Button variant="secondary" style={{ flex: 1 }} onClick={() => setShowCancelConfirm(false)} disabled={cancelBusy}>Đóng</Button>
                      <Button variant="danger" style={{ flex: 1 }} disabled={cancelBusy} onClick={() => void handleCancel()}>
                        {cancelBusy ? 'Đang huỷ…' : 'Huỷ hồ sơ'}
                      </Button>
                    </>
                  )}
                />
              )}

              {viewerUrl && (
                <div
                  onClick={closeImageViewer}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,37,34,.75)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-5)',
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-col items-center gap-4"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  >
                    <div style={{ overflow: 'hidden', maxWidth: '90vw', maxHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={viewerUrl}
                        alt="Ảnh CCCD phóng to"
                        style={{
                          maxWidth: '90vw', maxHeight: '70vh', objectFit: 'contain',
                          transform: `scale(${viewerZoom}) rotate(${viewerRotation}deg)`,
                          transition: 'transform var(--dur-fast) var(--ease)',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2" style={{ background: 'var(--teal-900)', borderRadius: 'var(--r-pill)', padding: 'var(--sp-2) var(--sp-3)' }}>
                      <IconButton icon="zoom-out" label="Thu nhỏ" size="sm" style={{ color: 'var(--on-deep)' }} disabled={viewerZoom <= 1} onClick={zoomOut} />
                      <span className="tc-num" style={{ color: 'var(--on-deep)', fontSize: 'var(--fs-sm)', minWidth: 44, textAlign: 'center' }}>{Math.round(viewerZoom * 100)}%</span>
                      <IconButton icon="zoom-in" label="Phóng to" size="sm" style={{ color: 'var(--on-deep)' }} disabled={viewerZoom >= 3} onClick={zoomIn} />
                      <IconButton icon="rotate-cw" label="Xoay ảnh" size="sm" style={{ color: 'var(--on-deep)' }} onClick={rotateImage} />
                      <IconButton icon="x" label="Đóng" size="sm" style={{ color: 'var(--on-deep)' }} onClick={closeImageViewer} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
    </AppShell>
  )
}
