import { Chip } from '@ds/components/core/Chip'
import type { ChatReactionResponse } from '../../../api/chat.ts'

interface ReactionsBarProps {
  reactions: ChatReactionResponse[]
  viewerAccountId: string
  onToggle: (emoji: string) => void
}

/** 1 emoji + so nguoi da tha, gom nhom tu danh sach reaction tho cua backend. */
interface ReactionGroup {
  emoji: string
  count: number
  mine: boolean
  names: string[]
}

/** Gom cac ChatReactionResponse (1 dong/tai khoan) thanh nhom theo emoji, giu thu tu xuat hien dau tien. */
function groupReactions(reactions: ChatReactionResponse[], viewerAccountId: string): ReactionGroup[] {
  const groups: ReactionGroup[] = []
  for (const reaction of reactions) {
    const group = groups.find((g) => g.emoji === reaction.emoji)
    const name = reaction.accountName ?? 'Người dùng'
    if (group) {
      group.count += 1
      group.names.push(name)
      if (reaction.accountId === viewerAccountId) group.mine = true
    } else {
      groups.push({ emoji: reaction.emoji, count: 1, mine: reaction.accountId === viewerAccountId, names: [name] })
    }
  }
  return groups
}

/**
 * Hang tong hop reaction duoi 1 tin nhan (them 2026-09-26) - 1 chip/emoji, bam vao chip da tha
 * se bo tha (toggle), bam emoji khac se doi. Rong neu chua ai tha gi.
 */
export function ReactionsBar({ reactions, viewerAccountId, onToggle }: ReactionsBarProps) {
  const groups = groupReactions(reactions, viewerAccountId)
  if (groups.length === 0) return null
  return (
    <div className="flex gap-1 flex-wrap" style={{ marginTop: 'var(--sp-1)' }}>
      {groups.map((group) => (
        <Chip
          key={group.emoji}
          selected={group.mine}
          onClick={() => onToggle(group.emoji)}
          title={group.names.join(', ')}
          style={{ minHeight: 'var(--sp-6)', padding: '0 var(--sp-2)', fontSize: 'var(--fs-xs)', gap: 'var(--sp-1)' }}
        >
          <span>{group.emoji}</span>
          <span className="tc-num">{group.count}</span>
        </Chip>
      ))}
    </div>
  )
}
