import { apiFetch } from './client.ts'

// Khop dung enum that cua backend, xem vn.taskconnect.task.api.TaskStatus (01-domain-glossary.md
// "Cong viec"). Dot nay (dang viec toi gian) chi tao Task o thang OPEN ngay - cac gia tri con
// lai giu du de khop CHECK constraint DB va khong phai sua lai khi dot sau them chuyen trang thai
// (sua/huy UC07, AI/Admin duyet PENDING_REVIEW).
export type TaskStatus = 'PENDING_REVIEW' | 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CLOSED' | 'CANCELLED' | 'REJECTED'

export interface CreateTaskPayload {
  categoryId: string
  title: string
  description: string
  // Dia diem CAN THUC HIEN cong viec - doc lap voi addressText/locationLat/locationLng cua
  // ho so (user_profiles). Poster nhap rieng moi lan dang viec, khong tu lay tu ho so.
  addressText: string
  lat: number
  lng: number
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
  budgetAmount: number | null
  scheduledAt: string | null
  estimatedWorkersNeeded: number
  status: TaskStatus
  imageUrls: string[]
  createdAt: string
  updatedAt: string
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

// --- UC10 (Tasker tim/ung tuyen viec) + UC11 (Poster xac nhan, gioi han doi trang thai -
// chua co Booking/escrow that, xem task-connect-claude/docs/TASK-MODULE-SPLIT.md). Khop dung
// TaskApplicationStatus/TaskFeedItemResponse/TaskApplicationResponse/MyApplicationResponse o BE.

export type TaskApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'NEEDS_RECONFIRM'

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
  createdAt: string
  respondedAt: string | null
}

export interface MyApplicationResponse {
  applicationId: string
  status: TaskApplicationStatus
  proposedArrivalText: string | null
  message: string | null
  createdAt: string
  respondedAt: string | null
  taskId: string
  taskTitle: string
  taskAddressText: string
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

/** Toan bo don ung tuyen (moi trang thai) cua chinh Tasker dang dang nhap - dung cho man "Viec da nhan". */
export function getMyApplications() {
  return apiFetch<MyApplicationResponse[]>('/tasks/applications/mine')
}

/** Poster xem danh sach ung vien cua 1 cong viec cua chinh minh. */
export function getTaskApplicants(taskId: string) {
  return apiFetch<TaskApplicationResponse[]>(`/tasks/${taskId}/applications`)
}

/** Poster xac nhan mot ung vien - Task chuyen ASSIGNED. */
export function confirmApplication(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/confirm`, { method: 'POST' })
}

/** Poster tu choi mot ung vien. */
export function rejectApplication(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/reject`, { method: 'POST' })
}
