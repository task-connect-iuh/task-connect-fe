import { apiFetch } from './client.ts'
import type { ExtraCostBatchStatus, PaymentMethod, TaskApplicationStatus, TaskEditableField, TaskStatus } from './tasks.ts'

// Khop dung vn.taskconnect.chat.api.ChannelStatus.
export type ChannelStatus = 'OPEN' | 'CLOSED'

// Khop dung vn.taskconnect.chat.api.ChatMessageType. IMAGE/FILE/VIDEO them 2026-09-26, VOICE them
// 2026-09-26 (round 2), EXTRA_COST_BATCH them 2026-10-03.
export type ChatMessageType =
  | 'TEXT' | 'SYSTEM' | 'PRICE_PROPOSAL' | 'RESCHEDULE_PROPOSAL' | 'IMAGE' | 'FILE' | 'VIDEO' | 'VOICE'
  | 'EXTRA_COST_BATCH'

// Khop dung vn.taskconnect.task.api.dto.ExtraCostBatchSummary.Item (them 2026-10-03) - rieng
// voi ExtraCostItem o tasks.ts vi khong mang id (DTO toi gian danh cho the trong chat).
export interface ExtraCostBatchCardItem {
  name: string
  amount: number
  photoUrl: string | null
}

// Khop dung vn.taskconnect.task.api.dto.ExtraCostBatchSummary (them 2026-10-03) - nhung gi
// ChatMessageResponse.extraCostBatch mang theo de ve the "Chi phí phát sinh" ngay trong chat.
export interface ExtraCostBatchCard {
  id: string
  batchNo: number
  status: ExtraCostBatchStatus
  note: string | null
  items: ExtraCostBatchCardItem[]
  totalAmount: number
  submittedAt: string
  reviewedAt: string | null
}

// Khop dung vn.taskconnect.chat.dto.response.ChatAttachmentResponse (them 2026-09-26). url la
// presigned GET ngan han, ky lai moi lan tai danh sach tin nhan - khong cache lau dai.
export interface ChatAttachmentResponse {
  url: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  sortOrder: number
}

// Khop dung vn.taskconnect.chat.dto.response.ChatReactionResponse (them 2026-09-26).
export interface ChatReactionResponse {
  accountId: string
  accountName: string | null
  emoji: string
}

// Khop dung vn.taskconnect.chat.api.ProposalStatus.
export type ProposalStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED'

// Khop dung vn.taskconnect.chat.api.InboxTab (4 tab, xem InboxTab.java).
export type InboxTab = 'ALL' | 'NEEDS_RESPONSE' | 'IN_PROGRESS' | 'CLOSED'

// Khop dung vn.taskconnect.chat.dto.response.ChatInboxItemResponse.
export interface ChatInboxItemResponse {
  applicationId: string
  channelId: string
  taskId: string
  taskTitle: string
  counterpartAccountId: string
  counterpartName: string | null
  counterpartAvatarUrl: string | null
  viewerRole: string
  status: ChannelStatus
  lastMessagePreview: string | null
  lastMessageAt: string
  needsResponse: boolean
  // Trang thai don ung tuyen hien tai - chi dung de suy ra badge ly do dong kenh khi
  // status=CLOSED (xem CLOSED_REASON_LABEL trong InboxPage.tsx), khong anh huong logic 4 tab.
  applicationStatus: TaskApplicationStatus
  // Kenh da duoc gan booking chua (UC11 confirm) - dung de xac dinh tab IN_PROGRESS, xem
  // matchesTab() trong InboxPage.tsx va Javadoc InboxTab.java (BE), khop
  // vn.taskconnect.chat.dto.response.ChatInboxItemResponse.hasBooking (2026-09-22).
  hasBooking: boolean
  // Trang thai cong viec cha - dung rieng de nhan biet "Admin da tu choi hau kiem cong viec nay"
  // (khac applicationStatus, khong doi khi Admin tu choi task), xem closedReasonLabel() trong
  // InboxPage.tsx.
  taskStatus: TaskStatus
  // Phuong thuc thanh toan da chon o UC11 (null neu hasBooking = false) - them 2026-10-02 de
  // quyet dinh hien nut "Chi phi phat sinh" thay "De xuat gia" (chi khi ASSIGNED + FULL_ESCROW).
  paymentMethod: PaymentMethod | null
}

// Khop dung vn.taskconnect.chat.dto.response.ChatApplicationStatusResponse - dung khi mo mot
// cuoc tro chuyen CHUA tung co kenh chat (selectedItem rong trong Inbox) de biet truoc co nen
// chan gui/hien thong bao "khong the bat dau hoi thoai" hay khong, xem InboxPage.tsx.
export interface ChatApplicationStatusResponse {
  applicationId: string
  taskId: string
  taskTitle: string
  counterpartAccountId: string
  counterpartName: string | null
  counterpartAvatarUrl: string | null
  viewerRole: string
  applicationStatus: TaskApplicationStatus
  taskStatus: TaskStatus
}

// Khop dung vn.taskconnect.chat.dto.response.ChatMessageResponse - cung la payload publish
// qua WebSocket toi "/topic/chat/{applicationId}".
export interface ChatMessageResponse {
  id: string
  channelId: string
  senderAccountId: string | null
  senderName: string | null
  senderAvatarUrl: string | null
  messageType: ChatMessageType
  body: string | null
  refPriceHistoryId: string | null
  priceProposalAmount: number | null
  proposedTime: string | null
  proposalStatus: ProposalStatus | null
  createdAt: string
  // Cac truong them 2026-09-26 - xem Javadoc vn.taskconnect.chat.dto.response.ChatMessageResponse.
  attachments: ChatAttachmentResponse[]
  replyToMessageId: string | null
  recalledAt: string | null
  recallableUntil: string | null
  reactions: ChatReactionResponse[]
  pinnedAt: string | null
  pinnedByAccountId: string | null
  pinnedByName: string | null
  // Chi co gia tri khi day la SYSTEM message sinh tu 1 lan Poster sua cong viec (UC07) - dung
  // goi getTaskEditOfMessage() de hien nut "Xem chi tiết thay đổi".
  refTaskEditId: string | null
  // Chi co gia tri khi messageType = EXTRA_COST_BATCH (them 2026-10-03) - extraCostBatch doc
  // TUOI tu BE moi lan hien (khong cache), dung de ve the "Chi phí phát sinh" ngay trong chat.
  refExtraCostBatchId: string | null
  extraCostBatch: ExtraCostBatchCard | null
}

// Khop dung vn.taskconnect.chat.dto.response.TaskEditDiffResponse - chi tiet "truoc -> sau"
// cua 1 lan Poster sua cong viec (UC07), tra ve tu getTaskEditOfMessage().
export interface TaskEditDiffResponse {
  id: string
  editedAt: string
  changes: { field: TaskEditableField; oldValue: string | null; newValue: string | null }[]
}

// Khop dung vn.taskconnect.chat.dto.response.InboxPingEvent - publish qua
// "/user/{accountId}/queue/inbox" moi khi co thay doi lien quan toi 1 application.
export interface InboxPingEvent {
  applicationId: string
}

/** Danh sach Inbox cua tai khoan dang dang nhap, loc theo 1 trong 4 tab. */
export function getInbox(tab: InboxTab) {
  return apiFetch<ChatInboxItemResponse[]>(`/chat/inbox?tab=${tab}`)
}

/** Toan bo lich su tin nhan cua kenh thuoc 1 application - rong neu kenh chua ton tai. */
export function getMessages(applicationId: string) {
  return apiFetch<ChatMessageResponse[]>(`/chat/applications/${applicationId}/messages`)
}

/** Chi tiet thay doi cua 1 SYSTEM message bao "Poster vừa cập nhật thông tin công việc" (UC07). */
export function getTaskEditOfMessage(applicationId: string, messageId: string) {
  return apiFetch<TaskEditDiffResponse>(`/chat/applications/${applicationId}/messages/${messageId}/task-edit`)
}

/** Trang thai application + task cha, KHONG doi hoi kenh chat da ton tai - dung khi mo 1 cuoc tro chuyen chua nam trong Inbox. */
export function getApplicationChatStatus(applicationId: string) {
  return apiFetch<ChatApplicationStatusResponse>(`/chat/applications/${applicationId}/status`)
}

/**
 * Gui 1 tin nhan TEXT trong kenh cua 1 application - lazy-create kenh neu la lan gui dau tien.
 * replyToMessageId tuy chon (them 2026-09-26) - tra loi (quote) 1 tin nhan khac cung kenh.
 */
export function sendTextMessage(applicationId: string, text: string, replyToMessageId?: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/messages`, {
    method: 'POST',
    body: { text, replyToMessageId: replyToMessageId ?? null },
  })
}

// Khop dung vn.taskconnect.chat.dto.response.ChatAttachmentUploadUrlResponse (them 2026-09-26).
export interface ChatAttachmentUploadUrlResponse {
  uploadUrl: string
  objectKey: string
  expiresAt: string
}

/** Xin 1 presigned PUT URL de tu tai 1 anh/video/file dinh kem len S3 - kind phai la IMAGE/FILE/VIDEO. */
export function createAttachmentUploadUrl(applicationId: string, contentType: string, kind: ChatMessageType) {
  return apiFetch<ChatAttachmentUploadUrlResponse>(`/chat/applications/${applicationId}/attachment-upload-url`, {
    method: 'POST',
    body: { contentType, kind },
  })
}

/** 1 file da PUT xong len S3 (objectKey do createAttachmentUploadUrl tra ve), goi lai nguyen ven khi gui tin nhan. */
export interface ChatAttachmentInput {
  objectKey: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
}

/** Tao 1 tin nhan IMAGE/FILE/VIDEO SAU KHI da PUT xong tung file len S3 (them 2026-09-26). */
export function sendAttachmentMessage(
  applicationId: string,
  messageType: ChatMessageType,
  attachments: ChatAttachmentInput[],
  options?: { caption?: string; replyToMessageId?: string },
) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/attachment-messages`, {
    method: 'POST',
    body: {
      messageType,
      caption: options?.caption ?? null,
      replyToMessageId: options?.replyToMessageId ?? null,
      attachments,
    },
  })
}

/** Chinh nguoi gui Thu hoi 1 tin nhan TEXT/IMAGE/FILE/VIDEO cua minh, trong han thoi gian cho phep (them 2026-09-26). */
export function recallMessage(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/messages/${messageId}/recall`, {
    method: 'POST',
  })
}

/** Tha/doi/bo (toggle - tha lai cung emoji se bo tha) 1 emoji tren 1 tin nhan (them 2026-09-26). */
export function reactToMessage(applicationId: string, messageId: string, emoji: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { emoji },
  })
}

/** Ghim 1 tin nhan vao kenh - ca hai ben deu ghim duoc, toi da so tin dong thoi (them 2026-09-26). */
export function pinMessage(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/messages/${messageId}/pin`, {
    method: 'POST',
  })
}

/** Bo ghim 1 tin nhan - ca hai ben deu bo ghim duoc (them 2026-09-26). */
export function unpinMessage(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/messages/${messageId}/pin`, {
    method: 'DELETE',
  })
}

/** Tao 1 de xuat gia moi trong kenh cua 1 application - chi gui duoc tu trong khung chat. */
export function createPriceProposal(applicationId: string, amount: number, note?: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/price-proposals`, {
    method: 'POST',
    body: { amount, note },
  })
}

/** Ben khong phai nguoi tao Dong y 1 de xuat gia con PROPOSED. */
export function acceptPriceProposal(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(
    `/chat/applications/${applicationId}/price-proposals/${messageId}/accept`,
    { method: 'POST' },
  )
}

/** Ben khong phai nguoi tao Tu choi 1 de xuat gia con PROPOSED. */
export function rejectPriceProposal(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(
    `/chat/applications/${applicationId}/price-proposals/${messageId}/reject`,
    { method: 'POST' },
  )
}

/** Chinh nguoi tao Thu hoi 1 de xuat gia con PROPOSED. */
export function withdrawPriceProposal(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(
    `/chat/applications/${applicationId}/price-proposals/${messageId}/withdraw`,
    { method: 'POST' },
  )
}

/** Tao 1 de xuat doi lich lam viec moi - chi hop le khi task dang ASSIGNED (da co booking). proposedTime la ISO datetime tuong lai. */
export function createRescheduleProposal(applicationId: string, proposedTime: string, note?: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/reschedule-proposals`, {
    method: 'POST',
    body: { proposedTime, note },
  })
}

/** Ben khong phai nguoi tao Dong y 1 de xuat doi lich con PROPOSED. */
export function acceptRescheduleProposal(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(
    `/chat/applications/${applicationId}/reschedule-proposals/${messageId}/accept`,
    { method: 'POST' },
  )
}

/** Ben khong phai nguoi tao Tu choi 1 de xuat doi lich con PROPOSED. */
export function rejectRescheduleProposal(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(
    `/chat/applications/${applicationId}/reschedule-proposals/${messageId}/reject`,
    { method: 'POST' },
  )
}

/** Chinh nguoi tao Thu hoi 1 de xuat doi lich con PROPOSED. */
export function withdrawRescheduleProposal(applicationId: string, messageId: string) {
  return apiFetch<ChatMessageResponse>(
    `/chat/applications/${applicationId}/reschedule-proposals/${messageId}/withdraw`,
    { method: 'POST' },
  )
}
