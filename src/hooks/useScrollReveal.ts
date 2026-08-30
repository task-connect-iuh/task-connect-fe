import { useEffect, useRef, useState } from 'react'

interface UseScrollRevealOptions {
  threshold?: number
}

/**
 * Hieu ung xuat hien khi section lan dau vao viewport (opacity 0->1, translateY 10px->0),
 * chay dung mot lan, khong lap khi cuon nguoc. Ton trong prefers-reduced-motion: tra ve
 * trang thai da hien san, khong giu phan tu vo hinh. Xem 20-design-system.md.
 */
export function useScrollReveal({ threshold = 0.15 }: UseScrollRevealOptions = {}) {
  const ref = useRef<HTMLElement>(null)
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [revealed, setRevealed] = useState(reduceMotion)

  useEffect(() => {
    if (reduceMotion || !ref.current) return

    const node = ref.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reduceMotion, threshold])

  return { ref, revealed }
}
