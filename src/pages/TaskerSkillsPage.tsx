import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { Select } from '@ds/components/forms/Select'
import { AppShell } from '../components/AppShell.tsx'
import { FileDropzone } from '../components/FileDropzone.tsx'
import {
  addAvailabilitySlot,
  createCertificateUploadUrl,
  deleteAvailabilitySlot,
  getMyAvailabilitySlots,
  getMyLatestKyc,
  getMySkills,
  listCertificateRequirements,
  listServiceCategories,
  submitSkill,
  updateAvailabilitySlot,
} from '../api/users.ts'
import type {
  AvailabilitySlotResponse,
  CategoryCertificateRequirementResponse,
  ServiceCategoryResponse,
  TaskerSkillResponse,
} from '../api/users.ts'
import { ApiError } from '../api/client.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'

const ALLOWED_CERTIFICATE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const DAY_LABELS: Record<number, string> = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' }
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: DAY_LABELS[day] }))

function skillStatusBadge(skill: TaskerSkillResponse | undefined) {
  if (!skill) return <Badge tone="neutral">Chưa khai báo</Badge>
  if (skill.verificationStatus === 'VERIFIED') return <Badge tone="success" icon="badge-check">Đã xác minh</Badge>
  if (skill.verificationStatus === 'REJECTED') return <Badge tone="danger" icon="shield-x">Bị từ chối</Badge>
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
        certificateNumber: certificateNumber.trim() || undefined,
        issuingAuthority: issuingAuthority.trim() || undefined,
        issuedDate: issuedDate || undefined,
        expiryDate: expiryDate || undefined,
        fileKey: file.key,
      })
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
        <Field label="Số hiệu chứng chỉ" hint="Không bắt buộc" style={{ flex: 1, minWidth: 200 }}>
          <Input value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Nơi cấp" hint="Không bắt buộc" style={{ flex: 1, minWidth: 200 }}>
          <Input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} disabled={busy} />
        </Field>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Field label="Ngày cấp" hint="Không bắt buộc" style={{ flex: 1, minWidth: 160 }}>
          <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Ngày hết hạn" hint="Không bắt buộc" style={{ flex: 1, minWidth: 160 }}>
          <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={busy} />
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

/**
 * Ho so nang luc Tasker - UC04. Gop 2 phan: khai bao ky nang+chung chi theo tung nhom dich
 * vu (chan cung neu KYC chua VERIFIED) va lich lam viec (doc lap, khong phu thuoc KYC). Chi
 * Tasker vao duoc (RoleGuard o App.tsx), phong theo bo cuc @ds/ui_kits/tasker/ProfileScreen.jsx.
 */
export function TaskerSkillsPage() {
  const [loading, setLoading] = useState(true)
  const [kycVerified, setKycVerified] = useState(false)
  const [categories, setCategories] = useState<ServiceCategoryResponse[]>([])
  const [skills, setSkills] = useState<TaskerSkillResponse[]>([])
  const [slots, setSlots] = useState<AvailabilitySlotResponse[]>([])
  const [loadError, setLoadError] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [slotDay, setSlotDay] = useState('1')
  const [slotStart, setSlotStart] = useState('08:00')
  const [slotEnd, setSlotEnd] = useState('12:00')
  const [slotError, setSlotError] = useState('')
  const [slotBusy, setSlotBusy] = useState(false)

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editDay, setEditDay] = useState('1')
  const [editStart, setEditStart] = useState('08:00')
  const [editEnd, setEditEnd] = useState('12:00')

  const loadAll = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const verified = await getMyLatestKyc().then((kyc) => kyc.status === 'VERIFIED').catch((error) => {
        if (error instanceof ApiError && error.code === 'USR-404-KYC_NOT_FOUND') return false
        throw error
      })
      setKycVerified(verified)

      const [categoryList, slotList] = await Promise.all([listServiceCategories(), getMyAvailabilitySlots()])
      setCategories(categoryList)
      setSlots(slotList)

      if (verified) {
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
    setSlotBusy(true)
    try {
      const created = await addAvailabilitySlot({ dayOfWeek: Number(slotDay), startTime: slotStart, endTime: slotEnd })
      setSlots((prev) => [...prev, created].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
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
    setSlotBusy(true)
    try {
      const updated = await updateAvailabilitySlot(editingSlotId, { dayOfWeek: Number(editDay), startTime: editStart, endTime: editEnd })
      setSlots((prev) => prev.map((slot) => (slot.id === updated.id ? updated : slot)).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
      setEditingSlotId(null)
    } catch (error) {
      setSlotError(error instanceof ApiError ? error.message : 'Không lưu được khung giờ.')
    } finally {
      setSlotBusy(false)
    }
  }

  const skillByCategory = new Map(skills.map((skill) => [skill.categoryId, skill]))
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null

  return (
    <AppShell navValue="skills" title="Hồ sơ năng lực" subtitle="Kỹ năng, chứng chỉ hành nghề và lịch làm việc">
      {loading
        ? null
        : (
            <div className="flex flex-col gap-6">
              {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

              <div>
                <h2 style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--sp-3)' }}>Kỹ năng theo nhóm dịch vụ</h2>
                {!kycVerified
                  ? (
                      <EmptyState icon="shield-question" title="Cần xác thực danh tính trước" action={<Link to="/xac-thuc-danh-tinh"><Button size="sm" icon="shield-check">Xác thực ngay</Button></Link>}>
                        Bạn cần xác thực danh tính (KYC) thành công trước khi khai báo kỹ năng và nộp chứng chỉ hành nghề.
                      </EmptyState>
                    )
                  : (
                      <div className="flex flex-col gap-4">
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}>
                          {categories.map((category) => {
                            const skill = skillByCategory.get(category.id)
                            return (
                              <Card key={category.id} padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                                <strong>{category.name}</strong>
                                {skillStatusBadge(skill)}
                                {skill?.verificationStatus === 'REJECTED' && skill.latestCertificationRejectionReason && (
                                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{skill.latestCertificationRejectionReason}</span>
                                )}
                                {(!skill || skill.verificationStatus === 'REJECTED') && (
                                  <Button variant="secondary" size="sm" onClick={() => setSelectedCategoryId(category.id)}>
                                    {skill ? 'Nộp lại' : 'Khai báo kỹ năng'}
                                  </Button>
                                )}
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
                                      <Input type="time" style={{ width: 120 }} value={editStart} onChange={(e) => setEditStart(e.target.value)} disabled={slotBusy} />
                                      <Input type="time" style={{ width: 120 }} value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={slotBusy} />
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
                      <Input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} disabled={slotBusy} />
                    </Field>
                    <Field label="Kết thúc">
                      <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} disabled={slotBusy} />
                    </Field>
                    <Button variant="secondary" icon="plus" disabled={slotBusy} onClick={() => void handleAddSlot()}>Thêm khung giờ</Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
    </AppShell>
  )
}
