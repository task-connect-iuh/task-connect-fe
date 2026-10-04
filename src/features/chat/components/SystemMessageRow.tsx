import { useState } from 'react'
import { Icon } from '@ds/components/core/Icon'
import { formatChatTime } from '../chatFormat.ts'

interface SystemMessageRowProps {
  body: string
  createdAt: string
  // Icon phu tuy chon cuoi cau - dung cho SYSTEM message sinh tu UC07 (Poster sua viec,
  // xem refTaskEditId tren ChatMessageResponse) de mo "Xem chi tiết thay đổi". Component nay
  // van generic, khong biet gi ve UC07 - noi goi (InboxPage.tsx) quyet dinh khi nao truyen.
  actionLabel?: string
  onAction?: () => void
}

/**
 * Dong SYSTEM (mo kenh, dong kenh, cascade REJECTED_AUTO, ket qua Thu hoi/Tu choi de xuat...) -
 * hien giua khung chat nhu 1 pill mong, khac han MessageBubble/PriceProposalCard cua 2 phia.
 * Noi dung + thoi gian gon tren 1 dong, icon hanh dong (neu co) dat ngay cuoi cau thay vi 1
 * nut rieng ben duoi - tranh pill bi cao/nang so voi cac tin nhan khac trong khung chat.
 */
export function SystemMessageRow({ body, createdAt, actionLabel, onAction }: SystemMessageRowProps) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="flex flex-col items-center"
      style={{
        alignSelf: 'center',
        gap: 2,
        textAlign: 'center',
        background: 'var(--paper-1)',
        border: 'var(--bw-hair) solid var(--border)',
        borderRadius: 'var(--r-pill)',
        padding: 'var(--sp-1) var(--sp-3)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--text-muted)',
        maxWidth: '90%',
      }}
    >
      <span className="flex items-center" style={{ gap: 'var(--sp-1)' }}>
        {body}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            title={actionLabel}
            aria-label={actionLabel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              color: hover ? 'var(--text-link-hover)' : 'var(--text-link)',
              transition: 'color var(--dur-fast) var(--ease)',
            }}
          >
            <Icon name="list" size={14} />
          </button>
        )}
      </span>
      <span>Ngày {formatChatTime(createdAt)}</span>
    </div>
  )
}
