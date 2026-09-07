import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Select } from '@ds/components/forms/Select'
import { Tabs } from '@ds/components/navigation/Tabs'
import { AppShell } from '../components/AppShell.tsx'
import { DialogViewport } from '../components/DialogViewport.tsx'
import { FileDropzone } from '../components/FileDropzone.tsx'
import {
  cancelMyCertification,
  createCertificateUploadUrl,
  getMyCertifications,
  getMyLatestKyc,
  getMySkills,
  listCertificateRequirements,
  listServiceCategories,
  submitSkill,
} from '../api/users.ts'
import type {
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
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'

const ALLOWED_CERTIFICATE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// Icon Lucide theo ma nhom dich vu (user_service_categories.code, xem V4 seed) - chi de
// trang tri cho de nhan dien tren the ky nang, khong mang y nghia nghiep vu.
const CATEGORY_ICON: Record<string, string> = {
  DIEN_DAN_DUNG: 'lightbulb',
  DIEN_LANH: 'snowflake',
  DIEN_CONG_NGHIEP_NHO: 'factory',
  CAP_THOAT_NUOC: 'droplets',
  THIET_BI_NUOC: 'shower-head',
}

/** Ngay hom nay theo gio dia phuong trinh duyet, dang "yyyy-mm-dd" - khop dinh dang value cua <input type="date">, so sanh truc tiep bang so sanh chuoi duoc. Khong dung toISOString() (quy ve UTC) vi VN luon truoc UTC, co the lech 1 ngay gan nua dem. */
function todayDateString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Ngay mai theo gio dia phuong trinh duyet, dang "yyyy-mm-dd" - dung lam min cho lich chon "Ngay het han" (phai sau hom nay, khong duoc chon dung hom nay). */
function tomorrowDateString() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Chuoi so nguyen nguoi dung nhap (don vi nghin dong) -> chuoi tien VND day du co dau cham ngan nghin, vd "222" -> "222.000 đ". Rong hoac khong phai so tra ve rong. */
function formatThousandVnd(digitsInThousand: string) {
  const n = Number(digitsInThousand)
  if (!digitsInThousand || Number.isNaN(n)) return ''
  return `${(n * 1000).toLocaleString('vi-VN')} đ`
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
const CERTIFICATION_STATUS_ICON: Record<CertificationStatus, string> = {
  PENDING_REVIEW: 'shield-question',
  APPROVED: 'badge-check',
  REJECTED: 'shield-x',
  EXPIRED: 'calendar-x',
  CANCELLED: 'x',
}

type CompactField = { label: string, value: ReactNode, numeric?: boolean }

/**
 * Ghep 2 field ngan gon vao chung 1 dong cua luoi 2 cot trong the lich su chung chi (vd Ngay
 * cap + Ngay het han). Field nao vang mat (null) thi field con lai chiem tron dong, khong de
 * trong 1 o rong ben canh.
 */
function pairRow(a: CompactField | null, b: CompactField | null) {
  if (a && b) {
    return (
      <>
        <DataRow label={a.label} value={a.value} numeric={a.numeric} />
        <DataRow label={b.label} value={b.value} numeric={b.numeric} />
      </>
    )
  }
  const only = a ?? b
  if (!only) return null
  return <DataRow label={only.label} value={only.value} numeric={only.numeric} style={{ gridColumn: '1 / -1' }} />
}

function skillStatusBadge(skill: TaskerSkillResponse | undefined) {
  if (!skill) return <Badge tone="neutral">Chưa khai báo</Badge>
  if (skill.verificationStatus === 'VERIFIED') return <Badge tone="success" icon="badge-check">Đã xác minh</Badge>
  if (skill.verificationStatus === 'REJECTED') return <Badge tone="danger" icon="shield-x">Bị từ chối</Badge>
  if (skill.verificationStatus === 'CANCELLED') return <Badge tone="neutral" icon="x">Đã huỷ</Badge>
  return <Badge tone="warning" icon="shield-question">Chờ duyệt</Badge>
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
  // Luu don vi nghin dong (nguoi dung go "222" nghia la 222.000 d) - existing.priceMin/Max tra
  // ve tu BE la dong nguyen, chia lai cho 1000 de hien thi dung don vi da nhap luc dau.
  const [priceMin, setPriceMin] = useState(existing?.priceMin != null ? String(Math.round(existing.priceMin / 1000)) : '')
  const [priceMax, setPriceMax] = useState(existing?.priceMax != null ? String(Math.round(existing.priceMax / 1000)) : '')
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

  const today = todayDateString()

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
    if (priceMin && priceMax && Number(priceMax) <= Number(priceMin)) nextErrors.priceMax = 'Giá tối đa phải lớn hơn giá tối thiểu.'
    if (!certificateTypeId) nextErrors.certificateTypeId = 'Chọn loại chứng chỉ.'
    if (!certificateNumber.trim()) nextErrors.certificateNumber = 'Nhập số hiệu chứng chỉ.'
    if (!issuingAuthority.trim()) nextErrors.issuingAuthority = 'Nhập nơi cấp.'
    if (!issuedDate) nextErrors.issuedDate = 'Chọn ngày cấp.'
    else if (issuedDate > today) nextErrors.issuedDate = 'Ngày cấp không được ở tương lai.'
    // expiryDate khong bat buoc (chung chi co the co hieu luc vinh vien) - chi kiem tra khi nguoi dung co nhap.
    if (expiryDate) {
      if (expiryDate <= today) nextErrors.expiryDate = 'Ngày hết hạn phải sau ngày hiện tại.'
      else if (issuedDate && expiryDate < issuedDate) nextErrors.expiryDate = 'Ngày hết hạn phải sau ngày cấp.'
    }
    if (!file) nextErrors.file = 'Tải file chứng chỉ.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !file) return

    setFormError('')
    setBusy(true)
    try {
      await submitSkill({
        categoryId: category.id,
        yearsExperience: years,
        // Nguoi dung go don vi nghin (vd "222") - nhan 1000 truoc khi gui, BE luu dong nguyen.
        priceMin: priceMin.trim() ? Number(priceMin) * 1000 : undefined,
        priceMax: priceMax.trim() ? Number(priceMax) * 1000 : undefined,
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
      // Loi validate Bean Validation tu BE (MethodArgumentNotValidException) tra chi tiet
      // tung field trong error.details, key trung ten field cua SubmitSkillRequest - gan
      // thang vao errors de hien duoi dung o thay vi banner chung chung. fileKey doi ten
      // sang "file" cho khop key state cuc bo. Loi BusinessException (vd KYC_NOT_VERIFIED,
      // SKILL_ALREADY_VERIFIED) khong co details dang field-map nen roi xuong banner chung.
      const fieldErrors = error instanceof ApiError && error.details && typeof error.details === 'object'
        ? error.details as Record<string, string>
        : null
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => {
          const next = { ...prev }
          for (const [key, message] of Object.entries(fieldErrors)) next[key === 'fileKey' ? 'file' : key] = message
          return next
        })
      } else {
        setFormError(error instanceof ApiError ? error.message : 'Không nộp được hồ sơ. Kiểm tra mạng rồi thử lại.')
      }
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
          <Input numeric inputMode="numeric" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value.replace(/\D/g, ''))} disabled={busy} error={!!errors.yearsExperience} />
        </Field>
        <Field
          label="Giá tối thiểu"
          hint="Nhập theo đơn vị nghìn đồng/giờ, không bắt buộc — vd nhập 50 nghĩa là 50.000 đ/giờ"
          error={errors.priceMin}
          style={{ flex: 1, minWidth: 160 }}
        >
          <Input
            numeric inputMode="numeric"
            suffix={priceMin ? formatThousandVnd(priceMin) : 'nghìn đ/giờ'}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, ''))}
            disabled={busy}
            error={!!errors.priceMin}
          />
        </Field>
        <Field
          label="Giá tối đa"
          hint="Nhập theo đơn vị nghìn đồng/giờ, không bắt buộc — vd nhập 50 nghĩa là 50.000 đ/giờ"
          error={errors.priceMax}
          style={{ flex: 1, minWidth: 160 }}
        >
          <Input
            numeric inputMode="numeric"
            suffix={priceMax ? formatThousandVnd(priceMax) : 'nghìn đ/giờ'}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ''))}
            disabled={busy}
            error={!!errors.priceMax}
          />
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
          <Input maxLength={100} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} disabled={busy} error={!!errors.certificateNumber} />
        </Field>
        <Field label="Nơi cấp" required error={errors.issuingAuthority} style={{ flex: 1, minWidth: 200 }}>
          <Input maxLength={255} value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} disabled={busy} error={!!errors.issuingAuthority} />
        </Field>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Field label="Ngày cấp" required error={errors.issuedDate} hint="Không được ở tương lai" style={{ flex: 1, minWidth: 160 }}>
          <Input type="date" max={today} value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} disabled={busy} error={!!errors.issuedDate} />
        </Field>
        <Field label="Ngày hết hạn" hint="Không bắt buộc — để trống nếu chứng chỉ có hiệu lực vĩnh viễn, phải sau ngày hiện tại nếu có nhập" error={errors.expiryDate} style={{ flex: 1, minWidth: 160 }}>
          <Input type="date" min={tomorrowDateString()} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={busy} error={!!errors.expiryDate} />
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
  useLockBodyScroll(true)
  const [certifications, setCertifications] = useState<CertificationDetailResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  // Chi de tra ten "Loai chung chi" theo certificateTypeId (endpoint nay von da goi trong SkillForm) -
  // API tra ve certificateTypeName san, khong can them field rieng vao CertificationDetailResponse.
  const [certTypes, setCertTypes] = useState<CategoryCertificateRequirementResponse[]>([])

  useEffect(() => {
    getMyCertifications(category.id)
      .then(setCertifications)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được lịch sử nộp chứng chỉ.'))
    listCertificateRequirements(category.id).then(setCertTypes).catch(() => {})
  }, [category.id])

  const certTypeNameById = new Map(certTypes.map((r) => [r.certificateTypeId, r.certificateTypeName]))

  return (
    <DialogViewport>
      <Dialog title={`Chi tiết kỹ năng — ${category.name}`} onClose={onClose} style={{ maxWidth: 640 }}>
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
              {certifications?.map((item) => {
                const certTypeName = certTypeNameById.get(item.certificateTypeId)

                return (
                <Card key={item.id} padding="0" style={{ overflow: 'hidden' }}>
                  <div
                    className="flex items-center justify-between"
                    style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-sunken)', borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}
                  >
                    <Badge tone={CERTIFICATION_STATUS_TONE[item.status]} icon={CERTIFICATION_STATUS_ICON[item.status]}>
                      {CERTIFICATION_STATUS_LABEL[item.status]}
                    </Badge>
                    <span className="flex items-center gap-1 tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      <Icon name="clock" size={13} />
                      {formatDate(item.submittedAt)}
                    </span>
                  </div>

                  <div style={{ padding: 'var(--sp-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'var(--sp-6)' }}>
                    {pairRow(
                      { label: 'Số năm kinh nghiệm', value: skill.yearsExperience, numeric: true },
                      item.certificateNumber ? { label: 'Số hiệu chứng chỉ', value: item.certificateNumber, numeric: true } : null,
                    )}
                    {pairRow(
                      item.issuedDate ? { label: 'Ngày cấp', value: formatDate(item.issuedDate), numeric: true } : null,
                      item.expiryDate ? { label: 'Ngày hết hạn', value: formatDate(item.expiryDate), numeric: true } : null,
                    )}
                    {certTypeName && <DataRow label="Loại chứng chỉ" value={certTypeName} style={{ gridColumn: '1 / -1' }} />}
                    {(skill.priceMin != null || skill.priceMax != null) && (
                      <DataRow
                        label="Khoảng giá đã khai"
                        numeric
                        style={{ gridColumn: '1 / -1' }}
                        value={`${skill.priceMin != null ? `${skill.priceMin.toLocaleString('vi-VN')}₫` : '—'} – ${skill.priceMax != null ? `${skill.priceMax.toLocaleString('vi-VN')}₫` : '—'}`}
                      />
                    )}
                    {item.issuingAuthority && <DataRow label="Nơi cấp" value={item.issuingAuthority} style={{ gridColumn: '1 / -1' }} />}
                  </div>

                  <div style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>
                    <Button
                      variant="secondary" size="sm" icon="external-link"
                      onClick={() => window.open(item.fileViewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Xem file chứng chỉ
                    </Button>
                  </div>

                  {item.rejectionReason && (
                    <div style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>
                      <Alert tone="danger" title="Lý do từ chối">{item.rejectionReason}</Alert>
                    </div>
                  )}
                </Card>
                )
              })}
            </div>
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}

/**
 * Ho so ky nang Tasker - UC04. Khai bao ky nang + chung chi hanh nghe theo tung nhom dich
 * vu. Xac thuc danh tinh (KYC, UC05) da tach thanh trang rieng "/xac-thuc-danh-tinh" (xem
 * KycPage.tsx, AppShell.tsx) - trang nay chi con doc trang thai KYC (getMyLatestKyc) de
 * tinh gate, khong con render form KYC. Lich lam viec da chuyen sang ProfilePage.tsx (doc
 * lap voi KYC/ky nang, hop ly hon o trang Ho so ca nhan - xem doan sua doi lien quan).
 * Khoi ky nang chan cung (EmptyState, khong cho mo form) neu tai khoan CHUA TUNG nop KYC lan
 * nao (hasSubmittedKyc = false) - khop gate requireKycSubmitted() o BE. Da nop roi (du dang
 * VERIFYING/REJECTED, khong bat buoc VERIFIED) thi mo khoa, chi con hien Alert nhac hồ so chi
 * duoc duyet sau khi KYC VERIFIED xong - khop gate requireKycVerified() rieng o approve().
 * Chi Tasker vao duoc (RoleGuard o App.tsx).
 */
export function TaskerSkillsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [kycStatus, setKycStatus] = useState<KycStatusResponse | null>(null)
  const [categories, setCategories] = useState<ServiceCategoryResponse[]>([])
  const [skills, setSkills] = useState<TaskerSkillResponse[]>([])
  const [loadError, setLoadError] = useState('')
  const [certTab, setCertTab] = useState<'all' | 'todo' | 'verified'>('all')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  // Form khai bao ky nang render ngay duoi danh sach the nhom dich vu - neu danh sach dai,
  // bam "Khai bao ky nang" o the dau se lam form hien ra ngoai man hinh. Cuon toi day moi lan
  // chon mot category de nguoi dung thay form ngay, khong phai tu cuon tay.
  const skillFormRef = useRef<HTMLDivElement>(null)
  const [detailsCategoryId, setDetailsCategoryId] = useState<string | null>(null)
  const [cancelSkillTarget, setCancelSkillTarget] = useState<TaskerSkillResponse | null>(null)
  const [cancelSkillBusy, setCancelSkillBusy] = useState(false)
  const [cancelSkillError, setCancelSkillError] = useState('')

  const kycVerified = kycStatus?.status === 'VERIFIED'
  // Gate rieng, nhe hon kycVerified: chi can co BAT KY lan nop KYC nao (VERIFYING/VERIFIED/
  // REJECTED deu duoc) la du de mo khoa khai bao ky nang - khop dung gate moi o BE
  // (TaskerSkillService.requireKycSubmitted, khac requireKycVerified chi ap dung luc Admin
  // duyet). getMyLatestKyc() tra null khi tai khoan chua tung nop (404 KYC_NOT_FOUND).
  const hasSubmittedKyc = kycStatus != null

  const loadAll = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const latestKyc = await getMyLatestKyc().catch((error) => {
        if (error instanceof ApiError && error.code === 'USR-404-KYC_NOT_FOUND') return null
        throw error
      })
      setKycStatus(latestKyc)

      const [categoryList, skillList] = await Promise.all([
        listServiceCategories(),
        getMySkills(),
      ])
      setCategories(categoryList)
      setSkills(skillList)
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Không tải được dữ liệu. Kiểm tra mạng rồi thử lại.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAll() }, [])

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

  useEffect(() => {
    if (selectedCategoryId) skillFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedCategoryId])

  useLockBodyScroll(!!cancelSkillTarget)

  const skillByCategory = new Map(skills.map((skill) => [skill.categoryId, skill]))
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null
  const detailsCategory = categories.find((c) => c.id === detailsCategoryId) ?? null
  const detailsSkill = detailsCategory ? skillByCategory.get(detailsCategory.id) : undefined

  // Dem theo trang thai de hien count tren Tabs va DataRow rail ben phai - "verified" chi tinh
  // VERIFIED, "todo" gom chua khai bao + PENDING + REJECTED + CANCELLED (deu can Tasker lam gi do).
  const verifiedCount = skills.filter((s) => s.verificationStatus === 'VERIFIED').length
  const pendingCount = skills.filter((s) => s.verificationStatus === 'PENDING').length
  const rejectedCount = skills.filter((s) => s.verificationStatus === 'REJECTED').length
  const todoCount = categories.length - verifiedCount
  const visibleCategories = categories.filter((category) => {
    if (certTab === 'all') return true
    const status = skillByCategory.get(category.id)?.verificationStatus
    if (certTab === 'verified') return status === 'VERIFIED'
    return status !== 'VERIFIED'
  })

  return (
    <AppShell navValue="skills" title="Kỹ năng & chứng chỉ" subtitle="Chứng chỉ hành nghề theo nhóm dịch vụ">
      {loading
        ? null
        : (
            <div className="flex flex-col gap-6">
              {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

              <div>
                <h2 style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--sp-3)' }}>Kỹ năng theo nhóm dịch vụ</h2>
                {!hasSubmittedKyc
                  ? (
                      <EmptyState
                        icon="shield-question"
                        title="Cần xác thực danh tính trước"
                        action={<Button icon="shield-check" onClick={() => navigate('/xac-thuc-danh-tinh')}>Xác thực danh tính ngay</Button>}
                      >
                        Nộp xác thực danh tính (KYC) trước khi khai báo kỹ năng và nộp chứng chỉ hành nghề — chỉ cần nộp xong, chưa cần chờ được duyệt.
                      </EmptyState>
                    )
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: '2.3fr 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
                      <div className="flex flex-col gap-4">
                        {!kycVerified && (
                          <Alert tone="warning" title="Đang chờ xác thực danh tính">
                            Bạn đã nộp KYC nên khai báo được kỹ năng và nộp chứng chỉ ngay, nhưng hồ sơ chỉ được duyệt sau khi xác thực danh tính (KYC) hoàn tất.
                          </Alert>
                        )}

                        <Tabs
                          value={certTab}
                          onChange={(value) => setCertTab(value as typeof certTab)}
                          tabs={[
                            { value: 'all', label: 'Tất cả', count: categories.length },
                            { value: 'todo', label: 'Cần xử lý', count: todoCount },
                            { value: 'verified', label: 'Đã xác minh', count: verifiedCount },
                          ]}
                        />

                        <div className="flex flex-col gap-3">
                          {visibleCategories.map((category) => {
                            const skill = skillByCategory.get(category.id)
                            return (
                              <Card key={category.id} padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                                <div className="flex items-start justify-between gap-3">
                                  <div style={{ minWidth: 0 }}>
                                    <div className="flex items-center gap-2">
                                      <Icon name={CATEGORY_ICON[category.code] ?? 'wrench'} size={20} style={{ color: 'var(--teal-600)', flex: '0 0 auto' }} />
                                      <strong style={{ fontSize: 'var(--fs-body-lg)' }}>{category.name}</strong>
                                    </div>
                                    {skill?.latestIssuingAuthority && (
                                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{skill.latestIssuingAuthority}</span>
                                    )}
                                  </div>
                                  {skillStatusBadge(skill)}
                                </div>

                                {skill && (
                                  <div className="flex gap-6 flex-wrap">
                                    <div>
                                      <div className="tc-label">Số hiệu</div>
                                      <span className="tc-num" style={{ fontSize: 'var(--fs-sm)' }}>{skill.latestCertificateNumber || '—'}</span>
                                    </div>
                                    <div>
                                      <div className="tc-label">Ngày cấp</div>
                                      <span className="tc-num" style={{ fontSize: 'var(--fs-sm)' }}>
                                        {skill.latestIssuedDate ? formatDate(skill.latestIssuedDate) : '—'}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {skill?.verificationStatus === 'VERIFIED' && skill.verifiedAt && (
                                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                                    Xác minh bởi TaskConnect · {formatDate(skill.verifiedAt)}
                                  </span>
                                )}
                                {skill?.verificationStatus === 'REJECTED' && skill.latestCertificationRejectionReason && (
                                  <Alert tone="danger" title="Cần nộp lại">{skill.latestCertificationRejectionReason}</Alert>
                                )}
                                {skill?.verificationStatus === 'PENDING' && (
                                  <Alert tone="info" title="Thời gian thẩm định">
                                    Chứng chỉ được đối chiếu với cơ quan cấp, thường trong 1–3 ngày làm việc.
                                  </Alert>
                                )}

                                <div className="flex gap-2 flex-wrap">
                                  {skill && (
                                    <Button variant="secondary" size="sm" icon="eye" onClick={() => setDetailsCategoryId(category.id)}>
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
                          {visibleCategories.length === 0 && (
                            <EmptyState icon="award" title="Không có nhóm dịch vụ nào ở mục này" />
                          )}
                        </div>

                        {selectedCategory && (
                          <div ref={skillFormRef}>
                            <SkillForm
                              category={selectedCategory}
                              existing={skillByCategory.get(selectedCategory.id)}
                              onCancel={() => setSelectedCategoryId(null)}
                              onDone={() => {
                                setSelectedCategoryId(null)
                                void loadAll()
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', position: 'sticky', top: 'var(--sp-5)' }}>
                        <Card padding="var(--sp-5)">
                          <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Mức độ đủ điều kiện</div>
                          <DataRow label="Nhóm dịch vụ đã xác minh" value={`${verifiedCount} / ${categories.length}`} numeric strong />
                          <DataRow label="Đang chờ duyệt" value={pendingCount} numeric />
                          <DataRow label="Bị từ chối" value={rejectedCount} numeric />
                        </Card>
                        <Alert tone="info" title="Vì sao cần chứng chỉ">
                          Mỗi nhóm dịch vụ cần một hồ sơ kỹ năng kèm chứng chỉ hành nghề riêng. Chứng chỉ được duyệt thì hồ sơ kỹ năng của nhóm đó mới được xác minh.
                        </Alert>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

      {detailsCategory && detailsSkill && (
        <SkillDetailsDialog category={detailsCategory} skill={detailsSkill} onClose={() => setDetailsCategoryId(null)} />
      )}

      {cancelSkillTarget && (
        <DialogViewport>
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
        </DialogViewport>
      )}
    </AppShell>
  )
}
