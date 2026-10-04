import { apiFetch } from './client.ts'

// Khop dung vn.taskconnect.admin.dto.response.SystemParametersResponse - nguong nghiep vu doc
// dong tu backend (khong hardcode o FE, dung tinh than voi rule "khong hardcode trong Java" cua
// 02-source-of-truth.md), dung de validate phia client truoc khi upload dinh kem chat (them
// 2026-09-26) va cac widget xem truoc khac.
export interface SystemParametersResponse {
  platformFeeRate: number
  maxConcurrentInvitesPerTask: number
  inviteExpiryHours: number
  chatMessageRecallWindowMinutes: number
  chatMaxPinnedMessagesPerChannel: number
  chatImageMaxCountPerMessage: number
  chatImageMaxSizeMb: number
  chatVideoMaxCountPerMessage: number
  chatVideoMaxSizeMb: number
  chatVideoMaxDurationSeconds: number
  chatFileMaxCountPerMessage: number
  chatFileMaxSizeMb: number
  chatVoiceMaxDurationSeconds: number
  chatVoiceMaxSizeMb: number
}

/** Doc cac nguong van hanh cong khai (moi tai khoan da dang nhap goi duoc) - GET /api/v1/system-parameters. */
export function getSystemParameters() {
  return apiFetch<SystemParametersResponse>('/system-parameters')
}
