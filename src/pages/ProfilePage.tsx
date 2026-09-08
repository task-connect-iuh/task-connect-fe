import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Chip } from '@ds/components/core/Chip'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { Select } from '@ds/components/forms/Select'
import { Textarea } from '@ds/components/forms/Textarea'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { AddressAutocomplete } from '../components/AddressAutocomplete.tsx'
import { AppShell } from '../components/AppShell.tsx'
import { LocationPickerMap } from '../components/LocationPickerMap.tsx'
import { TimeSelect } from '../components/TimeSelect.tsx'
import {
  addAvailabilitySlot,
  createAvatarUploadUrl,
  deleteAvailabilitySlot,
  getMyAvailabilitySlots,
  getMyLatestKyc,
  getMyProfile,
  getMySkills,
  listServiceCategories,
  updateAvailabilitySlot,
  updateMyProfile,
} from '../api/users.ts'
import type { AvailabilitySlotResponse, KycStatus, KycStatusResponse, ProfileResponse, ServiceCategoryResponse, TaskerSkillResponse } from '../api/users.ts'
import { updatePhone } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { useProfileStore } from '../stores/useProfileStore.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { DAY_LABELS, DAY_OPTIONS, DAY_SHORT_LABELS } from '../utils/dayOfWeek.ts'
import { formatDate } from '../utils/formatDate.ts'
import { reverseGeocode } from '../utils/geocoding.ts'
import type { AddressSuggestion } from '../utils/geocoding.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'

// Nhan/icon trang thai KYC cho khoi "Xac minh danh tinh" - trung voi cac trang Admin (vd
// KycQueuePage.tsx ben task-connect-admin) nhung 2 app tach repo nen khong import chung duoc.
const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  NOT_SUBMITTED: 'Chưa xác thực danh tính',
  VERIFYING: 'Đang chờ xác thực',
  VERIFIED: 'Đã xác thực danh tính',
  REJECTED: 'Xác thực bị từ chối',
  CANCELLED: 'Đã huỷ xác thực',
}
const KYC_STATUS_ICON: Record<KycStatus, string> = {
  NOT_SUBMITTED: 'shield-question',
  VERIFYING: 'shield-question',
  VERIFIED: 'badge-check',
  REJECTED: 'shield-x',
  CANCELLED: 'shield-question',
}
// Tone rieng cho khoi Alert "Xac minh danh tinh" - Alert chi co 5 tone (info/success/warning/
// danger/money), khac bo tone cua Badge (warning/success/danger/neutral) o tren.
const KYC_ALERT_TONE: Record<KycStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  NOT_SUBMITTED: 'info',
  VERIFYING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'info',
}

/** Mo ta ngan cho khoi "Xac minh danh tinh" o ProfilePage - dung kycDetail (ban ghi lan nop KYC gan nhat, tu getMyLatestKyc()) de co ngay duyet/ly do tu choi, kycStatus (tu ProfileResponse) de xac dinh trang thai vi day la nguon duy nhat tra ve duoc NOT_SUBMITTED. */
function kycStatusDescription(status: KycStatus, detail: KycStatusResponse | null) {
  switch (status) {
    case 'VERIFIED':
      return detail?.reviewedAt ? `Danh tính đã được duyệt ngày ${formatDate(detail.reviewedAt)}.` : 'Danh tính của bạn đã được duyệt.'
    case 'VERIFYING':
      return 'Hồ sơ đang được đối chiếu, thường trong 1–3 ngày làm việc.'
    case 'REJECTED':
      return detail?.rejectionReason ? `Hồ sơ bị từ chối: ${detail.rejectionReason}` : 'Hồ sơ xác thực bị từ chối, nộp lại để tiếp tục.'
    case 'CANCELLED':
      return 'Bạn đã huỷ hồ sơ xác thực gần nhất, nộp lại khi cần.'
    case 'NOT_SUBMITTED':
    default:
      return 'Bạn chưa nộp xác thực danh tính (KYC).'
  }
}

/** Hai khoang [aStart,aEnd) va [bStart,bEnd) (chuoi "HH:MM", so sanh duoc theo tu dien vi da zero-pad) co chong lan hay khong. */
function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd
}

// Whitelist khop dung common/storage/ImageContentTypes.java (avatar dung chung whitelist nay).
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Muc chon san cho "Ban kinh lam viec uu tien" - khop bien @Min(1)/@Max(50) cua
// UpdateProfileRequest.preferredRadiusKm o BE, khong cho go tay de tranh gia tri le.
const RADIUS_OPTIONS = [3, 5, 10, 15, 20, 30, 50].map((km) => ({ value: String(km), label: `${km} km` }))

/**
 * Ho so ca nhan cua chinh minh - UC03. GET /users/me nem USR-404-PROFILE_NOT_FOUND neu chua
 * tung PATCH lan nao (lazy-create o backend, xem docs/PROGRESS-USER-MODULE.md Buoc 1) - man
 * nay coi truong hop do la "chua co ho so", tu dong mo che do sua voi form rong thay vi bao
 * loi. Anh dai dien chi upload len S3 ngay khi chon (public-read, xem ADR-003), nhung chi
 * thuc su luu vao ho so khi bam "Lưu thay đổi" cung cac truong khac - tranh PATCH rieng
 * avatarUrl bi tu choi vi thieu fullName/operatingArea bat buoc o lan tao ho so dau tien.
 *
 * Doi email va doi mat khau tach rieng sang AccountSecurityPage (/ho-so/bao-mat) - day la
 * thong tin dang nhap dung chung cho moi vai tro, khac "thong tin ca nhan" hien theo tung
 * vai tro o day.
 *
 * Man hinh mac dinh o CHE DO XEM (chi doc) - bam "Sửa hồ sơ" moi chuyen sang form sua duoc.
 * Luc sua, moi truong deu bat buoc nhap (tru "Gioi thieu ban than") - handleSubmit chan Luu
 * neu con truong bat buoc bo trong.
 *
 * Ngoai "Thong tin ca nhan" (PATCH /users/me), trang con hien 2 khoi rieng chi danh cho tai
 * khoan co vai tro Tasker (isTasker, xem session.account.roles - tai khoan tu dang ky luon co
 * ca Poster/Tasker, chi tai khoan Admin thuan (chi co role admin) moi khong co): "Ky nang da
 * xac minh" (tom tat, doc qua getMySkills()/listServiceCategories(), sua that su van o trang
 * rieng "/ho-so-nang-luc") va "Lich lam viec" (CRUD day du, chuyen nguyen tu TaskerSkillsPage.tsx
 * sang day vi hop ly hon ve chu de - lich ranh la thong tin ca nhan, khong phai ho so ky nang).
 * Trang nay dung chung ca 3 vai tro (RoleGuard allow ['poster','tasker','admin']) nen 2 khoi do
 * PHAI gate boi isTasker, khac voi khoi "Thong tin ca nhan"/"Tai khoan & bao mat" hien cho tat ca.
 */
export function ProfilePage() {
  const navigate = useNavigate()
  const accountId = useAuthStore((state) => state.session?.account.id)
  const isTasker = useAuthStore((state) => state.session?.account.roles.includes('tasker') ?? false)

  const [loading, setLoading] = useState(true)
  const [isNewProfile, setIsNewProfile] = useState(false)
  const [loadError, setLoadError] = useState('')
  // Che do xem/sua cua toan bo the "Thong tin ca nhan" (avatar + cac truong ben duoi) -
  // ho so moi tao (isNewProfile) khong co gi de xem nen luon mo san che do sua.
  const [editMode, setEditMode] = useState(false)
  // Ban sao ho so vua tai/vua luu thanh cong gan nhat - dung de khoi phuc lai cac truong khi
  // nguoi dung bam "Huỷ" giua luc dang sua, khong goi lai GET /users/me.
  const [lastProfile, setLastProfile] = useState<ProfileResponse | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  // Gia tri phone luc tai ho so - dung de biet nguoi dung co THUC SU doi so hay khong luc
  // bam "Luu thay doi", tranh goi PATCH /auth/me/phone khong can thiet moi lan luu ho so.
  const [phoneAtLoad, setPhoneAtLoad] = useState('')
  const [phoneError, setPhoneError] = useState('')
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
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string, operatingArea?: string, address?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')

  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null)
  // Ban ghi lan nop KYC gan nhat (ngay duyet/ly do tu choi) - chi de hien mo ta chi tiet o
  // khoi "Xac minh danh tinh", trang thai chinh van doc tu kycStatus (ProfileResponse.kycStatus).
  const [kycDetail, setKycDetail] = useState<KycStatusResponse | null>(null)

  // Ban kinh lam viec uu tien (km) - luu ngay khi doi (khong qua editMode cua the "Thong
  // tin ca nhan"), giong cach Lich lam viec ben duoi luon tuong tac duoc.
  const [preferredRadiusKm, setPreferredRadiusKm] = useState('')
  const [radiusBusy, setRadiusBusy] = useState(false)
  const [radiusError, setRadiusError] = useState('')

  // Tom tat "Ky nang da xac minh" - chi doc, sua that su o TaskerSkillsPage.tsx (/ho-so-nang-luc).
  const [skills, setSkills] = useState<TaskerSkillResponse[]>([])
  const [categories, setCategories] = useState<ServiceCategoryResponse[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError] = useState('')

  // Lich lam viec - CRUD day du, chuyen nguyen logic tu TaskerSkillsPage.tsx.
  const [slots, setSlots] = useState<AvailabilitySlotResponse[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  // Chon nhieu ngay cung luc khi them khung gio (vd Thu 2 - Thu 6) - moi ngay duoc chon tao
  // rieng mot ban ghi AvailabilitySlotResponse (BE khong co endpoint tao hang loat).
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1]))
  const [slotStart, setSlotStart] = useState('08:00')
  const [slotEnd, setSlotEnd] = useState('12:00')
  const [slotError, setSlotError] = useState('')
  const [slotBusy, setSlotBusy] = useState(false)

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editDay, setEditDay] = useState('1')
  const [editStart, setEditStart] = useState('08:00')
  const [editEnd, setEditEnd] = useState('12:00')

  const applyProfile = (profile: ProfileResponse) => {
    setFullName(profile.fullName ?? '')
    setEmail(profile.email)
    setPhone(profile.phone ?? '')
    setPhoneAtLoad(profile.phone ?? '')
    setAvatarUrl(profile.avatarUrl)
    setAddressText(profile.addressText ?? '')
    setBio(profile.bio ?? '')
    setOperatingArea(profile.operatingArea ?? '')
    setLocationLat(profile.locationLat != null ? String(profile.locationLat) : '')
    setLocationLng(profile.locationLng != null ? String(profile.locationLng) : '')
    setPreferredRadiusKm(profile.preferredRadiusKm != null ? String(profile.preferredRadiusKm) : '')
    setKycStatus(profile.kycStatus)
    setLastProfile(profile)
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
          setEditMode(true)
        } else {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được hồ sơ. Kiểm tra mạng rồi thử lại.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Ky nang da xac minh + lich lam viec chi ap dung cho tai khoan co vai tro Tasker - khong
  // goi API rieng cho Poster/Admin thuan (isTasker false, xem javadoc component o tren).
  useEffect(() => {
    if (!isTasker) return
    let cancelled = false

    setSkillsLoading(true)
    setSkillsError('')
    Promise.all([listServiceCategories(), getMySkills()])
      .then(([categoryList, skillList]) => {
        if (cancelled) return
        setCategories(categoryList)
        setSkills(skillList)
      })
      .catch((error) => {
        if (cancelled) return
        setSkillsError(error instanceof ApiError ? error.message : 'Không tải được kỹ năng đã xác minh.')
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false)
      })

    setSlotsLoading(true)
    getMyAvailabilitySlots()
      .then((slotList) => {
        if (cancelled) return
        setSlots(slotList)
      })
      .catch((error) => {
        if (cancelled) return
        setSlotError(error instanceof ApiError ? error.message : 'Không tải được lịch làm việc.')
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })

    // Chi de lay ngay duyet/ly do tu choi hien trong mo ta - 404 USR-404-KYC_NOT_FOUND
    // (chua tung nop lan nao) la binh thuong, bo qua lang le vi kycStatus da du de biet
    // NOT_SUBMITTED roi.
    getMyLatestKyc()
      .then((detail) => { if (!cancelled) setKycDetail(detail) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [isTasker])

  /**
   * Doi ban kinh lam viec uu tien - luu ngay (PATCH mot phan, khong dung chung voi nut "Luu
   * thay doi" cua the "Thong tin ca nhan"), giong cach Lich lam viec ben duoi luon tuong
   * tac duoc doc lap voi editMode. Chon lai "Chua dat" khong goi API (BE coi null la "khong
   * doi" theo dung ngu nghia PATCH, khong xoa duoc gia tri da luu qua duong nay).
   */
  const handleRadiusChange = async (value: string) => {
    if (!value) return
    setRadiusError('')
    setRadiusBusy(true)
    try {
      const updated = await updateMyProfile({ preferredRadiusKm: Number(value) })
      applyProfile(updated)
      useToastStore.getState().pushToast('success', 'Đã lưu bán kính làm việc ưu tiên.')
    } catch (error) {
      setRadiusError(error instanceof ApiError ? error.message : 'Không lưu được bán kính làm việc. Kiểm tra mạng rồi thử lại.')
    } finally {
      setRadiusBusy(false)
    }
  }

  /** Bam/bo chon 1 ngay trong nhom Chip "Them khung gio" - cho phep chon nhieu ngay cung luc (vd T2-T6). */
  const toggleSlotDay = (day: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  /**
   * Them khung gio ranh cho MOI ngay dang duoc chon trong selectedDays cung luc - BE khong
   * co endpoint tao hang loat nen goi addAvailabilitySlot() rieng cho tung ngay (Promise.
   * allSettled thay vi Promise.all: 1 ngay bi trung/loi khong duoc lam mat cac ngay con lai
   * da tao thanh cong, tranh nguoi dung tuong minh phai bam lai tu dau ca nhung ngay da qua).
   */
  const handleAddSlot = async () => {
    setSlotError('')
    if (selectedDays.size === 0) {
      setSlotError('Chọn ít nhất một ngày.')
      return
    }
    if (slotEnd <= slotStart) {
      setSlotError('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }
    const days = Array.from(selectedDays)
    const overlapDay = days.find((day) => slots.some((slot) => slot.dayOfWeek === day
      && timeRangesOverlap(slotStart, slotEnd, slot.startTime.slice(0, 5), slot.endTime.slice(0, 5))))
    if (overlapDay != null) {
      setSlotError(`Khung giờ này trùng với một khung giờ đã khai báo trong ${DAY_LABELS[overlapDay]}.`)
      return
    }
    setSlotBusy(true)
    try {
      const results = await Promise.allSettled(
        days.map((day) => addAvailabilitySlot({ dayOfWeek: day, startTime: slotStart, endTime: slotEnd })),
      )
      const created = results
        .filter((result): result is PromiseFulfilledResult<AvailabilitySlotResponse> => result.status === 'fulfilled')
        .map((result) => result.value)
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

      if (created.length > 0) {
        setSlots((prev) => [...prev, ...created].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)))
      }
      if (failed.length > 0) {
        const firstError = failed[0].reason
        setSlotError(
          firstError instanceof ApiError
            ? firstError.message
            : `Không thêm được khung giờ cho ${failed.length} ngày.`,
        )
      }
      if (created.length > 0) {
        useToastStore.getState().pushToast('success', created.length > 1 ? `Đã thêm khung giờ cho ${created.length} ngày.` : 'Đã thêm khung giờ.')
      }
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
      setFieldErrors((prev) => ({ ...prev, address: undefined }))
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : 'Không xác minh được khu vực do lỗi mạng. Toạ độ chưa được lưu, thử lại.')
      setLocationResetSignal((n) => n + 1)
    } finally {
      setGeocoding(false)
    }
  }

  /**
   * Ap dung 1 goi y duoc chon tu dropdown autocomplete (go dia chi kieu GrabFood, xem
   * AddressAutocomplete.tsx) - khac applyPickedLocation: khong can goi lai reverseGeocode vi
   * searchAddress() da tra du addressText/operatingArea/toa do va da loc san chi con ket qua
   * Viet Nam (xem utils/geocoding.ts), nen luon la lua chon hop le. resetSignal van tang de
   * ep LocationPickerMap chay lai effect dong bo ke ca khi toa do trung gia tri cu.
   */
  const applySuggestion = (suggestion: AddressSuggestion) => {
    setGeocodeError('')
    setLocationLat(suggestion.lat.toFixed(6))
    setLocationLng(suggestion.lng.toFixed(6))
    setAddressText(suggestion.addressText)
    if (suggestion.operatingArea) setOperatingArea(suggestion.operatingArea)
    setLocationResetSignal((n) => n + 1)
    setFieldErrors((prev) => ({ ...prev, address: undefined }))
  }

  /**
   * AddressAutocomplete bao ve day khi o Dia chi dang o trang thai "tim khong ra goi y nao
   * cho van ban dang go" (xem Javadoc component do) - luu vao fieldErrors.address de Field
   * hien thong bao va handleSubmit chan nut Luu, tranh bao "da luu thanh cong" trong khi dia
   * chi that ra khong doi (van la gia tri cu).
   */
  const handleAddressValidity = (invalid: boolean) => {
    setFieldErrors((prev) => ({ ...prev, address: invalid ? 'Chưa tìm được địa chỉ hợp lệ.' : undefined }))
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

  const handleStartEdit = () => {
    setFormError('')
    setFieldErrors({})
    setPhoneError('')
    setAvatarError('')
    setGeocodeError('')
    setEditMode(true)
  }

  /** Huy sua - khoi phuc lai gia tri tu lan tai/luu gan nhat, khong goi lai API. */
  const handleCancelEdit = () => {
    if (lastProfile) applyProfile(lastProfile)
    setFieldErrors({})
    setFormError('')
    setPhoneError('')
    setAvatarError('')
    setGeocodeError('')
    setEditMode(false)
  }

  const handleSubmit = async () => {
    // Giu nguyen loi "address" (bao tu AddressAutocomplete.onValidityChange, xem
    // applySuggestion/handleAddressValidity ben duoi) - nextErrors chi tinh lai
    // fullName/operatingArea/address rong, khong duoc ghi de mat trang thai loi dia chi
    // "khong tim thay" dang co.
    const nextErrors: typeof fieldErrors = { address: fieldErrors.address }
    if (!fullName.trim()) nextErrors.fullName = 'Nhập họ tên.'
    if (!operatingArea.trim()) nextErrors.operatingArea = 'Nhập khu vực hoạt động.'
    if (!nextErrors.address && !addressText.trim()) nextErrors.address = 'Chọn địa chỉ.'
    setFieldErrors(nextErrors)

    const nextPhoneError = phone.trim() ? '' : 'Nhập số điện thoại.'
    setPhoneError(nextPhoneError)

    if (nextErrors.fullName || nextErrors.operatingArea || nextErrors.address || nextPhoneError) return

    setFormError('')
    setBusy(true)

    // Doi so dien thoai (neu co doi) TRUOC khi luu cac truong con lai - phone nam o
    // AuthAccount (module Auth), khong phai user_profiles, nen la mot API call rieng (PATCH
    // /auth/me/phone). Trung so voi tai khoan khac (AUTH-409-PHONE_EXISTS) thi to do o dung
    // field va toast, dung nhu cac field khac, va DUNG luon o day - khong luu tiep cac truong
    // con lai, tranh nguoi dung tuong da luu xong het trong khi so dien thoai chua doi duoc.
    if (phone.trim() !== phoneAtLoad.trim()) {
      try {
        await updatePhone(phone.trim())
        setPhoneAtLoad(phone.trim())
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Không cập nhật được số điện thoại. Kiểm tra mạng rồi thử lại.'
        setPhoneError(message)
        useToastStore.getState().pushToast('danger', message)
        setBusy(false)
        return
      }
    }

    try {
      const updated = await updateMyProfile({
        fullName: fullName.trim(),
        avatarUrl: avatarUrl ?? undefined,
        addressText: addressText.trim(),
        bio: bio.trim() || undefined,
        operatingArea: operatingArea.trim(),
        locationLat: locationLat.trim() ? Number(locationLat) : undefined,
        locationLng: locationLng.trim() ? Number(locationLng) : undefined,
      })
      applyProfile(updated)
      setIsNewProfile(false)
      setEditMode(false)
      useToastStore.getState().pushToast('success', 'Đã lưu hồ sơ.')
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Không lưu được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
  const verifiedSkills = skills.filter((skill) => skill.verificationStatus === 'VERIFIED')
  // Rail ben phai chi xuat hien khi co gi de hien: the ban do luc dang sua, hoac khoi "Xac
  // minh danh tinh" cho Tasker - khac editMode (chi rieng the ban do), phai tinh gop ca 2.
  const hasSidebar = editMode || (isTasker && !!kycStatus)

  return (
    <AppShell navValue="profile" title="Hồ sơ cá nhân" subtitle="Thông tin này hiển thị khi bạn đăng việc hoặc nhận việc">
      {loading
        ? null
        : (
            <div style={{ display: 'grid', gridTemplateColumns: hasSidebar ? 'minmax(0,var(--content-max)) 1fr' : 'minmax(0,var(--content-max))', gap: 'var(--sp-6)', alignItems: 'start' }}>
            <div className="flex flex-col gap-6">
              {loadError && <Alert tone="danger" title="Không tải được hồ sơ">{loadError}</Alert>}
              {isNewProfile && (
                <Alert tone="info" title="Bạn chưa có hồ sơ">
                  Điền thông tin bên dưới và lưu lại để tạo hồ sơ lần đầu.
                </Alert>
              )}
              {formError && <Alert tone="danger" title="Không lưu được hồ sơ">{formError}</Alert>}

              <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                <div className="flex gap-5 items-center">
                  <Avatar name={fullName || 'Tài khoản'} src={avatarUrl ?? undefined} size={80} />
                  <div className="flex-1 flex flex-col gap-2">
                    <strong style={{ fontSize: 'var(--fs-h3)' }}>{fullName || 'Chưa đặt tên'}</strong>
                    {accountId && (
                      <Link to={`/ho-so/${accountId}`} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)' }}>
                        Xem hồ sơ công khai của bạn
                      </Link>
                    )}
                  </div>
                  {editMode
                    ? (
                        <Button
                          variant="secondary"
                          size="md"
                          icon="image-up"
                          disabled={avatarUploading}
                          onClick={() => document.getElementById('avatar-file-input')?.click()}
                        >
                          {avatarUploading ? 'Đang tải ảnh…' : 'Đổi ảnh đại diện'}
                        </Button>
                      )
                    : (
                        <Button variant="secondary" size="md" icon="pencil" onClick={handleStartEdit}>
                          Sửa hồ sơ
                        </Button>
                      )}
                </div>

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
                {editMode && avatarError && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{avatarError}</span>
                )}

                <div style={{ borderTop: 'var(--bw) solid var(--border-subtle)' }} />

                {!editMode
                  ? (
                      <div className="flex flex-col">
                        <DataRow label="Số điện thoại" value={phone || '—'} />
                        <DataRow label="Địa chỉ" value={addressText || '—'} />
                        <DataRow label="Khu vực hoạt động" value={operatingArea || '—'} />
                        <div style={{ padding: 'var(--sp-3) 0' }}>
                          <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Giới thiệu bản thân</div>
                          <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {bio || 'Chưa có giới thiệu.'}
                          </p>
                        </div>
                      </div>
                    )
                  : (
                      <>
                        <Field label="Số điện thoại" required error={phoneError}>
                          <Input
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                            disabled={busy}
                            error={!!phoneError}
                          />
                        </Field>

                        <Field label="Họ và tên" required error={fieldErrors.fullName}>
                          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} error={!!fieldErrors.fullName} />
                        </Field>

                        <Field label="Khu vực hoạt động" required error={fieldErrors.operatingArea} hint="Tự động điền khi bạn chọn địa chỉ ở dưới — không gõ tay được">
                          <Input value={operatingArea} readOnly disabled={busy} error={!!fieldErrors.operatingArea} />
                        </Field>

                        <Field label="Địa chỉ" required error={fieldErrors.address} hint="Gõ để tìm và chỉ chọn từ danh sách gợi ý — không gõ tay giữ lại được">
                          <AddressAutocomplete
                            value={addressText}
                            onSelectSuggestion={applySuggestion}
                            onValidityChange={handleAddressValidity}
                            disabled={busy}
                          />
                        </Field>

                        <Field label="Giới thiệu bản thân" hint="Không bắt buộc, hiển thị công khai trên hồ sơ của bạn">
                          <Textarea rows={4} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} disabled={busy} />
                        </Field>

                        <Field label="Toạ độ" hint="Chọn trên bản đồ bên phải, dùng vị trí hiện tại, hoặc chọn từ gợi ý ở ô Địa chỉ — không gõ tay được ở đây">
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

                        <div className="flex gap-3">
                          <Button variant="primary" size="lg" disabled={busy} onClick={handleSubmit}>
                            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                          </Button>
                          {!isNewProfile && (
                            <Button variant="ghost" size="lg" disabled={busy} onClick={handleCancelEdit}>
                              Huỷ
                            </Button>
                          )}
                        </div>
                      </>
                    )}
              </Card>

              {isTasker && (
                <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <strong style={{ fontSize: 'var(--fs-h3)' }}>Năng lực & lịch làm việc</strong>
                    <Button variant="secondary" size="sm" icon="award" onClick={() => navigate('/ho-so-nang-luc')}>Quản lý kỹ năng</Button>
                  </div>

                  <div className="tc-label">Kỹ năng đã xác minh</div>
                  {skillsError && <Alert tone="danger" title="Không tải được kỹ năng">{skillsError}</Alert>}
                  {!skillsLoading && !skillsError && verifiedSkills.length === 0 && (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>Chưa có nhóm dịch vụ nào được xác minh.</p>
                  )}
                  {verifiedSkills.length > 0 && (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                      {verifiedSkills.map((skill) => (
                        <Card key={skill.categoryId} tone="sunken" padding="var(--sp-4)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                          <div className="flex items-center justify-between gap-2">
                            <strong style={{ fontSize: 'var(--fs-sm)' }}>{categoryNameById.get(skill.categoryId) ?? skill.categoryId}</strong>
                            <Badge tone="success" icon="badge-check">Đã xác minh</Badge>
                          </div>
                          <Badge tone="neutral" icon="clock">{skill.yearsExperience} năm kinh nghiệm</Badge>
                          {(skill.priceMin != null || skill.priceMax != null) && (
                            <span className="tc-num" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                              {skill.priceMin != null ? `${skill.priceMin.toLocaleString('vi-VN')}₫` : '—'}
                              {' – '}
                              {skill.priceMax != null ? `${skill.priceMax.toLocaleString('vi-VN')}₫` : '—'}
                            </span>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  <div style={{ borderTop: 'var(--bw-hair) solid var(--border-subtle)' }} />

                  <Field label="Bán kính làm việc ưu tiên" hint="Phạm vi bạn muốn nhận việc quanh khu vực hoạt động" error={radiusError}>
                    <Select
                      style={{ maxWidth: 200 }}
                      value={preferredRadiusKm}
                      onChange={(e) => void handleRadiusChange(e.target.value)}
                      disabled={radiusBusy}
                      error={!!radiusError}
                      options={[{ value: '', label: 'Chưa đặt' }, ...RADIUS_OPTIONS]}
                    />
                  </Field>

                  <div style={{ borderTop: 'var(--bw-hair) solid var(--border-subtle)' }} />

                  <div className="tc-label">Khung giờ rảnh</div>
                  {slotError && <Alert tone="danger" title="Không thực hiện được">{slotError}</Alert>}

                  {!slotsLoading && slots.length === 0
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

                  <div className="flex flex-col gap-3 pt-2" style={{ borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
                    <Field label="Ngày" hint="Chọn một hoặc nhiều ngày cùng lúc, vd Thứ 2 đến Thứ 6">
                      <div className="flex gap-2 flex-wrap">
                        {DAY_OPTIONS.map(({ value }) => {
                          const day = Number(value)
                          return (
                            <Chip key={day} selected={selectedDays.has(day)} onClick={() => !slotBusy && toggleSlotDay(day)}>
                              {DAY_SHORT_LABELS[day]}
                            </Chip>
                          )
                        })}
                      </div>
                    </Field>
                    <div className="flex gap-3 items-end flex-wrap">
                      <Field label="Bắt đầu">
                        <TimeSelect value={slotStart} onChange={setSlotStart} disabled={slotBusy} />
                      </Field>
                      <Field label="Kết thúc">
                        <TimeSelect value={slotEnd} onChange={setSlotEnd} disabled={slotBusy} />
                      </Field>
                      <Button variant="secondary" icon="plus" disabled={slotBusy} onClick={() => void handleAddSlot()}>Thêm khung giờ</Button>
                    </div>
                  </div>
                </Card>
              )}

              <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <strong style={{ fontSize: 'var(--fs-h3)' }}>Tài khoản & bảo mật</strong>
                <DataRow label="Email đăng nhập" value={email ?? '—'} />
                <Button
                  variant="secondary"
                  size="md"
                  icon="shield-check"
                  onClick={() => navigate('/ho-so/bao-mat')}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Đổi email & mật khẩu
                </Button>
              </Card>
            </div>

            {hasSidebar && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', position: 'sticky', top: 'var(--sp-5)' }}>
                {isTasker && kycStatus && (
                  <Alert
                    tone={KYC_ALERT_TONE[kycStatus]}
                    icon={KYC_STATUS_ICON[kycStatus]}
                    title={`Xác minh danh tính · ${KYC_STATUS_LABEL[kycStatus]}`}
                    style={{ border: 'var(--bw) solid var(--border)' }}
                    action={(
                      <Button variant="secondary" size="sm" icon="shield-check" onClick={() => navigate('/xac-thuc-danh-tinh')}>
                        Xem hồ sơ
                      </Button>
                    )}
                  >
                    {kycStatusDescription(kycStatus, kycDetail)}
                  </Alert>
                )}

                {editMode && (
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
                )}
              </div>
            )}
            </div>
          )}
    </AppShell>
  )
}
