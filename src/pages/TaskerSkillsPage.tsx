import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import { Select } from '@ds/components/forms/Select'
import { AppShell } from '../components/AppShell.tsx'
import { FileDropzone } from '../components/FileDropzone.tsx'
import { TimeSelect } from '../components/TimeSelect.tsx'
import {
  addAvailabilitySlot,
  cancelMyCertification,
  cancelMyKyc,
  createCertificateUploadUrl,
  createKycUploadUrl,
  deleteAvailabilitySlot,
  getMyAvailabilitySlots,
  getMyCertifications,
  getMyLatestKyc,
  getMySkills,
  listCertificateRequirements,
  listServiceCategories,
  submitKyc,
  submitSkill,
  updateAvailabilitySlot,
} from '../api/users.ts'
import type {
  AvailabilitySlotResponse,
  CategoryCertificateRequirementResponse,
  CertificationDetailResponse,
  CertificationStatus,
  KycStatusResponse,
  ServiceCategoryResponse,
  TaskerSkillResponse,
} from '../api/users.ts'
import { ApiError } from '../api/client.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'
import { formatDate } from '../utils/formatDate.ts'
import { DAY_LABELS, DAY_OPTIONS } from '../utils/dayOfWeek.ts'

const ALLOWED_CERTIFICATE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ALLOWED_ID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ID_NUMBER_PATTERN = /^\d{9}$|^\d{12}$/

// Icon Lucide theo ma nhom dich vu (user_service_categories.code, xem V4 seed) - chi de
// trang tri cho de nhan dien tren the ky nang, khong mang y nghia nghiep vu.
const CATEGORY_ICON: Record<string, string> = {
  DIEN_DAN_DUNG: 'lightbulb',
  DIEN_LANH: 'snowflake',
  DIEN_CONG_NGHIEP_NHO: 'factory',
  CAP_THOAT_NUOC: 'droplets',
  THIET_BI_NUOC: 'shower-head',
}

// Ten rut gon chi de hien thi tren the luoi (khong du cho ngang, "Điện công nghiệp quy mô
// nhỏ" bi xuong 2 dong) - moi noi khac (form khai bao, dialog chi tiet, badge ho so cong
// khai) van dung category.name day du, khong doi ten chinh thuc trong glossary.
const CATEGORY_CARD_TITLE: Record<string, string> = {
  DIEN_CONG_NGHIEP_NHO: 'Điện công nghiệp',
  THIET_BI_NUOC: 'Thiết bị nước',
}

/** Hai khoang [aStart,aEnd) va [bStart,bEnd) (chuoi "HH:MM", so sanh duoc theo tu dien vi da zero-pad) co chong lan hay khong. */
function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd
}

const CERTIFICATION_STATUS_TONE: Record<CertificationStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
}
const CERTIFICATION_STATUS_LABEL: Record<CertificationStatus, string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã huỷ',
}

function skillStatusBadge(skill: TaskerSkillResponse | undefined) {
  if (!skill) return <Badge tone="neutral">Chưa khai báo</Badge>
  if (skill.verificationStatus === 'VERIFIED') return <Badge tone="success" icon="badge-check">Đã xác minh</Badge>
  if (skill.verificationStatus === 'REJECTED') return <Badge tone="danger" icon="shield-x">Bị từ chối</Badge>
  if (skill.verificationStatus === 'CANCELLED') return <Badge tone="neutral" icon="x">Đã huỷ</Badge>
  return <Badge tone="warning" icon="shield-question">Chờ duyệt</Badge>
}

interface KycSectionProps {
  latest: KycStatusResponse | null
  onSubmitted: () => void
}

/**
 * Xac thuc danh tinh (KYC) - UC05, gop vao dau trang Ho so ky nang (khong con la tab/route
 * rieng nhu truoc - xem AppShell.tsx). Rut gon thanh mot dong trang thai khi da VERIFIED,
 * hien Alert khi dang VERIFYING, chi hien form day du khi chua tung nop hoac bi REJECTED.
 */
function KycSection({ latest, onSubmitted }: KycSectionProps) {
  const [fullNameOnId, setFullNameOnId] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [frontFile, setFrontFile] = useState<{ name: string, key: string } | null>(null)
  const [backFile, setBackFile] = useState<{ name: string, key: string } | null>(null)
  // Object URL cuc bo de xem truoc anh CCCD vua chon, khac object key tren S3 (frontFile.key).
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null)
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null)
  const [uploadingSide, setUploadingSide] = useState<'FRONT' | 'BACK' | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ fullNameOnId?: string, idNumber?: string, front?: string, back?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const canSubmit = !latest || latest.status === 'REJECTED' || latest.status === 'CANCELLED'

  const handleCancel = async () => {
    if (!latest) return
    setCancelBusy(true)
    setCancelError('')
    try {
      await cancelMyKyc(latest.id)
      setShowCancelConfirm(false)
      useToastStore.getState().pushToast('success', 'Đã huỷ hồ sơ xác minh danh tính.')
      onSubmitted()
    } catch (error) {
      setCancelError(error instanceof ApiError ? error.message : 'Không huỷ được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setCancelBusy(false)
    }
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
    if (!ID_NUMBER_PATTERN.test(idNumber.trim())) nextErrors.idNumber = 'Số CCCD/CMND gồm 9 hoặc 12 chữ số.'
    if (!frontFile) nextErrors.front = 'Tải ảnh mặt trước.'
    if (!backFile) nextErrors.back = 'Tải ảnh mặt sau.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !frontFile || !backFile) return

    setFormError('')
    setBusy(true)
    try {
      await submitKyc({
        fullNameOnId: fullNameOnId.trim(),
        idNumber: idNumber.trim(),
        idCardFrontKey: frontFile.key,
        idCardBackKey: backFile.key,
      })
      setFullNameOnId('')
      setIdNumber('')
      setFrontFile(null)
      setBackFile(null)
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl)
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl)
      setFrontPreviewUrl(null)
      setBackPreviewUrl(null)
      useToastStore.getState().pushToast('success', 'Nộp hồ sơ xác minh danh tính thành công, đang chờ xét duyệt.')
      onSubmitted()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Không nộp được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  if (!canSubmit) {
    if (latest?.status === 'VERIFYING') {
      return (
        <>
          <Card padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <Alert tone="info" title="Hồ sơ xác thực danh tính đang được xử lý">
              Hồ sơ của bạn đang chờ xét duyệt, thường dưới 24 giờ làm việc.
            </Alert>
            {cancelError && <Alert tone="danger" title="Không huỷ được hồ sơ">{cancelError}</Alert>}
            <Button variant="danger" size="sm" icon="x" disabled={cancelBusy} onClick={() => setShowCancelConfirm(true)} style={{ alignSelf: 'flex-start' }}>
              Huỷ hồ sơ
            </Button>
          </Card>
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
        </>
      )
    }
    return (
      <Card padding="var(--sp-5)" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <Badge tone="success" icon="shield-check">Đã xác thực danh tính</Badge>
        {latest?.reviewedAt && (
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Xác minh lúc {formatDate(latest.reviewedAt)}</span>
        )}
      </Card>
    )
  }

  return (
    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {formError && <Alert tone="danger" title="Không nộp được hồ sơ">{formError}</Alert>}
      {latest?.status === 'REJECTED' && latest.rejectionReason && (
        <Alert tone="danger" title="Hồ sơ trước bị từ chối">Lý do: {latest.rejectionReason}</Alert>
      )}

      <div className="flex gap-4 flex-wrap">
        <Field label="Họ và tên trên CCCD" required error={fieldErrors.fullNameOnId} style={{ flex: 1, minWidth: 220 }}>
          <Input value={fullNameOnId} onChange={(e) => setFullNameOnId(e.target.value)} disabled={busy} error={!!fieldErrors.fullNameOnId} />
        </Field>
        <Field label="Số CCCD/CMND" required hint="9 hoặc 12 chữ số" error={fieldErrors.idNumber} style={{ flex: 1, minWidth: 220 }}>
          <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} disabled={busy} error={!!fieldErrors.idNumber} numeric inputMode="numeric" />
        </Field>
      </div>

      <Field label="Ảnh CCCD" hint="Hai mặt, chụp đủ sáng, không loá. Chỉ dùng để xác minh và xử lý khiếu nại.">
        <div className="flex gap-4">
          <FileDropzone
            label="Mặt trước"
            hint="Kéo ảnh vào đây hoặc bấm để chọn"
            accept={ALLOWED_ID_IMAGE_TYPES.join(',')}
            fileName={frontFile?.name || (uploadingSide === 'FRONT' ? 'Đang tải…' : null)}
            previewUrl={frontPreviewUrl}
            error={fieldErrors.front}
            disabled={busy || uploadingSide !== null}
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
            onSelect={(file) => void handleUpload('BACK', file)}
          />
        </div>
      </Field>

      <Button size="lg" icon="shield-check" disabled={busy || uploadingSide !== null} onClick={handleSubmit} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Đang gửi…' : (latest?.status === 'REJECTED' || latest?.status === 'CANCELLED') ? 'Gửi lại hồ sơ' : 'Gửi hồ sơ xác thực'}
      </Button>
    </Card>
  )
}

interface SkillFormProps {
  category: ServiceCategoryResponse
  existing: TaskerSkillResponse | undefined
  onDone: () => void
  onCancel: () => void
}

/** Form khai bao ky nang gop nop chung chi cho MOT category - dung cho ca lan dau va nop lai sau REJECTED. */
function SkillForm({ category, existing, onDone, onCancel }: SkillFormProps) {
  const [requirements, setRequirements] = useState<CategoryCertificateRequirementResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')

  const [yearsExperience, setYearsExperience] = useState(existing ? String(existing.yearsExperience) : '')
  const [priceMin, setPriceMin] = useState(existing?.priceMin != null ? String(existing.priceMin) : '')
  const [priceMax, setPriceMax] = useState(existing?.priceMax != null ? String(existing.priceMax) : '')
  const [certificateTypeId, setCertificateTypeId] = useState('')
  const [certificateNumber, setCertificateNumber] = useState('')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [issuedDate, setIssuedDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState<{ name: string, key: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listCertificateRequirements(category.id)
      .then((list) => {
        setRequirements(list)
        if (list.length === 1) setCertificateTypeId(list[0].certificateTypeId)
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách chứng chỉ.'))
  }, [category.id])

  const handleFileSelect = async (picked: File) => {
    setErrors((prev) => ({ ...prev, file: '' }))
    if (!ALLOWED_CERTIFICATE_TYPES.includes(picked.type)) {
      setErrors((prev) => ({ ...prev, file: 'Chỉ nhận ảnh JPEG/PNG/WEBP hoặc file PDF.' }))
      return
    }
    setUploading(true)
    try {
      const { uploadUrl, objectKey } = await createCertificateUploadUrl(category.id, picked.type)
      await uploadFileToPresignedUrl(uploadUrl, picked)
      setFile({ name: picked.name, key: objectKey })
    } catch (error) {
      setErrors((prev) => ({ ...prev, file: error instanceof ApiError || error instanceof Error ? error.message : 'Tải file lên thất bại.' }))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {}
    const years = Number(yearsExperience)
    if (!yearsExperience || Number.isNaN(years) || years < 0 || years > 60) nextErrors.yearsExperience = 'Nhập số năm kinh nghiệm hợp lệ (0-60).'
    if (!certificateTypeId) nextErrors.certificateTypeId = 'Chọn loại chứng chỉ.'
    if (!certificateNumber.trim()) nextErrors.certificateNumber = 'Nhập số hiệu chứng chỉ.'
    if (!issuingAuthority.trim()) nextErrors.issuingAuthority = 'Nhập nơi cấp.'
    if (!issuedDate) nextErrors.issuedDate = 'Chọn ngày cấp.'
    // expiryDate khong bat buoc (chung chi co the co hieu luc vinh vien) - chi kiem tra thu tu khi nguoi dung co nhap.
    if (issuedDate && expiryDate && expiryDate < issuedDate) nextErrors.expiryDate = 'Ngày hết hạn phải sau ngày cấp.'
    if (!file) nextErrors.file = 'Tải file chứng chỉ.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !file) return

    setFormError('')
    setBusy(true)
    try {
      await submitSkill({
        categoryId: category.id,
        yearsExperience: years,
        priceMin: priceMin.trim() ? Number(priceMin) : undefined,
        priceMax: priceMax.trim() ? Number(priceMax) : undefined,
        certificateTypeId,
        certificateNumber: certificateNumber.trim(),
        issuingAuthority: issuingAuthority.trim(),
        issuedDate,
        expiryDate: expiryDate || undefined,
        fileKey: file.key,
      })
      useToastStore.getState().pushToast('success', 'Nộp hồ sơ kỹ năng thành công, đang chờ xét duyệt.')
      onDone()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Không nộp được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0 }}>{existing ? 'Nộp lại kỹ năng' : 'Khai báo kỹ năng'} — {category.name}</h3>
        <Button variant="ghost" size="sm" icon="x" onClick={onCancel}>Đóng</Button>
      </div>

      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}
      {formError && <Alert tone="danger" title="Không nộp được hồ sơ">{formError}</Alert>}

      <div className="flex gap-4 flex-wrap">
        <Field label="Số năm kinh nghiệm" required error={errors.yearsExperience} style={{ flex: 1, minWidth: 160 }}>
          <Input numeric inputMode="numeric" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} disabled={busy} error={!!errors.yearsExperience} />
        </Field>
        <Field label="Giá tối thiểu" hint="₫/giờ, không bắt buộc" style={{ flex: 1, minWidth: 160 }}>
          <Input numeric inputMode="numeric" suffix="₫" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Giá tối đa" hint="₫/giờ, không bắt buộc" style={{ flex: 1, minWidth: 160 }}>
          <Input numeric inputMode="numeric" suffix="₫" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} disabled={busy} />
        </Field>
      </div>

      <Field label="Loại chứng chỉ" required error={errors.certificateTypeId} hint="Chỉ cần một trong các loại dưới đây được duyệt">
        <Select
          value={certificateTypeId}
          onChange={(e) => setCertificateTypeId(e.target.value)}
          disabled={busy || !requirements}
          error={!!errors.certificateTypeId}
          options={[{ value: '', label: requirements ? 'Chọn loại chứng chỉ' : 'Đang tải…' },
            ...(requirements ?? []).map((r) => ({ value: r.certificateTypeId, label: r.certificateTypeName }))]}
        />
      </Field>

      <div className="flex gap-4 flex-wrap">
        <Field label="Số hiệu chứng chỉ" required error={errors.certificateNumber} style={{ flex: 1, minWidth: 200 }}>
          <Input value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} disabled={busy} error={!!errors.certificateNumber} />
        </Field>
        <Field label="Nơi cấp" required error={errors.issuingAuthority} style={{ flex: 1, minWidth: 200 }}>
          <Input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} disabled={busy} error={!!errors.issuingAuthority} />
        </Field>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Field label="Ngày cấp" required error={errors.issuedDate} style={{ flex: 1, minWidth: 160 }}>
          <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} disabled={busy} error={!!errors.issuedDate} />
        </Field>
        <Field label="Ngày hết hạn" hint="Không bắt buộc — để trống nếu chứng chỉ có hiệu lực vĩnh viễn" error={errors.expiryDate} style={{ flex: 1, minWidth: 160 }}>
          <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={busy} error={!!errors.expiryDate} />
        </Field>
      </div>

      <Field label="File chứng chỉ" required error={errors.file} hint="Ảnh chụp hoặc file PDF">
        <FileDropzone
          label="Tải file chứng chỉ"
          hint="Kéo file vào đây hoặc bấm để chọn"
          accept={ALLOWED_CERTIFICATE_TYPES.join(',')}
          fileName={file?.name || (uploading ? 'Đang tải…' : null)}
          disabled={busy || uploading}
          onSelect={(picked) => void handleFileSelect(picked)}
        />
      </Field>

      <Button size="lg" icon="badge-check" disabled={busy || uploading} onClick={handleSubmit} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Đang gửi…' : 'Nộp hồ sơ'}
      </Button>
    </Card>
  )
}

interface SkillDetailsDialogProps {
  category: ServiceCategoryResponse
  skill: TaskerSkillResponse
  onClose: () => void
}

/**
 * "Xem chi tiet" tren the ky nang - cho Tasker xem lai thong tin da khai (kinh nghiem, gia,
 * trang thai xac minh, xac minh boi ai) va toan bo lich su nop chung chi cho category do. Mo
 * duoc voi moi trang thai (VERIFIED, PENDING, REJECTED), khong chi khi bi tu choi.
 */
function SkillDetailsDialog({ category, skill, onClose }: SkillDetailsDialogProps) {
  const [certifications, setCertifications] = useState<CertificationDetailResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getMyCertifications(category.id)
      .then(setCertifications)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được lịch sử nộp chứng chỉ.'))
  }, [category.id])

  return (
    <Dialog title={`Chi tiết kỹ năng — ${category.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {skill.verificationStatus === 'VERIFIED' && skill.verifiedAt && (
          <Card padding="var(--sp-4)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {skillStatusBadge(skill)}
            <Field label="Xác minh bởi"><span>TaskConnect · {formatDate(skill.verifiedAt)}</span></Field>
          </Card>
        )}

        <div>
          <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Lịch sử nộp chứng chỉ</div>
          {loadError && <Alert tone="danger" title="Không tải được lịch sử">{loadError}</Alert>}
          {!certifications && !loadError && <p>Đang tải…</p>}
          {certifications?.length === 0 && <EmptyState icon="award" title="Chưa có lần nộp nào" />}
          <div className="flex flex-col gap-3" style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 'var(--sp-2)' }}>
            {certifications?.map((item) => (
              <Card key={item.id} padding="var(--sp-4)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div className="flex items-center justify-between">
                  <Badge tone={CERTIFICATION_STATUS_TONE[item.status]}>{CERTIFICATION_STATUS_LABEL[item.status]}</Badge>
                  <span className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{formatDate(item.submittedAt)}</span>
                </div>
                <Field label="Số năm kinh nghiệm"><span className="tc-num">{skill.yearsExperience}</span></Field>
                {(skill.priceMin != null || skill.priceMax != null) && (
                  <Field label="Khoảng giá đã khai">
                    <span className="tc-num">
                      {skill.priceMin != null ? `${skill.priceMin.toLocaleString('vi-VN')}₫` : '—'}
                      {' – '}
                      {skill.priceMax != null ? `${skill.priceMax.toLocaleString('vi-VN')}₫` : '—'}
                    </span>
                  </Field>
                )}
                {item.certificateNumber && <Field label="Số hiệu chứng chỉ"><span className="tc-num">{item.certificateNumber}</span></Field>}
                {item.issuingAuthority && <Field label="Nơi cấp"><span>{item.issuingAuthority}</span></Field>}
                <a href={item.fileViewUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>
                  Xem file chứng chỉ
                </a>
                {item.rejectionReason && <Alert tone="danger" title="Lý do từ chối">{item.rejectionReason}</Alert>}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

/**
 * Ho so ky nang Tasker - UC04 + UC05. Gop 3 phan: xac thuc danh tinh KYC (truoc day la tab
 * rieng "/xac-thuc-danh-tinh", nay gop chung vao dau trang - xem AppShell.tsx), khai bao ky
 * nang+chung chi theo tung nhom dich vu (chan cung neu KYC chua VERIFIED), va lich lam viec
 * (doc lap, khong phu thuoc KYC). Chi Tasker vao duoc (RoleGuard o App.tsx).
 */
export function TaskerSkillsPage() {
  const [loading, setLoading] = useState(true)
  const [kycStatus, setKycStatus] = useState<KycStatusResponse | null>(null)
  const [categories, setCategories] = useState<ServiceCategoryResponse[]>([])
  const [skills, setSkills] = useState<TaskerSkillResponse[]>([])
  const [slots, setSlots] = useState<AvailabilitySlotResponse[]>([])
  const [loadError, setLoadError] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [detailsCategoryId, setDetailsCategoryId] = useState<string | null>(null)
  const [cancelSkillTarget, setCancelSkillTarget] = useState<TaskerSkillResponse | null>(null)
  const [cancelSkillBusy, setCancelSkillBusy] = useState(false)
  const [cancelSkillError, setCancelSkillError] = useState('')

  const [slotDay, setSlotDay] = useState('1')
  const [slotStart, setSlotStart] = useState('08:00')
  const [slotEnd, setSlotEnd] = useState('12:00')
  const [slotError, setSlotError] = useState('')
  const [slotBusy, setSlotBusy] = useState(false)

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editDay, setEditDay] = useState('1')
  const [editStart, setEditStart] = useState('08:00')
  const [editEnd, setEditEnd] = useState('12:00')

  const kycVerified = kycStatus?.status === 'VERIFIED'

  const loadAll = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const latestKyc = await getMyLatestKyc().catch((error) => {
        if (error instanceof ApiError && error.code === 'USR-404-KYC_NOT_FOUND') return null
        throw error
      })
      setKycStatus(latestKyc)

      const [categoryList, slotList] = await Promise.all([listServiceCategories(), getMyAvailabilitySlots()])
      setCategories(categoryList)
      setSlots(slotList)

      if (latestKyc?.status === 'VERIFIED') {
        setSkills(await getMySkills())
      }
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Không tải được dữ liệu. Kiểm tra mạng rồi thử lại.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAll() }, [])

  const handleAddSlot = async () => {
    setSlotError('')
    if (slotEnd <= slotStart) {
      setSlotError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    const day = Number(slotDay)
    const overlapping = slots.some((slot) => slot.dayOfWeek === day
      && timeRangesOverlap(slotStart, slotEnd, slot.startTime.slice(0, 5), slot.endTime.slice(0, 5)))
    if (overlapping) {
      setSlotError('Khung giờ này trùng với một khung giờ đã khai báo trong cùng ngày.')
      return
    }
    setSlotBusy(true)
    try {
      const created = await addAvailabilitySlot({ dayOfWeek: Number(slotDay), startTime: slotStart, endTime: slotEnd })
      setSlots((prev) => [...prev, created].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
      useToastStore.getState().pushToast('success', 'Đã thêm khung giờ.')
    } catch (error) {
      setSlotError(error instanceof ApiError ? error.message : 'Không thêm được khung giờ.')
    } finally {
      setSlotBusy(false)
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    setSlotBusy(true)
    try {
      await deleteAvailabilitySlot(slotId)
      setSlots((prev) => prev.filter((slot) => slot.id !== slotId))
      useToastStore.getState().pushToast('success', 'Đã xoá khung giờ.')
    } catch (error) {
      setSlotError(error instanceof ApiError ? error.message : 'Không xoá được khung giờ.')
    } finally {
      setSlotBusy(false)
    }
  }

  const startEditSlot = (slot: AvailabilitySlotResponse) => {
    setSlotError('')
    setEditingSlotId(slot.id)
    setEditDay(String(slot.dayOfWeek))
    setEditStart(slot.startTime.slice(0, 5))
    setEditEnd(slot.endTime.slice(0, 5))
  }

  const handleSaveEditSlot = async () => {
    if (!editingSlotId) return
    if (editEnd <= editStart) {
      setSlotError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    const day = Number(editDay)
    const overlapping = slots.some((slot) => slot.id !== editingSlotId && slot.dayOfWeek === day
      && timeRangesOverlap(editStart, editEnd, slot.startTime.slice(0, 5), slot.endTime.slice(0, 5)))
    if (overlapping) {
      setSlotError('Khung giờ này trùng với một khung giờ đã khai báo trong cùng ngày.')
      return
    }
    setSlotBusy(true)
    try {
      const updated = await updateAvailabilitySlot(editingSlotId, { dayOfWeek: Number(editDay), startTime: editStart, endTime: editEnd })
      setSlots((prev) => prev.map((slot) => (slot.id === updated.id ? updated : slot)).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
      setEditingSlotId(null)
      useToastStore.getState().pushToast('success', 'Đã lưu khung giờ.')
    } catch (error) {
      setSlotError(error instanceof ApiError ? error.message : 'Không lưu được khung giờ.')
    } finally {
      setSlotBusy(false)
    }
  }

  /**
   * Huy lan nop chung chi dang cho duyet cua 1 category - dung latestCertificationId (luon
   * co gia tri khi verificationStatus la PENDING, vi submitSkill luon tao dong chung chi
   * cung luc voi ho so ky nang). Loi USR-409-SKILL... khong xay ra o day, loi thuc te co the
   * gap la USR-409-CERTIFICATION_NOT_PENDING_REVIEW neu Admin vua duyet/tu choi dung luc.
   */
  const handleCancelSkill = async () => {
    if (!cancelSkillTarget?.latestCertificationId) return
    setCancelSkillBusy(true)
    setCancelSkillError('')
    try {
      await cancelMyCertification(cancelSkillTarget.latestCertificationId)
      setCancelSkillTarget(null)
      useToastStore.getState().pushToast('success', 'Đã huỷ hồ sơ kỹ năng.')
      void loadAll()
    } catch (error) {
      setCancelSkillError(error instanceof ApiError ? error.message : 'Không huỷ được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setCancelSkillBusy(false)
    }
  }

  const skillByCategory = new Map(skills.map((skill) => [skill.categoryId, skill]))
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null
  const detailsCategory = categories.find((c) => c.id === detailsCategoryId) ?? null
  const detailsSkill = detailsCategory ? skillByCategory.get(detailsCategory.id) : undefined

  return (
    <AppShell navValue="skills" title="Hồ sơ kỹ năng" subtitle="Xác thực danh tính, kỹ năng, chứng chỉ hành nghề và lịch làm việc">
      {loading
        ? null
        : (
            <div className="flex flex-col gap-6">
              {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

              <div>
                <h2 style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--sp-3)' }}>Xác thực danh tính</h2>
                <KycSection latest={kycStatus} onSubmitted={() => void loadAll()} />
              </div>

              <div>
                <h2 style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--sp-3)' }}>Kỹ năng theo nhóm dịch vụ</h2>
                {!kycVerified
                  ? (
                      <EmptyState icon="shield-question" title="Cần xác thực danh tính trước">
                        Hoàn tất xác thực danh tính ở mục phía trên trước khi khai báo kỹ năng và nộp chứng chỉ hành nghề.
                      </EmptyState>
                    )
                  : (
                      <div className="flex flex-col gap-4">
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}>
                          {categories.map((category) => {
                            const skill = skillByCategory.get(category.id)
                            return (
                              <Card key={category.id} padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                                <div className="flex items-center gap-2">
                                  <Icon name={CATEGORY_ICON[category.code] ?? 'wrench'} size={20} style={{ color: 'var(--teal-600)', flex: '0 0 auto' }} />
                                  <strong title={category.name} style={{ whiteSpace: 'nowrap' }}>
                                    {CATEGORY_CARD_TITLE[category.code] ?? category.name}
                                  </strong>
                                </div>
                                {skillStatusBadge(skill)}
                                {skill?.verificationStatus === 'VERIFIED' && skill.verifiedAt && (
                                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                                    Xác minh bởi TaskConnect · {formatDate(skill.verifiedAt)}
                                  </span>
                                )}
                                <div className="flex gap-2 flex-wrap">
                                  {skill && (
                                    <Button variant="ghost" size="sm" icon="eye" onClick={() => setDetailsCategoryId(category.id)}>
                                      Xem chi tiết
                                    </Button>
                                  )}
                                  {(!skill || skill.verificationStatus === 'REJECTED' || skill.verificationStatus === 'CANCELLED') && (
                                    <Button variant="secondary" size="sm" onClick={() => setSelectedCategoryId(category.id)}>
                                      {skill ? 'Nộp lại' : 'Khai báo kỹ năng'}
                                    </Button>
                                  )}
                                  {skill?.verificationStatus === 'PENDING' && (
                                    <Button variant="danger" size="sm" icon="x" onClick={() => { setCancelSkillTarget(skill); setCancelSkillError('') }}>
                                      Huỷ
                                    </Button>
                                  )}
                                </div>
                              </Card>
                            )
                          })}
                        </div>

                        {selectedCategory && (
                          <SkillForm
                            category={selectedCategory}
                            existing={skillByCategory.get(selectedCategory.id)}
                            onCancel={() => setSelectedCategoryId(null)}
                            onDone={() => {
                              setSelectedCategoryId(null)
                              void loadAll()
                            }}
                          />
                        )}
                      </div>
                    )}
              </div>

              <div>
                <h2 style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--sp-3)' }}>Lịch làm việc</h2>
                <Card padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  {slotError && <Alert tone="danger" title="Không thực hiện được">{slotError}</Alert>}

                  {slots.length === 0
                    ? <EmptyState icon="calendar-clock" title="Chưa khai báo khung giờ nào">Thêm khung giờ rảnh để Poster biết khi nào bạn nhận việc.</EmptyState>
                    : (
                        <div className="flex flex-col gap-2">
                          {slots.map((slot) => (
                            <div key={slot.id} className="flex items-center gap-3 py-2 flex-wrap" style={{ borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}>
                              {editingSlotId === slot.id
                                ? (
                                    <>
                                      <Select style={{ width: 140 }} value={editDay} onChange={(e) => setEditDay(e.target.value)} disabled={slotBusy} options={DAY_OPTIONS} />
                                      <TimeSelect value={editStart} onChange={setEditStart} disabled={slotBusy} />
                                      <span style={{ color: 'var(--text-muted)' }}>–</span>
                                      <TimeSelect value={editEnd} onChange={setEditEnd} disabled={slotBusy} />
                                      <Button variant="primary" size="sm" icon="check" disabled={slotBusy} onClick={() => void handleSaveEditSlot()}>Lưu</Button>
                                      <Button variant="ghost" size="sm" onClick={() => setEditingSlotId(null)} disabled={slotBusy}>Huỷ</Button>
                                    </>
                                  )
                                : (
                                    <>
                                      <Badge tone="brand">{DAY_LABELS[slot.dayOfWeek]}</Badge>
                                      <span className="tc-num flex-1">{slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}</span>
                                      <Button variant="ghost" size="sm" icon="pencil" disabled={slotBusy} onClick={() => startEditSlot(slot)}>Sửa</Button>
                                      <Button variant="ghost" size="sm" icon="trash-2" disabled={slotBusy} onClick={() => void handleDeleteSlot(slot.id)}>Xoá</Button>
                                    </>
                                  )}
                            </div>
                          ))}
                        </div>
                      )}

                  <div className="flex gap-3 items-end flex-wrap pt-2" style={{ borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
                    <Field label="Ngày" style={{ minWidth: 140 }}>
                      <Select value={slotDay} onChange={(e) => setSlotDay(e.target.value)} disabled={slotBusy} options={DAY_OPTIONS} />
                    </Field>
                    <Field label="Bắt đầu">
                      <TimeSelect value={slotStart} onChange={setSlotStart} disabled={slotBusy} />
                    </Field>
                    <Field label="Kết thúc">
                      <TimeSelect value={slotEnd} onChange={setSlotEnd} disabled={slotBusy} />
                    </Field>
                    <Button variant="secondary" icon="plus" disabled={slotBusy} onClick={() => void handleAddSlot()}>Thêm khung giờ</Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

      {detailsCategory && detailsSkill && (
        <SkillDetailsDialog category={detailsCategory} skill={detailsSkill} onClose={() => setDetailsCategoryId(null)} />
      )}

      {cancelSkillTarget && (
        <Dialog
          title="Huỷ hồ sơ kỹ năng đang chờ duyệt?"
          subtitle="Bạn sẽ cần khai báo lại từ đầu cho nhóm dịch vụ này nếu muốn nộp lại."
          onClose={() => setCancelSkillTarget(null)}
          footer={(
            <>
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => setCancelSkillTarget(null)} disabled={cancelSkillBusy}>Đóng</Button>
              <Button variant="danger" style={{ flex: 1 }} disabled={cancelSkillBusy} onClick={() => void handleCancelSkill()}>
                {cancelSkillBusy ? 'Đang huỷ…' : 'Huỷ hồ sơ'}
              </Button>
            </>
          )}
        >
          {cancelSkillError && <Alert tone="danger" title="Không huỷ được hồ sơ">{cancelSkillError}</Alert>}
        </Dialog>
      )}
    </AppShell>
  )
}
