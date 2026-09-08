import { useState } from 'react'

/**
 * Trang thai trinh xem anh dang gallery (nhieu anh, next/prev) + phong to/thu nho/xoay - tach
 * tu pattern da co trong KycPage.tsx (xem anh CCCD, chi 1 anh) roi mo rong them next/prev de
 * dung cho danh sach nhieu anh minh hoa cong viec (PostTaskPage luc soan, MyTasksPage luc xem
 * danh sach/chi tiet). images rong nghia la dang dong.
 */
export function useImageLightbox() {
  const [images, setImages] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [viewerZoom, setViewerZoom] = useState(1)
  const [viewerRotation, setViewerRotation] = useState(0)

  /** Mo gallery tai 1 danh sach anh, bat dau tu startIndex (mac dinh anh dau tien). */
  const open = (imageList: string[], startIndex = 0) => {
    setImages(imageList)
    setIndex(startIndex)
    setViewerZoom(1)
    setViewerRotation(0)
  }
  const close = () => setImages([])
  const zoomIn = () => setViewerZoom((zoom) => Math.min(3, zoom + 0.25))
  const zoomOut = () => setViewerZoom((zoom) => Math.max(1, zoom - 0.25))
  const rotate = () => setViewerRotation((rotation) => (rotation + 90) % 360)
  /** Sang anh ke tiep (vong lai anh dau neu dang o anh cuoi), reset zoom/xoay cho anh moi. */
  const next = () => {
    setIndex((i) => (i + 1) % images.length)
    setViewerZoom(1)
    setViewerRotation(0)
  }
  /** Sang anh truoc (vong ve anh cuoi neu dang o anh dau), reset zoom/xoay cho anh moi. */
  const prev = () => {
    setIndex((i) => (i - 1 + images.length) % images.length)
    setViewerZoom(1)
    setViewerRotation(0)
  }
  /** Nhay thang toi 1 anh cu the (bam vao dau trang trong ImageLightbox), reset zoom/xoay. */
  const goTo = (target: number) => {
    setIndex(target)
    setViewerZoom(1)
    setViewerRotation(0)
  }

  return {
    viewerUrl: images[index] ?? null,
    index,
    total: images.length,
    viewerZoom,
    viewerRotation,
    open,
    close,
    zoomIn,
    zoomOut,
    rotate,
    next,
    prev,
    goTo,
  }
}
