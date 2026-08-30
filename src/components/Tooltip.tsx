import type { ReactNode } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
}

/**
 * Nhan ten hien duoi phan tu con khi tro chuot vao hoac focus bang ban phim (khong chi
 * hover chuot, de khong bo sot nguoi dung dieu huong bang Tab). Dung cho icon-only control
 * (IconButton...) khong co chu hien san canh icon. Component dung chung, khong thuoc @ds -
 * DS chua co san Tooltip.
 */
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className="pointer-events-none absolute opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 px-2 py-1"
        style={{
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 'var(--sp-2)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--teal-900)',
          color: 'var(--white)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 'var(--fw-semibold)',
          whiteSpace: 'nowrap',
          transition: 'opacity var(--dur-fast) var(--ease)',
          zIndex: 20,
        }}
      >
        {label}
      </span>
    </span>
  )
}
