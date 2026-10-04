import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

// Chuyen the tu component mo nguon "LatticeLoader" (React Bits) sang TypeScript cho app nay -
// GIU NGUYEN logic goc (cac PATTERNS/MARKS/resolvePattern la toan bo "hinh dang" lattice, sua
// vao day se lam sai cac pattern co san), CHI doi: (1) mau mac dinh sang token Design System
// thay vi hex cung ("Cam hardcode mau hex" - 20-design-system.md), (2) class prefix "tc-lattice-"
// thay vi "lattice-" de khop quy uoc class tuy chinh cua du an (xem tc-stage-reveal trong
// index.css), (3) reduced-motion tat han animation (khop --dur-fast/--dur/--dur-slow ve 0ms khi
// prefers-reduced-motion trong motion.css) thay vi ban goc chi lam diu di nhung van lap.
//
// Ve rule "khong lap vo han" (20-design-system.md, "Motion is reserved for state change"):
// animation cua component nay CHI chay trong dung luc status="working" (dang cho 1 request that
// - GeminiVisionClient/TaskPriceSuggestionService), tu dong dung va dong cung thanh dau tick/x
// ngay khi status doi - xac nhan voi nguoi dung day la ngoai le hop le (gan chat vong doi 1 request
// that, khac ban chat voi decorative loop vo co), khong phai vi pham am tham.

export type LatticeLoaderStatus = 'working' | 'done' | 'error'

/** Hinh dang cell tuy chinh - moi phan tu la so buoc delay (don vi `step`), null = 1 o trong khong sang. */
export interface LatticeLoaderCustomPattern {
  cells: Array<number | null>
  loop?: number
  scale?: number
  lit?: number
}

export type LatticeLoaderPatternName =
  | 'arrow' | 'dots' | 'ripple' | 'spiral' | 'orbit' | 'snake' | 'sweep' | 'spin' | 'rain' | 'pulse'

export interface LatticeLoaderProps {
  label?: string
  doneLabel?: string
  errorLabel?: string
  status?: LatticeLoaderStatus
  pattern?: LatticeLoaderPatternName | LatticeLoaderCustomPattern
  grid?: 3 | 4
  shape?: 'square' | 'round'
  color?: string
  doneColor?: string
  errorColor?: string
  cellSize?: number
  gap?: number
  fontSize?: number
  step?: number
  idleOpacity?: number
  glow?: boolean
  glowColor?: string
  showTimer?: boolean
  /** Giay da troi qua, kiem soat tu ngoai - khi dat, dong ho noi bo KHONG tu chay (dung cho test/Storybook, khong dung trong app that). */
  elapsed?: number
  className?: string
  style?: CSSProperties
}

interface ResolvedPattern {
  cells: Array<number | null>
  loop: number
  scale: number
  lit: number
}

const PATTERNS: Record<string, Record<number, { cells: Array<number | null>; loop: number; scale: number; lit?: number }>> = {
  arrow: { 3: { cells: [1, 2, 3, 0, 1, 2, 1, 2, 3], loop: 7.2, scale: 1 } },
  dots: { 3: { cells: [0, 1, 2, 0, 1, 2, 0, 1, 2], loop: 3, scale: 2.4 } },
  ripple: { 3: { cells: [2, 1, 2, 1, 0, 1, 2, 1, 2], loop: 4.8, scale: 1.5 } },
  spiral: { 3: { cells: [0, 1, 2, 7, 8, 3, 6, 5, 4], loop: 9, scale: 1.2, lit: 0.35 } },
  orbit: {
    3: { cells: [0, 1, 2, 7, null, 3, 6, 5, 4], loop: 8, scale: 1.2 },
    4: { cells: [0, 1, 2, 3, 11, null, null, 4, 10, null, null, 5, 9, 8, 7, 6], loop: 6, scale: 1.2, lit: 0.45 },
  },
  snake: {
    3: { cells: [0, 1, 2, 5, 4, 3, 6, 7, 8], loop: 9, scale: 1, lit: 0.35 },
    4: { cells: [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12], loop: 16, scale: 1, lit: 0.25 },
  },
  sweep: { 4: { cells: [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6], loop: 5, scale: 1, lit: 0.45 } },
  spin: { 4: { cells: [0, 0, 1, 1, 0, 0, 1, 1, 3, 3, 2, 2, 3, 3, 2, 2], loop: 4, scale: 1.6, lit: 0.35 } },
  rain: { 4: { cells: [0, 2, 1, 3, 1, 3, 2, 4, 2, 4, 3, 5, 3, 5, 4, 6], loop: 4, scale: 1.2, lit: 0.35 } },
  pulse: { 4: { cells: [2, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 2], loop: 2.4, scale: 2.5, lit: 0.45 } },
}
const DEFAULT_PATTERN: Record<number, string> = { 3: 'orbit', 4: 'sweep' }
const MARKS: Record<number, { done: number[]; error: number[] }> = {
  3: { done: [2, 3, 5, 7], error: [0, 2, 4, 6, 8] },
  4: { done: [7, 8, 10, 13], error: [0, 3, 5, 6, 9, 10, 12, 15] },
}

function resolvePattern(pattern: LatticeLoaderPatternName | LatticeLoaderCustomPattern, grid: number): ResolvedPattern {
  if (typeof pattern === 'string') {
    const named = PATTERNS[pattern]
    const byGrid = named?.[grid]
    const fallback = PATTERNS[DEFAULT_PATTERN[grid]][grid]
    const picked = byGrid ?? fallback
    return { cells: picked.cells, loop: picked.loop, scale: picked.scale, lit: picked.lit ?? 0.62 }
  }
  const cells = Array.from({ length: grid * grid }, (_, i) => pattern.cells[i] ?? null)
  const max = Math.max(0, ...cells.filter((v): v is number => v != null))
  return { cells, loop: pattern.loop ?? max + 4.2, scale: pattern.scale ?? 1, lit: pattern.lit ?? 0.62 }
}

/** "12.3s" hoac "1m 05.0s" - dong ho hien thoi gian AI da xu ly, don vi luu noi bo la 1/10 giay (ds). */
function formatElapsed(ds: number): string {
  return ds < 600 ? `${(ds / 10).toFixed(1)}s` : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`
}

/** Ban doc cho screen reader (khong dung ky hieu don vi "s" viet tat). */
function spokenElapsed(ds: number): string {
  return ds < 600
    ? `${(ds / 10).toFixed(1)} giây`
    : `${Math.floor(ds / 600)} phút ${((ds % 600) / 10).toFixed(1)} giây`
}

/**
 * Chi bao dang xu ly dang luoi cham sang (lattice) - dung khi Poster cho AiFacade tra ve ket
 * qua (goi y tu anh, goi y gia). status="working" chay animation quet qua tung o theo pattern
 * da chon; doi status sang "done"/"error" se dong cung thanh dau tick/x va dung dong ho.
 * Mau mac dinh doc tu Design System token (--teal-600/--success/--danger), KHONG hardcode hex.
 */
export default function LatticeLoader({
  label = 'Đang xử lý',
  doneLabel = 'Xong sau',
  errorLabel = 'Lỗi sau',
  status = 'working',
  pattern = 'orbit',
  grid = 3,
  shape = 'round',
  color = 'var(--teal-600)',
  doneColor = 'var(--success)',
  errorColor = 'var(--danger)',
  cellSize = 8,
  gap = 4,
  fontSize = 13,
  step = 120,
  idleOpacity = 0.15,
  // Glow dung box-shadow tu do - "Dam bao tuyet doi": he thong chi co --shadow-raise/
  // --shadow-overlay, cam do bong tu che (20-design-system.md). KHONG bat glow trong app nay,
  // giu prop lai chi de tuong thich API goc, khong xoa het vi co the can lai neu DS doi rule sau.
  glow = false,
  glowColor = '',
  showTimer = true,
  elapsed,
  className = '',
  style,
}: LatticeLoaderProps) {
  const n = grid === 4 ? 4 : 3
  const pat = resolvePattern(pattern, n)
  const marks = MARKS[n]
  const d = step * pat.scale
  const cycle = Math.round(pat.loop * d)

  const timerRef = useRef<HTMLSpanElement | null>(null)
  const dsRef = useRef(0)
  const markRef = useRef<'done' | 'error'>('done')
  const mark = status === 'working' ? markRef.current : status
  markRef.current = mark
  const [announce, setAnnounce] = useState(`${label}, đang xử lý`)

  const paint = (ds: number) => {
    dsRef.current = ds
    if (timerRef.current) timerRef.current.textContent = formatElapsed(ds)
  }

  useLayoutEffect(() => {
    if (elapsed != null) {
      paint(Math.round(elapsed * 10))
      return undefined
    }
    if (status !== 'working') return undefined
    const startedAt = performance.now()
    paint(0)
    const id = window.setInterval(() => paint(Math.floor((performance.now() - startedAt) / 100)), 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, elapsed])

  useEffect(() => {
    if (status === 'working') setAnnounce(`${label}, đang xử lý`)
    else setAnnounce(`${status === 'done' ? doneLabel : errorLabel}${showTimer ? ` ${spokenElapsed(dsRef.current)}` : ''}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <span
      role="status"
      className={`tc-lattice-loader${className ? ` ${className}` : ''}`}
      data-status={status}
      data-shape={shape}
      data-glow={glow ? '' : undefined}
      style={
        {
          '--ll-n': n,
          '--ll-cell': `${cellSize}px`,
          '--ll-gap': `${gap}px`,
          '--ll-font': `${fontSize}px`,
          '--ll-color': color,
          '--ll-mark': status === 'error' ? errorColor : doneColor,
          '--ll-idle': idleOpacity,
          '--ll-glow': glowColor || color,
          '--ll-mark-glow': glowColor || (status === 'error' ? errorColor : doneColor),
          '--ll-cycle': `${cycle}ms`,
          ...style,
        } as CSSProperties
      }
    >
      <span className="tc-lattice-loader__grid" aria-hidden="true">
        <span className="tc-lattice-loader__layer tc-lattice-loader__run">
          {pat.cells.map((unit, i) => (
            <span
              key={i}
              className="tc-lattice-loader__cell"
              data-hole={unit == null ? '' : undefined}
              data-lit={pat.lit && pat.lit !== 0.62 ? Math.round(pat.lit * 100) : undefined}
              style={unit == null ? undefined : { animationDelay: `${Math.round(unit * d)}ms` }}
            />
          ))}
        </span>
        <span className="tc-lattice-loader__layer tc-lattice-loader__mark">
          {pat.cells.map((_, i) => (
            <span key={i} className="tc-lattice-loader__cell" data-on={marks[mark].includes(i) ? '' : undefined} />
          ))}
        </span>
      </span>
      <span className="tc-lattice-loader__label" aria-hidden="true">
        <span className="tc-lattice-loader__text" data-active={status === 'working' ? '' : undefined}>
          {label}
        </span>
        <span className="tc-lattice-loader__text" data-active={status === 'done' ? '' : undefined}>
          {doneLabel}
        </span>
        <span className="tc-lattice-loader__text" data-active={status === 'error' ? '' : undefined}>
          {errorLabel}
        </span>
      </span>
      {showTimer ? (
        <span ref={timerRef} className="tc-lattice-loader__timer" aria-hidden="true">
          0.0s
        </span>
      ) : null}
      <span className="tc-lattice-loader__sr">{announce}</span>
    </span>
  )
}
