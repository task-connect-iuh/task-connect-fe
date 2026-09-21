import { useEffect, useState } from 'react'
import { Icon } from '@ds/components/core/Icon'

// 3 buoc that cua pipeline goi y (TaskerMatchingService buoc 1+2, AiSuggestionService buoc 3 -
// xem PROGRESS-AI-MATCHING-MODULE.md), KHONG phai copy trang tri bia dat - dung de Poster hieu
// AI dang lam gi, dung tinh than "AI copy luon hedged, minh bach" cua Design System.
const STAGES = [
  'Đang lọc Tasker theo khoảng cách và lịch rảnh…',
  'Đang so khớp mức giá và kinh nghiệm…',
  'Đang phân tích ngữ nghĩa và viết lý do gợi ý…',
]

// Khoang cach (ms) giua cac lan hien them 1 dong trang thai - chi la nhip cam nhan tien do,
// khong phai tin hieu that tu backend (1 request HTTP duy nhat, khong co progress event tung
// buoc) - xem ghi chu trong index.css ve ly do khong dung CSS animation lap vo han.
const STAGE_INTERVAL_MS = 900

/**
 * Trang thai cho khi goi GET /tasks/{id}/suggested-taskers (SuggestedTaskersPanel.tsx) - thay
 * cho dong text "Dang tai goi y..." don gian truoc do (yeu cau nguoi dung: can 1 animation hop
 * ly thay vi text tinh). Radar icon TINH (khong quay/nhap nhay lien tuc) trong vong tron tint
 * teal nhac lai dung tu vung "radar = ghep viec" da co san trong Iconography cua Design
 * System; cam giac "dang xu ly" den tu viec cac dong trang thai lan luot xuat hien theo thoi
 * gian (moi dong 1 animation MOT LAN, xem tc-stage-reveal trong index.css), khong phai spinner
 * quay vo han - tuan thu dung guardrail "khong lap vo han, khong troi noi" cua
 * 20-design-system.md.
 */
export function SuggestionsLoading() {
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    if (visibleCount >= STAGES.length) return
    const timer = setTimeout(() => setVisibleCount((prev) => prev + 1), STAGE_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <div
      className="flex flex-col items-center gap-4"
      style={{
        padding: 'var(--sp-6) var(--sp-4)',
        animation: 'tc-stage-reveal var(--dur-slow) var(--ease-out) both',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--r-pill)',
          background: 'var(--brand-tint-strong)',
          border: 'var(--bw) solid var(--teal-300)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="radar" size={26} style={{ color: 'var(--brand-strong)' }} />
      </div>

      <div className="flex flex-col items-center gap-2" style={{ minHeight: STAGES.length * 24 }}>
        {STAGES.slice(0, visibleCount).map((stage, index) => {
          const isCurrent = index === visibleCount - 1
          return (
            <p
              key={stage}
              style={{
                margin: 0,
                fontSize: 'var(--fs-sm)',
                color: isCurrent ? 'var(--text-body)' : 'var(--text-faint)',
                fontWeight: isCurrent ? 'var(--fw-medium)' : 'var(--fw-regular)',
                textAlign: 'center',
                animation: 'tc-stage-reveal var(--dur-slow) var(--ease-out) both',
              }}
            >
              {stage}
            </p>
          )
        })}
      </div>
    </div>
  )
}
