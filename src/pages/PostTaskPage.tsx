import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { AISuggestion } from '@ds/components/marketplace/AISuggestion'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Checkbox } from '@ds/components/forms/Checkbox'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Select } from '@ds/components/forms/Select'
import { Textarea } from '@ds/components/forms/Textarea'
import { AppShell } from '../components/AppShell.tsx'
import { AddressAutocomplete } from '../components/AddressAutocomplete.tsx'
import { ImageLightbox } from '../components/ImageLightbox.tsx'
import { LocationPickerMap } from '../components/LocationPickerMap.tsx'
import { TimeSelect } from '../components/TimeSelect.tsx'
import { createTask, createTaskImageUploadUrl } from '../api/tasks.ts'
import { getMyProfile, listServiceCategories } from '../api/users.ts'
import type { ServiceCategoryResponse } from '../api/users.ts'
import { ApiError } from '../api/client.ts'
import { reverseGeocode } from '../utils/geocoding.ts'
import type { AddressSuggestion } from '../utils/geocoding.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'
import { useToastStore } from '../stores/useToastStore.ts'

const MAX_IMAGES = 5
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// So Tasker uoc tinh khong con o nhap tren giao dien (theo yeu cau nguoi dung) - luon gui 1,
// dung nghia voi OQ-08 da chot tam: truong nay chi de hien thi, khong co nghia he thong.
const DEFAULT_ESTIMATED_WORKERS_NEEDED = 1
// Ty le phi nen tang DA CHOT (docs/02-source-of-truth.md, 8%) - dung o day CHI de xem truoc
// so tien o rail ben phai, khong phai tinh toan that. Tinh toan escrow that (khi module
// Payment ton tai) phai doc tu admin.system_parameters, khong hardcode - xem 02-source-of-truth.md.
const PLATFORM_FEE_RATE = 0.08

function formatVnd(amount: number) {
  return `${amount.toLocaleString('vi-VN')} đ`
}

/** Ngay mai theo gio dia phuong trinh duyet, dang "yyyy-mm-dd" - dung lam min cho lich chon
 *  "Thoi gian mong muon" (phai sau hom nay, khong duoc chon dung hom nay), cung mau
 *  tomorrowDateString() da co o TaskerSkillsPage.tsx. */
function tomorrowDateString() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Ghep ngay ("yyyy-mm-dd") + gio ("HH:mm") thanh chuoi Instant ISO-8601 hop le (co giay va
 * "Z") de BE Instant.parse() doc duoc - vd "2026-10-15T09:00:00.000Z". new Date(...) hieu
 * "yyyy-mm-ddTHH:mm" la gio dia phuong trinh duyet (dung, vi nguoi dung chon gio theo gio
 * cua ho), toISOString() tu quy doi sang UTC. Rong neu chua chon ngay - scheduledAt tuy chon.
 */
function buildScheduledAtIso(date: string, time: string): string | undefined {
  if (!date) return undefined
  return new Date(`${date}T${time}:00`).toISOString()
}

interface PendingImage {
  // Ten duy nhat tren client de lam key/xoa - khong lien quan gi den id tren BE.
  localId: string
  file: File
  previewUrl: string
  publicUrl: string | null
  uploading: boolean
  error?: string
}

/**
 * Dang cong viec (UC06 toi gian) - UC06, chi tao. Xem/sua/huy va UC10/UC11 (Tasker
 * ung tuyen, Poster xac nhan) lam dot sau, xem docs/PROGRESS-TASK-POSTER-MODULE.md.
 * Dia diem cong viec (addressText/lat/lng) la truong rieng cua Task, KHONG lay tu ho
 * so (user_profiles) - Poster co the dang viec o noi khac noi ho dang o. Chon dia diem
 * theo dung 2 huong cua ProfilePage.tsx (go dia chi + chon tu dropdown goi y, hoac bam/keo
 * ghim tren ban do, kem nut "Dung vi tri hien tai") - lat/lng khong con o nhap rieng tren
 * giao dien nhung van la truong bat buoc gui xuong BE, suy ra tu 1 trong 2 cach chon do.
 * Ngan sach va thoi gian mong muon deu tuy chon (khong bat buoc) theo quyet dinh da chot voi
 * nguoi dung. Chi role TASK_POSTER vao duoc trang nay (RoleGuard o App.tsx).
 */
export function PostTaskPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<ServiceCategoryResponse[] | null>(null)
  const [categoriesError, setCategoriesError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [addressText, setAddressText] = useState('')
  // Chuoi rong nghia la chua chon vi tri nao - giu dang chuoi (giong ProfilePage.tsx) de de
  // phan biet "chua chon" (rong) voi "0" (toa do hop le tren xich dao/kinh tuyen goc).
  const [locationLat, setLocationLat] = useState('')
  const [locationLng, setLocationLng] = useState('')
  const [locationResetSignal, setLocationResetSignal] = useState(0)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')
  const [budget, setBudget] = useState('')
  // Ngay + gio mong muon, tach rieng thay vi 1 <input type="datetime-local"> - trinh duyet cho
  // go phut le (vd "00:01"), BE nhan Instant.parse() nghiem ngat (ISO-8601 co giay + timezone)
  // nen bao loi "khong doc duoc body" khi gio khong co giay/mui gio. Dung lai TimeSelect (da
  // co san o Lich lam viec cua ProfilePage.tsx) de gio chi chon duoc theo moc 15 phut, ghep
  // voi ngay thanh Instant hop le luc submit (xem buildScheduledAtIso).
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [images, setImages] = useState<PendingImage[]>([])
  // Xac nhan "hieu cach tien tam giu hoat dong" - chan nut Dang viec, giong mau tham khao
  // (poster/PostJobScreen.jsx). Ban than viec dang cong viec dot nay CHUA giu tien that (chua
  // co Booking/Payment) - checkbox nay la buoc UX chuan bi truoc cho luc co escrow that.
  const [understandsEscrow, setUnderstandsEscrow] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lightbox = useImageLightbox()

  useEffect(() => {
    listServiceCategories()
      .then(setCategories)
      .catch((error) => setCategoriesError(error instanceof ApiError ? error.message : 'Không tải được danh sách nhóm dịch vụ.'))
  }, [])

  // Dien san dia chi cong viec tu ho so ca nhan (neu co) ngay luc vao trang, cho tien - Poster
  // van sua lai thoai mai vi day chi la gia tri goi y ban dau, khong khoa cung: addressText/
  // lat/lng cua Task la truong RIENG, doc lap voi ho so (xem Javadoc dau file) - dien san
  // KHONG bien no thanh dong bo 2 chieu, chi copy 1 lan luc mount. Chua co ho so
  // (USR-404-PROFILE_NOT_FOUND) hoac ho so chua khai bao dia chi/toa do: bo qua, giu form
  // rong nhu cu.
  useEffect(() => {
    getMyProfile()
      .then((profile) => {
        if (profile.addressText && profile.locationLat != null && profile.locationLng != null) {
          setAddressText(profile.addressText)
          setLocationLat(profile.locationLat.toFixed(6))
          setLocationLng(profile.locationLng.toFixed(6))
        }
      })
      .catch(() => {})
  }, [])

  const uploadingCount = images.filter((img) => img.uploading).length

  /**
   * Ap dung 1 toa do vua chon (bam/keo ghim tren ban do, hoac nut "Dung vi tri hien tai") -
   * CHI luu vao toa do/dia chi SAU KHI xac nhan qua reverse geocode la nam trong Viet Nam
   * (cung logic ProfilePage.tsx - xem utils/geocoding.ts "supported"). Ngoai Viet Nam hoac
   * loi mang: khong doi field nao, chi bao loi va keo ghim tro ve vi tri hop le gan nhat qua
   * resetSignal.
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
      setErrors((prev) => ({ ...prev, addressText: '' }))
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : 'Không xác minh được khu vực do lỗi mạng. Toạ độ chưa được lưu, thử lại.')
      setLocationResetSignal((n) => n + 1)
    } finally {
      setGeocoding(false)
    }
  }

  /** Ap dung 1 goi y duoc chon tu dropdown autocomplete o o Dia chi - cung logic ProfilePage.tsx. */
  const applySuggestion = (suggestion: AddressSuggestion) => {
    setGeocodeError('')
    setLocationLat(suggestion.lat.toFixed(6))
    setLocationLng(suggestion.lng.toFixed(6))
    setAddressText(suggestion.addressText)
    setLocationResetSignal((n) => n + 1)
    setErrors((prev) => ({ ...prev, addressText: '' }))
  }

  /** AddressAutocomplete bao ve day khi khong tim ra goi y nao cho van ban dang go - chan nut Dang viec. */
  const handleAddressValidity = (invalid: boolean) => {
    setErrors((prev) => ({ ...prev, addressText: invalid ? 'Không tìm thấy địa chỉ này. Hãy chọn địa chỉ khác hoặc chọn vị trí trên bản đồ.' : '' }))
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Trình duyệt này không hỗ trợ lấy vị trí hiện tại.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => void applyPickedLocation(position.coords.latitude, position.coords.longitude),
      () => setFormError('Không lấy được vị trí hiện tại. Bạn chọn địa chỉ hoặc chọn trên bản đồ.'),
    )
  }

  /** Chon them anh (toi da 5 tam, giu nhung tam da co) - moi anh xin 1 presigned URL rieng va tu tai len S3 ngay. */
  const handlePickImages = async (fileList: FileList) => {
    const remainingSlots = MAX_IMAGES - images.length
    const picked = Array.from(fileList).slice(0, remainingSlots)
    const invalid = picked.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type))
    if (invalid) {
      setErrors((prev) => ({ ...prev, images: 'Chỉ nhận ảnh JPEG/PNG/WEBP.' }))
      return
    }
    setErrors((prev) => ({ ...prev, images: '' }))

    const pendingEntries: PendingImage[] = picked.map((file) => ({
      localId: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      publicUrl: null,
      uploading: true,
    }))
    setImages((prev) => [...prev, ...pendingEntries])

    for (const entry of pendingEntries) {
      try {
        const { uploadUrl, publicUrl } = await createTaskImageUploadUrl(entry.file.type)
        await uploadFileToPresignedUrl(uploadUrl, entry.file)
        setImages((prev) => prev.map((img) => (img.localId === entry.localId ? { ...img, uploading: false, publicUrl } : img)))
      } catch (error) {
        const message = error instanceof ApiError || error instanceof Error ? error.message : 'Tải ảnh lên thất bại.'
        setImages((prev) => prev.map((img) => (img.localId === entry.localId ? { ...img, uploading: false, error: message } : img)))
      }
    }
  }

  /** Bo 1 anh da chon (chua submit thi khong con anh huong gi den BE, file da tai len S3 chi don gian khong duoc dua vao imageUrls). */
  const handleRemoveImage = (localId: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((img) => img.localId !== localId)
    })
  }

  const handleSubmit = async () => {
    // Giu nguyen loi "addressText" bao tu AddressAutocomplete.onValidityChange (xem
    // handleAddressValidity) - khong ghi de mat trang thai "khong tim thay" dang co.
    const nextErrors: Record<string, string> = { addressText: errors.addressText }
    if (!title.trim()) nextErrors.title = 'Nhập tiêu đề công việc.'
    if (!description.trim()) nextErrors.description = 'Mô tả công việc cần làm.'
    if (!categoryId) nextErrors.categoryId = 'Chọn nhóm dịch vụ.'
    if (!nextErrors.addressText && !addressText.trim()) nextErrors.addressText = 'Chọn địa chỉ cần thực hiện công việc.'
    if (!nextErrors.addressText && (!locationLat.trim() || !locationLng.trim())) {
      nextErrors.addressText = 'Chưa xác định được toạ độ — chọn lại từ danh sách gợi ý hoặc chọn vị trí trên bản đồ.'
    }
    if (scheduledDate && scheduledDate < tomorrowDateString()) {
      nextErrors.scheduledAt = 'Thời gian mong muốn phải sau hôm nay.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setFormError('')
    setBusy(true)
    try {
      await createTask({
        categoryId,
        title: title.trim(),
        description: description.trim(),
        addressText: addressText.trim(),
        lat: Number(locationLat),
        lng: Number(locationLng),
        budgetAmount: budget.trim() ? Number(budget) : undefined,
        scheduledAt: buildScheduledAtIso(scheduledDate, scheduledTime),
        estimatedWorkersNeeded: DEFAULT_ESTIMATED_WORKERS_NEEDED,
        imageUrls: images.map((img) => img.publicUrl).filter((url): url is string => !!url),
      })
      useToastStore.getState().pushToast('success', 'Đăng việc thành công.')
      navigate('/viec-cua-toi')
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.details && typeof error.details === 'object'
        ? error.details as Record<string, string>
        : null
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }))
      } else {
        setFormError(error instanceof ApiError ? error.message : 'Không đăng được việc. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell navValue="post" title="Đăng việc" subtitle="Mô tả công việc cần làm, Tasker phù hợp sẽ ứng tuyển">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,var(--content-max)) 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          {categoriesError && <Alert tone="danger" title="Không tải được dữ liệu">{categoriesError}</Alert>}
          {formError && <Alert tone="danger" title="Không đăng được việc">{formError}</Alert>}

          <Field label="Tiêu đề" required error={errors.title}>
            <Input
              maxLength={150}
              placeholder="Vd: Sửa vòi nước bị rỉ trong bếp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              error={!!errors.title}
            />
          </Field>

          <Field label="Mô tả chi tiết" required error={errors.description} hint="Càng chi tiết, Tasker càng dễ báo giá đúng">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              error={!!errors.description}
            />
          </Field>

          <AISuggestion
            label="Gợi ý từ AI"
            value="Sửa chữa điện nước · 400.000 – 600.000 ₫"
            confidence={82}
          >
            Minh hoạ giao diện — tính năng tự gợi ý danh mục và khoảng giá từ mô tả sẽ được bổ
            sung khi module AI hoàn thành. Hiện tại bạn tự chọn danh mục và ngân sách bên dưới.
          </AISuggestion>

          <Field label="Nhóm dịch vụ" required error={errors.categoryId}>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={busy || !categories}
              error={!!errors.categoryId}
              options={[{ value: '', label: categories ? 'Chọn nhóm dịch vụ' : 'Đang tải…' },
                ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>

          <Field
            label="Địa chỉ cần thực hiện công việc"
            required
            error={errors.addressText}
            hint="Tự điền từ hồ sơ của bạn nếu có — gõ để tìm và chọn từ danh sách gợi ý, hoặc chọn vị trí trên bản đồ bên phải, để sửa lại nếu khác nơi ở trong hồ sơ"
          >
            <AddressAutocomplete
              value={addressText}
              onSelectSuggestion={applySuggestion}
              onValidityChange={handleAddressValidity}
              disabled={busy}
            />
          </Field>

          <Field label="Ngân sách" hint="Không bắt buộc — để trống hiển thị 'thoả thuận'" error={errors.budgetAmount} style={{ maxWidth: 280 }}>
            <Input
              numeric inputMode="numeric" suffix="₫"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
              error={!!errors.budgetAmount}
            />
          </Field>

          <Field label="Thời gian mong muốn" hint="Không bắt buộc" error={errors.scheduledAt}>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="date"
                min={tomorrowDateString()}
                value={scheduledDate}
                onChange={(e) => { setScheduledDate(e.target.value); setErrors((prev) => ({ ...prev, scheduledAt: '' })) }}
                disabled={busy}
                error={!!errors.scheduledAt}
                style={{ maxWidth: 200 }}
              />
              <TimeSelect value={scheduledTime} onChange={setScheduledTime} disabled={busy || !scheduledDate} />
            </div>
          </Field>

          <Field label="Ảnh minh hoạ công việc" hint={`Không bắt buộc — tối đa ${MAX_IMAGES} ảnh, bấm vào ảnh để phóng to`} error={errors.images}>
            <div className="flex gap-3 flex-wrap">
              {images.map((img) => (
                <div key={img.localId} style={{ width: 96 }}>
                  <div style={{ position: 'relative', width: 96, height: 96 }}>
                    <img
                      src={img.previewUrl}
                      alt=""
                      onClick={() => !img.uploading && lightbox.open(images.map((i) => i.previewUrl), images.indexOf(img))}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-md)',
                        border: `var(--bw) solid ${img.error ? 'var(--danger)' : 'var(--border)'}`,
                        opacity: img.uploading ? 0.5 : 1,
                        cursor: img.uploading ? 'default' : 'zoom-in',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.localId)}
                      disabled={busy}
                      aria-label="Bỏ ảnh này"
                      style={{
                        position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 'var(--r-pill)',
                        background: 'var(--surface-card)', border: 'var(--bw) solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                      }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                    {img.uploading && (
                      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)' }}>
                        Đang tải…
                      </span>
                    )}
                  </div>
                  {img.error && (
                    <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--danger)', lineHeight: 1.3 }}>
                      {img.error} Ảnh này sẽ KHÔNG được đăng kèm việc — bấm x để bỏ hoặc thử lại.
                    </span>
                  )}
                </div>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="flex flex-col items-center justify-center gap-1"
                  style={{
                    width: 96, height: 96, borderRadius: 'var(--r-md)', border: 'var(--bw) dashed var(--teal-300)',
                    background: 'var(--bg-section)', color: 'var(--teal-700)', cursor: 'pointer', padding: 0,
                  }}
                >
                  <Icon name="plus" size={20} />
                  <span style={{ fontSize: 'var(--fs-xs)' }}>Thêm ảnh</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void handlePickImages(e.target.files)
                e.target.value = ''
              }}
            />
          </Field>

          <Checkbox
            checked={understandsEscrow}
            onChange={(e) => setUnderstandsEscrow(e.target.checked)}
            disabled={busy}
            label="Tôi hiểu cách tiền tạm giữ hoạt động"
            description="Sau khi bạn chọn Tasker, tiền chuyển sang trạng thái tạm giữ và chỉ được giải ngân khi bạn nghiệm thu. Nếu hai bên không thống nhất, hồ sơ chuyển sang khiếu nại."
          />

          <Button
            size="lg" icon="file-plus-2"
            disabled={busy || uploadingCount > 0 || !understandsEscrow}
            onClick={() => void handleSubmit()}
            style={{ alignSelf: 'flex-start' }}
          >
            {busy ? 'Đang đăng…' : 'Đăng việc'}
          </Button>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', position: 'sticky', top: 'var(--sp-5)' }}>
          {(() => {
            const budgetNumber = budget.trim() ? Number(budget) : 0
            if (budgetNumber <= 0) {
              return (
                <Card tone="money" padding="var(--sp-5)">
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.55 }}>
                    Nhập ngân sách để xem trước số tiền sẽ tạm giữ khi bạn chọn Tasker.
                  </p>
                </Card>
              )
            }
            const feeAmount = Math.round(budgetNumber * PLATFORM_FEE_RATE)
            const taskerReceives = budgetNumber - feeAmount
            return (
              <Card tone="money" padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <MoneyAmount value={budgetNumber} size="lg" tone="money" label="Sẽ tạm giữ khi bạn chọn Tasker" />
                <DataRow label="Phí nền tảng (8%)" value={formatVnd(feeAmount)} numeric />
                <DataRow label="Tasker nhận được" value={formatVnd(taskerReceives)} numeric strong />
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.55, margin: 0 }}>
                  Không có phí đăng việc. Nếu bạn huỷ trước khi Tasker bắt đầu, tiền hoàn về nguyên vẹn.
                </p>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Bản xem trước giao diện — ví và tạm giữ tiền thật sẽ có khi module Thanh toán hoàn thành.
                </p>
              </Card>
            )
          })()}

          <Alert tone="info" title="Gợi ý AI hoạt động thế nào">
            Mô hình sẽ đọc mô tả của bạn để đoán danh mục và khoảng giá thị trường. Nó không tự đăng
            việc, không tự chọn Tasker, và không đàm phán giá. Khối minh hoạ ở trên là giao diện xem
            trước, module AI thật sẽ được bổ sung ở giai đoạn sau.
          </Alert>

          <Card padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="tc-label">Chọn vị trí trên bản đồ</div>
              <Button variant="ghost" size="sm" icon="locate-fixed" onClick={handleUseCurrentLocation} disabled={busy}>
                Vị trí hiện tại
              </Button>
            </div>
            <LocationPickerMap
              lat={locationLat.trim() ? Number(locationLat) : null}
              lng={locationLng.trim() ? Number(locationLng) : null}
              resetSignal={locationResetSignal}
              onPick={(pickedLat, pickedLng) => void applyPickedLocation(pickedLat, pickedLng)}
            />
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Bấm vào bản đồ hoặc kéo ghim để chọn vị trí — hệ thống tự điền "Địa chỉ", bạn sửa lại được nếu chưa đúng.
            </p>
            {geocoding && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Đang tra địa chỉ từ toạ độ…</span>}
            {geocodeError && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{geocodeError}</span>}
          </Card>
          <Alert tone="info" title="Việc của bạn hiển thị ngay">
            Công việc đăng xong hiển thị công khai cho Tasker ngay lập tức, không cần chờ duyệt.
          </Alert>
        </div>
      </div>

      {lightbox.viewerUrl && (
        <ImageLightbox
          url={lightbox.viewerUrl}
          zoom={lightbox.viewerZoom}
          rotation={lightbox.viewerRotation}
          onClose={lightbox.close}
          onZoomIn={lightbox.zoomIn}
          onZoomOut={lightbox.zoomOut}
          onRotate={lightbox.rotate}
          index={lightbox.index}
          total={lightbox.total}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
          onGoTo={lightbox.goTo}
        />
      )}
    </AppShell>
  )
}
