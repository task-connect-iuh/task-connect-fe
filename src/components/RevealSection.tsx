import type { CSSProperties, ReactNode } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal.ts'

interface RevealSectionProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Boc mot section chinh cua trang voi hieu ung xuat hien lan dau vao viewport - bat buoc
 * cho moi section chinh theo 20-design-system.md (opacity 0->1, translateY 10px->0, chay
 * dung mot lan). useScrollReveal da tu xu ly prefers-reduced-motion.
 */
export function RevealSection({ children, className, style }: RevealSectionProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(var(--sp-3))',
        transition: 'opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
