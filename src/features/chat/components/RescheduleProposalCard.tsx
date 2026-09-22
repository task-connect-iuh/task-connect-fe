import { Button } from '@ds/components/core/Button'
import { Icon } from '@ds/components/core/Icon'
import type { ChatMessageResponse } from '../../../api/chat.ts'
import { formatChatTime } from '../chatFormat.ts'
import { ProposalStatusBadge } from './ProposalStatusBadge.tsx'

interface RescheduleProposalCardProps {
  message: ChatMessageResponse
  viewerAccountId: string
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onWithdraw: () => void
}

/**
 * The 1 tin RESCHEDULE_PROPOSAL trong khung chat (UC16 muc 9, chi phat sinh khi task da
 * ASSIGNED) - cung co che Dong y/Tu choi/Thu hoi voi PriceProposalCard, khac o hien gio hen moi
 * thay vi so tien. Man tao de xuat doi lich rieng (kem xu ly khoang tam giu chua du) chua lam o
 * round nay - the nay chi hien/xu ly de xuat da co san trong lich su chat.
 */
export function RescheduleProposalCard({ message, viewerAccountId, busy, onAccept, onReject, onWithdraw }: RescheduleProposalCardProps) {
  const mine = message.senderAccountId === viewerAccountId
  const status = message.proposalStatus ?? 'PROPOSED'
  const proposed = status === 'PROPOSED'

  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '84%',
          border: `var(--bw) solid ${proposed ? 'var(--brand)' : 'var(--border)'}`,
          background: proposed ? 'var(--brand-tint)' : 'var(--surface-card)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          opacity: proposed ? 1 : 0.85,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 'var(--sp-2)' }}>
          <span className="tc-label">{mine ? 'Bạn đề xuất đổi lịch' : 'Đề xuất đổi lịch'}</span>
          <ProposalStatusBadge status={status} mine={mine} />
        </div>
        <div className="flex items-center gap-2">
          <Icon name="calendar-clock" size={18} style={{ color: 'var(--teal-700)' }} />
          <strong className="tc-num" style={{ fontSize: 'var(--fs-body-lg)' }}>
            {message.proposedTime ? formatChatTime(message.proposedTime) : '—'}
          </strong>
        </div>
        {message.body && (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', marginTop: 4, lineHeight: 1.55 }}>{message.body}</p>
        )}
        {proposed && (
          <div className="flex gap-2 flex-wrap" style={{ marginTop: 'var(--sp-3)' }}>
            {!mine && (
              <>
                <Button size="sm" icon="check" disabled={busy} onClick={onAccept}>Đồng ý đổi lịch</Button>
                <Button variant="secondary" size="sm" icon="x" disabled={busy} onClick={onReject}>Từ chối</Button>
              </>
            )}
            {mine && (
              <Button variant="ghost" size="sm" icon="undo-2" disabled={busy} onClick={onWithdraw}>Thu hồi</Button>
            )}
          </div>
        )}
        <p className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
          Gửi {formatChatTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}
