import { createExtraCostImageUploadUrl } from '../../api/tasks.ts'

/**
 * Xin presigned PUT URL roi PUT thang 1 File len S3 (khong qua backend, xem
 * TaskExtraCostImageUploadService o BE) - dung fetch tho (KHONG dung apiFetch, URL nay tro thang
 * toi S3), cung co che voi uploadChatAttachments() (features/chat/attachmentUpload.ts). Tra ve
 * publicUrl de gan thang vao ExtraCostItemInput.photoUrl - khac dinh kem chat (presigned GET rieng
 * tu), anh chi phi phat sinh la public-read giong task_images nen khong can ky lai moi lan xem.
 */
export async function uploadExtraCostImage(applicationId: string, file: File): Promise<string> {
  const { uploadUrl, publicUrl } = await createExtraCostImageUploadUrl(applicationId, file.type)
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Tải "${file.name}" lên thất bại.`)
  }
  return publicUrl
}
