// PUT truc tiep 1 file len presigned URL cua S3, khong qua backend (apiFetch) - S3 khong
// hieu ApiResponse envelope cua backend nen khong the dung apiFetch o day. Dung chung cho
// avatar, anh CCCD (KYC) va file chung chi Tasker.
export async function uploadFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Tải file lên thất bại (HTTP ${response.status}). Thử lại hoặc chọn file khác.`)
  }
}
