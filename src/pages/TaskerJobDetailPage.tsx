import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { KycStatus } from '@ds/components/marketplace/KycStatus'
import { LifecycleTracker } from '@ds/components/marketplace/LifecycleTracker'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Textarea } from '@ds/components/forms/Textarea'
import { AppShell } from '../components/AppShell.tsx'
import { ImageLightbox } from '../components/ImageLightbox.tsx'
import { listCertificateRequirements, getMyCertifications } from '../api/users.ts'
import type { CategoryCertificateRequirementResponse, CertificationDetailResponse } from '../api/users.ts'
import { applyToTask, getFeedTask } from '../api/tasks.ts'
import type { TaskFeedItemResponse } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { toKycStatusState, useTaskerEligibility } from '../features/tasker/useTaskerEligibility.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'
import { useToastStore } from '../stores/useToastStore.ts'

// Ty le phi nen tang DA CHOT (8%, xem 02-source-of-truth.md) - CHI de xem truoc so tien o rail
// ben phai, cung cach dung nhu PostTaskPage.tsx. Khong phai tinh toan escrow that.
const PLATFORM_FEE_RATE = 0.08

function formatVnd(amount: number) {
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`
}

function formatScheduleLabel(iso: string | null) {
  if (!iso) return 'Thời gian thoả thuận'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

interface RequirementRow {
  requirement: CategoryCertificateRequirementResponse
  approved: boolean
}

/**
 * Chi tiet 1 viec + form gui ung tuyen (UC10) - Tasker. Viec goi that qua getFeedTask() (module
 * Task, khong con la findMockFeedJob - xem docs/TASK-MODULE-SPLIT.md), yeu cau chung chi va
 * trang thai KYC cung la DU LIEU THAT (listCertificateRequirements, getMyCertifications,
 * useTaskerEligibility). Theo yeu cau nguoi dung: BO o "Gia ban de xuat" VA o "Thoi gian ban co
 * the toi" (form chi con "Loi nhan ngan"). Dieu kien chung chi la OR, khong phai AND - chi can
 * DUYET 1 TRONG SO cac chung chi yeu cau cho danh muc nay la du dieu kien (khong bat buoc co du
 * tat ca), va chan nut Gui ung tuyen khi KYC chua VERIFIED. Nut "Xem ho so nguoi dang" van
 * disabled - khong phai vi thieu accountId that nua
 * (job.posterId gio la that) ma vi module Review chua ton tai, chua co diem uy tin de hien thi
 * dang hoang, xem TaskFeedItemResponse. Chi role TASKER vao duoc (RoleGuard o App.tsx).
 */
export function TaskerJobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState<TaskFeedItemResponse | null | undefined>(undefined)
  const { ready, categories, kycStatus, kycVerified } = useTaskerEligibility()
  const lightbox = useImageLightbox()

  const [requirements, setRequirements] = useState<CategoryCertificateRequirementResponse[] | null>(null)
  const [myCertifications, setMyCertifications] = useState<CertificationDetailResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!jobId) { setJob(null); return }
    getFeedTask(jobId)
      .then(setJob)
      .catch((error) => {
        setJob(null)
        if (!(error instanceof ApiError && error.code === 'TSK-404-TASK_NOT_FOUND')) {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được việc này.')
        }
      })
  }, [jobId])

  // job.categoryId la id that (khong con categoryCode minh hoa), tra category that theo id.
  const category = job ? (categories ?? []).find((c) => c.id === job.categoryId) : undefined

  useEffect(() => {
    if (!category) return
    Promise.all([listCertificateRequirements(category.id), getMyCertifications(category.id)])
      .then(([reqs, certs]) => { setRequirements(reqs); setMyCertifications(certs) })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được yêu cầu chứng chỉ.'))
  }, [category])

  if (job === undefined) {
    return (
      <AppShell navValue="feed" title="Chi tiết việc">
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Đang tải…</p>
      </AppShell>
    )
  }

  if (!job) {
    return (
      <AppShell navValue="feed" title="Chi tiết việc">
        {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}
        <EmptyState icon="search-x" title="Không tìm thấy việc này" action={<Button onClick={() => navigate('/tim-viec')}>Về danh sách việc</Button>} />
      </AppShell>
    )
  }

  const requirementRows: RequirementRow[] = (requirements ?? []).map((requirement) => ({
    requirement,
    approved: (myCertifications ?? []).some((c) => c.certificateTypeId === requirement.certificateTypeId && c.status === 'APPROVED'),
  }))
  // OR, khong phai AND: chi can 1 trong so cac chung chi yeu cau cho danh muc nay duoc duyet
  // la du dieu kien (yeu cau nguoi dung) - neu khong co chung chi nao yeu cau thi khong chan.
  const hasRequiredCert = requirementRows.length === 0 || requirementRows.some((row) => row.approved)
  const certsReady = requirements != null && myCertifications != null
  const canApply = certsReady && kycVerified && hasRequiredCert

  const handleApply = () => {
    setSubmitting(true)
    applyToTask(job.id, { message: message || undefined })
      .then(() => {
        setSubmitted(true)
        useToastStore.getState().pushToast('success', 'Đã gửi ứng tuyển. Chờ người đăng xác nhận.')
      })
      .catch((error) => {
        setLoadError(error instanceof ApiError ? error.message : 'Gửi ứng tuyển thất bại, thử lại sau.')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <AppShell navValue="feed" title="Chi tiết việc" subtitle={category?.name ?? job.categoryName}>
      <Link
        to="/tim-viec"
        className="flex items-center gap-1"
        style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)', marginBottom: 'var(--sp-4)', width: 'fit-content' }}
      >
        <Icon name="arrow-left" size={15} />Về danh sách việc
      </Link>

      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5">
          <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Badge tone="brand" style={{ alignSelf: 'flex-start' }}>{category?.name ?? job.categoryName}</Badge>
            <h2 style={{ fontSize: 'var(--fs-h1)' }}>{job.title}</h2>
            <div className="flex gap-5 flex-wrap" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{job.addressText}</span>
              <span className="flex items-center gap-1"><Icon name="clock" size={15} />{formatScheduleLabel(job.scheduledAt)}</span>
              <span className="flex items-center gap-1"><Icon name="lock" size={15} />Trả qua tạm giữ</span>
            </div>
            <p style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--text-body)', lineHeight: 1.6, maxWidth: 620 }}>{job.description}</p>

            {job.imageUrls.length > 0 && (
              <Button variant="secondary" size="sm" icon="image" style={{ alignSelf: 'flex-start' }} onClick={() => lightbox.open(job.imageUrls, 0)}>
                Xem ảnh ({job.imageUrls.length})
              </Button>
            )}

            <LifecycleTracker current={1} />
          </Card>

          <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <h3>Gửi ứng tuyển</h3>

            {ready && !kycVerified && (
              <KycStatus
                state={toKycStatusState(kycStatus)}
                reason="Bạn cần xác minh danh tính (KYC) trước khi ứng tuyển bất kỳ việc nào."
                action={<Button size="sm" variant="secondary" onClick={() => navigate('/xac-thuc-danh-tinh')}>Xác minh ngay</Button>}
              />
            )}

            {requirementRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="tc-label">Chứng chỉ cho việc này — chỉ cần có 1 trong số dưới đây</div>
                {requirementRows.map((row) => (
                  <div key={row.requirement.certificateTypeId} className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: row.approved ? 'var(--text-body)' : 'var(--text-muted)' }}>
                    <Icon name={row.approved ? 'badge-check' : 'circle-alert'} size={16} />
                    {row.requirement.certificateTypeName}
                    <Badge tone={row.approved ? 'success' : 'danger'}>{row.approved ? 'Đã có' : 'Chưa chứng minh'}</Badge>
                  </div>
                ))}
              </div>
            )}

            {certsReady && !hasRequiredCert && (
              <Alert
                tone="danger"
                title="Chưa đủ điều kiện để ứng tuyển"
                action={<Button size="sm" icon="upload" onClick={() => navigate('/ho-so-nang-luc')}>Tải chứng chỉ lên</Button>}
              >
                Việc này cần ít nhất 1 trong {requirementRows.length} chứng chỉ ở trên được duyệt. Gửi bản chụp để thẩm định — thường xong trong 1–3 ngày làm việc.
              </Alert>
            )}

            <Field label="Lời nhắn ngắn" hint="Nói rõ kinh nghiệm liên quan và cách bạn xử lý.">
              <Textarea rows={3} placeholder="Tôi làm điện nước 6 năm, có thể tới đúng giờ…" value={message} onChange={(e) => setMessage(e.target.value)} disabled={submitted} />
            </Field>

            <Button
              size="lg" icon={submitted ? 'check' : 'send'}
              disabled={!canApply || submitting || submitted}
              onClick={handleApply}
              style={{ alignSelf: 'flex-start' }}
            >
              {submitted ? 'Đã gửi ứng tuyển' : submitting ? 'Đang gửi…' : 'Gửi ứng tuyển'}
            </Button>
          </Card>
        </div>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          <Card tone="money" padding="var(--sp-5)">
            {job.budgetAmount != null ? (
              <>
                <MoneyAmount value={job.budgetAmount} size="lg" tone="money" label="Ngân sách người đăng đưa ra" />
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <DataRow label="Phí nền tảng (8%)" value={`−${formatVnd(job.budgetAmount * PLATFORM_FEE_RATE)}`} numeric />
                  <DataRow label="Bạn nhận được" value={formatVnd(job.budgetAmount * (1 - PLATFORM_FEE_RATE))} numeric strong />
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Ngân sách thoả thuận trực tiếp với người đăng.</p>
            )}
            <p style={{ marginTop: 'var(--sp-3)', marginBottom: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Bản xem trước giao diện — ví và tạm giữ tiền thật sẽ có khi module Thanh toán hoàn thành.
            </p>
          </Card>

          <Alert tone="money" title="Tiền được giữ trước khi bạn bắt đầu">
            Khi người đăng chọn bạn, ngân sách chuyển sang trạng thái tạm giữ. Bạn thấy trạng thái đó trong ví trước khi tới nơi làm.
          </Alert>

          <Card padding="var(--sp-5)" className="flex items-center gap-3">
            <Avatar name={job.posterName ?? 'Người đăng'} size={44} />
            <div className="flex-1">
              <strong style={{ fontSize: 'var(--fs-body)' }}>{job.posterName ?? 'Người đăng việc'}</strong>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Người đăng việc</div>
            </div>
          </Card>
          <Button variant="secondary" block icon="user-search" disabled title="Chưa có điểm uy tín — module Đánh giá chưa hoàn thành">
            Xem hồ sơ người đăng
          </Button>
        </div>
      </div>

      {lightbox.viewerUrl && (
        <ImageLightbox
          url={lightbox.viewerUrl}
          zoom={lightbox.viewerZoom}
          rotation={lightbox.viewerRotation}
          onClose={lightbox.close}
          onZoomIn={lightbox.zoomIn}
          onZoomOut={lightbox.zoomOut}
          onRotate={lightbox.rotate}
          index={lightbox.index}
          total={lightbox.total}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
          onGoTo={lightbox.goTo}
        />
      )}
    </AppShell>
  )
}
