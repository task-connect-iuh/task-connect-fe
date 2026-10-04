import { useEffect, useState } from 'react'
import LatticeLoader from '../../components/LatticeLoader.tsx'

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
 * ly thay vi text tinh). Doi tu vong tron + icon radar TINH sang LatticeLoader (yeu cau nguoi
 * dung, 2026-09-29) - pattern "sweep" + dang tron (--shape="round") giu lai dung tinh than
 * "radar quet" cua icon cu, kich thuoc (grid 4, o 12px) can bang voi vong tron 56px truoc do.
 * LatticeLoader chi loop animation trong luc component nay con mount (status luon "working",
 * unmount ngay khi co ket qua that) - cung ngoai le "gan voi vong doi 1 request that" da thong
 * nhat voi nguoi dung cho component nay (xem LatticeLoader.tsx), khong phai decorative loop vo
 * co ma 20-design-system.md cam. An label/timer rieng cua LatticeLoader (showTimer=false,
 * label rong) vi cac dong trang thai STAGES ben duoi da du chi tiet, tranh trung lap.
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
      <LatticeLoader
        status="working"
        pattern="sweep"
        grid={4}
        shape="round"
        cellSize={12}
        gap={4}
        label=""
        showTimer={false}
      />

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
