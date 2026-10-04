import { Icon } from '@ds/components/core/Icon'
import { IconButton } from '@ds/components/core/IconButton'
import type { ChatMessageResponse } from '../../../api/chat.ts'

interface PinnedMessagesBarProps {
  /** Toan bo lich su tin nhan da nap - loc ra tin dang duoc ghim (pinnedAt khac null) o day, khong nhan rieng 1 danh sach. */
  messages: ChatMessageResponse[]
  busyMessageId: string | null
  onUnpin: (messageId: string) => void
}

/** Doan tom tat 1 tin nhan de hien trong thanh ghim. */
function pinnedSnippet(message: ChatMessageResponse): string {
  switch (message.messageType) {
    case 'IMAGE': return message.body || 'Hình ảnh'
    case 'VIDEO': return message.body || 'Video'
    case 'FILE': return message.body || 'File'
    case 'PRICE_PROPOSAL': return 'Đề xuất giá'
    case 'RESCHEDULE_PROPOSAL': return 'Đề xuất đổi lịch'
    default: return message.body ?? ''
  }
}

/**
 * Thanh tin nhan dang ghim, hien co dinh phia tren khung tin nhan (them 2026-09-26) - toi da 3
 * tin/kenh (gioi han thuc thi o BE), ca hai ben deu bo ghim duoc bat ky tin nao trong day. Bam
 * vao 1 dong se cuon toi dung tin nhan do trong lich su.
 */
export function PinnedMessagesBar({ messages, busyMessageId, onUnpin }: PinnedMessagesBarProps) {
  const pinned = messages
    .filter((m) => !!m.pinnedAt)
    .sort((a, b) => new Date(a.pinnedAt ?? 0).getTime() - new Date(b.pinnedAt ?? 0).getTime())
  if (pinned.length === 0) return null
  return (
    <div
      className="flex flex-col gap-1"
      style={{
        padding: 'var(--sp-2) var(--sp-5)', background: 'var(--paper-1)',
        borderBottom: 'var(--bw-hair) solid var(--border)',
      }}
    >
      {pinned.map((message) => (
        <div key={message.id} className="flex items-center gap-2">
          <Icon name="pin" size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <button
            type="button"
            onClick={() => document.getElementById(`chat-message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="flex-1"
            style={{
              textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--fs-xs)', color: 'var(--text-body)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {pinnedSnippet(message)}
          </button>
          <IconButton
            icon="pin-off" label="Bỏ ghim" size="sm" variant="ghost"
            disabled={busyMessageId === message.id}
            onClick={() => onUnpin(message.id)}
          />
        </div>
      ))}
    </div>
  )
}
