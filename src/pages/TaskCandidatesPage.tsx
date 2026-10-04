import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Radio } from '@ds/components/forms/Radio'
import { AppShell } from '../components/AppShell.tsx'
import { DialogViewport } from '../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { ApiError } from '../api/client.ts'
import { confirmApplication, getTask, getTaskApplicants, rejectApplication } from '../api/tasks.ts'
import type { PaymentMethod, TaskApplicationResponse, TaskApplicationStatus, TaskResponse } from '../api/tasks.ts'
import { getSystemParameters } from '../api/systemParameters.ts'
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
  // Them cho UC07 (Poster huy/sua viec da dang).
  CANCELLED: 'Công việc đã huỷ',
  TIME_CHANGED_NEEDS_RECONFIRM: 'Chờ xác nhận lại giờ mới',
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
  CANCELLED: 'neutral',
  TIME_CHANGED_NEEDS_RECONFIRM: 'warning',
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
  // Yeu cau nguoi dung 2026-09-30: "Chon nguoi nay" bat buoc task phai co scheduledAt - khop
  // dung guard MISSING_SCHEDULED_AT moi them o TaskApplicationService.confirm() (BE).
  const canConfirm = feeBase != null && task.scheduledAt != null && candidate.pendingProposalAmount == null
    && candidate.status === 'PENDING' && task.status === 'OPEN' && !candidate.hasBooking
  // Ung vien THANG cua UC11 "Chon nguoi nay" giu nguyen status=PENDING (khong chuyen ACCEPTED) -
  // hasBooking moi la tin hieu dung "da duoc chon", nen phai loai rieng khoi isSelectableStatus,
  // neu khong nut "Chon nguoi nay"/"Tu choi" van hien cho ung vien da duoc giao viec (bao cao
  // nguoi dung 2026-09-28).
  const isSelectableStatus = (candidate.status === 'PENDING' || candidate.status === 'INVITED') && !candidate.hasBooking
  // Cung nhom "da roi khoi vong doi" duoc lam toi hon o TaskerJobsPage.tsx (ApplicationRow) -
  // rut ung tuyen, bi Poster tu choi, hoac viec da giao cho Tasker khac (yeu cau nguoi dung).
  const isDimmed = candidate.status === 'WITHDRAWN' || candidate.status === 'REJECTED' || candidate.status === 'REJECTED_AUTO'
  // WITHDRAWN va REJECTED_AUTO la 2 trang thai CASCADE - BE cuon ca PENDING lan INQUIRING/
  // INVITED ve chung 1 gia tri nay (isStillActiveForCascade() va Javadoc withdraw() trong
  // TaskApplicationService.java), nen khong con cach nao biet chac candidate nay tung "tu ung
  // tuyen" that hay chi "dang hoi them" - hien INITIATED_BY_LABEL luc do la doan bua (bao cao
  // nguoi dung 2026-09-28, cung loai loi da sua o badge InboxPage.tsx). rieng REJECTED CHAC
  // CHAN tu PENDING (reject() bat buoc status=PENDING, xem TaskApplicationService.reject()) nen
  // van an toan de hien.
  const initiatedByAmbiguous = candidate.status === 'WITHDRAWN' || candidate.status === 'REJECTED_AUTO'

  return (
    <Card
      tone={isDimmed ? 'sunken' : 'plain'}
      padding="var(--sp-5)"
      style={{ border: hasAgreedPrice ? 'var(--bw) solid var(--brand)' : undefined, display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
    >
      <div className="flex gap-4 items-start">
        <Avatar name={candidate.taskerName ?? 'Tasker'} src={candidate.taskerAvatarUrl ?? undefined} size={56} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <strong style={{ fontSize: 'var(--fs-body-lg)' }}>{candidate.taskerName ?? 'Tasker'}</strong>
            {/* PENDING/INQUIRING la 2 trang thai "vua gui, chua ai quyet dinh gi" - 1 tag la du
                (Tu ung tuyen/Ban da moi cho PENDING, rieng INQUIRING doi han sang "Đang hỏi
                thêm" vi INITIATED_BY_LABEL "Tự ứng tuyển" ngu y da nop don, sai voi 1 nguoi moi
                hoi them, cung 1 loi nhu badge InboxPage.tsx da sua). "Chờ xác nhận" (CANDIDATE_
                STATUS_LABEL.PENDING) an di vi thua - chi con lai 1 tag cho 2 trang thai nay. Cac
                trang thai da co quyet dinh (duoc chon qua hasBooking, REJECTED, REJECTED_AUTO,
                WITHDRAWN...) van hien du 2 tag nhu cu (yeu cau nguoi dung 2026-09-28). */}
            {candidate.status === 'INQUIRING' ? (
              <Badge tone={CANDIDATE_STATUS_TONE.INQUIRING}>{CANDIDATE_STATUS_LABEL.INQUIRING}</Badge>
            ) : !initiatedByAmbiguous ? (
              <Badge tone={candidate.initiatedBy === 'POSTER' ? 'brand' : 'neutral'} icon={candidate.initiatedBy === 'POSTER' ? 'send' : undefined}>
                {INITIATED_BY_LABEL[candidate.initiatedBy]}
              </Badge>
            ) : null}
            {/* hasBooking rieng con duoc uu tien hien du 2 tag ke ca khi status con la PENDING -
                UC11 "Chon nguoi nay" GIU NGUYEN status=PENDING (khong chuyen ACCEPTED, xem
                Javadoc TaskApplicationService.confirm()), hasBooking moi la tin hieu "da duoc
                chon" that su. */}
            {(candidate.hasBooking || (candidate.status !== 'PENDING' && candidate.status !== 'INQUIRING')) && (
              <Badge tone={candidate.hasBooking ? 'success' : CANDIDATE_STATUS_TONE[candidate.status]}>
                {candidate.hasBooking ? 'Đã chọn' : CANDIDATE_STATUS_LABEL[candidate.status]}
              </Badge>
            )}
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
              <span className="tc-label" style={{ display: 'block' }}>
                {candidate.pendingProposalProposedBy === 'TASKER' ? 'Tasker đề xuất' : 'Bạn đã đề xuất'}
              </span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)', lineHeight: 1.2 }}>
                {formatVnd(candidate.pendingProposalAmount)}
              </span>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                {candidate.pendingProposalProposedBy === 'TASKER' ? (
                  <Badge tone="warning" icon="clock">Chờ bạn quyết định</Badge>
                ) : (
                  <Badge tone="info" icon="clock">Đang chờ Tasker phản hồi</Badge>
                )}
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

      {/* De xuat gia dang cho CHI hien thong bao, khong co nut Dong y/Tu choi tren card - hanh
          dong do van phai lam trong khung chat (PriceProposalCard.tsx), du ben nao de xuat (sua
          theo phan hoi nguoi dung 2026-10-01: ban dau co nut rieng khi Tasker de xuat, nhung
          nguoi dung muon dong bo ve 1 kieu thong bao duy nhat nhu khi chinh Poster de xuat).
          Tone warning (vang) rieng cho truong hop cho CHINH Poster phan hoi (Tasker de xuat) -
          phan biet muc do can hanh dong ngay (minh la nguoi can quyet dinh) voi truong hop chi
          dang cho doi phuong (Poster tu de xuat), tone do van giu info (yeu cau nguoi dung). */}
      {candidate.pendingProposalAmount != null && (
        <Alert
          tone={candidate.pendingProposalProposedBy === 'TASKER' ? 'warning' : 'info'}
          title={candidate.pendingProposalProposedBy === 'TASKER' ? 'Chờ bạn phản hồi' : 'Đang chờ phản hồi'}
        >
          {candidate.pendingProposalProposedBy === 'TASKER'
            ? `${candidate.taskerName ?? 'Tasker'} đã đề xuất ${formatVnd(candidate.pendingProposalAmount)}. Vào "Nhắn tin" để đồng ý hoặc từ chối.`
            : `Bạn đã đề xuất ${formatVnd(candidate.pendingProposalAmount)} đến ${candidate.taskerName ?? 'Tasker'} và đang chờ phản hồi.`}
        </Alert>
      )}

      {/* Tach lam 2 hang thay vi nhoi 5 phan tu vao 1 hang flex-wrap (button dai + ca cau
          ghi chu khien no vo xuong nhieu dong lech nhau, tung sua bang justify-content:
          space-between nhung khi "Từ chối" roi rieng 1 dong thi lai bi day ve trai vi dong
          do chi co 1 phan tu). Hang 1 = hanh dong chinh (Chon nguoi nay + ly do chua bam
          duoc, chi hien khi con dang cho quyet dinh). Hang 2 = hanh dong phu ben trai
          (Nhan tin, Lich su gia) va Tu choi dinh phai bang marginLeft:auto - auto-margin
          van day dung sang phai ke ca khi hang nay phai wrap, khac voi justify-content. */}
      <div className="flex flex-col gap-3" style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        {isSelectableStatus && (
          <div className="flex gap-3 flex-wrap items-center">
            <Button icon="user-round-check" disabled={!canConfirm || busy} onClick={onConfirm}>
              {busy ? 'Đang xử lý…' : 'Chọn người này'}
            </Button>
            {!canConfirm && (
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {candidate.pendingProposalAmount != null
                  ? 'Đang có một đề xuất giá chờ xử lý.'
                  : task.scheduledAt == null
                    ? 'Công việc chưa có thời gian mong muốn — sửa công việc để thêm trước khi chọn.'
                    : 'Chưa có mức nào được hai bên đồng ý.'}
              </span>
            )}
          </div>
        )}
        <div className="flex gap-3 flex-wrap items-center">
          <Button
            variant="secondary" icon="message-square"
            onClick={() => navigate(`/tin-nhan/${candidate.id}`, {
              state: { counterpartName: candidate.taskerName, counterpartAvatarUrl: candidate.taskerAvatarUrl },
            })}
          >
            Nhắn tin
          </Button>
          {/* Ghost + vien trung tinh: co khung de tach khoi chu thuong, nhung nhat hon "Nhan tin" (secondary teal) vi day chi la hanh dong tra cuu */}
          <Button variant="ghost" icon="history" onClick={onViewHistory} style={{ border: 'var(--bw) solid var(--border)' }}>
            Lịch sử giá
          </Button>
          {isSelectableStatus && (
            /* variant danger: vien + chu clay theo dung quy uoc "loi va tu choi" cua DS, dong bo voi nut Tu choi trong khung chat (InboxPage) */
            <Button variant="danger" icon="x" disabled={busy} onClick={onReject} style={{ marginLeft: 'auto' }}>Từ chối</Button>
          )}
        </div>
      </div>
    </Card>
  )
}

interface ConfirmDialogProps {
  taskerName: string | null
  feeBase: number
  onClose: () => void
  onConfirmed: (paymentMethod: PaymentMethod) => void
}

// Nhan/mo ta 2 phuong thuc thanh toan (quyet dinh nguoi dung 2026-10-02 - ten chua co san trong
// dac ta, tu dat theo dung noi dung nguoi dung mo ta, co the doi sau). So tien cu the cua tung
// phuong thuc tinh ngay trong dialog (feeBase cho FULL_ESCROW, feeBase x platformFeeRate cho
// FEE_ONLY_ESCROW) va cong khai ngay trong nhan - khong giau dieu kien sau "xem them"
// (.claude/rules/22-vietnamese-copy.md).

/**
 * Modal 2 buoc truoc khi xac nhan giao viec that (khong dao nguoc duoc - giu tien that qua
 * Payment, tao booking, dong kenh cac ung vien khac). Buoc 1 ("method"): Poster chon 1 trong 2
 * phuong thuc thanh toan (quyet dinh nguoi dung 2026-10-02). Buoc 2 ("confirm"): tom tat nhu cu,
 * kem nhac lai phuong thuc da chon. feeBase truyen tu ngoai vao (candidate.agreedPriceAmount neu
 * da thuong luong, else task.budgetAmount - xem Javadoc CandidateCard). Nhan taskerName rieng
 * (thay vi ca candidate) va duoc export de InboxPage.tsx (khung chat) tai su dung cho nut "Chon
 * nguoi nay" dat canh o nhap (2026-09-22) - cung 1 nghiep vu xac nhan giao viec, chi khac noi mo
 * dialog. onConfirmed nhan paymentMethod da chon (doi chu ky 2026-10-02) - caller tu goi
 * confirmApplication voi gia tri nay.
 */
export function ConfirmDialog({ taskerName, feeBase, onClose, onConfirmed }: ConfirmDialogProps) {
  useLockBodyScroll(true)
  const [step, setStep] = useState<'method' | 'confirm'>('method')
  const [method, setMethod] = useState<PaymentMethod>('FULL_ESCROW')
  const [platformFeeRate, setPlatformFeeRate] = useState<number | null>(null)

  useEffect(() => {
    getSystemParameters().then((params) => setPlatformFeeRate(params.platformFeeRate)).catch(() => { /* giu null, an phan mo ta PA2 neu chua tai duoc */ })
  }, [])

  const feeOnlyAmount = platformFeeRate != null ? Math.floor(feeBase * platformFeeRate) : null
  const directAmount = feeOnlyAmount != null ? feeBase - feeOnlyAmount : null
  const methodLabel = method === 'FULL_ESCROW' ? 'Giữ toàn bộ qua hệ thống' : 'Chỉ giữ phí nền tảng'
  const heldAmount = method === 'FULL_ESCROW' ? feeBase : feeOnlyAmount

  return (
    <DialogViewport>
      <Dialog
        title={step === 'method' ? 'Chọn phương thức thanh toán' : `Giao việc cho ${taskerName ?? 'Tasker'}`}
        onClose={onClose}
        style={step === 'method' ? { maxWidth: 560 } : undefined}
      >
        {step === 'method' ? (
          <div className="flex flex-col gap-4">
            <div style={{ background: 'var(--money-tint)', border: 'var(--bw) solid var(--amber-300)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)', textAlign: 'center' }}>
              <span className="tc-label" style={{ display: 'block', color: 'var(--amber-700)' }}>Giá chốt cho công việc này</span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)', color: 'var(--amber-700)' }}>
                {formatVnd(feeBase)}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <div style={{ border: `var(--bw) solid ${method === 'FULL_ESCROW' ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
                <Radio
                  name="paymentMethod"
                  value="FULL_ESCROW"
                  checked={method === 'FULL_ESCROW'}
                  onChange={() => setMethod('FULL_ESCROW')}
                  label={`Giữ toàn bộ qua hệ thống — tạm giữ ${formatVnd(feeBase)} ngay`}
                  description="Hệ thống tạm giữ toàn bộ số tiền khi giao việc, chỉ chuyển cho Tasker sau khi công việc hoàn tất."
                />
              </div>
              <div style={{ border: `var(--bw) solid ${method === 'FEE_ONLY_ESCROW' ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
                <Radio
                  name="paymentMethod"
                  value="FEE_ONLY_ESCROW"
                  checked={method === 'FEE_ONLY_ESCROW'}
                  onChange={() => setMethod('FEE_ONLY_ESCROW')}
                  label={`Chỉ giữ phí nền tảng${feeOnlyAmount != null ? ` — tạm giữ ${formatVnd(feeOnlyAmount)} ngay` : ''}`}
                  description={
                    directAmount != null
                      ? `${formatVnd(directAmount)} còn lại hai bên tự thanh toán trực tiếp ngoài hệ thống — hệ thống không quản lý phần này.`
                      : 'Phần còn lại hai bên tự thanh toán trực tiếp ngoài hệ thống — hệ thống không quản lý phần này.'
                  }
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={onClose}>Để sau</Button>
              <Button icon="arrow-right" onClick={() => setStep('confirm')}>Tiếp tục</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div style={{ background: 'var(--money-tint)', border: 'var(--bw) solid var(--amber-300)', borderRadius: 'var(--r-md)', padding: 'var(--sp-5)', textAlign: 'center' }}>
              <span className="tc-label" style={{ display: 'block', color: 'var(--amber-700)' }}>Giá chốt cho công việc này</span>
              <span className="tc-num" style={{ fontSize: 'var(--fs-amount-lg)', fontWeight: 'var(--fw-black)', color: 'var(--amber-700)', display: 'block', marginTop: 4 }}>
                {formatVnd(feeBase)}
              </span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--amber-700)', display: 'block', marginTop: 4 }}>
                {methodLabel}{heldAmount != null ? ` · tạm giữ ngay ${formatVnd(heldAmount)}` : ''}
              </span>
            </div>
            <Alert tone="info" title="Các ứng viên còn lại">
              Những người khác chuyển sang trạng thái cần ứng tuyển lại, và hội thoại của họ được đóng kèm một dòng ghi rõ lý do.
            </Alert>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" icon="arrow-left" onClick={() => setStep('method')}>Quay lại</Button>
              <Button icon="check" onClick={() => onConfirmed(method)}>Giao việc với {formatVnd(feeBase)}</Button>
            </div>
          </div>
        )}
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

  const handleConfirmed = (paymentMethod: PaymentMethod) => {
    if (!taskId || !confirmTarget) return
    setProcessingId(confirmTarget.id)
    confirmApplication(taskId, confirmTarget.id, paymentMethod)
      .then(() => {
        useToastStore.getState().pushToast('success', 'Đã chọn Tasker này cho công việc.')
        setConfirmTarget(null)
        refresh()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Xác nhận thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  const agreedCount = candidates?.filter((c) => c.agreedPriceAmount != null).length ?? 0

  // Ung vien da duoc giao viec (hasBooking) luon len dau danh sach - Poster de dang thay ngay
  // ai la nguoi da chon, thay vi phai tim giua cac ung vien khac (yeu cau nguoi dung).
  const sortedCandidates = useMemo(
    () => candidates == null ? null : [...candidates].sort((a, b) => Number(b.hasBooking) - Number(a.hasBooking)),
    [candidates],
  )

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
          {candidates == null && !loadError && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tải…</p>
          )}
          {candidates != null && candidates.length === 0 && (
            <EmptyState icon="user-search" title="Chưa có ai ứng tuyển việc này" />
          )}
          {task && sortedCandidates?.map((candidate) => (
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
              <DataRow label="Ngân sách ban đầu" value={task.budgetAmount != null ? formatVnd(task.budgetAmount) : 'Thoả thuận'} numeric />
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
