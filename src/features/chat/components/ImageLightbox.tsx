import { useState } from 'react'
import { Dialog } from '@ds/components/feedback/Dialog'
import { IconButton } from '@ds/components/core/IconButton'
import { DialogViewport } from '../../../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../../../utils/useLockBodyScroll.ts'
import type { ChatAttachmentResponse } from '../../../api/chat.ts'

interface ImageLightboxProps {
  images: ChatAttachmentResponse[]
  startIndex: number
  onClose: () => void
}

/**
 * Xem anh phong to (them 2026-09-26) - dung lai chinh Dialog cua Design System lam scrim/khung
 * thay vi tu ve overlay rieng (tranh hardcode mau rgba() ngoai pham vi component goc DS, xem
 * 20-design-system.md). Co dieu huong truoc/sau neu tin nhan co nhieu anh (gui nhieu anh 1 luc).
 */
export function ImageLightbox({ images, startIndex, onClose }: ImageLightboxProps) {
  useLockBodyScroll(true)
  const [index, setIndex] = useState(startIndex)
  const image = images[index]
  if (!image) return null
  return (
    <DialogViewport>
      <Dialog
        onClose={onClose}
        style={{ maxWidth: '90vw', background: 'var(--paper-0)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <img
            src={image.url}
            alt={image.fileName}
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--r-md)', objectFit: 'contain' }}
          />
          <div className="flex items-center gap-3">
            {images.length > 1 && (
              <IconButton
                icon="chevron-left" label="Ảnh trước" size="sm"
                disabled={index === 0}
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
              />
            )}
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {image.fileName}{images.length > 1 ? ` · ${index + 1}/${images.length}` : ''}
            </span>
            {images.length > 1 && (
              <IconButton
                icon="chevron-right" label="Ảnh sau" size="sm"
                disabled={index === images.length - 1}
                onClick={() => setIndex((current) => Math.min(images.length - 1, current + 1))}
              />
            )}
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}
