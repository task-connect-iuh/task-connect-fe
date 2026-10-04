import { useState, type ReactNode } from 'react'
import { Icon } from '@ds/components/core/Icon'
import type { ChatMessageResponse } from '../../../api/chat.ts'
import { formatChatTime } from '../chatFormat.ts'
import { ReplyQuoteHeader } from './ReplyQuoteHeader.tsx'
import { ReactionsBar } from './ReactionsBar.tsx'
import { MessageActionsRow } from './MessageActionsRow.tsx'
import { ImageLightbox } from './ImageLightbox.tsx'

interface ChatMessageBubbleProps {
  message: ChatMessageResponse
  /** Toan bo lich su tin nhan da nap (luon nap 1 lan, xem ChatService.listMessages BE) - dung de tra cuu tin dang duoc quote. */
  allMessages: ChatMessageResponse[]
  viewerAccountId: string
  busy: boolean
  onReply: (message: ChatMessageResponse) => void
  onRecall: (messageId: string) => void
  onReact: (messageId: string, emoji: string) => void
  onPin: (messageId: string) => void
  onUnpin: (messageId: string) => void
}

/** "512 KB", "3.4 MB" - don gian hoa dung luong file de hien canh ten file. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Icon Lucide phu hop theo duoi file - mac dinh "file" cho duoi khong nam trong danh sach. */
const FILE_ICON_BY_EXTENSION: Record<string, string> = {
  pdf: 'file-text', doc: 'file-text', docx: 'file-text',
  xls: 'file-spreadsheet', xlsx: 'file-spreadsheet',
  zip: 'file-archive',
}

function fileIconFor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return FILE_ICON_BY_EXTENSION[extension] ?? 'file'
}

/**
 * The hien 1 tin nhan TEXT/IMAGE/FILE/VIDEO trong khung chat, kem tra loi (quote)/tha cam xuc/
 * ghim/thu hoi (them 2026-09-26, sua lai cach bo tri 2026-09-26: cum icon hanh dong nam BEN
 * CANH bong bong thay vi hang co dinh nam DUOI bong bong nhu ban dau, theo yeu cau nguoi dung -
 * giu icon tren cung 1 hang voi bong bong, phia ben trong (gan tam man hinh hon la bong bong).
 *
 * Tin TEXT KHONG con dung <MessageBubble> cua Design System nua (van la thu vien chi doc, khong
 * sua) - tu ve lai dung mau mau/border/radius cua no (xem MessageBubble.jsx) de co the dat trong
 * 1 hang flex chung voi cum icon; ban than MessageBubble tu quan ly justify-content rieng nen
 * khong ghep duoc voi 1 flex item khac cung hang.
 */
export function ChatMessageBubble({
  message, allMessages, viewerAccountId, busy, onReply, onRecall, onReact, onPin, onUnpin,
}: ChatMessageBubbleProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const mine = message.senderAccountId === viewerAccountId
  const recalled = !!message.recalledAt
  const canRecall = mine && !recalled && !!message.recallableUntil
    && new Date(message.recallableUntil).getTime() > Date.now()
  const pinned = !!message.pinnedAt
  const replyTarget = message.replyToMessageId
    ? allMessages.find((m) => m.id === message.replyToMessageId) ?? null
    : null

  const jumpToReplyTarget = () => {
    if (!message.replyToMessageId) return
    document.getElementById(`chat-message-${message.replyToMessageId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (recalled) {
    return (
      <div id={`chat-message-${message.id}`} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ fontStyle: 'italic', color: 'var(--text-faint)', fontSize: 'var(--fs-sm)', padding: 'var(--sp-2) var(--sp-3)' }}>
          Tin nhắn đã được thu hồi
        </div>
      </div>
    )
  }

  const replyHeader = message.replyToMessageId
    ? <ReplyQuoteHeader target={replyTarget} viewerAccountId={viewerAccountId} onJumpTo={jumpToReplyTarget} />
    : null

  const quickActions = (
    <MessageActionsRow
      canRecall={canRecall} pinned={pinned} busy={busy}
      onReply={() => onReply(message)}
      onRecall={() => onRecall(message.id)}
      onReact={(emoji) => onReact(message.id, emoji)}
      onPin={() => onPin(message.id)}
      onUnpin={() => onUnpin(message.id)}
    />
  )

  /** 1 hang: [icon (neu khong phai mine)] [noi dung tin] [icon (neu la mine)] - icon luon nam o phia trong, gan giua man hinh hon bong bong. */
  const withQuickActionsRow = (content: ReactNode, maxWidth: string) => (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 'var(--sp-1)' }}>
      {mine && quickActions}
      <div style={{ maxWidth, minWidth: 0 }}>{content}</div>
      {!mine && quickActions}
    </div>
  )

  if (message.messageType === 'TEXT') {
    return (
      <div id={`chat-message-${message.id}`}>
        {withQuickActionsRow(
          <div style={{
            padding: 'var(--sp-3) var(--sp-4)',
            background: mine ? 'var(--brand)' : 'var(--surface-card)',
            color: mine ? 'var(--text-on-brand)' : 'var(--text-body)',
            border: `var(--bw) solid ${mine ? 'var(--brand)' : 'var(--border)'}`,
            borderRadius: mine
              ? 'var(--r-lg) var(--r-lg) var(--r-sm) var(--r-lg)'
              : 'var(--r-lg) var(--r-lg) var(--r-lg) var(--r-sm)',
            fontSize: 'var(--fs-body)', lineHeight: 1.55,
          }}>
            {replyHeader}
            {message.body}
            <span className="tc-num" style={{ display: 'block', marginTop: 4, fontSize: 'var(--fs-xs)', opacity: .7 }}>
              {formatChatTime(message.createdAt)}
            </span>
          </div>,
          '78%',
        )}
        <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
          <ReactionsBar reactions={message.reactions} viewerAccountId={viewerAccountId} onToggle={(emoji) => onReact(message.id, emoji)} />
        </div>
      </div>
    )
  }

  return (
    <div id={`chat-message-${message.id}`}>
      {withQuickActionsRow(
        <div style={{
          border: 'var(--bw) solid var(--border)', background: 'var(--surface-card)',
          borderRadius: 'var(--r-lg)', padding: 'var(--sp-3)',
        }}>
          {replyHeader}
          {message.messageType === 'IMAGE' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: message.attachments.length > 1 ? 'repeat(2, 1fr)' : '1fr',
              gap: 'var(--sp-1)',
            }}>
              {message.attachments.map((attachment, i) => (
                <img
                  key={attachment.url}
                  src={attachment.url}
                  alt={attachment.fileName}
                  onClick={() => setLightboxIndex(i)}
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                />
              ))}
            </div>
          )}
          {message.messageType === 'VIDEO' && message.attachments[0] && (
            <video controls style={{ width: '100%', maxHeight: 280, borderRadius: 'var(--r-sm)' }}>
              <source src={message.attachments[0].url} type={message.attachments[0].mimeType} />
              Trình duyệt không hỗ trợ phát video.
            </video>
          )}
          {message.messageType === 'VOICE' && message.attachments[0] && (
            <div className="flex items-center gap-2">
              <Icon name="mic" size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <audio controls style={{ height: 36, maxWidth: 220 }}>
                <source src={message.attachments[0].url} type={message.attachments[0].mimeType} />
                Trình duyệt không hỗ trợ phát tin nhắn thoại.
              </audio>
            </div>
          )}
          {message.messageType === 'FILE' && (
            <div className="flex flex-col gap-2">
              {message.attachments.map((attachment) => (
                <a
                  key={attachment.url}
                  href={attachment.url}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2"
                  style={{
                    border: 'var(--bw-hair) solid var(--border)', borderRadius: 'var(--r-sm)',
                    padding: 'var(--sp-2)', textDecoration: 'none', color: 'var(--text-body)',
                  }}
                >
                  <Icon name={fileIconFor(attachment.fileName)} size={20} />
                  <span className="flex-1" style={{ fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {attachment.fileName}
                  </span>
                  <span className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    {formatBytes(attachment.fileSizeBytes)}
                  </span>
                  <Icon name="download" size={16} />
                </a>
              ))}
            </div>
          )}
          {message.body && (
            <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-2)', lineHeight: 1.5 }}>{message.body}</p>
          )}
          <p className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
            {formatChatTime(message.createdAt)}
          </p>
        </div>,
        '84%',
      )}
      <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
        <ReactionsBar reactions={message.reactions} viewerAccountId={viewerAccountId} onToggle={(emoji) => onReact(message.id, emoji)} />
      </div>
      {message.messageType === 'IMAGE' && lightboxIndex !== null && (
        <ImageLightbox images={message.attachments} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}
