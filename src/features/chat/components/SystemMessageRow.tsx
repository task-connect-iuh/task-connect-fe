import { formatChatTime } from '../chatFormat.ts'

interface SystemMessageRowProps {
  body: string
  createdAt: string
}

/**
 * Dong SYSTEM (mo kenh, dong kenh, cascade REJECTED_AUTO, ket qua Thu hoi/Tu choi de xuat...) -
 * hien giua khung chat nhu 1 pill trung lap, khac han MessageBubble/PriceProposalCard cua 2 phia.
 */
export function SystemMessageRow({ body, createdAt }: SystemMessageRowProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        alignSelf: 'center',
        alignItems: 'center',
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
      <span>{body}</span>
      <span>Ngày {formatChatTime(createdAt)}</span>
    </div>
  )
}
