import type { ChatMessageResponse } from '../../../api/chat.ts'

/**
 * Doan tom tat 1 tin nhan de hien trong khung quote - uu tien loai dinh kem/thu hoi truoc noi
 * dung tho. Export de ReplyComposerBar.tsx dung lai (thay vi lap lai logic khi soan tra loi).
 */
export function quoteSnippet(message: ChatMessageResponse): string {
  if (message.recalledAt) return 'Tin nhắn đã được thu hồi'
  switch (message.messageType) {
    case 'IMAGE': return message.body || 'Đã gửi hình ảnh'
    case 'VIDEO': return message.body || 'Đã gửi video'
    case 'FILE': return message.body || 'Đã gửi file'
    case 'PRICE_PROPOSAL': return 'Đề xuất giá'
    case 'RESCHEDULE_PROPOSAL': return 'Đề xuất đổi lịch'
    default: return message.body ?? ''
  }
}

interface ReplyQuoteHeaderProps {
  target: ChatMessageResponse | null
  viewerAccountId: string
  onJumpTo?: () => void
}

/**
 * Khung trich dan tin nhan dang duoc tra loi, hien phia tren noi dung tin nhan hien tai (them
 * 2026-09-26). target=null nghia la khong tim thay tin goc trong danh sach da nap (khong nen xay
 * ra vi toan bo lich su luon nap 1 lan, nhung phong ho) - khi do hien 1 dong trung lap thay the.
 */
export function ReplyQuoteHeader({ target, viewerAccountId, onJumpTo }: ReplyQuoteHeaderProps) {
  const senderLabel = target
    ? target.senderAccountId === viewerAccountId ? 'Bạn' : target.senderName ?? 'Người dùng'
    : null
  return (
    <div
      onClick={onJumpTo}
      style={{
        borderLeft: 'var(--bw) solid var(--brand)',
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--sp-1) var(--sp-2)',
        marginBottom: 'var(--sp-1)',
        cursor: onJumpTo ? 'pointer' : 'default',
        fontSize: 'var(--fs-xs)',
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-muted)' }}>
        {senderLabel ?? 'Tin nhắn gốc'}
      </div>
      <div style={{
        color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {target ? quoteSnippet(target) : 'Không còn tồn tại'}
      </div>
    </div>
  )
}
