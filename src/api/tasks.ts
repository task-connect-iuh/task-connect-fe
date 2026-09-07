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
