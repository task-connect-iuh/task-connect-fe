import { useState } from 'react'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import type { ChatMessageResponse } from '../../../api/chat.ts'
import type { ExtraCostBatchStatus } from '../../../api/tasks.ts'
import { formatChatTime, formatVnd } from '../chatFormat.ts'
import { ImageLightbox } from './ImageLightbox.tsx'

interface ExtraCostBatchCardProps {
  message: ChatMessageResponse
  viewerAccountId: string
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onWithdraw: () => void
}

const STATUS_BADGE: Record<ExtraCostBatchStatus, { tone: 'warning' | 'success' | 'neutral' | 'danger'; icon: string; label: string }> = {
  PENDING: { tone: 'warning', icon: 'clock', label: 'Chờ duyệt' },
  APPROVED: { tone: 'success', icon: 'check', label: 'Đã đồng ý' },
  REJECTED: { tone: 'danger', icon: 'x', label: 'Đã từ chối' },
  WITHDRAWN: { tone: 'neutral', icon: 'undo-2', label: 'Đã thu hồi' },
}

/**
 * The tin nhan EXTRA_COST_BATCH ngay trong khung chat (them 2026-10-03, yeu cau nguoi dung:
 * "đẩy thẳng qua đoạn chat ... giống như gửi đề xuất giá") - cung bo cuc voi PriceProposalCard.tsx
 * nhung Dong y/Tu choi/Thu hoi goi thang API chi phi phat sinh da co san (khong phai
 * accept/reject/withdrawPriceProposal). message.extraCostBatch LUON la du lieu TUOI tu BE (doc
 * qua TaskFacade.findExtraCostBatch() moi lan GET/push, xem Javadoc ChatMessageResponse) -
 * component nay chi hien thi, khong tu tinh toan them.
 */
export function ExtraCostBatchCard({ message, viewerAccountId, busy, onApprove, onReject, onWithdraw }: ExtraCostBatchCardProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const mine = message.senderAccountId === viewerAccountId
  const batch = message.extraCostBatch
  if (!batch) return null
  const pending = batch.status === 'PENDING'
  const badge = STATUS_BADGE[batch.status]
  const photoItems = batch.items.filter((item) => item.photoUrl != null)

  return (
    <div id={`chat-message-${message.id}`} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '84%',
          border: `var(--bw) solid ${pending ? 'var(--amber-400)' : 'var(--border)'}`,
          background: pending ? 'var(--money-tint)' : 'var(--surface-card)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-4)',
        }}
      >
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 'var(--sp-2)' }}>
          <span className="tc-label" style={{ color: pending ? 'var(--amber-700)' : undefined }}>
            {mine ? 'Bạn đăng chi phí phát sinh' : 'Chi phí phát sinh'}
          </span>
          <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>
        </div>
        <div className="flex flex-col gap-2">
          {batch.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span style={{ fontSize: 'var(--fs-sm)' }}>{item.name}</span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
                +{formatVnd(item.amount)}
              </span>
            </div>
          ))}
        </div>
        {photoItems.length > 0 && (
          <div className="flex gap-2 flex-wrap" style={{ marginTop: 'var(--sp-2)' }}>
            {photoItems.map((item, i) => (
              <img
                key={i}
                src={item.photoUrl!}
                alt={item.name}
                onClick={() => setLightboxIndex(i)}
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
              />
            ))}
          </div>
        )}
        <span
          className="tc-num"
          style={{
            display: 'block', fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)',
            color: pending ? 'var(--amber-700)' : 'var(--text-title)', marginTop: 'var(--sp-3)',
          }}
        >
          +{formatVnd(batch.totalAmount)}
        </span>
        {batch.note && (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', marginTop: 4, lineHeight: 1.55 }}>{batch.note}</p>
        )}
        {pending && (
          <div className="flex gap-2 flex-wrap" style={{ marginTop: 'var(--sp-3)' }}>
            {!mine && (
              <>
                <Button size="sm" icon="check" disabled={busy} onClick={onApprove}>Đồng ý</Button>
                <Button variant="secondary" size="sm" icon="x" disabled={busy} onClick={onReject}>Từ chối</Button>
              </>
            )}
            {mine && (
              /* Ghost mac dinh border trong suot, tren nen money-tint cua the thi nut gan nhu vo
                 hinh - to mau border bang --amber-400 cho khop khung the (cung ly do voi
                 PriceProposalCard.tsx). */
              <Button
                variant="ghost" size="sm" icon="undo-2"
                style={{ borderColor: 'var(--amber-400)' }}
                disabled={busy} onClick={onWithdraw}
              >
                Thu hồi
              </Button>
            )}
          </div>
        )}
        <p className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
          Gửi {formatChatTime(message.createdAt)}
        </p>
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox
          images={photoItems.map((item, i) => ({
            url: item.photoUrl!, fileName: item.name, mimeType: 'image/jpeg', fileSizeBytes: 0, sortOrder: i,
          }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
