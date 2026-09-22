import { apiFetch } from './client.ts'
import type { TaskApplicationStatus } from './tasks.ts'

// Khop dung vn.taskconnect.chat.api.ChannelStatus.
export type ChannelStatus = 'OPEN' | 'CLOSED'

// Khop dung vn.taskconnect.chat.api.ChatMessageType.
export type ChatMessageType = 'TEXT' | 'SYSTEM' | 'PRICE_PROPOSAL' | 'RESCHEDULE_PROPOSAL'

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

/** Gui 1 tin nhan TEXT trong kenh cua 1 application - lazy-create kenh neu la lan gui dau tien. */
export function sendTextMessage(applicationId: string, text: string) {
  return apiFetch<ChatMessageResponse>(`/chat/applications/${applicationId}/messages`, {
    method: 'POST',
    body: { text },
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
