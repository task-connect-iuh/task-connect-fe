import { apiFetch } from './client.ts'

// Khop dung enum that cua backend, xem vn.taskconnect.user.api.{KycStatus,SkillVerificationStatus,CertificationStatus}.
// KycStatus: NOT_SUBMITTED chi xuat hien o ProfileResponse.kycStatus (cot user_profiles.kyc_status) -
// ban ghi tung lan nop (KycStatusResponse.status) khong bao gio la NOT_SUBMITTED, thay vao do
// GET .../kyc-verifications/latest nem 404 USR-404-KYC_NOT_FOUND khi chua tung nop lan nao.
export type KycStatus = 'NOT_SUBMITTED' | 'VERIFYING' | 'VERIFIED' | 'REJECTED' | 'CANCELLED'
export type SkillVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CANCELLED'
export type CertificationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
export type KycImageSide = 'FRONT' | 'BACK'

export interface ProfileResponse {
  accountId: string
  fullName: string | null
  avatarUrl: string | null
  addressText: string | null
  bio: string | null
  operatingArea: string | null
  locationLat: number | null
  locationLng: number | null
  kycStatus: KycStatus
}

// Mot nhom dich vu da VERIFIED, dung de hien badge "Da xac minh" tren ho so cong khai -
// xem PublicVerifiedSkillResponse.java o backend.
export interface PublicVerifiedSkillResponse {
  categoryId: string
  categoryName: string
  verifiedAt: string
}

// bio la cong khai (khac addressText/toa do) - doan gioi thieu ban than nguoi dung chu dong
// viet de nguoi khac xem, xem PublicProfileResponse.java o backend. availability la lich
// ranh trong tuan cua Tasker (thu + khung gio), cap nhat ngay khi Tasker sua Lich lam viec.
export interface PublicProfileResponse {
  accountId: string
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  operatingArea: string | null
  verifiedSkills: PublicVerifiedSkillResponse[]
  availability: AvailabilitySlotResponse[]
}

export interface UpdateProfilePayload {
  fullName?: string
  avatarUrl?: string
  addressText?: string
  bio?: string
  operatingArea?: string
  locationLat?: number
  locationLng?: number
}

export interface AvatarUploadUrlResponse {
  uploadUrl: string
  publicUrl: string
  expiresAt: string
}

/** Ho so cua chinh minh - nem USR-404-PROFILE_NOT_FOUND neu chua tung PATCH lan nao (lazy-create). */
export function getMyProfile() {
  return apiFetch<ProfileResponse>('/users/me')
}

/** PATCH mot phan - field nao khong gui giu nguyen gia tri cu. Lan goi dau tien tao moi ho so. */
export function updateMyProfile(payload: UpdateProfilePayload) {
  return apiFetch<ProfileResponse>('/users/me', { method: 'PATCH', body: payload })
}

/** Ho so cong khai toi thieu cua mot tai khoan bat ky. */
export function getPublicProfile(accountId: string) {
  return apiFetch<PublicProfileResponse>(`/users/${accountId}`)
}

/** Xin presigned PUT URL de tu tai anh dai dien len S3 (public-read), dung publicUrl tra ve de PATCH /users/me sau. */
export function createAvatarUploadUrl(contentType: string) {
  return apiFetch<AvatarUploadUrlResponse>('/users/me/avatar-upload-url', { method: 'POST', body: { contentType } })
}

// ---------------------------------------------------------------------------
// KYC (xac thuc danh tinh) - chi Tasker duoc dan link tu FE, xem docs/PROGRESS-FE-USER-MODULE.md.
// ---------------------------------------------------------------------------

export interface KycUploadUrlResponse {
  uploadUrl: string
  objectKey: string
  expiresAt: string
}

export interface SubmitKycPayload {
  fullNameOnId: string
  idNumber: string
  idCardFrontKey: string
  idCardBackKey: string
}

export interface KycStatusResponse {
  id: string
  status: KycStatus
  submittedAt: string
  reviewedAt: string | null
  rejectionReason: string | null
}

/** Xin presigned PUT URL rieng tu de tu tai anh CCCD (mat truoc/sau) len S3, khong co publicUrl. */
export function createKycUploadUrl(side: KycImageSide, contentType: string) {
  return apiFetch<KycUploadUrlResponse>('/users/me/kyc-verifications/upload-url', {
    method: 'POST',
    body: { side, contentType },
  })
}

/** Nop ho so KYC moi - loi USR-409-KYC_ALREADY_VERIFYING/USR-409-KYC_ALREADY_VERIFIED neu dang co lan nop hop le. */
export function submitKyc(payload: SubmitKycPayload) {
  return apiFetch<KycStatusResponse>('/users/me/kyc-verifications', { method: 'POST', body: payload })
}

/** Trang thai lan nop KYC gan nhat - nem USR-404-KYC_NOT_FOUND neu chua tung nop (FE hieu la "chua xac thuc"). */
export function getMyLatestKyc() {
  return apiFetch<KycStatusResponse>('/users/me/kyc-verifications/latest')
}

/** Tu huy lan nop KYC cua chinh minh khi con dang VERIFYING - loi USR-409-KYC_NOT_PENDING_REVIEW neu da duoc xu ly. */
export function cancelMyKyc(kycVerificationId: string) {
  return apiFetch<KycStatusResponse>(`/users/me/kyc-verifications/${kycVerificationId}/cancel`, { method: 'PATCH' })
}

// ---------------------------------------------------------------------------
// Danh muc dich vu + yeu cau chung chi (Master Data, dung lam du lieu cho form khai ky nang).
// ---------------------------------------------------------------------------

export interface ServiceCategoryResponse {
  id: string
  code: string
  name: string
  description: string | null
  minExperienceYears: number
}

export interface CertificateTypeResponse {
  id: string
  code: string
  name: string
  issuingAuthority: string | null
  description: string | null
}

export interface CategoryCertificateRequirementResponse {
  certificateTypeId: string
  certificateTypeCode: string
  certificateTypeName: string
  mandatory: boolean
  minExperienceYears: number
}

export function listServiceCategories() {
  return apiFetch<ServiceCategoryResponse[]>('/users/service-categories')
}

export function listCertificateTypes() {
  return apiFetch<CertificateTypeResponse[]>('/users/certificate-types')
}

/** Chung chi duoc chap nhan cho 1 category - quan he OR giua cac dong, chi can 1 duoc duyet la du. */
export function listCertificateRequirements(categoryId: string) {
  return apiFetch<CategoryCertificateRequirementResponse[]>(`/users/service-categories/${categoryId}/certificate-requirements`)
}

// ---------------------------------------------------------------------------
// Ho so ky nang Tasker gop nop chung chi (chi Tasker, hasRole('TASKER') o backend).
// ---------------------------------------------------------------------------

export interface CertificateUploadUrlResponse {
  uploadUrl: string
  objectKey: string
  expiresAt: string
}

export interface SubmitSkillPayload {
  categoryId: string
  yearsExperience: number
  priceMin?: number
  priceMax?: number
  certificateTypeId: string
  certificateNumber?: string
  issuingAuthority?: string
  issuedDate?: string
  expiryDate?: string
  fileKey: string
  experienceProofUrl?: string
  claimedExperienceYears?: number
}

export interface TaskerSkillResponse {
  categoryId: string
  yearsExperience: number
  priceMin: number | null
  priceMax: number | null
  verificationStatus: SkillVerificationStatus
  verifiedAt: string | null
  // Dung de goi cancelMyCertification khi verificationStatus === 'PENDING' - null neu chua
  // tung nop lan nao (hiem, TaskerSkillResponse chi ton tai sau it nhat 1 lan submitSkill).
  latestCertificationId: string | null
  latestCertificationStatus: CertificationStatus | null
  latestCertificationRejectionReason: string | null
}

/** Xin presigned PUT URL rieng tu de tu tai file chung chi (anh hoac PDF) len S3. */
export function createCertificateUploadUrl(categoryId: string, contentType: string) {
  return apiFetch<CertificateUploadUrlResponse>(`/users/me/tasker-skills/${categoryId}/certificate-upload-url`, {
    method: 'POST',
    body: { contentType },
  })
}

/** Dang ky (hoac nop lai sau REJECTED) ky nang cho 1 category kem chung chi - chan cung neu KYC chua VERIFIED. */
export function submitSkill(payload: SubmitSkillPayload) {
  return apiFetch<TaskerSkillResponse>('/users/me/tasker-skills', { method: 'POST', body: payload })
}

/** Danh sach moi category chinh chu da khai bao, kem trang thai chung chi gan nhat. */
export function getMySkills() {
  return apiFetch<TaskerSkillResponse[]>('/users/me/tasker-skills')
}

// Khop dung CertificationReviewResponse.java o backend - dung chung cho Admin xet duyet va
// chinh chu Tasker tu xem lai qua nut "Xem chi tiet".
export interface CertificationDetailResponse {
  id: string
  certificateTypeId: string
  certificateNumber: string | null
  issuingAuthority: string | null
  issuedDate: string | null
  expiryDate: string | null
  fileViewUrl: string
  experienceProofUrl: string | null
  claimedExperienceYears: number | null
  status: CertificationStatus
  rejectionReason: string | null
  submittedAt: string
  reviewedAt: string | null
}

/** Chinh chu Tasker tu xem lai toan bo lich su nop chung chi cua minh cho 1 category - dung cho nut "Xem chi tiet". */
export function getMyCertifications(categoryId: string) {
  return apiFetch<CertificationDetailResponse[]>(`/users/me/tasker-skills/${categoryId}/certifications`)
}

/** Tu huy 1 lan nop chung chi cua chinh minh khi con dang PENDING_REVIEW - loi USR-409-CERTIFICATION_NOT_PENDING_REVIEW neu da duoc xu ly. */
export function cancelMyCertification(certificationId: string) {
  return apiFetch<TaskerSkillResponse>(`/users/me/tasker-certifications/${certificationId}/cancel`, { method: 'PATCH' })
}

// ---------------------------------------------------------------------------
// Lich ranh Tasker - doc lap voi KYC/ky nang, khong qua duyet.
// ---------------------------------------------------------------------------

export interface AvailabilitySlotResponse {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface AvailabilitySlotPayload {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export function addAvailabilitySlot(payload: AvailabilitySlotPayload) {
  return apiFetch<AvailabilitySlotResponse>('/users/me/tasker-availability', { method: 'POST', body: payload })
}

export function getMyAvailabilitySlots() {
  return apiFetch<AvailabilitySlotResponse[]>('/users/me/tasker-availability')
}

export function updateAvailabilitySlot(slotId: string, payload: Partial<AvailabilitySlotPayload>) {
  return apiFetch<AvailabilitySlotResponse>(`/users/me/tasker-availability/${slotId}`, { method: 'PATCH', body: payload })
}

export function deleteAvailabilitySlot(slotId: string) {
  return apiFetch<void>(`/users/me/tasker-availability/${slotId}`, { method: 'DELETE' })
}
