import { apiFetch } from './client.ts'
import type { KycStatus } from './users.ts'
import type { TaskStatus } from './tasks.ts'

// Khop dung DTO/enum cua module Matching (backend) - vn.taskconnect.matching.api. UC09 mo
// rong: ngoai viec Tasker tu ung tuyen (task_applications, xem api/tasks.ts), Poster gio con
// duoc AI goi y va CHU DONG moi mot Tasker cu the (moi loi song song, doc lap voi
// TaskApplicationStatus). Xem plan kind-zooming-bumblebee.md.
export type TaskerInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

// Khop SuggestedTaskerResponse.java - toi da 10 Tasker phu hop nhat cho 1 Task, backend DA sap
// xep tot->kem san. FE PHAI giu nguyen thu tu tra ve, khong tu sap xep lai, khong cat bot con 3.
export interface SuggestedTaskerResponse {
  taskerId: string
  fullName: string
  avatarUrl: string | null
  kycStatus: KycStatus
  // 0-100, do AI/service Matching tinh toan tu du lieu lich su that.
  confidence: number
  // Diem co loi cho Tasker nay (vi du: lich ranh khop, gan, gia hop ly) - tieng Viet, hien
  // thanh danh sach RIENG voi concerns (yeu cau nguoi dung: khong duoc gop chung 1 danh sach).
  reasons: string[]
  // Diem bat loi/rui ro (vi du: cach xa, gia cao hon du kien) - co the rong neu khong co gi dang luu y.
  concerns: string[]
  // true khi confidence duoi nguong cau hinh o backend (admin.system_parameters) - FE chi
  // hien thi canh bao, khong tu tinh lai nguong nay.
  lowConfidence: boolean
  distanceKm: number
  priceMin: number | null
  priceMax: number | null
  completedJobsNearby: number
}

// Khop TaskerInviteResponse.java - khong co taskId (nguoi goi da biet tu tham so ham), co kem
// san taskerName/taskerAvatarUrl de hien thi ngay khong can goi them API.
export interface TaskerInviteResponse {
  id: string
  taskerId: string
  taskerName: string | null
  taskerAvatarUrl: string | null
  status: TaskerInviteStatus
  createdAt: string
  respondedAt: string | null
}

/**
 * Poster xem danh sach Tasker AI goi y cho 1 cong viec cua chinh minh (UC09).
 * @param expand true khi Poster bam "Xem thêm" (SuggestedTaskersPanel.tsx) - backend mo rong
 *               pham vi tim kiem (bo qua ban kinh tu khai cua Tasker) va tra toi da 20 thay vi 10.
 */
export function getSuggestedTaskers(taskId: string, expand = false) {
  return apiFetch<SuggestedTaskerResponse[]>(`/tasks/${taskId}/suggested-taskers${expand ? '?expand=true' : ''}`)
}

/** Poster chu dong moi 1 Tasker cu the lam viec nay - doc lap voi luong Tasker tu ung tuyen (applyToTask). */
export function createInvite(taskId: string, taskerId: string) {
  return apiFetch<TaskerInviteResponse>(`/tasks/${taskId}/invites`, { method: 'POST', body: { taskerId } })
}

/** Tasker chap nhan 1 loi moi minh nhan duoc. */
export function acceptInvite(taskId: string, inviteId: string) {
  return apiFetch<TaskerInviteResponse>(`/tasks/${taskId}/invites/${inviteId}/accept`, { method: 'POST' })
}

/** Tasker tu choi 1 loi moi minh nhan duoc. */
export function declineInvite(taskId: string, inviteId: string) {
  return apiFetch<TaskerInviteResponse>(`/tasks/${taskId}/invites/${inviteId}/decline`, { method: 'POST' })
}

// Khop MyInviteResponse.java (module Matching) - phong theo MyApplicationResponse (api/tasks.ts)
// nhung nguon la matching_tasker_invites thay vi task_applications. taskImageUrls luon rong o
// vong nay (backend chua lo anh Task cho man hinh phu nay, xem Javadoc MyInviteResponse.java).
export interface MyInviteResponse {
  inviteId: string
  status: TaskerInviteStatus
  createdAt: string
  respondedAt: string | null
  taskId: string
  taskTitle: string
  taskAddressText: string
  taskLat: number
  taskLng: number
  taskBudgetAmount: number | null
  taskScheduledAt: string | null
  taskStatus: TaskStatus
  categoryId: string
  categoryName: string
  posterName: string | null
  taskImageUrls: string[]
}

/** Toan bo loi moi (moi trang thai) ma chinh Tasker dang dang nhap da nhan duoc. */
export function getMyInvites() {
  return apiFetch<MyInviteResponse[]>('/tasks/invites/mine')
}
