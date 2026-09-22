import { apiFetch } from './client.ts'
import type { ProposalStatus } from './chat.ts'
import type { LocationType } from './users.ts'

// Khop dung enum that cua backend, xem vn.taskconnect.task.api.TaskStatus (01-domain-glossary.md
// "Cong viec"). Dot nay (dang viec toi gian) chi tao Task o thang OPEN ngay - cac gia tri con
// lai giu du de khop CHECK constraint DB va khong phai sua lai khi dot sau them chuyen trang thai
// (sua/huy UC07, AI/Admin duyet PENDING_REVIEW).
export type TaskStatus = 'PENDING_REVIEW' | 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CLOSED' | 'CANCELLED' | 'REJECTED'

// Khop dung vn.taskconnect.task.api.SuppliesStatus - bat buoc chon luc dang viec, khong co gia
// tri mac dinh o FE (xem PostTaskPage.tsx).
export type SuppliesStatus = 'FULL' | 'PARTIAL' | 'UNKNOWN'

export interface CreateTaskPayload {
  categoryId: string
  title: string
  description: string
  // Dia diem CAN THUC HIEN cong viec - doc lap voi addressText/locationLat/locationLng cua
  // ho so (user_profiles). Poster nhap rieng moi lan dang viec, khong tu lay tu ho so.
  addressText: string
  lat: number
  lng: number
  // Loai dia diem + luu y khi toi noi - FE dien san tu ho so Poster luc mo form (xem
  // PostTaskPage.tsx), nguoi dung sua duoc rieng cho cong viec nay, khong bat buoc.
  locationType?: LocationType
  arrivalNotes?: string
  // Tinh trang vat tu - bat buoc chon. suppliesNote LUON tuy chon du suppliesStatus la gia tri
  // nao, FE chi hien o khi FULL/PARTIAL (xem PostTaskPage.tsx).
  suppliesStatus: SuppliesStatus
  suppliesNote?: string
  budgetAmount?: number
  // ISO datetime (tu <input type="datetime-local">) - tuy chon, de trong hien thi "thoa thuan".
  scheduledAt?: string
  estimatedWorkersNeeded?: number
  // 0-5 URL cong khai, xin tung URL rieng qua createTaskImageUploadUrl truoc khi submit.
  imageUrls?: string[]
}

export interface TaskResponse {
  id: string
  posterId: string
  categoryId: string
  categoryName: string
  title: string
  description: string
  addressText: string
  lat: number
  lng: number
  locationType: LocationType | null
  arrivalNotes: string | null
  suppliesStatus: SuppliesStatus
  suppliesNote: string | null
  budgetAmount: number | null
  scheduledAt: string | null
  estimatedWorkersNeeded: number
  status: TaskStatus
  imageUrls: string[]
  createdAt: string
  updatedAt: string
  // So don ung tuyen dang PENDING (cho Poster xac nhan/tu choi) - dung de loc tab "Can xu ly" o MyTasksPage.
  pendingApplicantCount: number
}

export interface TaskImageUploadUrlResponse {
  uploadUrl: string
  publicUrl: string
  expiresAt: string
}

/** Dang mot cong viec moi - chi tai khoan mang role TASK_POSTER goi duoc (403 o BE neu khong dung role). */
export function createTask(payload: CreateTaskPayload) {
  return apiFetch<TaskResponse>('/tasks', { method: 'POST', body: payload })
}

/** Danh sach cong viec da dang cua chinh Poster dang dang nhap. */
export function getMyTasks() {
  return apiFetch<TaskResponse[]>('/tasks/mine')
}

/** Chi tiet 1 cong viec - dot nay chi chu task xem duoc (chua co man xem cong khai cho Tasker). */
export function getTask(taskId: string) {
  return apiFetch<TaskResponse>(`/tasks/${taskId}`)
}

/** Xin presigned PUT URL rieng tu de tu tai 1 anh minh hoa cong viec len S3, cung mau avatar/KYC/chung chi. */
export function createTaskImageUploadUrl(contentType: string) {
  return apiFetch<TaskImageUploadUrlResponse>('/tasks/images-upload-url', {
    method: 'POST',
    body: { contentType },
  })
}

// --- UC10 (Tasker tim/ung tuyen viec) + UC11 (Poster xac nhan) + UC09/UC16 (loi moi truc
// tiep, hoi them, thuong luong gia qua Chat - xem task-connect-claude/docs/PROGRESS-CHAT-MODULE.md).
// Khop dung TaskApplicationStatus/TaskFeedItemResponse/TaskApplicationResponse/MyApplicationResponse
// o BE - da mo rong tu 4 len 10 gia tri o Round B0-B6 cua module Chat.

// Khop dung vn.taskconnect.task.api.TaskApplicationStatus - 10 gia tri (ACCEPTED/NEEDS_RECONFIRM
// la gia tri CU giu tuong thich nguoc, ACCEPTED van con dung lam nhan rieng cho nut "Tu choi"
// thu cong (khac REJECTED_AUTO cua UC11 he thong tu dong tu choi), NEEDS_RECONFIRM khong con
// code path nao set nua - xem Javadoc TaskApplicationStatus.java).
export type TaskApplicationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'NEEDS_RECONFIRM'
  | 'INQUIRING'
  | 'INVITED'
  | 'WITHDRAWN'
  | 'REJECTED_AUTO'
  | 'DECLINED'
  | 'INVITE_EXPIRED'

// Khop dung vn.taskconnect.task.api.TaskApplicationInitiator.
export type TaskApplicationInitiator = 'TASKER' | 'POSTER'

// Khong co distanceKm (can vi tri Tasker + ban kinh mac dinh, OQ-02 con MO trong
// docs/OPEN-QUESTIONS.md) va khong co diem uy tin/so luot danh gia Poster (module Review chua
// ton tai) - hai truong nay backend khong tra, KHONG tu bia o day.
export interface TaskFeedItemResponse {
  id: string
  categoryId: string
  categoryName: string
  title: string
  description: string
  addressText: string
  lat: number
  lng: number
  locationType: LocationType | null
  arrivalNotes: string | null
  suppliesStatus: SuppliesStatus
  suppliesNote: string | null
  budgetAmount: number | null
  scheduledAt: string | null
  imageUrls: string[]
  posterId: string
  posterName: string | null
  posterAvatarUrl: string | null
  createdAt: string
}

export interface ApplyToTaskPayload {
  message?: string
}

export interface TaskApplicationResponse {
  id: string
  taskerId: string
  taskerName: string | null
  taskerAvatarUrl: string | null
  proposedArrivalText: string | null
  message: string | null
  status: TaskApplicationStatus
  // initiatedBy/expiresAt them tu Round B5 (chong spam loi moi UC09) - expiresAt chi co gia
  // tri khi status=INVITED va Tasker chua phan hoi gi trong kenh chat.
  initiatedBy: TaskApplicationInitiator
  expiresAt: string | null
  createdAt: string
  respondedAt: string | null
  // agreedPriceAmount/pendingProposalAmount them cho man "Ung vien & chot gia" (Round F2) - ca
  // 2 co the null (chua tung co de xuat nao/khong co de xuat nao dang cho). Doc trong lich su
  // chat, KHONG phai field luu thang tren don ung tuyen.
  agreedPriceAmount: number | null
  pendingProposalAmount: number | null
}

/** Ket qua UC11 "Chon nguoi nay" - dung cho POST .../confirm. Khop dung ConfirmApplicationResponse.java. */
export interface ConfirmApplicationResponse {
  application: TaskApplicationResponse
  bookingId: string
  feeBaseAmount: number
  platformFee: number
  payoutEstimate: number
}

export interface MyApplicationResponse {
  applicationId: string
  status: TaskApplicationStatus
  initiatedBy: TaskApplicationInitiator
  expiresAt: string | null
  proposedArrivalText: string | null
  message: string | null
  createdAt: string
  respondedAt: string | null
  taskId: string
  taskTitle: string
  taskDescription: string
  taskAddressText: string
  taskLocationType: LocationType | null
  taskArrivalNotes: string | null
  taskSuppliesStatus: SuppliesStatus
  taskSuppliesNote: string | null
  taskBudgetAmount: number | null
  taskScheduledAt: string | null
  taskStatus: TaskStatus
  categoryId: string
  categoryName: string
  posterName: string | null
  taskImageUrls: string[]
}

/** Feed cong viec dang mo cho Tasker duyet - chi role TASKER goi duoc. */
export function browseOpenTasks(params: { categoryId?: string; keyword?: string } = {}) {
  const search = new URLSearchParams()
  if (params.categoryId) search.set('categoryId', params.categoryId)
  if (params.keyword) search.set('keyword', params.keyword)
  const qs = search.toString()
  return apiFetch<TaskFeedItemResponse[]>(`/tasks${qs ? `?${qs}` : ''}`)
}

/** Chi tiet 1 cong viec dang mo - dung khi Tasker vao thang URL /tim-viec/:id. */
export function getFeedTask(taskId: string) {
  return apiFetch<TaskFeedItemResponse>(`/tasks/${taskId}/browse`)
}

/** Tasker gui don ung tuyen 1 cong viec. */
export function applyToTask(taskId: string, payload: ApplyToTaskPayload) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications`, { method: 'POST', body: payload })
}

/** Tasker bam "Nhan tin hoi them" - tao don INQUIRING + mo kenh chat ngay (UC16 muc 2). */
export function createInquiry(taskId: string, message: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/inquire`, {
    method: 'POST',
    body: { message },
  })
}

/** Tasker rut mot don dang PENDING hoac INQUIRING cua chinh minh. */
export function withdrawApplication(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/withdraw`, {
    method: 'POST',
  })
}

/** Tasker bam "Ung tuyen" tu the "Dang hoi them" - chuyen thang 1 don dang INQUIRING thanh PENDING. */
export function applyFromInquiry(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/apply-from-inquiry`, {
    method: 'POST',
  })
}

/** Toan bo don ung tuyen (moi trang thai) cua chinh Tasker dang dang nhap - dung cho man "Viec da nhan". */
export function getMyApplications() {
  return apiFetch<MyApplicationResponse[]>('/tasks/applications/mine')
}

/** Poster xem danh sach ung vien cua 1 cong viec cua chinh minh. */
export function getTaskApplicants(taskId: string) {
  return apiFetch<TaskApplicationResponse[]>(`/tasks/${taskId}/applications`)
}

/**
 * Poster xac nhan mot ung vien (UC11 "Chon nguoi nay") - tao booking-lite that
 * (status PENDING_ESCROW, chua giai ngan duoc vi chua co module Payment), cac ung vien con lai
 * chuyen REJECTED_AUTO kem dong kenh chat. Tra ve ca so lieu phi/payout XEM TRUOC.
 */
export function confirmApplication(taskId: string, applicationId: string) {
  return apiFetch<ConfirmApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/confirm`, {
    method: 'POST',
  })
}

/** Poster tu choi mot ung vien. */
export function rejectApplication(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/reject`, { method: 'POST' })
}

export interface InviteTaskerPayload {
  taskerId: string
  proposedPrice?: number
  message?: string
}

/**
 * Poster moi truc tiep mot Tasker nhan cong viec (UC09) - neu co proposedPrice, no duoc gui
 * vao kenh chat nhu 1 PRICE_PROPOSAL binh thuong ngay khi mo kenh, khong luu thang vao don.
 */
export function inviteTasker(taskId: string, payload: InviteTaskerPayload) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/invitations`, { method: 'POST', body: payload })
}

/** Tasker nhan mot loi moi truc tiep dang cho (INVITED) - chuyen PENDING. */
export function acceptInvite(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/invitations/${applicationId}/accept`, {
    method: 'POST',
  })
}

/** Tasker tu choi mot loi moi truc tiep dang cho (INVITED) - chan moi lai vinh vien cho cung task nay. */
export function declineInvite(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/invitations/${applicationId}/decline`, {
    method: 'POST',
  })
}

// Khop dung vn.taskconnect.task.api.ChangeType.
export type ChangeType = 'INITIAL_AGREEMENT' | 'SCOPE_CHANGE'

/** Khop dung TaskPriceHistoryEntryResponse.java - 1 dong lich su gia (chi ghi them), dung cho man "Lich su gia". */
export interface TaskPriceHistoryEntryResponse {
  id: string
  changeType: ChangeType
  amount: number
  note: string | null
  createdByAccountId: string
  createdByName: string | null
  createdAt: string
  acceptedByAccountId: string | null
  acceptedByName: string | null
  acceptedAt: string | null
  // Them 2026-09-21 - doc tu chat_messages.proposal_status (xem Javadoc BE) de phan biet dung
  // PROPOSED (con dang cho quyet dinh) voi REJECTED (da bi Tu choi hoac chinh nguoi de xuat Thu
  // hoi) thay vi chi suy tu acceptedAt == null nhu truoc (2 truong hop do trung nhau).
  status: ProposalStatus
}

/** Toan bo lich su gia cua 1 application - ca Poster va Tasker cua don do goi duoc. */
export function getPriceHistory(applicationId: string) {
  return apiFetch<TaskPriceHistoryEntryResponse[]>(`/tasks/applications/${applicationId}/price-history`)
}
