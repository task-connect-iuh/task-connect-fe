import { Button } from '@ds/components/core/Button'
import { Icon } from '@ds/components/core/Icon'
import { formatChatTime } from '../chatFormat.ts'

interface TimeChangeReconfirmCardProps {
  createdAt: string
  newScheduledAtLabel: string | null
  // Con dang cho phan hoi: la tin GAN NHAT khop mau cau nay VA applicationStatus hien tai con
  // la TIME_CHANGED_NEEDS_RECONFIRM (InboxPage.tsx tinh, xem comment tren component).
  pendingResponse: boolean
  // Chi Tasker so huu don nay moi thay nut "Van nhan viec" - Poster xem cung the nhung khong
  // co nut (khong phai nguoi can hanh dong).
  canReconfirm: boolean
  busy: boolean
  onReconfirm: () => void
  actionLabel?: string
  onAction?: () => void
}

/**
 * The rieng cho SYSTEM message "Poster vua doi gio mong muon" (UC07 Tang 3, task con OPEN, don
 * dang PENDING) - nang cap tu SystemMessageRow phang thanh 1 the giong PriceProposalCard/
 * RescheduleProposalCard, co nut "Van nhan viec" ngay trong chat thay vi bat Tasker roi khung
 * chat ve TaskerJobsPage.tsx moi xac nhan duoc. Khac RESCHEDULE_PROPOSAL (2 chieu, chi sau
 * ASSIGNED) - day la 1 chieu, Poster ghi de scheduled_at truc tiep nen khong co proposalStatus
 * rieng tren tin nay; "pendingResponse" duoc InboxPage tinh tu ben ngoai (tin nay co phai tin
 * GAN NHAT khop mau cau VA don co dang can xac nhan hay khong) de tranh hien nut tren 1 the
 * LICH SU da duoc xu ly xong tu 1 lan doi gio truoc do.
 */
export function TimeChangeReconfirmCard({
  createdAt, newScheduledAtLabel, pendingResponse, canReconfirm, busy, onReconfirm, actionLabel, onAction,
}: TimeChangeReconfirmCardProps) {
  const showButton = pendingResponse && canReconfirm

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          maxWidth: '84%',
          border: `var(--bw) solid ${pendingResponse ? 'var(--amber-400)' : 'var(--border)'}`,
          background: pendingResponse ? 'var(--money-tint)' : 'var(--surface-card)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          opacity: pendingResponse ? 1 : 0.85,
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 'var(--sp-2)' }}>
          <Icon name="calendar-clock" size={18} style={{ color: 'var(--teal-700)' }} />
          <span className="tc-label">Poster vừa đổi thời gian mong muốn</span>
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.55, margin: 0 }}>
          Thời gian mới: <strong className="tc-num">{newScheduledAtLabel ?? 'Chưa xác định'}</strong>.
          {showButton && ' Bấm "Vẫn nhận việc" nếu bạn vẫn làm được, hoặc rút ứng tuyển nếu giờ mới không phù hợp.'}
        </p>
        <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 'var(--sp-3)' }}>
          {showButton && (
            <Button size="sm" icon="check" disabled={busy} onClick={onReconfirm}>
              {busy ? 'Đang xác nhận…' : 'Vẫn nhận việc'}
            </Button>
          )}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              title={actionLabel}
              aria-label={actionLabel}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
                color: 'var(--text-link)', fontSize: 'var(--fs-xs)',
              }}
            >
              <Icon name="list" size={14} />
              {actionLabel}
            </button>
          )}
        </div>
        <p className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
          Gửi {formatChatTime(createdAt)}
        </p>
      </div>
    </div>
  )
}
