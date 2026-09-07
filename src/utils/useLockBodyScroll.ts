import { useEffect } from 'react'

/**
 * Khoa scroll cua <body> trong luc active=true - can thiet vi Dialog cua @ds dung
 * position: absolute (khong phai fixed) va khong tu khoa scroll nen, nen trang phia sau lop
 * overlay van keo duoc. Tra lai overflow cu khi active tat hoac component unmount.
 */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])
}
