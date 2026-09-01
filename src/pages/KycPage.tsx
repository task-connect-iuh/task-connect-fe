import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { KycStatus } from '@ds/components/marketplace/KycStatus'
import { AppShell } from '../components/AppShell.tsx'
import { FileDropzone } from '../components/FileDropzone.tsx'
import { createKycUploadUrl, getMyLatestKyc, submitKyc } from '../api/users.ts'
import type { KycStatusResponse } from '../api/users.ts'
import { ApiError } from '../api/client.ts'
import { uploadFileToPresignedUrl } from '../utils/s3Upload.ts'

// Whitelist khop dung common/storage/ImageContentTypes.java.
const ALLOWED_ID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ID_NUMBER_PATTERN = /^\d{9}$|^\d{12}$/

/** state cua KycStatus (@ds/components/marketplace/KycStatus) - khong khop 1-1 ten voi KycStatus BE. */
function toKycStatusState(status: KycStatusResponse['status'] | null): 'unverified' | 'pending' | 'approved' | 'rejected' {
  switch (status) {
    case 'VERIFYING': return 'pending'
    case 'VERIFIED': return 'approved'
    case 'REJECTED': return 'rejected'
    default: return 'unverified'
  }
}

/**
 * Xac thuc danh tinh (KYC) - UC05. Chi Tasker duoc dan link toi trang nay tu FE (xem
 * docs/PROGRESS-FE-USER-MODULE.md "KYC Tasker-only") - Task Poster khong can verify CCCD.
 * GET .../latest nem USR-404-KYC_NOT_FOUND khi chua tung nop lan nao, khong phai gia tri
 * enum "NOT_SUBMITTED" (gia tri do chi xuat hien o ProfileResponse.kycStatus).
 */
export function KycPage() {
  const [loading, setLoading] = useState(true)
  const [latest, setLatest] = useState<KycStatusResponse | null>(null)
  const [loadError, setLoadError] = useState('')

  const [fullNameOnId, setFullNameOnId] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [frontFile, setFrontFile] = useState<{ name: string, key: string } | null>(null)
  const [backFile, setBackFile] = useState<{ name: string, key: string } | null>(null)
  // Object URL cuc bo (URL.createObjectURL) de xem truoc anh CCCD vua chon - khac object
  // key tren S3 (frontFile.key), chi song trong trinh duyet, phai revoke khi thay hoac nop xong.
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null)
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null)
  const [uploadingSide, setUploadingSide] = useState<'FRONT' | 'BACK' | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ fullNameOnId?: string, idNumber?: string, front?: string, back?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    setLoading(true)
    getMyLatestKyc()
      .then((response) => setLatest(response))
      .catch((error) => {
        if (error instanceof ApiError && error.code === 'USR-404-KYC_NOT_FOUND') {
          setLatest(null)
        } else {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được trạng thái xác thực. Kiểm tra mạng rồi thử lại.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const canSubmit = !latest || latest.status === 'REJECTED'

  const handleUpload = async (side: 'FRONT' | 'BACK', file: File) => {
    setFieldErrors((prev) => ({ ...prev, [side === 'FRONT' ? 'front' : 'back']: undefined }))
    if (!ALLOWED_ID_IMAGE_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, [side === 'FRONT' ? 'front' : 'back']: 'Chỉ nhận ảnh JPEG, PNG hoặc WEBP.' }))
      return
    }
    const preview = URL.createObjectURL(file)
    if (side === 'FRONT') {
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl)
      setFrontPreviewUrl(preview)
    } else {
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl)
      setBackPreviewUrl(preview)
    }
    setUploadingSide(side)
    try {
      const { uploadUrl, objectKey } = await createKycUploadUrl(side, file.type)
      await uploadFileToPresignedUrl(uploadUrl, file)
      const picked = { name: file.name, key: objectKey }
      if (side === 'FRONT') setFrontFile(picked)
      else setBackFile(picked)
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : 'Tải ảnh lên thất bại.'
      setFieldErrors((prev) => ({ ...prev, [side === 'FRONT' ? 'front' : 'back']: message }))
    } finally {
      setUploadingSide(null)
    }
  }

  const handleSubmit = async () => {
    const nextErrors: typeof fieldErrors = {}
    if (!fullNameOnId.trim()) nextErrors.fullNameOnId = 'Nhập họ tên đúng như trên CCCD.'
    if (!ID_NUMBER_PATTERN.test(idNumber.trim())) nextErrors.idNumber = 'Số CCCD/CMND gồm 9 hoặc 12 chữ số.'
    if (!frontFile) nextErrors.front = 'Tải ảnh mặt trước.'
    if (!backFile) nextErrors.back = 'Tải ảnh mặt sau.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !frontFile || !backFile) return

    setFormError('')
    setBusy(true)
    try {
      await submitKyc({
        fullNameOnId: fullNameOnId.trim(),
        idNumber: idNumber.trim(),
        idCardFrontKey: frontFile.key,
        idCardBackKey: backFile.key,
      })
      setFullNameOnId('')
      setIdNumber('')
      setFrontFile(null)
      setBackFile(null)
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl)
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl)
      setFrontPreviewUrl(null)
      setBackPreviewUrl(null)
      refresh()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Không nộp được hồ sơ. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell navValue="kyc" title="Xác thực danh tính" subtitle="Bắt buộc trước khi khai báo kỹ năng và nhận việc">
      {loading
        ? null
        : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,var(--content-max)) 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
              {canSubmit
                ? (
                    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                      {loadError && <Alert tone="danger" title="Không tải được trạng thái">{loadError}</Alert>}
                      {formError && <Alert tone="danger" title="Không nộp được hồ sơ">{formError}</Alert>}

                      <div className="flex gap-4 flex-wrap">
                        <Field label="Họ và tên trên CCCD" required error={fieldErrors.fullNameOnId} style={{ flex: 1, minWidth: 220 }}>
                          <Input value={fullNameOnId} onChange={(e) => setFullNameOnId(e.target.value)} disabled={busy} error={!!fieldErrors.fullNameOnId} />
                        </Field>
                        <Field label="Số CCCD/CMND" required hint="9 hoặc 12 chữ số" error={fieldErrors.idNumber} style={{ flex: 1, minWidth: 220 }}>
                          <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} disabled={busy} error={!!fieldErrors.idNumber} numeric inputMode="numeric" />
                        </Field>
                      </div>

                      <Field label="Ảnh CCCD" hint="Hai mặt, chụp đủ sáng, không loá. Chỉ dùng để xác minh và xử lý khiếu nại.">
                        <div className="flex gap-4">
                          <FileDropzone
                            label="Mặt trước"
                            hint="Kéo ảnh vào đây hoặc bấm để chọn"
                            accept={ALLOWED_ID_IMAGE_TYPES.join(',')}
                            fileName={frontFile?.name || (uploadingSide === 'FRONT' ? 'Đang tải…' : null)}
                            previewUrl={frontPreviewUrl}
                            error={fieldErrors.front}
                            disabled={busy || uploadingSide !== null}
                            onSelect={(file) => void handleUpload('FRONT', file)}
                          />
                          <FileDropzone
                            label="Mặt sau"
                            hint="Kéo ảnh vào đây hoặc bấm để chọn"
                            accept={ALLOWED_ID_IMAGE_TYPES.join(',')}
                            fileName={backFile?.name || (uploadingSide === 'BACK' ? 'Đang tải…' : null)}
                            previewUrl={backPreviewUrl}
                            error={fieldErrors.back}
                            disabled={busy || uploadingSide !== null}
                            onSelect={(file) => void handleUpload('BACK', file)}
                          />
                        </div>
                      </Field>

                      <Button size="lg" icon="shield-check" disabled={busy || uploadingSide !== null} onClick={handleSubmit} style={{ alignSelf: 'flex-start' }}>
                        {busy ? 'Đang gửi…' : latest?.status === 'REJECTED' ? 'Gửi lại hồ sơ' : 'Gửi hồ sơ xác thực'}
                      </Button>
                    </Card>
                  )
                : (
                    <Alert tone="info" title="Hồ sơ đang được xử lý">
                      {latest?.status === 'VERIFYING'
                        ? 'Hồ sơ của bạn đang chờ xét duyệt, thường dưới 24 giờ làm việc.'
                        : 'Danh tính của bạn đã được xác thực, không cần nộp lại.'}
                    </Alert>
                  )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', position: 'sticky', top: 'var(--sp-5)' }}>
                <KycStatus
                  state={toKycStatusState(latest ? latest.status : null)}
                  reason={latest?.status === 'REJECTED' ? latest.rejectionReason ?? undefined : undefined}
                />
              </div>
            </div>
          )}
    </AppShell>
  )
}
