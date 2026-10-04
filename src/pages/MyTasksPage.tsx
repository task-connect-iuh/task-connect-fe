import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
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
import {
  approveExtraCostBatch,
  getExtraCostSummary,
  getMyTasks,
  rejectExtraCostBatch,
  topUpExtraCostEscrow,
  withdrawExtraCostBatch,
} from '../api/tasks.ts'
import type { ExtraCostMoneySummaryResponse, TaskResponse, TaskStatus } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { LOCATION_TYPE_LABELS } from '../utils/locationType.ts'
import { SUPPLIES_STATUS_LABELS } from '../utils/suppliesStatus.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'
import { CancelTaskDialog } from '../features/tasks/components/CancelTaskDialog.tsx'
import { EditTaskDialog } from '../features/tasks/components/EditTaskDialog.tsx'
import { ExtraCostBreakdownCard } from '../features/tasks/components/ExtraCostBreakdownCard.tsx'

// Task con sua/huy duoc theo UC07 - khop POSTER_EDITABLE_STATUSES ben BE (TaskService.java).
function isPosterEditable(status: TaskStatus): boolean {
  return status === 'OPEN' || status === 'PENDING_REVIEW'
}

// Nhan rieng cho TaskStatus (khac vocabulary cua StatusPill - component do chi danh cho
// trang thai booking/thanh toan, xem StatusPill.jsx "Never invent labels outside this map").
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  OPEN: 'Đang mở',
  ASSIGNED: 'Đã nhận việc',
  COMPLETED: 'Hoàn tất',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
  REJECTED: 'Bị admin từ chối',
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

interface TaskDetailDialogProps {
  task: TaskResponse
  onClose: () => void
}

/**
 * Xem chi tiet 1 cong viec da dang - dung lai du lieu da co san tu getMyTasks(), khong goi
 * rieng GET /tasks/{id}. Anh chi hien khi bam nut "Xem ảnh" (khong hien san thumbnail) - mo
 * ImageLightbox dang gallery, duyet qua lai bang next/prev, cham trang, hoac vuot trai/phai.
 * Khong con hien danh sach ung vien/"Tasker gợi ý" trong dialog nay nua - ca 2 da chuyen ra
 * ngoai TaskRow (nut "Ứng viên" + "Tasker gợi ý" o footer card danh sach, xem
 * TaskRow ben duoi) de Poster thao tac truc tiep tu danh sach thay vi phai mo modal nay truoc
 * (yeu cau nguoi dung). Export vi InboxPage.tsx dung lai dialog nay.
 */
export function TaskDetailDialog({ task, onClose }: TaskDetailDialogProps) {
  useLockBodyScroll(true)
  const navigate = useNavigate()
  const lightbox = useImageLightbox()
  const step = lifecycleStepFor(task.status)

  // Chi phi phat sinh (quyet dinh nguoi dung 2026-10-02) - tai qua winningApplicationId (chi co
  // gia tri khi task.status === ASSIGNED, xem Javadoc BE TaskResponse.winningApplicationId). Man
  // nay la goc nhin Poster co dinh (khac InboxPage.tsx phai tu tinh viewerRole tu kenh dang mo).
  const [extraCostSummary, setExtraCostSummary] = useState<ExtraCostMoneySummaryResponse | null>(null)
  const [extraCostActionBusyId, setExtraCostActionBusyId] = useState<string | null>(null)

  const refreshExtraCostSummary = () => {
    if (!task.winningApplicationId) { setExtraCostSummary(null); return }
    getExtraCostSummary(task.winningApplicationId).then(setExtraCostSummary).catch(() => setExtraCostSummary(null))
  }

  useEffect(refreshExtraCostSummary, [task.winningApplicationId])

  const runExtraCostAction = (batchId: string, action: Promise<ExtraCostMoneySummaryResponse>, failMessage: string) => {
    setExtraCostActionBusyId(batchId)
    action
      .then(setExtraCostSummary)
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : failMessage))
      .finally(() => setExtraCostActionBusyId(null))
  }

  return (
    <DialogViewport>
      <Dialog title={task.title} subtitle={task.categoryName} onClose={onClose} style={{ maxWidth: 640 }}>
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 'var(--sp-1)' }}>
          <div className="flex flex-col gap-4">
            <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>

            {task.status === 'REJECTED' && task.rejectionReason && (
              <Alert tone="danger" title="Lý do công việc bị từ chối">{task.rejectionReason}</Alert>
            )}

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
            {task.locationType && <DataRow label="Loại địa điểm" value={LOCATION_TYPE_LABELS[task.locationType]} />}
            {task.arrivalNotes && <DataRow label="Lưu ý khi tới nơi" value={task.arrivalNotes} />}
            <DataRow label="Tình trạng vật tư" value={SUPPLIES_STATUS_LABELS[task.suppliesStatus]} />
            {task.suppliesNote && <DataRow label="Mô tả thêm về vật tư" value={task.suppliesNote} />}
            <DataRow label={task.budgetAmount != null ? 'Ngân sách ban đầu' : 'Ngân sách'} value={formatBudget(task.budgetAmount)} numeric />
            <DataRow label="Thời gian mong muốn" value={task.scheduledAt ? formatDateTime(task.scheduledAt) : 'Chưa xác định'} />
            <DataRow label="Đăng lúc" value={formatDateTime(task.createdAt)} />

            {extraCostSummary && task.winningApplicationId && (
              <ExtraCostBreakdownCard
                summary={extraCostSummary}
                viewerRole="POSTER"
                topUpBusy={extraCostActionBusyId === 'top-up'}
                actionBusyBatchId={extraCostActionBusyId}
                onViewPendingInChat={() => { onClose(); navigate(`/tin-nhan/${task.winningApplicationId}`) }}
                onTopUp={() => runExtraCostAction('top-up', topUpExtraCostEscrow(task.winningApplicationId!), 'Nạp thêm thất bại, thử lại sau.')}
                onApprove={(batchId) => runExtraCostAction(batchId, approveExtraCostBatch(task.winningApplicationId!, batchId), 'Thao tác thất bại, thử lại sau.')}
                onReject={(batchId) => runExtraCostAction(batchId, rejectExtraCostBatch(task.winningApplicationId!, batchId), 'Thao tác thất bại, thử lại sau.')}
                onWithdraw={(batchId) => runExtraCostAction(batchId, withdrawExtraCostBatch(task.winningApplicationId!, batchId), 'Thu hồi thất bại, thử lại sau.')}
              />
            )}
          </div>
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
  onEdit: () => void
  onCancel: () => void
}

/** Mot dong cong viec trong danh sach - phong theo bo cuc JobListRow (@ds) nhung tu ve rieng
 * vi JobListRow.status dung vocabulary cua StatusPill (booking/thanh toan), khong khop
 * TaskStatus that cua module Task - xem comment o TASK_STATUS_LABEL. */
function TaskRow({ task, onOpenDetail, onEdit, onCancel }: TaskRowProps) {
  const navigate = useNavigate()
  const step = lifecycleStepFor(task.status)

  return (
    <Card
      tone={task.status === 'REJECTED' ? 'sunken' : 'plain'}
      padding="var(--sp-4) var(--sp-5)"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
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
            ? <MoneyAmount value={task.budgetAmount} size="md" label="Ngân sách ban đầu" style={{ alignItems: 'flex-end' }} />
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
        {(task.status === 'OPEN' || task.status === 'ASSIGNED') && (
          <Button variant="secondary" size="sm" icon="users" onClick={() => navigate(`/viec-cua-toi/${task.id}/ung-vien`)}>
            Ứng viên
          </Button>
        )}
        {isPosterEditable(task.status) && (
          <>
            <Button variant="secondary" size="sm" icon="pencil" onClick={onEdit}>Sửa</Button>
            <Button variant="danger" size="sm" icon="trash-2" onClick={onCancel}>Huỷ</Button>
          </>
        )}
        <div className="flex items-center gap-3" style={{ marginLeft: 'auto' }}>
          {task.status === 'OPEN' && (
            <Button variant="secondary" size="sm" icon="sparkles" onClick={() => navigate(`/goi-y-tasker/${task.id}`)}>
              Tasker gợi ý
            </Button>
          )}
          <Button variant="secondary" size="sm" icon="eye" onClick={onOpenDetail}>Chi tiết</Button>
        </div>
      </div>
    </Card>
  )
}

type TaskTab = 'needsAction' | 'running' | 'done' | 'all'

/**
 * Viec cua toi (UC06 toi gian, phan xem) - tong quan + danh sach cong viec da dang cua
 * Poster, theo bo cuc tham khao poster/JobsScreen.jsx (Design System). 3 o thong ke + 4 tab
 * (Can xu ly/Dang chay/Da xong/Tat ca) va "Lich viec sap toi" deu la DU LIEU THAT, tu chinh
 * GET /tasks/mine da co (khong can API moi - moi field can dung deu da co san trong
 * TaskResponse). "Tien cua ban trong tuan" va o thong ke "Thanh toan" la BAN XEM TRUOC GIAO
 * DIEN, chua co du lieu that vi module Payment chua ton tai - ghi ro trong UI, khong am tham
 * gia vo da hoat dong (cung nguyen tac da ap dung o PostTaskPage.tsx). Da co UC07 (sua/huy,
 * xem nut "Sửa"/"Huỷ việc" tren TaskRow + EditTaskDialog/CancelTaskDialog) - chua co UC08
 * (lich su chuyen trang thai chi tiet), xem docs/PROGRESS-TASK-POSTER-MODULE.md.
 * Chi role TASK_POSTER vao duoc (RoleGuard o App.tsx).
 */
export function MyTasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [detailTask, setDetailTask] = useState<TaskResponse | null>(null)
  const [editTask, setEditTask] = useState<TaskResponse | null>(null)
  const [cancelTarget, setCancelTarget] = useState<TaskResponse | null>(null)
  const [tab, setTab] = useState<TaskTab>('needsAction')

  const refresh = () => {
    getMyTasks()
      .then(setTasks)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách công việc.'))
  }

  useEffect(refresh, [])

  const openCount = tasks?.filter((t) => t.status === 'OPEN').length ?? 0
  // Viec OPEN co it nhat 1 don PENDING - can Poster xac nhan/tu choi (khac openCount o tren,
  // vi OPEN nhung chua ai ung tuyen thi khong "can xu ly" gi, chi con thay o tab "Tat ca").
  const needsActionCount = tasks?.filter((t) => t.status === 'OPEN' && t.pendingApplicantCount > 0).length ?? 0
  const runningCount = tasks?.filter((t) => t.status === 'ASSIGNED').length ?? 0
  const doneCount = tasks?.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length ?? 0
  const allCount = tasks?.length ?? 0

  const TABS = [
    { value: 'needsAction', label: 'Cần bạn xử lý', count: needsActionCount },
    { value: 'running', label: 'Đang chạy', count: runningCount },
    { value: 'done', label: 'Đã xong', count: doneCount },
    { value: 'all', label: 'Tất cả', count: allCount },
  ]

  const shown = useMemo(() => {
    if (!tasks) return []
    if (tab === 'all') return tasks
    if (tab === 'needsAction') return tasks.filter((t) => t.status === 'OPEN' && t.pendingApplicantCount > 0)
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
                onEdit={() => setEditTask(task)}
                onCancel={() => setCancelTarget(task)}
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
          </Card>
        </div>
      </div>

      {detailTask && (
        <TaskDetailDialog task={detailTask} onClose={() => setDetailTask(null)} />
      )}
      {editTask && (
        <EditTaskDialog task={editTask} onClose={() => setEditTask(null)} onSaved={refresh} />
      )}
      {cancelTarget && (
        <CancelTaskDialog task={cancelTarget} onClose={() => setCancelTarget(null)} onCancelled={refresh} />
      )}
    </AppShell>
  )
}
