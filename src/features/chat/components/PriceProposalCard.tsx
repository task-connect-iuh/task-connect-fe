import { Button } from '@ds/components/core/Button'
import type { ChatMessageResponse } from '../../../api/chat.ts'
import { formatChatTime, formatVnd } from '../chatFormat.ts'
import { ProposalStatusBadge } from './ProposalStatusBadge.tsx'

interface PriceProposalCardProps {
  message: ChatMessageResponse
  viewerAccountId: string
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onWithdraw: () => void
}

/**
 * The 1 tin PRICE_PROPOSAL trong khung chat (UC16 muc 3) - bo cuc bam theo man "Tin nhắn & chốt
 * giá" cua file thiet ke tham khao. Ben KHONG PHAI nguoi tao thay Dong y/Tu choi khi con
 * PROPOSED, chinh nguoi tao thay Thu hoi - dung 3 nut nhu mockup, khong co "Tra gia khac" rieng
 * (tra gia khac chinh la gui 1 PRICE_PROPOSAL moi sau khi de xuat nay het hieu luc).
 */
export function PriceProposalCard({ message, viewerAccountId, busy, onAccept, onReject, onWithdraw }: PriceProposalCardProps) {
  const mine = message.senderAccountId === viewerAccountId
  const status = message.proposalStatus ?? 'PROPOSED'
  const proposed = status === 'PROPOSED'
  // ACCEPTED van la gia tri con hieu luc (chinh la gia chot) - CHI REJECTED (bi Tu choi hoac
  // chinh nguoi de xuat Thu hoi) moi thuc su "khong con hieu luc". Truoc day dung chung dieu
  // kien voi !proposed nen ACCEPTED bi gach ngang/mo giong het REJECTED, gay hieu lam (nguoi
  // dung bao cao 2026-09-21).
  const active = status !== 'REJECTED'
  const amount = message.priceProposalAmount ?? 0

  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '84%',
          border: `var(--bw) solid ${active ? 'var(--amber-400)' : 'var(--border)'}`,
          background: active ? 'var(--money-tint)' : 'var(--surface-card)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
          opacity: active ? 1 : 0.85,
        }}
      >
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 'var(--sp-2)' }}>
          <span className="tc-label" style={{ color: active ? 'var(--amber-700)' : undefined }}>
            {mine ? 'Bạn đề xuất giá' : 'Đề xuất giá'}
          </span>
          <ProposalStatusBadge status={status} mine={mine} />
        </div>
        <span
          className="tc-num"
          style={{
            fontSize: 'var(--fs-amount)',
            fontWeight: 'var(--fw-black)',
            color: active ? 'var(--amber-700)' : 'var(--text-muted)',
            textDecoration: status === 'REJECTED' ? 'line-through' : 'none',
          }}
        >
          {formatVnd(amount)}
        </span>
        {message.body && (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', marginTop: 4, lineHeight: 1.55 }}>{message.body}</p>
        )}
        {proposed && (
          <div className="flex gap-2 flex-wrap" style={{ marginTop: 'var(--sp-3)' }}>
            {!mine && (
              <>
                <Button size="sm" icon="check" disabled={busy} onClick={onAccept}>Đồng ý {formatVnd(amount)}</Button>
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
