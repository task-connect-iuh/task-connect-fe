import { IconButton } from '@ds/components/core/IconButton'
import type { ChatMessageResponse } from '../../../api/chat.ts'
import { quoteSnippet } from './ReplyQuoteHeader.tsx'

interface ReplyComposerBarProps {
  target: ChatMessageResponse
  viewerAccountId: string
  onCancel: () => void
}

/**
 * Hien phia tren o nhap khi dang soan 1 tin tra loi (them 2026-09-26) - bam X de huy tra loi
 * (khong huy noi dung dang go, chi bo lien ket tra loi).
 */
export function ReplyComposerBar({ target, viewerAccountId, onCancel }: ReplyComposerBarProps) {
  const senderLabel = target.senderAccountId === viewerAccountId ? 'Bạn' : target.senderName ?? 'Người dùng'
  return (
    <div
      className="flex items-center gap-2"
      style={{
        padding: 'var(--sp-2) var(--sp-5)', background: 'var(--paper-1)',
        borderBottom: 'var(--bw-hair) solid var(--border)',
      }}
    >
      <div className="flex-1" style={{ fontSize: 'var(--fs-xs)', overflow: 'hidden' }}>
        <span style={{ color: 'var(--text-muted)' }}>Đang trả lời {senderLabel}: </span>
        <span style={{ color: 'var(--text-body)' }}>{quoteSnippet(target)}</span>
      </div>
      <IconButton icon="x" label="Huỷ trả lời" size="sm" variant="ghost" onClick={onCancel} />
    </div>
  )
}
