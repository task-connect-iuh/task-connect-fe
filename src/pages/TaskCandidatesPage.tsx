import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { AppShell } from '../components/AppShell.tsx'
import { DialogViewport } from '../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { ApiError } from '../api/client.ts'
import { confirmApplication, getTask, getTaskApplicants, rejectApplication } from '../api/tasks.ts'
import type { TaskApplicationResponse, TaskApplicationStatus, TaskResponse } from '../api/tasks.ts'
import { formatVnd } from '../features/chat/chatFormat.ts'
import { PriceHistoryPanel } from '../features/chat/components/PriceHistoryPanel.tsx'

// Nhan/tone rieng cho khoi "khoi tao boi" - trung voi nhan da dung o InboxPage.tsx/MyTasksPage.tsx.
const INITIATED_BY_LABEL: Record<TaskApplicationResponse['initiatedBy'], string> = {
  TASKER: 'Tự ứng tuyển',
  POSTER: 'Bạn đã mời',
}

// Nhan/tone rieng cho TaskApplicationStatus goc nhin POSTER (khac APPLICATION_STATUS_LABEL o
// TaskerJobsPage.tsx dung xung "ban" cho Tasker - o day nguoi xem la Poster nen doi lai vai
// nhan cho dung goc nhin, vd INVITED/REJECTED). Theo yeu cau nguoi dung 2026-09-21: hien them 1
// badge trang thai canh badge "khoi tao boi" tren moi CandidateCard de phan biet ro PENDING/
// WITHDRAWN/REJECTED... - listApplicantsForOwner() da tra ve TAT CA trang thai tu truoc (khong
// loc rieng PENDING/INVITED), chi UI truoc gio khong hien thi phan biet duoc. Tone giu dung
// theo TaskerJobsPage.tsx (mau sac mang y nghia khach quan ve muc do "con hieu luc" cua trang
// thai, khong doi theo goc nhin nguoi xem).
const CANDIDATE_STATUS_LABEL: Record<TaskApplicationStatus, string> = {
  PENDING: 'Chờ xác nhận',
  ACCEPTED: 'Đã chọn',
  NEEDS_RECONFIRM: 'Cần ứng tuyển lại',
  REJECTED: 'Đã từ chối',
  INQUIRING: 'Đang hỏi thêm',
  INVITED: 'Đang chờ phản hồi',
  WITHDRAWN: 'Đã rút ứng tuyển',
  REJECTED_AUTO: 'Đã giao người khác',
  DECLINED: 'Đã từ chối lời mời',
  INVITE_EXPIRED: 'Lời mời đã hết hạn',
}
const CANDIDATE_STATUS_TONE: Record<TaskApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  NEEDS_RECONFIRM: 'warning',
  REJECTED: 'neutral',
  INQUIRING: 'info',
  INVITED: 'warning',
  WITHDRAWN: 'neutral',
  REJECTED_AUTO: 'neutral',
  DECLINED: 'danger',
  INVITE_EXPIRED: 'neutral',
}

interface CandidateCardProps {
  candidate: TaskApplicationResponse
  task: TaskResponse
  busy: boolean
  onConfirm: () => void
  onReject: () => void
  onViewHistory: () => void
}

/**
 * The 1 ung vien trong man "Ung vien & chot gia" (Round F2) - bo cuc theo file thiet ke tham
 * khao. "Chon nguoi nay" mo (khong disabled) khi co feeBase (agreedPriceAmount da thuong luong
 * qua chat, HOAC ngan sach task.budgetAmount neu chua ai thuong luong gi - dung KHOP dieu kien
 * feeBase cua TaskApplicationService.confirm() o backend: proposedPrice cua don HOAC ngan sach
 * task, khong co ca hai thi backend tra MISSING_AGREED_PRICE) va khong co de xuat nao dang
 * PROPOSED (pendingProposalAmount == null, khop PRICE_PROPOSAL_PENDING - fallback ngan sach
 * KHONG bo qua 1 de xuat dang cho quyet dinh). Sua 2026-09-21: truoc day FE bat buoc phai co
 * agreedPriceAmount (tuc phai thuong luong qua chat) moi mo nut, du task da co san ngan sach -
 * chat voi nguoi dung, xac nhan mo rong dung fallback BE da co san thay vi bat them 1 buoc
 * "Tasker xac nhan ngan sach" moi (business rule chua tung co trong docs/dac ta). Khong tu doan
 * sai UI - backend van la nguon xac nhan cuoi cung, click van goi API that du UI co doan dung
 * hay khong.
 */
function CandidateCard({ candidate, task, busy, onConfirm, onReject, onViewHistory }: CandidateCardProps) {
  const navigate = useNavigate()
  const hasAgreedPrice = candidate.agreedPriceAmount != null
  const feeBase = candidate.agreedPriceAmount ?? task.budgetAmount
  const canConfirm = feeBase != null && candidate.pendingProposalAmount == null
    && candidate.status === 'PENDING' && task.status === 'OPEN'
  const isSelectableStatus = candidate.status === 'PENDING' || candidate.status === 'INVITED'

  return (
    <Card
      padding="var(--sp-5)"
      style={{ border: hasAgreedPrice ? 'var(--bw) solid var(--brand)' : undefined, display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
    >
      <div className="flex gap-4 items-start">
        <Avatar name={candidate.taskerName ?? 'Tasker'} src={candidate.taskerAvatarUrl ?? undefined} size={56} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <strong style={{ fontSize: 'var(--fs-body-lg)' }}>{candidate.taskerName ?? 'Tasker'}</strong>
            <Badge tone={candidate.initiatedBy === 'POSTER' ? 'brand' : 'neutral'} icon={candidate.initiatedBy === 'POSTER' ? 'send' : undefined}>
              {INITIATED_BY_LABEL[candidate.initiatedBy]}
            </Badge>
            <Badge tone={CANDIDATE_STATUS_TONE[candidate.status]}>{CANDIDATE_STATUS_LABEL[candidate.status]}</Badge>
          </div>
        </div>
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          {hasAgreedPrice ? (
            <>
              <span className="tc-label" style={{ display: 'block' }}>Giá đã đồng ý</span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)', color: 'var(--amber-700)', lineHeight: 1.2 }}>
                {formatVnd(candidate.agreedPriceAmount!)}
              </span>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Badge tone="success" icon="check">Cả hai đã đồng ý</Badge>
              </div>
            </>
          ) : candidate.pendingProposalAmount != null ? (
            <>
              <span className="tc-label" style={{ display: 'block' }}>Đang đề xuất</span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)', lineHeight: 1.2 }}>
                {formatVnd(candidate.pendingProposalAmount)}
              </span>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Badge tone="warning" icon="clock">Chờ quyết định</Badge>
              </div>
            </>
          ) : task.budgetAmount != null ? (
            <>
              <span className="tc-label" style={{ display: 'block' }}>Theo ngân sách đã đăng</span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)', color: 'var(--amber-700)', lineHeight: 1.2 }}>
                {formatVnd(task.budgetAmount)}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Chưa có mức giá nào</span>
          )}
        </div>
      </div>

      {candidate.message && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>{candidate.message}</p>
      )}

      {!hasAgreedPrice && candidate.pendingProposalAmount == null && task.budgetAmount == null && (
        <Alert tone="info" title="Chưa có mức giá nào được đề xuất">
          Nhắn tin để trao đổi mức giá — "Chọn người này" chỉ mở khi có một mức được cả hai bên đồng ý.
        </Alert>
      )}

      <div className="flex gap-3 flex-wrap items-center" style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        {isSelectableStatus && (
          <Button icon="user-round-check" disabled={!canConfirm || busy} onClick={onConfirm}>
            {busy ? 'Đang xử lý…' : 'Chọn người này'}
          </Button>
        )}
        {!canConfirm && isSelectableStatus && (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {candidate.pendingProposalAmount != null
              ? 'Đang có một đề xuất giá chờ xử lý.'
              : 'Chưa có mức nào được hai bên đồng ý.'}
          </span>
        )}
        <Button
          variant="secondary" icon="message-square"
          onClick={() => navigate(`/tin-nhan/${candidate.id}`, {
            state: { counterpartName: candidate.taskerName, counterpartAvatarUrl: candidate.taskerAvatarUrl },
          })}
        >
          Nhắn tin
        </Button>
        <Button variant="ghost" icon="history" onClick={onViewHistory}>Lịch sử giá</Button>
        {isSelectableStatus && (
          <Button variant="ghost" icon="x" disabled={busy} onClick={onReject} style={{ marginLeft: 'auto' }}>Từ chối</Button>
        )}
      </div>
    </Card>
  )
}

interface ConfirmDialogProps {
  taskerName: string | null
  feeBase: number
  onClose: () => void
  onConfirmed: () => void
}

/**
 * Modal xac nhan giao viec truoc khi goi API that (khong dao nguoc duoc - tao booking-lite,
 * dong kenh cac ung vien khac). feeBase truyen tu ngoai vao (candidate.agreedPriceAmount neu da
 * thuong luong, else task.budgetAmount - xem Javadoc CandidateCard) thay vi tu doc thang
 * candidate.agreedPriceAmount nhu truoc, vi tu 2026-09-21 "Chon nguoi nay" co the mo ma chua co
 * agreedPriceAmount (dung fallback ngan sach). Nhan taskerName rieng (thay vi ca candidate) va
 * duoc export de InboxPage.tsx (khung chat) tai su dung cho nut "Chon nguoi nay" dat canh o nhap
 * (2026-09-22) - cung 1 nghiep vu xac nhan giao viec, chi khac noi mo dialog.
 */
export function ConfirmDialog({ taskerName, feeBase, onClose, onConfirmed }: ConfirmDialogProps) {
  useLockBodyScroll(true)
  return (
    <DialogViewport>
      <Dialog title={`Giao việc cho ${taskerName ?? 'Tasker'}`} onClose={onClose}>
        <div className="flex flex-col gap-4">
          <div style={{ background: 'var(--money-tint)', border: 'var(--bw) solid var(--amber-300)', borderRadius: 'var(--r-md)', padding: 'var(--sp-5)', textAlign: 'center' }}>
            <span className="tc-label" style={{ display: 'block', color: 'var(--amber-700)' }}>Giá chốt cho công việc này</span>
            <span className="tc-num" style={{ fontSize: 'var(--fs-amount-lg)', fontWeight: 'var(--fw-black)', color: 'var(--amber-700)', display: 'block', marginTop: 4 }}>
              {formatVnd(feeBase)}
            </span>
          </div>
          <Alert tone="info" title="Các ứng viên còn lại">
            Những người khác chuyển sang trạng thái cần ứng tuyển lại, và hội thoại của họ được đóng kèm một dòng ghi rõ lý do.
          </Alert>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose}>Để sau</Button>
            <Button icon="check" onClick={onConfirmed}>Giao việc với {formatVnd(feeBase)}</Button>
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}

/**
 * Man "Ung vien & chot gia" (Round F2) - Poster xem/so sanh gia cua tat ca ung vien 1 cong
 * viec cung luc, khac ApplicantsPanel (dialog nho trong MyTasksPage.tsx) o cho "Chon nguoi nay"
 * chi mo khi da co gia dong y that (khong phai chi can status PENDING). 2 noi cung ton tai song
 * song theo dung ke hoach Round F2/F3 - ApplicantsPanel se duoc thay hoan toan o Round F3.
 */
export function TaskCandidatesPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskResponse | null>(null)
  const [candidates, setCandidates] = useState<TaskApplicationResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<TaskApplicationResponse | null>(null)
  const [historyApplicationId, setHistoryApplicationId] = useState<string | null>(null)

  const refresh = () => {
    if (!taskId) return
    Promise.all([getTask(taskId), getTaskApplicants(taskId)])
      .then(([taskResponse, applicants]) => { setTask(taskResponse); setCandidates(applicants) })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách ứng viên.'))
  }

  useEffect(refresh, [taskId])

  const handleReject = (candidate: TaskApplicationResponse) => {
    if (!taskId) return
    setProcessingId(candidate.id)
    rejectApplication(taskId, candidate.id)
      .then((updated) => {
        setCandidates((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? null)
        useToastStore.getState().pushToast('success', 'Đã từ chối ứng viên này.')
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Từ chối thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  const handleConfirmed = () => {
    if (!taskId || !confirmTarget) return
    setProcessingId(confirmTarget.id)
    confirmApplication(taskId, confirmTarget.id)
      .then(() => {
        useToastStore.getState().pushToast('success', 'Đã chọn Tasker này cho công việc.')
        setConfirmTarget(null)
        refresh()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Xác nhận thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  const agreedCount = candidates?.filter((c) => c.agreedPriceAmount != null).length ?? 0

  return (
    <AppShell
      navValue="jobs"
      title={task?.title ?? 'Ứng viên & chốt giá'}
      subtitle={task ? `${candidates?.length ?? 0} ứng viên · ${task.budgetAmount != null ? formatVnd(task.budgetAmount) : 'giá thoả thuận'}` : undefined}
      actions={<Button variant="secondary" icon="arrow-left" onClick={() => navigate('/viec-cua-toi')}>Về Việc của tôi</Button>}
    >
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>
          {task?.budgetAmount == null && (
            <Alert tone="warning" title="Việc này để giá thoả thuận">
              Bạn chưa ghi số tiền khi đăng. Phải có một mức giá được cả hai bên đồng ý trước khi giao việc — nút "Chọn người này" chỉ mở khi ứng viên đó đã có giá đồng ý.
            </Alert>
          )}

          {candidates == null && !loadError && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tải…</p>
          )}
          {candidates != null && candidates.length === 0 && (
            <EmptyState icon="user-search" title="Chưa có ai ứng tuyển việc này" />
          )}
          {task && candidates?.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              task={task}
              busy={processingId === candidate.id}
              onConfirm={() => setConfirmTarget(candidate)}
              onReject={() => handleReject(candidate)}
              onViewHistory={() => setHistoryApplicationId(candidate.id)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          {task && (
            <Card padding="var(--sp-5)">
              <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>{task.title}</div>
              <DataRow label="Ngân sách" value={task.budgetAmount != null ? formatVnd(task.budgetAmount) : 'Thoả thuận'} numeric />
              <DataRow label="Ứng viên" value={candidates?.length ?? 0} numeric />
              <DataRow label="Đã có giá đồng ý" value={agreedCount} numeric strong />
            </Card>
          )}
          <Alert tone="info" title="Chốt số tách khỏi giao việc">
            Số trong chat chỉ là lời nói. Giá chốt chỉ đổi khi một đề xuất được bấm Đồng ý trong hội thoại.
          </Alert>
        </div>
      </div>

      {confirmTarget && task && (
        <ConfirmDialog
          taskerName={confirmTarget.taskerName}
          feeBase={(confirmTarget.agreedPriceAmount ?? task.budgetAmount)!}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={handleConfirmed}
        />
      )}

      {historyApplicationId && (
        <DialogViewport>
          <Dialog title="Lịch sử giá" onClose={() => setHistoryApplicationId(null)}>
            <PriceHistoryPanel applicationId={historyApplicationId} />
          </Dialog>
        </DialogViewport>
      )}
    </AppShell>
  )
}
