import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Icon } from '@ds/components/core/Icon'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Tabs } from '@ds/components/navigation/Tabs'
import { AppShell } from '../components/AppShell.tsx'
import { ImageLightbox } from '../components/ImageLightbox.tsx'
import { getMyApplications } from '../api/tasks.ts'
import type { MyApplicationResponse, TaskApplicationStatus } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'

// Nhan/tone rieng cho TaskApplicationStatus - KHONG dung vocabulary cua StatusPill (component
// do chi danh cho trang thai booking/thanh toan, xem 01-domain-glossary.md), cung nguyen tac
// da ap dung cho TASK_STATUS_LABEL o MyTasksPage.tsx (Poster).
const APPLICATION_STATUS_LABEL: Record<TaskApplicationStatus, string> = {
  PENDING: 'Chờ xác nhận',
  ACCEPTED: 'Đã nhận việc',
  NEEDS_RECONFIRM: 'Cần ứng tuyển lại',
  REJECTED: 'Bị từ chối',
}
const APPLICATION_STATUS_TONE: Record<TaskApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  NEEDS_RECONFIRM: 'warning',
  REJECTED: 'neutral',
}

/** "Thứ 5, 14:00" - dung cho lich viec sap toi va nhan gio trong danh sach. */
function formatWeekdayTime(iso: string) {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

interface ScheduleClash {
  first: MyApplicationResponse
  second: MyApplicationResponse
  gapMinutes: number
}

/**
 * Canh bao 2 viec DA NHAN (status ACCEPTED) co scheduledAt cach nhau duoi 1 gio trong cung 1
 * ngay (ke ca trung gio, gap am) - dung du lieu that (taskScheduledAt) thay vi startHour/
 * durationHours minh hoa nhu truoc, vi backend chua co thoi luong du kien cho tung viec.
 */
function findScheduleClashes(jobs: MyApplicationResponse[]): ScheduleClash[] {
  const withSchedule = jobs.filter((j) => j.taskScheduledAt != null)
  const sorted = [...withSchedule].sort(
    (a, b) => new Date(a.taskScheduledAt!).getTime() - new Date(b.taskScheduledAt!).getTime(),
  )
  const clashes: ScheduleClash[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const current = sorted[i]
    const gapMinutes = Math.round(
      (new Date(current.taskScheduledAt!).getTime() - new Date(prev.taskScheduledAt!).getTime()) / 60000,
    )
    if (gapMinutes < 60) clashes.push({ first: prev, second: current, gapMinutes })
  }
  return clashes
}

interface ApplicationRowProps {
  application: MyApplicationResponse
  onOpenGallery: (startIndex: number) => void
}

/** Mot dong viec da ung tuyen/da nhan - phong theo bo cuc TaskRow cua MyTasksPage.tsx (Poster) de dong bo giao dien giua 2 vai tro. */
function ApplicationRow({ application, onOpenGallery }: ApplicationRowProps) {
  const navigate = useNavigate()
  return (
    <Card padding="var(--sp-4) var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div className="flex gap-4 items-start">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="brand">{application.categoryName}</Badge>
            <Badge tone={APPLICATION_STATUS_TONE[application.status]}>{APPLICATION_STATUS_LABEL[application.status]}</Badge>
          </div>
          <strong style={{ display: 'block', marginTop: 6, fontSize: 'var(--fs-body-lg)', color: 'var(--text-title)', lineHeight: 1.35 }}>
            {application.taskTitle}
          </strong>
          <div className="flex flex-wrap gap-4" style={{ marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{application.taskAddressText}</span>
            <span className="flex items-center gap-1">
              <Icon name="clock" size={15} />
              {application.taskScheduledAt ? formatWeekdayTime(application.taskScheduledAt) : 'Thời gian thoả thuận'}
            </span>
            <span className="flex items-center gap-1"><Icon name="user" size={15} />{application.posterName ?? 'Người đăng việc'}</span>
          </div>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {application.taskBudgetAmount != null
            ? <MoneyAmount value={application.taskBudgetAmount} size="md" label="Ngân sách" />
            : (
                <div className="flex flex-col" style={{ alignItems: 'flex-end' }}>
                  <span className="tc-label" style={{ fontSize: 'var(--fs-label)' }}>Ngân sách</span>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Thoả thuận</span>
                </div>
              )}
        </div>
      </div>

      {application.message && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          Lời nhắn của bạn: <span style={{ color: 'var(--text-body)' }}>{application.message}</span>
        </div>
      )}

      <div className="flex items-center gap-3" style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        {application.taskImageUrls.length > 0 ? (
          <Button variant="secondary" size="sm" icon="image" onClick={() => onOpenGallery(0)}>
            Xem ảnh ({application.taskImageUrls.length})
          </Button>
        ) : (
          <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-faint)' }}>
            <Icon name="image-off" size={15} />Không có ảnh
          </span>
        )}

        {application.status === 'ACCEPTED' && (
          <>
            <Button variant="secondary" size="sm" icon="message-square" disabled title="Nhắn tin sẽ có khi module Chat hoàn thành">Nhắn tin</Button>
            <Button size="sm" icon="badge-check" disabled title="Báo hoàn tất sẽ có khi module Booking hoàn thành">Báo hoàn tất</Button>
            <Button
              variant="ghost" size="sm" icon="navigation"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(application.taskAddressText)}`, '_blank', 'noopener,noreferrer')}
            >
              Chỉ đường
            </Button>
          </>
        )}
        {application.status === 'NEEDS_RECONFIRM' && (
          <Button size="sm" icon="refresh-cw" onClick={() => navigate(`/tim-viec/${application.taskId}`)}>Ứng tuyển lại</Button>
        )}
        <div style={{ marginLeft: 'auto' }} />
        {application.status !== 'REJECTED' && (
          <Button variant="ghost" size="sm" icon="receipt-text" disabled title="Ví chưa khả dụng">Xem giao dịch</Button>
        )}
      </div>
    </Card>
  )
}

type JobTab = 'accepted' | 'waiting' | 'all'

/**
 * Viec ban da nhan (UC10/UC11, phan xem sau khi ung tuyen) - Tasker. Du lieu that qua
 * getMyApplications() (module Task, khong con la MOCK_ACCEPTED_JOBS - xem
 * docs/TASK-MODULE-SPLIT.md). Backend chua co Booking nen khong co payout/HELD/BOOKED/
 * COMPLETED - nhom theo dung TaskApplicationStatus that (PENDING/ACCEPTED/NEEDS_RECONFIRM/
 * REJECTED). Canh bao "2 viec sat gio nhau" tinh tren taskScheduledAt that (khong con
 * startHour/durationHours minh hoa). Tien te (thu nhap, Mo vi) van disabled dung yeu cau
 * "de sau" cua nguoi dung. Chi role TASKER vao duoc.
 */
export function TaskerJobsPage() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<MyApplicationResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<JobTab>('accepted')
  const rowLightbox = useImageLightbox()

  useEffect(() => {
    getMyApplications()
      .then(setApplications)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách việc đã ứng tuyển.'))
  }, [])

  const accepted = useMemo(() => (applications ?? []).filter((a) => a.status === 'ACCEPTED'), [applications])
  const waiting = useMemo(
    () => (applications ?? []).filter((a) => a.status === 'PENDING' || a.status === 'NEEDS_RECONFIRM'),
    [applications],
  )
  const shown = tab === 'accepted' ? accepted : tab === 'waiting' ? waiting : (applications ?? [])

  const clashes = useMemo(() => findScheduleClashes(accepted), [accepted])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return accepted
      .filter((a) => a.taskScheduledAt && new Date(a.taskScheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.taskScheduledAt!).getTime() - new Date(b.taskScheduledAt!).getTime())
      .slice(0, 5)
  }, [accepted])

  return (
    <AppShell
      navValue="jobs"
      title="Việc bạn đã nhận"
      subtitle={`${accepted.length} việc đã nhận · ${waiting.length} đang chờ xác nhận`}
      actions={<Button icon="layout-list" onClick={() => navigate('/tim-viec')}>Tìm việc mới</Button>}
    >
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '2.3fr 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-4)' }}>
            <Card padding="var(--sp-5)">
              <div className="tc-label">Đã nhận việc</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>{accepted.length}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>người đăng đã xác nhận</div>
            </Card>
            <Card padding="var(--sp-5)">
              <div className="tc-label">Chờ xác nhận</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>{waiting.length}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>đang chờ người đăng phản hồi</div>
            </Card>
            <Card tone="money" padding="var(--sp-5)">
              <div className="tc-label">Thu nhập</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>—</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>chưa khả dụng</div>
            </Card>
          </div>

          {clashes.map((clash) => (
            <Alert
              key={`${clash.first.applicationId}-${clash.second.applicationId}`}
              tone="warning"
              title="Hai việc đã nhận sát giờ nhau"
            >
              <strong>{clash.first.taskTitle}</strong> và <strong>{clash.second.taskTitle}</strong> cách nhau chỉ{' '}
              {clash.gapMinutes < 0 ? 'trùng giờ' : `${clash.gapMinutes} phút`}. Nhắn tin sẽ có khi module Chat hoàn thành —
              hiện tại hãy liên hệ trực tiếp người đăng việc để sắp xếp lại.
            </Alert>
          ))}

          <Tabs
            value={tab}
            onChange={(v) => setTab(v as JobTab)}
            tabs={[
              { value: 'accepted', label: 'Đã nhận', count: accepted.length },
              { value: 'waiting', label: 'Chờ xác nhận', count: waiting.length },
              { value: 'all', label: 'Tất cả', count: applications?.length ?? 0 },
            ]}
          />

          <div className="flex flex-col gap-4">
            {shown.map((application) => (
              <ApplicationRow
                key={application.applicationId}
                application={application}
                onOpenGallery={(startIndex) => rowLightbox.open(application.taskImageUrls, startIndex)}
              />
            ))}
            {applications && shown.length === 0 && (
              <EmptyState icon="layout-list" title="Chưa có việc nào ở đây" action={<Button icon="layout-list" onClick={() => navigate('/tim-viec')}>Tìm việc mới</Button>} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          <Card padding="var(--sp-5)">
            <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Lịch việc sắp tới</div>
            {upcoming.length === 0 && (
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Chưa có việc nào đặt thời gian sắp tới.</p>
            )}
            {upcoming.map((application) => (
              <div key={application.applicationId} style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}>
                <div className="tc-num" style={{ flex: '0 0 auto', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--teal-700)' }}>
                  {formatWeekdayTime(application.taskScheduledAt!)}
                </div>
                <div style={{ flex: 1, fontSize: 'var(--fs-sm)', lineHeight: 1.4 }}>{application.taskTitle}</div>
              </div>
            ))}
          </Card>

          <Card padding="var(--sp-5)">
            <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Thu nhập theo trạng thái</div>
            <DataRow label="Đang tạm giữ" value="—" numeric strong />
            <DataRow label="Chờ thanh toán" value="—" numeric />
            <DataRow label="Phí nền tảng dự kiến" value="—" numeric />
            <p style={{ marginTop: 'var(--sp-3)', marginBottom: 'var(--sp-3)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Bản xem trước giao diện — ví và tạm giữ tiền thật sẽ có khi module Thanh toán hoàn thành.
            </p>
            <Button block variant="money" size="sm" icon="banknote-arrow-down" disabled title="Ví chưa khả dụng">Mở ví</Button>
          </Card>

          <Alert tone="info" title="Nhận nhiều việc không làm tăng thứ hạng">
            Xếp hạng dựa trên tỷ lệ hoàn tất và đúng giờ. Nhận quá tay rồi huỷ sẽ làm giảm điểm.
          </Alert>
        </div>
      </div>

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
