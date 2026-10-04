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
  // Ly do admin tu choi - chi co gia tri khi status === 'REJECTED' (xem TaskResponse.java).
  rejectionReason: string | null
  imageUrls: string[]
  createdAt: string
  updatedAt: string
  // So don ung tuyen dang PENDING (cho Poster xac nhan/tu choi) - dung de loc tab "Can xu ly" o MyTasksPage.
  pendingApplicantCount: number
  // Ngan sach (Tang 2, UC07) co dang bi khoa hay khong - true khi con BAT KY don
  // PENDING/INQUIRING/INVITED/TIME_CHANGED_NEEDS_RECONFIRM nao, RONG hon pendingApplicantCount
  // (chi dem PENDING) - dung o EditTaskDialog.tsx, yeu cau nguoi dung 2026-09-30.
  budgetLocked: boolean
  // Vat tu (suppliesStatus/suppliesNote, Tang 2, UC07) co dang bi khoa hay khong - HEP hon
  // budgetLocked, CHI true khi co don PENDING/TIME_CHANGED_NEEDS_RECONFIRM - INQUIRING/INVITED
  // khong khoa vat tu (yeu cau nguoi dung 2026-09-30, vong 2).
  suppliesLocked: boolean
  // Id don ung tuyen da duoc chon o UC11 cho task nay, null neu chua ASSIGNED - them 2026-10-02
  // de TaskDetailDialog goi duoc getExtraCostSummary() cho dung application.
  winningApplicationId: string | null
}

// Phuong thuc thanh toan Poster chon luc UC11 "Chon nguoi nay" (quyet dinh nguoi dung
// 2026-10-02) - khop vn.taskconnect.booking.api.PaymentMethod. FULL_ESCROW giu 100% qua he
// thong; FEE_ONLY_ESCROW chi giu 8% phi nen tang, 92% con lai hai ben tu thanh toan ngoai he
// thong, he thong khong quan ly.
export type PaymentMethod = 'FULL_ESCROW' | 'FEE_ONLY_ESCROW'

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

// Chi 6 truong sua duoc cua UC07 (khop UpdateTaskRequest.java) - GHI DE TOAN BO, undefined/null
// nghia la "xoa gia tri" (vd budgetAmount = undefined la "thoa thuan"). Luon gui du 6 truong ke
// ca cac truong Tang 2 dang bi disable tren form - BE tu so sanh gia tri de biet field nao THAT
// SU doi (xem Javadoc TaskService.updateTask), khong dua vao viec field co mat trong payload.
export interface UpdateTaskPayload {
  locationType?: LocationType | null
  arrivalNotes?: string | null
  suppliesStatus: SuppliesStatus
  suppliesNote?: string | null
  budgetAmount?: number | null
  scheduledAt?: string | null
}

/**
 * Poster sua mot cong viec da dang (UC07) - chi khi task con OPEN/PENDING_REVIEW. Ngan
 * sach/vat tu bi khoa (409 FIELD_LOCKED_HAS_APPLICANTS) khi dang co >=1 ung vien PENDING va
 * field do THAT SU doi gia tri - xem EditTaskDialog.tsx cho nhanh xu ly loi nay.
 */
export function updateTask(taskId: string, payload: UpdateTaskPayload) {
  return apiFetch<TaskResponse>(`/tasks/${taskId}`, { method: 'PATCH', body: payload })
}

/** Poster tu huy cong viec cua chinh minh (UC07) - tu do khi con OPEN/PENDING_REVIEW, khong phan biet co ung vien hay khong. */
export function cancelTask(taskId: string) {
  return apiFetch<void>(`/tasks/${taskId}/cancel`, { method: 'PATCH' })
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

// Khop dung vn.taskconnect.task.api.TaskApplicationStatus - 12 gia tri (ACCEPTED/NEEDS_RECONFIRM
// la gia tri CU giu tuong thich nguoc, ACCEPTED van con dung lam nhan rieng cho nut "Tu choi"
// thu cong (khac REJECTED_AUTO cua UC11 he thong tu dong tu choi), NEEDS_RECONFIRM khong con
// code path nao set nua - xem Javadoc TaskApplicationStatus.java). CANCELLED/
// TIME_CHANGED_NEEDS_RECONFIRM them cho UC07 (Poster huy/sua viec da dang).
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
  | 'CANCELLED'
  | 'TIME_CHANGED_NEEDS_RECONFIRM'

// Khop dung vn.taskconnect.task.api.TaskEditableField - 6 truong Poster sua duoc sau khi da
// dang viec (UC07). title/description/anh/addressText/lat/lng/categoryId/estimatedWorkersNeeded
// khoa cung vinh vien, KHONG nam trong danh sach nay.
export type TaskEditableField =
  | 'LOCATION_TYPE'
  | 'ARRIVAL_NOTES'
  | 'BUDGET_AMOUNT'
  | 'SUPPLIES_STATUS'
  | 'SUPPLIES_NOTE'
  | 'SCHEDULED_AT'

// Ma loi BE (ErrorCode.FIELD_LOCKED_HAS_APPLICANTS) cho tinh huong dua hiem: field Tang 2 dang
// disable tren form nhung van bi khoa (co PENDING moi phat sinh giua luc mo form va luc bam Luu,
// hoac 2 tab cung mo). EditTaskDialog.tsx bat rieng ma nay de giu nguyen input Poster vua nhap
// thay vi bao loi chung chung.
export const FIELD_LOCKED_ERROR_CODE = 'TSK-409-FIELD_LOCKED_HAS_APPLICANTS'

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

// proposedPrice/priceReason them 2026-09-30 (yeu cau nguoi dung) cho lua chon "De nghi mot muc
// khac" o form ung tuyen - neu gui proposedPrice thi priceReason BAT BUOC (BE bao
// TSK-400-PRICE_REASON_REQUIRED neu thieu). Ca 2 di qua kenh chat nhu 1 PRICE_PROPOSAL binh
// thuong, khong luu thang vao don (giong het proposedPrice cua InviteTaskerPayload).
export interface ApplyToTaskPayload {
  message?: string
  proposedPrice?: number
  priceReason?: string
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
  // pendingProposalProposedBy them cho man "Ung vien & chot gia" - chi khac null khi
  // pendingProposalAmount khac null, cho biet Tasker hay Poster la nguoi de xuat de doi
  // nhan/thong bao cho dung chieu. Dong y/Tu choi de xuat van chi lam duoc trong khung chat.
  pendingProposalProposedBy: TaskApplicationInitiator | null
  // Don UNG VIEN THANG cua UC11 "Chon nguoi nay" GIU NGUYEN status=PENDING (khong chuyen
  // ACCEPTED) - hasBooking (tu BookingFacade.findByApplicationId ben BE) moi la tin hieu dung
  // "da duoc chon", dung de an nut Chon nguoi nay/Tu choi va doi badge trang thai.
  hasBooking: boolean
}

/** Ket qua UC11 "Chon nguoi nay" - dung cho POST .../confirm. Khop dung ConfirmApplicationResponse.java. */
export interface ConfirmApplicationResponse {
  application: TaskApplicationResponse
  bookingId: string
  feeBaseAmount: number
  // paymentMethod/escrowHeldAmount them 2026-10-02 - so tien THAT da tam giu (gia lap) theo
  // phuong thuc Poster vua chon, khac feeBaseAmount khi paymentMethod = FEE_ONLY_ESCROW.
  paymentMethod: PaymentMethod
  escrowHeldAmount: number
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
  taskLat: number
  taskLng: number
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
  // Gia THAT da chot qua chat (doc trong task_price_history ben BE, khong phai field luu thang
  // tren don ung tuyen) - null neu chua co de xuat nao duoc Dong y, dung fallback taskBudgetAmount.
  agreedPriceAmount: number | null
  // Don UNG VIEN THANG cua UC11 "Chon nguoi nay" GIU NGUYEN status=PENDING (khong chuyen
  // ACCEPTED) - hasBooking (tu BookingFacade.findByApplicationId ben BE) moi la tin hieu dung
  // "da duoc chon", dung de xep tab "Da nhan" thay vi dua vao status.
  hasBooking: boolean
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

/** Tasker bam "Van nhan viec" sau khi Poster doi "Thoi gian mong muon" (UC07 Tier 3) - don dang TIME_CHANGED_NEEDS_RECONFIRM tro ve PENDING. */
export function reconfirmApplication(taskId: string, applicationId: string) {
  return apiFetch<TaskApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/reconfirm`, {
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
 * Poster xac nhan mot ung vien (UC11 "Chon nguoi nay") kem phuong thuc thanh toan da chon -
 * tao booking-lite that (status CONFIRMED tu 2026-10-02, da giu tien that qua Payment - gia
 * lap, chua tich hop Sepay), cac ung vien con lai chuyen REJECTED_AUTO kem dong kenh chat.
 */
export function confirmApplication(taskId: string, applicationId: string, paymentMethod: PaymentMethod) {
  return apiFetch<ConfirmApplicationResponse>(`/tasks/${taskId}/applications/${applicationId}/confirm`, {
    method: 'POST',
    body: { paymentMethod },
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

// --- Chi phi phat sinh (quyet dinh nguoi dung 2026-10-02) - Tasker da ung tien mua vat tu/cong
// lam phat sinh, dang len lam bang chung minh bach de Poster tra lai sau khi hoan thanh. CHI
// dung duoc khi paymentMethod cua booking = FULL_ESCROW (xem Javadoc BE TaskExtraCostService).
// Day la co che RIENG voi "De xuat gia" (ChangeType/task_price_history) - khong lien quan gia
// chot, chi cong don them vao so tien Poster phai tra.

// Khop dung vn.taskconnect.task.api.ExtraCostBatchStatus.
export type ExtraCostBatchStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface ExtraCostItem {
  id: string
  name: string
  amount: number
  photoUrl: string | null
}

export interface ExtraCostBatch {
  id: string
  batchNo: number
  status: ExtraCostBatchStatus
  note: string | null
  items: ExtraCostItem[]
  totalAmount: number
  submittedByAccountId: string
  submittedByName: string | null
  submittedAt: string
  reviewedByAccountId: string | null
  reviewedByName: string | null
  reviewedAt: string | null
}

/**
 * Toan bo buc tranh tien cua 1 application sau khi ASSIGNED - chi phi chot ban dau + cac batch
 * phat sinh da duyet + batch dang cho (neu co) + so sanh voi so dang tam giu that. Khop dung
 * ExtraCostMoneySummaryResponse.java.
 */
export interface ExtraCostMoneySummaryResponse {
  feeBaseAmount: number
  paymentMethod: PaymentMethod
  heldAmount: number
  approvedBatches: ExtraCostBatch[]
  pendingBatch: ExtraCostBatch | null
  approvedExtraTotal: number
  // = feeBaseAmount + tong cac batch da duyet - "Tong ban phai tra".
  requiredTotal: number
  // Phan con thieu so voi heldAmount hien tai (0 neu da du hoac thua) - dung hien "Can nap them" + nut "Nap".
  deltaNeeded: number
}

/** Tong hop tien cua 1 application - ca Poster va Tasker cua don do goi duoc. */
export function getExtraCostSummary(applicationId: string) {
  return apiFetch<ExtraCostMoneySummaryResponse>(`/tasks/applications/${applicationId}/extra-costs/summary`)
}

export interface ExtraCostItemInput {
  name: string
  amount: number
  photoUrl?: string
}

/** Tasker dang 1 batch chi phi phat sinh moi (co the gom nhieu khoan). */
export function submitExtraCostBatch(applicationId: string, note: string | undefined, items: ExtraCostItemInput[]) {
  return apiFetch<ExtraCostMoneySummaryResponse>(`/tasks/applications/${applicationId}/extra-costs`, {
    method: 'POST',
    body: { note, items },
  })
}

/** Tasker tu thu hoi mot batch do chinh minh dang, dang cho duyet. */
export function withdrawExtraCostBatch(applicationId: string, batchId: string) {
  return apiFetch<ExtraCostMoneySummaryResponse>(
    `/tasks/applications/${applicationId}/extra-costs/${batchId}/withdraw`,
    { method: 'POST' },
  )
}

/** Poster dong y mot batch chi phi phat sinh dang cho duyet. */
export function approveExtraCostBatch(applicationId: string, batchId: string) {
  return apiFetch<ExtraCostMoneySummaryResponse>(
    `/tasks/applications/${applicationId}/extra-costs/${batchId}/approve`,
    { method: 'POST' },
  )
}

/** Poster tu choi mot batch chi phi phat sinh dang cho duyet. */
export function rejectExtraCostBatch(applicationId: string, batchId: string) {
  return apiFetch<ExtraCostMoneySummaryResponse>(
    `/tasks/applications/${applicationId}/extra-costs/${batchId}/reject`,
    { method: 'POST' },
  )
}

/** Poster bam "Nap" - nap them (gia lap) cho du so phai tra sau khi cac batch da duyet tang len. */
export function topUpExtraCostEscrow(applicationId: string) {
  return apiFetch<ExtraCostMoneySummaryResponse>(`/tasks/applications/${applicationId}/extra-costs/top-up`, {
    method: 'POST',
  })
}

export interface ExtraCostImageUploadUrlResponse {
  uploadUrl: string
  publicUrl: string
  expiresAt: string
}

/** Xin presigned PUT URL rieng tu de Tasker tu tai 1 anh minh chung chi phi phat sinh len S3. */
export function createExtraCostImageUploadUrl(applicationId: string, contentType: string) {
  return apiFetch<ExtraCostImageUploadUrlResponse>(`/tasks/applications/${applicationId}/extra-cost-images/upload-url`, {
    method: 'POST',
    body: { contentType },
  })
}
