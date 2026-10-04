import { useRef, useState } from 'react'
import { Icon } from '@ds/components/core/Icon'
import { IconButton } from '@ds/components/core/IconButton'
import { EmojiPickerDialog } from './EmojiPickerDialog.tsx'

interface MessageActionsRowProps {
  /** Con trong han thu hoi (15 phut, doc tu recallableUntil cua tin) - da tinh san o component cha, da gop voi "la tin cua chinh minh". */
  canRecall: boolean
  pinned: boolean
  busy: boolean
  onReply: () => void
  onRecall: () => void
  onReact: (emoji: string) => void
  onPin: () => void
  onUnpin: () => void
}

interface MenuItemProps {
  icon: string
  label: string
  tone?: 'danger'
  onClick: () => void
}

/** 1 dong trong menu "..." - tu quan ly hover giong EmojiGridButton, vi day khong phai nut co san trong DS. */
function MenuItem({ icon, label, tone, onClick }: MenuItemProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', width: '100%',
        padding: 'var(--sp-2) var(--sp-3)', border: 'none', textAlign: 'left', cursor: 'pointer',
        borderRadius: 'var(--r-sm)', background: hover ? 'var(--paper-1)' : 'transparent',
        color: tone === 'danger' ? 'var(--danger)' : 'var(--text-body)',
        fontSize: 'var(--fs-sm)', transition: 'background var(--dur-fast) var(--ease)',
      }}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  )
}

/**
 * Cum icon nho ben canh tin nhan (sua 2026-09-26 theo yeu cau nguoi dung - truoc day la 1 hang 4
 * icon luon hien duoi tin nhan): chi con 1 nut "tha cam xuc" luon hien de thao tac nhanh, va 1
 * nut "..." mo menu xo xuong chua Tra loi/Ghim-Bo ghim/Thu hoi - giong mau Messenger/Zalo, giam
 * so nut hien thuong truc canh moi tin.
 *
 * Menu "..." dung 1 lop phu position:fixed toan man hinh (bam ra ngoai de dong, giong co che cua
 * Dialog) thay vi position:absolute neo vao nut - tranh bi CAT MAT boi khung tin nhan dang
 * overflow-y:auto (fixed khong bi anh huong boi overflow cua cha, absolute thi co).
 */
export function MessageActionsRow({
  canRecall, pinned, busy, onReply, onRecall, onReact, onPin, onUnpin,
}: MessageActionsRowProps) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const openMenu = () => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setMenuPosition({ top: rect.bottom + 4, left: rect.left })
    setMenuOpen(true)
  }

  const selectAndClose = (action: () => void) => {
    action()
    setMenuOpen(false)
  }

  return (
    <div className="flex items-center gap-1">
      <IconButton
        icon="smile" label="Thả cảm xúc" size="sm" variant="ghost" disabled={busy}
        onClick={() => setEmojiPickerOpen(true)}
      />
      <div ref={anchorRef} style={{ display: 'inline-flex' }}>
        <IconButton icon="more-horizontal" label="Thêm hành động" size="sm" variant="ghost" disabled={busy} onClick={openMenu} />
      </div>

      {menuOpen && menuPosition && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 45 }} onClick={() => setMenuOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: menuPosition.top, left: menuPosition.left,
              minWidth: 180, background: 'var(--surface-card)', border: 'var(--bw) solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-overlay)', padding: 'var(--sp-1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <MenuItem icon="reply" label="Trả lời" onClick={() => selectAndClose(onReply)} />
            {pinned
              ? <MenuItem icon="pin-off" label="Bỏ ghim" onClick={() => selectAndClose(onUnpin)} />
              : <MenuItem icon="pin" label="Ghim tin nhắn" onClick={() => selectAndClose(onPin)} />}
            {canRecall && (
              <MenuItem icon="undo-2" label="Thu hồi" tone="danger" onClick={() => selectAndClose(onRecall)} />
            )}
          </div>
        </div>
      )}

      {emojiPickerOpen && (
        <EmojiPickerDialog
          onClose={() => setEmojiPickerOpen(false)}
          onSelect={(emoji) => onReact(emoji)}
        />
      )}
    </div>
  )
}
