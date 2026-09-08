import { useRef } from 'react'
import { IconButton } from '@ds/components/core/IconButton'

interface ImageLightboxProps {
  /** Anh dang xem - cha component chi render <ImageLightbox> khi co url. */
  url: string
  zoom: number
  rotation: number
  onClose: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onRotate: () => void
  /** Vi tri anh hien tai (0-based) va tong so anh - hien "2 / 5", nut next/prev, cham trang
   *  va vuot trai/phai khi total > 1. */
  index?: number
  total?: number
  onNext?: () => void
  onPrev?: () => void
  /** Bam vao 1 cham trang de nhay thang toi anh do. */
  onGoTo?: (index: number) => void
}

// So px keo toi thieu de tinh la 1 lan vuot trang - qua ngan de tranh nham voi thao tac keo de
// xem chi tiet (chua co pan luc zoom o day) hay chi la cham nhe.
const SWIPE_THRESHOLD_PX = 50

/**
 * Overlay xem 1 anh phong to/thu nho/xoay, co the la 1 anh don le hoac 1 anh trong gallery
 * nhieu anh (next/prev, cham trang, vuot trai/phai bang chuot/cham - dung khi xem anh minh
 * hoa cong viec o PostTaskPage/MyTasksPage) - tach tu UI da co trong KycPage.tsx (xem anh
 * CCCD, chi 1 anh). Dung chung voi useImageLightbox.ts (quan ly state) - component nay chi
 * ve UI, khong tu giu state (tru vi tri bat dau keo, chi la chi tiet tuong tac cuc bo).
 */
export function ImageLightbox({ url, zoom, rotation, onClose, onZoomIn, onZoomOut, onRotate, index, total, onNext, onPrev, onGoTo }: ImageLightboxProps) {
  const hasGallery = !!total && total > 1 && !!onNext && !!onPrev
  const dragStartX = useRef<number | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasGallery) return
    dragStartX.current = e.clientX
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasGallery || dragStartX.current == null) return
    const delta = e.clientX - dragStartX.current
    dragStartX.current = null
    if (delta > SWIPE_THRESHOLD_PX) onPrev?.()
    else if (delta < -SWIPE_THRESHOLD_PX) onNext?.()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,37,34,.75)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-5)',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4" style={{ maxWidth: '100%', maxHeight: '100%' }}>
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragStartX.current = null }}
          style={{
            position: 'relative', overflow: 'hidden', maxWidth: '90vw', maxHeight: '70vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: hasGallery ? 'pan-y' : undefined, cursor: hasGallery ? 'grab' : undefined,
          }}
        >
          {hasGallery && (
            <IconButton
              icon="chevron-left" label="Ảnh trước" size="md" variant="ghost"
              style={{ position: 'absolute', left: 'var(--sp-2)', color: 'var(--on-deep)', background: 'rgba(4,37,34,.5)' }}
              onClick={onPrev}
            />
          )}
          <img
            src={url}
            alt="Ảnh phóng to"
            draggable={false}
            style={{
              maxWidth: '90vw', maxHeight: '70vh', objectFit: 'contain',
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform var(--dur-fast) var(--ease)',
            }}
          />
          {hasGallery && (
            <IconButton
              icon="chevron-right" label="Ảnh tiếp theo" size="md" variant="ghost"
              style={{ position: 'absolute', right: 'var(--sp-2)', color: 'var(--on-deep)', background: 'rgba(4,37,34,.5)' }}
              onClick={onNext}
            />
          )}
        </div>

        {hasGallery && (
          <div className="flex items-center gap-2" role="tablist" aria-label="Chọn ảnh">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Ảnh ${i + 1}`}
                onClick={() => onGoTo?.(i)}
                style={{
                  width: i === index ? 20 : 8, height: 8, borderRadius: 'var(--r-pill)', padding: 0, border: 'none',
                  background: i === index ? 'var(--brand)' : 'var(--on-deep-muted)',
                  opacity: i === index ? 1 : 0.5, cursor: onGoTo ? 'pointer' : 'default',
                  transition: 'width var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease)',
                }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2" style={{ background: 'var(--teal-900)', borderRadius: 'var(--r-pill)', padding: 'var(--sp-2) var(--sp-3)' }}>
          {hasGallery && (
            <span className="tc-num" style={{ color: 'var(--on-deep-muted)', fontSize: 'var(--fs-sm)', minWidth: 44, textAlign: 'center' }}>
              {(index ?? 0) + 1} / {total}
            </span>
          )}
          <IconButton icon="zoom-out" label="Thu nhỏ" size="sm" style={{ color: 'var(--on-deep)' }} disabled={zoom <= 1} onClick={onZoomOut} />
          <span className="tc-num" style={{ color: 'var(--on-deep)', fontSize: 'var(--fs-sm)', minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <IconButton icon="zoom-in" label="Phóng to" size="sm" style={{ color: 'var(--on-deep)' }} disabled={zoom >= 3} onClick={onZoomIn} />
          <IconButton icon="rotate-cw" label="Xoay ảnh" size="sm" style={{ color: 'var(--on-deep)' }} onClick={onRotate} />
          <IconButton icon="x" label="Đóng" size="sm" style={{ color: 'var(--on-deep)' }} onClick={onClose} />
        </div>
      </div>
    </div>
  )
}
