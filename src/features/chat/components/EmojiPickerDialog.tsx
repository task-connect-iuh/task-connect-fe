import { useState } from 'react'
import { Dialog } from '@ds/components/feedback/Dialog'
import { DialogViewport } from '../../../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../../../utils/useLockBodyScroll.ts'
import { COMMON_EMOJIS } from '../emoji.ts'

/**
 * 1 o trong luoi emoji - tu quan ly hover (giong cach lam cua Button.jsx trong Design System,
 * vi day la nut glyph don gian khong co san trong DS) de tuan thu rule "moi nut phai co hover
 * ro rang" (20-design-system.md).
 */
function EmojiGridButton({ emoji, onSelect }: { emoji: string; onSelect: (emoji: string) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={() => onSelect(emoji)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, fontSize: 22, lineHeight: 1,
        border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
        background: hover ? 'var(--paper-1)' : 'transparent',
        transition: 'background var(--dur-fast) var(--ease)',
      }}
    >
      {emoji}
    </button>
  )
}

interface EmojiPickerDialogProps {
  onClose: () => void
  onSelect: (emoji: string) => void
}

/**
 * Bang chon 1 trong 32 emoji co dinh (COMMON_EMOJIS) - dung chung cho ca "chen emoji vao noi
 * dung tin nhan" (composer) va "tha bieu tuong cam xuc" (reaction tren 1 tin), them 2026-09-26.
 * Khong dung thu vien emoji-picker ngoai - xem Javadoc COMMON_EMOJIS ve ly do.
 */
export function EmojiPickerDialog({ onClose, onSelect }: EmojiPickerDialogProps) {
  useLockBodyScroll(true)
  return (
    <DialogViewport>
      <Dialog title="Chọn biểu tượng cảm xúc" onClose={onClose}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 'var(--sp-1)' }}>
          {COMMON_EMOJIS.map((emoji) => (
            <EmojiGridButton key={emoji} emoji={emoji} onSelect={(selected) => { onSelect(selected); onClose() }} />
          ))}
        </div>
      </Dialog>
    </DialogViewport>
  )
}
