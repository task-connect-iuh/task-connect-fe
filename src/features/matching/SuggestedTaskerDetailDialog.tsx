import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Dialog } from '@ds/components/feedback/Dialog'
import { Icon } from '@ds/components/core/Icon'
import type { SuggestedTaskerResponse } from '../../api/matching.ts'
import type { TaskResponse } from '../../api/tasks.ts'
import { DialogViewport } from '../../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll.ts'

function formatVnd(amount: number) {
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`
}

function formatBudget(task: TaskResponse) {
  return task.budgetAmount != null ? formatVnd(task.budgetAmount) : 'Thoả thuận'
}

function formatSchedule(task: TaskResponse) {
  return task.scheduledAt ? new Date(task.scheduledAt).toLocaleString('vi-VN') : 'Chưa chọn giờ cụ thể'
}

function formatDistance(km: number) {
  return `${km.toFixed(1)} km`
}

function formatPriceRange(min: number | null, max: number | null) {
  if (min == null && max == null) return 'Giá thoả thuận'
  if (min != null && max != null) return `${formatVnd(min)} – ${formatVnd(max)}`
  if (min != null) return `Từ ${formatVnd(min)}`
  return `Đến ${formatVnd(max as number)}`
}

type InviteState = 'idle' | 'inviting' | 'invited'

interface SuggestedTaskerDetailDialogProps {
  task: TaskResponse
  tasker: SuggestedTaskerResponse
  inviteState: InviteState
  dismissed: boolean
  onClose: () => void
  onInvite: () => void
  onToggleDismiss: () => void
}

/**
 * Modal xem chi tiet 1 goi y, mo khi bam vao the SuggestedTaskerCard (SuggestedTaskersPanel.tsx)
 * - hien SONG SONG thong tin co ban cua chinh cong viec (cot trai) va thong tin Tasker duoc goi y
 * (cot phai) de Poster de doi chieu (yeu cau nguoi dung: "nen hien thong tin co ban cua job da
 * chon de goi y de de so sanh"), khac voi the rut gon ngoai danh sach chi co thong tin Tasker.
 */
export function SuggestedTaskerDetailDialog({
  task,
  tasker,
  inviteState,
  dismissed,
  onClose,
  onInvite,
  onToggleDismiss,
}: SuggestedTaskerDetailDialogProps) {
  useLockBodyScroll(true)
  const verified = tasker.kycStatus === 'VERIFIED'

  return (
    <DialogViewport>
      <Dialog
        title="So sánh với công việc"
        subtitle={tasker.fullName}
        onClose={onClose}
        style={{ maxWidth: 760 }}
        footer={
          <>
            <Button variant="ghost" size="md" icon={dismissed ? 'rotate-ccw' : 'x'} onClick={onToggleDismiss} style={{ flex: 1 }}>
              {dismissed ? 'Hoàn tác' : 'Bỏ qua gợi ý này'}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={inviteState === 'invited' ? 'check' : 'send'}
              disabled={dismissed || inviteState !== 'idle'}
              onClick={onInvite}
              style={{ flex: 2 }}
            >
              {inviteState === 'invited' ? 'Đã mời' : inviteState === 'inviting' ? 'Đang gửi…' : 'Mời làm việc này'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <Card tone="sunken" padding="var(--sp-4)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div className="tc-label" style={{ color: 'var(--text-muted)' }}>Công việc bạn đã đăng</div>
            <Badge tone="brand" style={{ width: 'fit-content' }}>{task.categoryName}</Badge>
            <strong style={{ fontSize: 'var(--fs-body)' }}>{task.title}</strong>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <Icon name="map-pin" size={15} />{task.addressText}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <Icon name="wallet" size={15} />Ngân sách: {formatBudget(task)}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <Icon name="clock" size={15} />{formatSchedule(task)}
            </span>
          </Card>

          <Card tone="sunken" padding="var(--sp-4)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div className="tc-label" style={{ color: 'var(--text-muted)' }}>Tasker được gợi ý</div>
            <div className="flex items-center gap-2">
              <Avatar name={tasker.fullName} src={tasker.avatarUrl ?? undefined} size={36} verified={verified} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 'var(--fs-body)', display: 'block' }}>{tasker.fullName}</strong>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                  {verified ? 'Đã xác minh danh tính' : 'Chưa xác minh danh tính'}
                </span>
              </div>
            </div>
            {tasker.lowConfidence ? (
              <Badge tone="warning" icon="triangle-alert" style={{ width: 'fit-content' }}>Độ tin cậy {tasker.confidence}% — thấp</Badge>
            ) : (
              <Badge tone="success" icon="sparkles" style={{ width: 'fit-content' }}>Độ tin cậy {tasker.confidence}%</Badge>
            )}
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <Icon name="map-pin" size={15} />Cách bạn {formatDistance(tasker.distanceKm)}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <Icon name="wallet" size={15} />Giá: {formatPriceRange(tasker.priceMin, tasker.priceMax)}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <Icon name="badge-check" size={15} />{tasker.completedJobsNearby} việc đã hoàn tất gần đây
            </span>
          </Card>
        </div>

        {tasker.reasons.length > 0 && (
          <div style={{ background: 'var(--success-tint)', border: 'var(--bw-hair) solid var(--teal-200)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            <div className="tc-label" style={{ color: 'var(--teal-700)', marginBottom: 'var(--sp-2)' }}>Vì sao AI gợi ý người này</div>
            <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasker.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', listStyle: 'none', lineHeight: 1.5 }}>
                  <Icon name="circle-check" size={15} strokeColor="var(--success)" style={{ marginTop: 2 }} />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tasker.concerns.length > 0 && (
          <div style={{ background: 'var(--warning-tint)', border: 'var(--bw-hair) solid var(--amber-200)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', marginTop: 'var(--sp-3)' }}>
            <div className="tc-label" style={{ color: 'var(--amber-700)', marginBottom: 'var(--sp-2)' }}>Điểm cần lưu ý</div>
            <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasker.concerns.map((concern, i) => (
                <li key={i} className="flex items-start gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', listStyle: 'none', lineHeight: 1.5 }}>
                  <Icon name="triangle-alert" size={15} strokeColor="var(--warning)" style={{ marginTop: 2 }} />
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </DialogViewport>
  )
}
