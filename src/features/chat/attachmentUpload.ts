import type { ChatAttachmentInput, ChatMessageType } from '../../api/chat.ts'
import { createAttachmentUploadUrl } from '../../api/chat.ts'
import type { SystemParametersResponse } from '../../api/systemParameters.ts'

const KIND_LABEL: Record<string, string> = { IMAGE: 'ảnh', VIDEO: 'video', FILE: 'file', VOICE: 'ghi âm' }

/**
 * Tra ve gioi han (so luong + dung luong) khop dung nguong BE dang ap dung (ChatService.
 * validateAttachmentLimits) cho 1 kind - dung de chan phia client TRUOC khi upload len S3, tranh
 * nguoi dung cho "Dang tai tep len..." het thoi gian PUT roi moi bi BE tra 400 (them 2026-09-26).
 */
function getAttachmentLimits(kind: ChatMessageType, params: SystemParametersResponse) {
  switch (kind) {
    case 'IMAGE': return { maxCount: params.chatImageMaxCountPerMessage, maxSizeBytes: params.chatImageMaxSizeMb * 1024 * 1024 }
    case 'VIDEO': return { maxCount: params.chatVideoMaxCountPerMessage, maxSizeBytes: params.chatVideoMaxSizeMb * 1024 * 1024 }
    case 'FILE': return { maxCount: params.chatFileMaxCountPerMessage, maxSizeBytes: params.chatFileMaxSizeMb * 1024 * 1024 }
    case 'VOICE': return { maxCount: 1, maxSizeBytes: params.chatVoiceMaxSizeMb * 1024 * 1024 }
    default: return null
  }
}

/**
 * Kiem tra 1 lan chon file (so luong + dung luong tung file) truoc khi goi uploadChatAttachments().
 * Tra ve thong bao loi (tieng Viet, san sang hien toast) neu vi pham, null neu hop le. Neu chua
 * tai xong `params` (goi /system-parameters that bai), tra ve null va de BE la nguon that su -
 * tranh chan nham nguoi dung khi FE khong co du lieu gioi han.
 */
export function validateAttachmentSelection(
  kind: ChatMessageType,
  files: File[],
  params: SystemParametersResponse | null,
): string | null {
  if (!params) return null
  const limits = getAttachmentLimits(kind, params)
  if (!limits) return null
  const label = KIND_LABEL[kind] ?? 'tệp'
  if (files.length > limits.maxCount) {
    return `Chỉ được gửi tối đa ${limits.maxCount} ${label} mỗi lần.`
  }
  const oversized = files.find((file) => file.size > limits.maxSizeBytes)
  if (oversized) {
    const maxMb = Math.round(limits.maxSizeBytes / (1024 * 1024))
    return `"${oversized.name}" vượt quá dung lượng cho phép (tối đa ${maxMb}MB).`
  }
  return null
}

/**
 * Xin presigned PUT URL roi PUT thang 1 File len S3 (khong qua backend, xem
 * ChatAttachmentUploadService o BE) - dung fetch tho (KHONG dung apiFetch, URL nay tro thang
 * toi S3 chu khong phai backend cua chung ta, khong can Authorization/BASE_URL). Nem Error neu
 * S3 tra ve khac 2xx (vd sai Content-Type da ky).
 */
async function uploadOneFile(applicationId: string, kind: ChatMessageType, file: File): Promise<ChatAttachmentInput> {
  const { uploadUrl, objectKey } = await createAttachmentUploadUrl(applicationId, file.type, kind)
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Tải "${file.name}" lên thất bại.`)
  }
  return { objectKey, fileName: file.name, mimeType: file.type, fileSizeBytes: file.size }
}

/**
 * Tai TUAN TU tung file len S3 (khong Promise.all song song - tranh dot bien nhieu presigned
 * URL cung luc khi nguoi dung chon vd 10 anh, va giu dung thu tu sortOrder client da chon) roi
 * tra ve danh sach ChatAttachmentInput san sang goi sendAttachmentMessage(). Nem Error ngay tai
 * file dau tien loi, khong gui tin nhan thieu file.
 */
export async function uploadChatAttachments(
  applicationId: string,
  kind: ChatMessageType,
  files: File[],
): Promise<ChatAttachmentInput[]> {
  const results: ChatAttachmentInput[] = []
  for (const file of files) {
    results.push(await uploadOneFile(applicationId, kind, file))
  }
  return results
}
