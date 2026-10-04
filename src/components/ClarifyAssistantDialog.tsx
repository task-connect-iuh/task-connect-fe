import { useState } from 'react'
import { Button } from '@ds/components/core/Button'
import { Dialog } from '@ds/components/feedback/Dialog'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import type { ClarifyingQuestionResponse } from '../api/tasks.ts'
import { refineClarifyingAnswers } from '../api/tasks.ts'
import { DialogViewport } from './DialogViewport.tsx'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'

interface ClarifyAssistantDialogProps {
  /** Toi da 3 cau hoi AI sinh khi mo ta tu anh con chung chung, chua neu ro mot su co cu the. */
  questions: ClarifyingQuestionResponse[]
  /** Mo ta hien tai tren form - dung lam ngu canh de AI gop voi cau tra loi, viet lai thanh 1 doan hoan chinh. */
  originalDescription: string
  /** Goi voi mo ta HOAN CHINH (da thay the, khong phai doan can noi them) - noi goi (PostTaskPage) chi viec setDescription. */
  onApply: (fullDescription: string) => void
  onClose: () => void
}

/**
 * Modal "Hoi them" - bu dap phan anh KHONG chup duoc (nguyen nhan an sau trieu chung be mat,
 * vd ong nuoc ngam vo chi thay duoc vet uot tren san) bang cau hoi chi nguoi tai hien truong
 * moi tra loi duoc (xem .claude/rules/15-ai-module.md "chuc nang 4"). Phong theo mockup nguoi
 * dung cung cap ("Dang viec - Hoi them (modal) - offline.html"): dang hoi thoai voi "Tro ly
 * TaskConnect" (avatar bot), moi cau hoi la 1 bubble AI + 1 o tra loi rieng cua Poster. Khong
 * bat buoc tra loi het - cau nao de trong bi bo qua luc ghep vao mo ta (xem onApply o PostTaskPage).
 */
export function ClarifyAssistantDialog({ questions, originalDescription, onApply, onClose }: ClarifyAssistantDialogProps) {
  useLockBodyScroll(true)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [applying, setApplying] = useState(false)

  const answeredCount = Object.values(answers).filter((a) => a.trim()).length
  const noAnswers = answeredCount === 0

  // Cach ghep tho du phong khi AI khong viet lai duoc (het quota/loi mang) - giong cach cu
  // truoc khi co refineClarifyingAnswers, van dung duoc du khong tu nhien bang.
  const fallbackMerge = (answered: { questionText: string; answer: string }[]) => {
    const appended = answered.map((a) => `${a.questionText} ${a.answer}.`).join(' ')
    return originalDescription.trim() ? `${originalDescription.trim()} ${appended}` : appended
  }

  const handleApply = async () => {
    const answered = questions
      .map((q, i) => ({ questionText: q.text, answer: answers[i]?.trim() ?? '' }))
      .filter((a) => a.answer)
    setApplying(true)
    try {
      const result = await refineClarifyingAnswers(originalDescription, answered)
      onApply(result.available && result.refinedDescription ? result.refinedDescription : fallbackMerge(answered))
    } catch {
      onApply(fallbackMerge(answered))
    } finally {
      setApplying(false)
    }
  }

  return (
    <DialogViewport>
      <Dialog
        onClose={onClose}
        style={{ maxWidth: 480, animationName: 'tc-stage-reveal', animationDuration: 'var(--dur-slow)', animationTimingFunction: 'var(--ease-out)', animationFillMode: 'both' }}
        footer={
          <div className="flex flex-col gap-2" style={{ width: '100%' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {answeredCount}/{questions.length} câu đã trả lời
            </span>
            <div className="flex items-center gap-3" style={{ width: '100%' }}>
              <Button variant="ghost" size="sm" disabled={applying} onClick={onClose}>Để sau</Button>
              <Button
                size="sm"
                icon="text-cursor-input"
                disabled={noAnswers || applying}
                onClick={handleApply}
                style={{ flex: 1 }}
              >
                {applying ? 'Đang tổng hợp...' : 'Gửi'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4" style={{ maxHeight: '60vh', overflowY: 'auto', paddingTop: 'var(--sp-1)' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44, height: 44, flex: '0 0 auto', borderRadius: 'var(--r-pill)',
                background: 'var(--teal-500)', color: 'var(--text-on-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}
            >
              <Icon name="bot" size={22} />
              <span
                style={{
                  position: 'absolute', right: -1, bottom: -1, width: 12, height: 12,
                  borderRadius: 'var(--r-pill)', background: 'var(--teal-300)', border: 'var(--bw) solid var(--surface-card)',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-title)' }}>
                Trợ lý TaskConnect
              </div>
              <div className="flex items-center gap-1" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                <Icon name="sparkles" size={13} />
                Gợi ý từ AI · cần thêm chi tiết
              </div>
            </div>
          </div>

          <div
            style={{
              maxWidth: '88%', background: 'var(--bg-section)', border: 'var(--bw) solid var(--border-subtle)',
              borderRadius: 'var(--r-lg)', padding: 'var(--sp-3) var(--sp-4)',
            }}
          >
            <p style={{ margin: '0 0 var(--sp-1)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-title)', lineHeight: 1.45 }}>
              Bạn bổ sung thêm giúp mình một số thứ nhé
            </p>
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.6 }}>
              Mình đã xem ảnh nhưng mô tả có thể chưa đủ chi tiết để Tasker báo giá đúng. Bạn đang ở đó, chắc chắn biết rõ hơn mình — câu nào chưa chắc thì cứ để trống.
            </p>
          </div>

          {questions.map((q, i) => (
            <div
              key={q.key}
              className="flex flex-col gap-2"
              style={{
                animationName: 'tc-stage-reveal', animationDuration: 'var(--dur-slow)',
                animationTimingFunction: 'var(--ease-out)', animationFillMode: 'both',
                animationDelay: `${Math.min(i, 3) * 80}ms`,
              }}
            >
              <div
                style={{
                  alignSelf: 'flex-start', maxWidth: '88%', background: 'var(--bg-section)',
                  border: 'var(--bw) solid var(--border-subtle)', borderRadius: 'var(--r-lg)',
                  padding: 'var(--sp-3) var(--sp-4)', fontSize: 'var(--fs-body)', color: 'var(--text-title)', lineHeight: 1.55,
                }}
              >
                {q.text}
              </div>
              <label className="flex flex-col gap-1" style={{ alignSelf: 'flex-end', width: '80%' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textAlign: 'right' }}>Bạn trả lời</span>
                <Input
                  placeholder={q.placeholder}
                  value={answers[i] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                  maxLength={200}
                />
              </label>
            </div>
          ))}
        </div>
      </Dialog>
    </DialogViewport>
  )
}
