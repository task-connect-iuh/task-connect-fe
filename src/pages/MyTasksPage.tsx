import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Icon } from '@ds/components/core/Icon'
import { LifecycleTracker } from '@ds/components/marketplace/LifecycleTracker'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Tabs } from '@ds/components/navigation/Tabs'
import { AppShell } from '../components/AppShell.tsx'
import { DialogViewport } from '../components/DialogViewport.tsx'
import { ImageLightbox } from '../components/ImageLightbox.tsx'
import { confirmApplication, getMyTasks, getTaskApplicants, rejectApplication } from '../api/tasks.ts'
import type { TaskApplicationResponse, TaskResponse, TaskStatus } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'
import { useToastStore } from '../stores/useToastStore.ts'

// Nhan rieng cho TaskStatus (khac vocabulary cua StatusPill - component do chi danh cho
// trang thai booking/thanh toan, xem StatusPill.jsx "Never invent labels outside this map").
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  OPEN: 'Đang mở',
  ASSIGNED: 'Đã nhận việc',
  COMPLETED: 'Hoàn tất',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
  REJECTED: 'Bị từ chối',
}
const TASK_STATUS_TONE: Record<TaskStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING_REVIEW: 'warning',
  OPEN: 'success',
  ASSIGNED: 'info',
  COMPLETED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
  REJECTED: 'danger',
}

/**
 * Vi tri cua 1 cong viec trong vong doi 7 buoc chuan (LifecycleTracker, dung nguyen 7 nhan da
 * co trong Design System: Dang viec - Ghep viec - Dat viec - Tam giu - Hoan tat - Giai ngan -
 * Danh gia). Dot nay he thong CHI thuc su lam xong buoc "Dang viec" - OPEN nghia la dang o
 * buoc "Ghep viec" (dang tim Tasker), ASSIGNED/COMPLETED/CLOSED la suy luan cho tuong lai
 * (UC10/11, Booking, Payment chua ton tai nen 3 trang thai nay hien tai luon rong trong danh
 * sach that - xem docs/PROGRESS-TASK-POSTER-MODULE.md). null nghia la da roi khoi vong doi
 * chuan (CANCELLED/REJECTED), khong hien tracker cho 2 truong hop nay.
 */
function lifecycleStepFor(status: TaskStatus): number | null {
  switch (status) {
    case 'PENDING_REVIEW': return 0
    case 'OPEN': return 1
    case 'ASSIGNED': return 2
    case 'COMPLETED': return 4
    case 'CLOSED': return 6
    default: return null
  }
}

function formatBudget(amount: number | null) {
  return amount != null ? `${amount.toLocaleString('vi-VN')} đ` : 'Thoả thuận'
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN')
}

/** "Thứ 5, 14:00" - dung cho danh sach Lich viec sap toi o rail phai. */
function formatWeekdayTime(iso: string) {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

// Nhan/tone rieng cho trang thai don ung tuyen - cung nguyen tac voi TASK_STATUS_LABEL (khong dung vocabulary StatusPill).
const APPLICATION_STATUS_LABEL: Record<TaskApplicationResponse['status'], string> = {
  PENDING: 'Chờ bạn xác nhận',
  ACCEPTED: 'Đã xác nhận',
  NEEDS_RECONFIRM: 'Cần ứng tuyển lại',
  REJECTED: 'Đã từ chối',
}
const APPLICATION_STATUS_TONE: Record<TaskApplicationResponse['status'], 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  NEEDS_RECONFIRM: 'warning',
  REJECTED: 'neutral',
}

interface ApplicantsPanelProps {
  task: TaskResponse
  onConfirmed: () => void
}

/**
 * Danh sach ung vien cua 1 cong viec + nut xac nhan/tu choi (UC11, gioi han doi trang thai -
 * chua tao Booking that, xem docs/TASK-MODULE-SPLIT.md). Chi hien khi task dang OPEN (con
 * nhan ung tuyen) hoac ASSIGNED (de xem lai ai da duoc chon). Sau khi xac nhan thanh cong, goi
 * onConfirmed() de MyTasksPage refetch danh sach cong viec (Task chuyen ASSIGNED) va dong dialog.
 */
function ApplicantsPanel({ task, onConfirmed }: ApplicantsPanelProps) {
  const [applicants, setApplicants] = useState<TaskApplicationResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    getTaskApplicants(task.id)
      .then(setApplicants)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách ứng viên.'))
  }, [task.id])

  const handleConfirm = (applicationId: string) => {
    setProcessingId(applicationId)
    confirmApplication(task.id, applicationId)
      .then(() => {
        useToastStore.getState().pushToast('success', 'Đã xác nhận Tasker cho công việc này.')
        onConfirmed()
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Xác nhận thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  const handleReject = (applicationId: string) => {
    setProcessingId(applicationId)
    rejectApplication(task.id, applicationId)
      .then((updated) => {
        setApplicants((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? null)
        useToastStore.getState().pushToast('success', 'Đã từ chối ứng viên này.')
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Từ chối thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  return (
    <div className="flex flex-col gap-3" style={{ paddingTop: 'var(--sp-2)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
      <div className="tc-label">Ứng viên</div>
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}
      {applicants == null && !loadError && (
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tải…</p>
      )}
      {applicants != null && applicants.length === 0 && (
        <EmptyState icon="user-search" title="Chưa có ai ứng tuyển" />
      )}
      {applicants?.map((applicant) => (
        <Card key={applicant.id} padding="var(--sp-4)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={applicant.taskerName ?? 'Tasker'} size={36} />
            <div className="flex-1">
              <strong style={{ fontSize: 'var(--fs-body)' }}>{applicant.taskerName ?? 'Tasker'}</strong>
            </div>
            <Badge tone={APPLICATION_STATUS_TONE[applicant.status]}>{APPLICATION_STATUS_LABEL[applicant.status]}</Badge>
          </div>
          {applicant.message && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.5 }}>{applicant.message}</p>
          )}
          {applicant.status === 'PENDING' && task.status === 'OPEN' && (
            <div className="flex gap-2" style={{ marginTop: 'var(--sp-1)' }}>
              <Button size="sm" icon="check" disabled={processingId != null} onClick={() => handleConfirm(applicant.id)}>
                {processingId === applicant.id ? 'Đang xử lý…' : 'Xác nhận'}
              </Button>
              <Button variant="secondary" size="sm" icon="x" disabled={processingId != null} onClick={() => handleReject(applicant.id)}>
                Từ chối
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

interface TaskDetailDialogProps {
  task: TaskResponse
  onClose: () => void
  onApplicantConfirmed: () => void
}

/** Xem chi tiet 1 cong viec da dang - dung lai du lieu da co san tu getMyTasks(), khong goi rieng GET /tasks/{id}. Anh chi hien khi bam nut "Xem ảnh" (khong hien san thumbnail) - mo ImageLightbox dang gallery, duyet qua lai bang next/prev, cham trang, hoac vuot trai/phai. Voi task OPEN/ASSIGNED, them ApplicantsPanel de Poster xem/xac nhan ung vien (UC11). */
function TaskDetailDialog({ task, onClose, onApplicantConfirmed }: TaskDetailDialogProps) {
  useLockBodyScroll(true)
  const lightbox = useImageLightbox()
  const step = lifecycleStepFor(task.status)

  return (
    <DialogViewport>
      <Dialog title={task.title} subtitle={task.categoryName} onClose={onClose} style={{ maxWidth: 640 }}>
        <div className="flex flex-col gap-4">
          <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>

          {step != null && (
            <div style={{ overflowX: 'auto', padding: 'var(--sp-2) 0' }}>
              <LifecycleTracker current={step} style={{ minWidth: 480 }} />
            </div>
          )}

          {task.imageUrls.length > 0 && (
            <Button
              variant="secondary" size="sm" icon="image"
              onClick={() => lightbox.open(task.imageUrls, 0)}
              style={{ alignSelf: 'flex-start' }}
            >
              Xem ảnh ({task.imageUrls.length})
            </Button>
          )}

          <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{task.description}</p>

          <DataRow label="Địa chỉ" value={task.addressText} />
          <DataRow label="Ngân sách" value={formatBudget(task.budgetAmount)} numeric />
          <DataRow label="Thời gian mong muốn" value={task.scheduledAt ? formatDateTime(task.scheduledAt) : 'Chưa xác định'} />
          <DataRow label="Đăng lúc" value={formatDateTime(task.createdAt)} />

          {(task.status === 'OPEN' || task.status === 'ASSIGNED') && (
            <ApplicantsPanel task={task} onConfirmed={() => { onApplicantConfirmed(); onClose() }} />
          )}
        </div>
      </Dialog>

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
    </DialogViewport>
  )
}

interface TaskRowProps {
  task: TaskResponse
  onOpenDetail: () => void
  onOpenGallery: (startIndex: number) => void
}

/** Mot dong cong viec trong danh sach - phong theo bo cuc JobListRow (@ds) nhung tu ve rieng
 * vi JobListRow.status dung vocabulary cua StatusPill (booking/thanh toan), khong khop
 * TaskStatus that cua module Task - xem comment o TASK_STATUS_LABEL. */
function TaskRow({ task, onOpenDetail, onOpenGallery }: TaskRowProps) {
  const step = lifecycleStepFor(task.status)

  return (
    <Card padding="var(--sp-4) var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div className="flex gap-4 items-start">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="brand">{task.categoryName}</Badge>
            <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
          </div>
          <strong style={{ display: 'block', marginTop: 6, fontSize: 'var(--fs-body-lg)', color: 'var(--text-title)', lineHeight: 1.35 }}>
            {task.title}
          </strong>
          <div className="flex flex-wrap gap-4" style={{ marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{task.addressText}</span>
            <span className="flex items-center gap-1">
              <Icon name="clock" size={15} />
              {task.scheduledAt ? formatWeekdayTime(task.scheduledAt) : `Đăng ${formatDateTime(task.createdAt)}`}
            </span>
          </div>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {task.budgetAmount != null
            ? <MoneyAmount value={task.budgetAmount} size="md" label="Ngân sách" />
            : (
                <div className="flex flex-col" style={{ alignItems: 'flex-end' }}>
                  <span className="tc-label" style={{ fontSize: 'var(--fs-label)' }}>Ngân sách</span>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Thoả thuận</span>
                </div>
              )}
        </div>
      </div>

      {step != null && (
        <div style={{ overflowX: 'auto' }}>
          <LifecycleTracker current={step} style={{ minWidth: 420 }} />
        </div>
      )}

      <div className="flex items-center gap-3" style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        {task.imageUrls.length > 0 ? (
          <Button variant="secondary" size="sm" icon="image" onClick={() => onOpenGallery(0)}>
            Xem ảnh ({task.imageUrls.length})
          </Button>
        ) : (
          <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>
            <Icon name="image-off" size={15} />Không có ảnh
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="secondary" size="sm" icon="eye" onClick={onOpenDetail}>Xem chi tiết</Button>
        </div>
      </div>
    </Card>
  )
}

type TaskTab = 'posted' | 'running' | 'done' | 'all'

/**
 * Viec cua toi (UC06 toi gian, phan xem) - tong quan + danh sach cong viec da dang cua
 * Poster, theo bo cuc tham khao poster/JobsScreen.jsx (Design System). 3 o thong ke + 4 tab
 * (Da dang/Dang chay/Da xong/Tat ca) va "Lich viec sap toi" deu la DU LIEU THAT, tu chinh
 * GET /tasks/mine da co (khong can API moi - moi field can dung deu da co san trong
 * TaskResponse). "Tien cua ban trong tuan" va o thong ke "Thanh toan" la BAN XEM TRUOC GIAO
 * DIEN, chua co du lieu that vi module Payment chua ton tai - ghi ro trong UI, khong am tham
 * gia vo da hoat dong (cung nguyen tac da ap dung o PostTaskPage.tsx). Chua co UC07 (sua/huy)
 * hay UC08 (lich su chuyen trang thai chi tiet) - xem docs/PROGRESS-TASK-POSTER-MODULE.md.
 * Chi role TASK_POSTER vao duoc (RoleGuard o App.tsx).
 */
export function MyTasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [detailTask, setDetailTask] = useState<TaskResponse | null>(null)
  const [tab, setTab] = useState<TaskTab>('posted')
  const rowLightbox = useImageLightbox()

  const refresh = () => {
    getMyTasks()
      .then(setTasks)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách công việc.'))
  }

  useEffect(refresh, [])

  const openCount = tasks?.filter((t) => t.status === 'OPEN').length ?? 0
  const runningCount = tasks?.filter((t) => t.status === 'ASSIGNED').length ?? 0
  const doneCount = tasks?.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length ?? 0
  const allCount = tasks?.length ?? 0

  const TABS = [
    { value: 'posted', label: 'Đã đăng', count: openCount },
    { value: 'running', label: 'Đang chạy', count: runningCount },
    { value: 'done', label: 'Đã xong', count: doneCount },
    { value: 'all', label: 'Tất cả', count: allCount },
  ]

  const shown = useMemo(() => {
    if (!tasks) return []
    if (tab === 'all') return tasks
    if (tab === 'posted') return tasks.filter((t) => t.status === 'OPEN')
    if (tab === 'running') return tasks.filter((t) => t.status === 'ASSIGNED')
    return tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED')
  }, [tasks, tab])

  const upcoming = useMemo(() => {
    if (!tasks) return []
    const now = Date.now()
    return tasks
      .filter((t) => t.scheduledAt && new Date(t.scheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
      .slice(0, 5)
  }, [tasks])

  return (
    <AppShell
      navValue="jobs"
      title="Việc của tôi"
      subtitle={`${openCount} việc đang mở · ${allCount} việc đã đăng`}
      actions={<Button icon="file-plus-2" onClick={() => navigate('/dang-viec')}>Đăng việc mới</Button>}
    >
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '2.3fr 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-4)' }}>
            <Card padding="var(--sp-5)">
              <div className="tc-label">Việc đã đăng</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>{openCount}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>đang mở, chờ Tasker</div>
            </Card>
            <Card padding="var(--sp-5)">
              <div className="tc-label">Việc đang chạy</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>{runningCount}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>đã nhận Tasker</div>
            </Card>
            <Card tone="money" padding="var(--sp-5)">
              <div className="tc-label">Thanh toán</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>—</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>chưa khả dụng</div>
            </Card>
          </div>

          <Tabs tabs={TABS} value={tab} onChange={(v) => setTab(v as TaskTab)} />

          <div className="flex flex-col gap-4">
            {shown.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpenDetail={() => setDetailTask(task)}
                onOpenGallery={(startIndex) => rowLightbox.open(task.imageUrls, startIndex)}
              />
            ))}
            {tasks && shown.length === 0 && (
              tasks.length === 0
                ? (
                    <EmptyState
                      icon="clipboard-list"
                      title="Bạn chưa đăng công việc nào"
                      action={<Button icon="file-plus-2" onClick={() => navigate('/dang-viec')}>Đăng việc đầu tiên</Button>}
                    />
                  )
                : <EmptyState icon="check-check" title="Không có việc nào ở đây" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          <Card padding="var(--sp-5)">
            <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Lịch việc sắp tới</div>
            {upcoming.length === 0 && (
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Chưa có việc nào đặt thời gian sắp tới.</p>
            )}
            {upcoming.map((task) => (
              <div key={task.id} style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}>
                <div className="tc-num" style={{ flex: '0 0 auto', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--teal-700)' }}>
                  {formatWeekdayTime(task.scheduledAt!)}
                </div>
                <div style={{ flex: 1, fontSize: 'var(--fs-sm)', lineHeight: 1.4 }}>{task.title}</div>
              </div>
            ))}
          </Card>

          <Card padding="var(--sp-5)">
            <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Tiền của bạn trong tuần</div>
            <DataRow label="Đang tạm giữ" value="—" numeric strong />
            <DataRow label="Chờ thanh toán" value="—" numeric />
            <DataRow label="Phí nền tảng dự kiến" value="—" numeric />
            <p style={{ marginTop: 'var(--sp-3)', marginBottom: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Bản xem trước giao diện — ví và tạm giữ tiền thật sẽ có khi module Thanh toán hoàn thành.
            </p>
          </Card>
        </div>
      </div>

      {detailTask && (
        <TaskDetailDialog task={detailTask} onClose={() => setDetailTask(null)} onApplicantConfirmed={refresh} />
      )}

      {rowLightbox.viewerUrl && (
        <ImageLightbox
          url={rowLightbox.viewerUrl}
          zoom={rowLightbox.viewerZoom}
          rotation={rowLightbox.viewerRotation}
          onClose={rowLightbox.close}
          onZoomIn={rowLightbox.zoomIn}
          onZoomOut={rowLightbox.zoomOut}
          onRotate={rowLightbox.rotate}
          index={rowLightbox.index}
          total={rowLightbox.total}
          onNext={rowLightbox.next}
          onPrev={rowLightbox.prev}
          onGoTo={rowLightbox.goTo}
        />
      )}
    </AppShell>
  )
}
