import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Chip } from '@ds/components/core/Chip'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { IconButton } from '@ds/components/core/IconButton'
import { Input } from '@ds/components/forms/Input'
import { Textarea } from '@ds/components/forms/Textarea'
import { AppShell } from '../components/AppShell.tsx'
import { DialogViewport } from '../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { ApiError } from '../api/client.ts'
import {
  acceptPriceProposal,
  acceptRescheduleProposal,
  createPriceProposal,
  createRescheduleProposal,
  getApplicationChatStatus,
  getInbox,
  getMessages,
  pinMessage,
  reactToMessage,
  recallMessage,
  rejectPriceProposal,
  rejectRescheduleProposal,
  sendAttachmentMessage,
  sendTextMessage,
  unpinMessage,
  withdrawPriceProposal,
  withdrawRescheduleProposal,
} from '../api/chat.ts'
import type { ChatApplicationStatusResponse, ChatInboxItemResponse, ChatMessageResponse, ChatMessageType, InboxTab } from '../api/chat.ts'
import {
  applyFromInquiry,
  approveExtraCostBatch,
  confirmApplication,
  getExtraCostSummary,
  getMyApplications,
  getTask,
  reconfirmApplication,
  rejectApplication,
  rejectExtraCostBatch,
  submitExtraCostBatch,
  topUpExtraCostEscrow,
  withdrawApplication,
  withdrawExtraCostBatch,
} from '../api/tasks.ts'
import type {
  ExtraCostItemInput,
  ExtraCostMoneySummaryResponse,
  MyApplicationResponse,
  PaymentMethod,
  TaskApplicationStatus,
  TaskResponse,
  TaskStatus,
} from '../api/tasks.ts'
import { uploadExtraCostImage } from '../features/tasks/extraCostImageUpload.ts'
import { ExtraCostBreakdownCard } from '../features/tasks/components/ExtraCostBreakdownCard.tsx'
import { formatChatTime, formatVnd } from '../features/chat/chatFormat.ts'
import { uploadChatAttachments, validateAttachmentSelection } from '../features/chat/attachmentUpload.ts'
import { getSystemParameters, type SystemParametersResponse } from '../api/systemParameters.ts'
import { buildScheduledAtIso, splitScheduledAt, tomorrowDateString } from '../utils/taskForm.ts'
import { TimeSelect } from '../components/TimeSelect.tsx'
import { TaskDetailDialog } from './MyTasksPage.tsx'
import { ApplicationDetailDialog } from './TaskerJobsPage.tsx'
import { ConfirmDialog } from './TaskCandidatesPage.tsx'
import { ChatMessageBubble } from '../features/chat/components/ChatMessageBubble.tsx'
import { EmojiPickerDialog } from '../features/chat/components/EmojiPickerDialog.tsx'
import { ExtraCostBatchCard } from '../features/chat/components/ExtraCostBatchCard.tsx'
import { PinnedMessagesBar } from '../features/chat/components/PinnedMessagesBar.tsx'
import { PriceHistoryPanel } from '../features/chat/components/PriceHistoryPanel.tsx'
import { PriceProposalCard } from '../features/chat/components/PriceProposalCard.tsx'
import { ReplyComposerBar } from '../features/chat/components/ReplyComposerBar.tsx'
import { RescheduleProposalCard } from '../features/chat/components/RescheduleProposalCard.tsx'
import { SystemMessageRow } from '../features/chat/components/SystemMessageRow.tsx'
import { TaskEditDiffDialog } from '../features/tasks/components/TaskEditDiffDialog.tsx'
import { TimeChangeReconfirmCard } from '../features/chat/components/TimeChangeReconfirmCard.tsx'
import { VoiceRecorderButton } from '../features/chat/components/VoiceRecorderButton.tsx'
import { useChatSocket } from '../features/chat/useChatSocket.ts'

// LAP LAI dung ChatSystemMessages.TASK_TIME_CHANGED_NEEDS_RECONFIRM (BE) - dung de nhan dien
// dung SYSTEM message nao can nang cap thanh TimeChangeReconfirmCard thay vi SystemMessageRow
// phang (khong dua vao refTaskEditId don thuan vi TASK_UPDATED_BY_POSTER cung mang field nay).
// Sua dong bo neu doi copy o backend, cung nguyen tac voi CLOSED_REASON_LABEL o duoi.
const TIME_CHANGE_RECONFIRM_BODY = 'Poster vừa đổi thời gian mong muốn. Hãy xác nhận lại nếu bạn vẫn nhận việc này.'

// Mac dinh khi chua tai xong /system-parameters (hoac loi mang) - khop dung gia tri seed cua
// "chat_voice_max_duration_seconds" trong V42, chi dung tam thoi de VoiceRecorderButton co
// nguong hop ly ngay ca khi chua fetch xong, khong phai hardcode business rule (gia tri that
// van doc tu API, day chi la fallback hien thi).
const DEFAULT_VOICE_MAX_DURATION_SECONDS = 300

// 4 tab dung dinh nghia InboxTab.java (Round B2) - nhan tieng Viet chinh thuc.
const TAB_CONFIG: { value: InboxTab; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NEEDS_RESPONSE', label: 'Cần phản hồi' },
  // Nhan dung nguyen tu Javadoc InboxTab.java: "Tat ca / Can phan hoi / Dang thuc hien / Da dong".
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'CLOSED', label: 'Đã đóng' },
]

// Nhan badge cu the cho tung ly do dong kenh (thay the nhan "Da dong" chung chung) - suy tu
// applicationStatus tai thoi diem xem, chi co y nghia khi item.status === 'CLOSED'. Chi liet
// ke dung 5 gia tri THAT SU dan toi dong kenh hien nay (xem cac loi goi closeChannelIfExists()
// trong TaskApplicationService.java: withdraw/declineInvite/sweepExpiredInvites/confirm-cascade/
// reject). Cac gia tri con lai (PENDING/ACCEPTED/NEEDS_RECONFIRM/INQUIRING/INVITED) khong bao
// gio xuat hien tren 1 channel CLOSED trong code hien tai - neu lo xuat hien (vd sau nay co
// them duong dong channel khac, nhu task COMPLETED qua booking that) thi roi ve nhan chung
// "Da dong" mac dinh thay vi bao loi, xem closedReasonLabel().
const CLOSED_REASON_LABEL: Partial<Record<TaskApplicationStatus, string>> = {
  WITHDRAWN: 'Đã rút ứng tuyển',
  DECLINED: 'Đã từ chối lời mời',
  REJECTED: 'Đã từ chối ứng viên',
  REJECTED_AUTO: 'Đã giao cho người khác',
  INVITE_EXPIRED: 'Lời mời đã hết hạn',
  // Them cho UC07 (Poster huy ca cong viec).
  CANCELLED: 'Công việc đã bị huỷ',
}

// LAP LAI dung ChatService.CHAT_TERMINAL_APPLICATION_STATUSES (BE) - dung ca cho preemptive
// check khi CHUA co kenh chat (xem noChannelStatus/preemptiveBlocked ben duoi), khong chi cho
// badge cua channel da CLOSED.
const TERMINAL_APPLICATION_STATUSES: TaskApplicationStatus[] = [
  'WITHDRAWN', 'REJECTED', 'REJECTED_AUTO', 'DECLINED', 'INVITE_EXPIRED', 'CANCELLED',
]

/**
 * Nhan hien cho 1 hoi thoai khong the chat duoc nua - uu tien taskStatus (Admin tu choi CA cong
 * viec qua hau kiem, xem TaskService.rejectFlaggedTask) truoc applicationStatus (tu choi/rut ung
 * tuyen o cap TUNG don), vi taskStatus REJECTED khong lam doi applicationStatus cua don (xem
 * Javadoc TaskApplicationParties.taskStatus, BE).
 */
function closedReasonLabel(applicationStatus: TaskApplicationStatus, taskStatus?: TaskStatus): string {
  // Rut gon "Quan tri vien" -> "QTV" rieng cho nhan badge nay (khac Alert o composer, van
  // dung nguyen chu day du) - badge cha (ThreadListItem/header) khong du rong cho ca cau,
  // bi tran/che mat chu (bao cao nguoi dung 2026-09-22).
  if (taskStatus === 'REJECTED') return 'QTV đã từ chối công việc này'
  return CLOSED_REASON_LABEL[applicationStatus] ?? 'Đã đóng'
}

/**
 * Loc 1 item theo 1 tab - LAP LAI dung logic matchesTab() cua ChatService.java (backend) o
 * phia client. Chi goi getInbox('ALL') MOT LAN roi loc ca 4 tab tu chinh danh sach do (thay vi
 * goi rieng 4 request) - dung duoc vi tab ALL la superset cua ca 3 tab con lai va moi item da
 * mang du needsResponse/hasBooking/status de tinh lai chinh xac, khong can hoi lai server.
 * SUA 2026-09-22: IN_PROGRESS truoc day la "OPEN va khong can phan hoi ngay" - nghia la 1 kenh
 * dang thuong luong (chua ai duoc chon, chua co booking), vua tra loi xong va dang cho doi
 * phuong, se nhay nham vao day. Doi sang dung hasBooking (chi that khi Poster da "Chon nguoi
 * nay" o UC11) - kenh OPEN, khong can phan hoi, CHUA co booking gio khong khop tab rieng nao,
 * chi con nam o tab ALL, dung theo yeu cau nguoi dung (khong tu suy dien).
 */
function matchesTab(tab: InboxTab, item: ChatInboxItemResponse): boolean {
  switch (tab) {
    case 'ALL': return true
    case 'NEEDS_RESPONSE': return item.needsResponse
    case 'IN_PROGRESS': return item.status === 'OPEN' && item.hasBooking
    case 'CLOSED': return item.status === 'CLOSED'
  }
}

/** Gop 1 tin nhan moi/cap nhat vao danh sach hien co - thay the neu trung id (WS co the ban lai dung message da co), sap lai theo thoi gian. */
function mergeMessage(list: ChatMessageResponse[], incoming: ChatMessageResponse): ChatMessageResponse[] {
  const index = list.findIndex((m) => m.id === incoming.id)
  const next = index >= 0 ? [...list.slice(0, index), incoming, ...list.slice(index + 1)] : [...list, incoming]
  return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

interface TaskContextSummary {
  title: string
  addressText: string
  scheduledAt: string | null
  budgetAmount: number | null
  categoryName: string
}

// Nguon du lieu day du de mo lai dung modal "Xem chi tiet" da co san o MyTasksPage.tsx (Poster)/
// TaskerJobsPage.tsx (Tasker) - khong tao modal rieng cho Chat, tai su dung nguyen 2 dialog do
// (bao gom ca ApplicantsPanel trong TaskDetailDialog cho Poster) vi cung 1 nghiep vu "xem chi
// tiet cong viec", tranh viet trung logic hien thi lan 2.
type ChatTaskDetailSource =
  | { role: 'POSTER'; task: TaskResponse }
  | { role: 'TASKER'; application: MyApplicationResponse }

/**
 * Ten/avatar doi phuong duoc cac man khac (danh sach ung vien, viec da nhan...) truyen kem qua
 * navigate(..., { state }) luc dieu huong toi day - CHI dung de hien tam o header khi cuoc tro
 * chuyen CHUA co kenh that (selectedItem null vi chua co tin nhan nao, xem selectedItem ben
 * duoi). Khong thay the du lieu that: ngay khi ChatInboxItemResponse ve (co kenh that), header
 * luon uu tien selectedItem, hint nay chi la fallback hien thi, khong dung o logic nghiep vu nao.
 */
interface ChatContactHint {
  counterpartName?: string | null
  counterpartAvatarUrl?: string | null
}

/**
 * Lay thong tin cong viec de hien o rail phai - khong co endpoint "chi tiet 1 application" dung
 * chung 2 vai tro, nen tai su dung 2 nguon da co san theo dung quyen cua tung vai tro: Poster
 * goi GET /tasks/{id} (chi chu task xem duoc, dung boi vi viewerRole=POSTER nghia la chinh
 * minh la chu), Tasker doc lai tu getMyApplications() (danh sach don cua chinh minh, da co san
 * day du field cong viec).
 */
async function loadTaskContext(item: ChatInboxItemResponse): Promise<{ summary: TaskContextSummary; detailSource: ChatTaskDetailSource } | null> {
  if (item.viewerRole === 'POSTER') {
    const task = await getTask(item.taskId)
    return {
      summary: { title: task.title, addressText: task.addressText, scheduledAt: task.scheduledAt, budgetAmount: task.budgetAmount, categoryName: task.categoryName },
      detailSource: { role: 'POSTER', task },
    }
  }
  const mine = await getMyApplications()
  const match = mine.find((a) => a.taskId === item.taskId)
  return match
    ? {
        summary: { title: match.taskTitle, addressText: match.taskAddressText, scheduledAt: match.taskScheduledAt, budgetAmount: match.taskBudgetAmount, categoryName: match.categoryName },
        detailSource: { role: 'TASKER', application: match },
      }
    : null
}

/** "Thứ 5, 14:00" - dung chung mau voi MyTasksPage.tsx/TaskerJobsPage.tsx. */
function formatWeekdayTime(iso: string) {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

// Nguong de xuat gia - khop dung @Min/@Max cua CreatePriceProposalRequest.java (BE), cung
// nguong da chot voi budgetAmount (PostTaskPage.tsx). O nhap nhan don vi NGHIN dong.
const PROPOSAL_MIN_THOUSAND = 100
const PROPOSAL_MAX_THOUSAND = 50_000

// Nguong moi khoan "Chi phi phat sinh" - khop dung @Min/@Max cua ExtraCostItemInput.java (BE),
// chot cung nguoi dung 2026-10-03. O nhap nhan don vi NGHIN dong, cung quy uoc voi o Ngan sach
// (PostTaskPage.tsx) va o De xuat gia (PriceProposalDialog o tren).
const EXTRA_COST_ITEM_MIN_THOUSAND = 10
const EXTRA_COST_ITEM_MAX_THOUSAND = 10_000
const AMOUNT_RANGE_MESSAGE = `Số tiền mỗi khoản phải từ ${formatVnd(EXTRA_COST_ITEM_MIN_THOUSAND * 1000)} đến ${formatVnd(EXTRA_COST_ITEM_MAX_THOUSAND * 1000)}.`

interface PriceProposalDialogProps {
  busy: boolean
  onClose: () => void
  onSubmit: (amount: number, note: string) => void
}

/** Modal "Đề xuất giá" mo tu composer - nhap theo don vi nghin dong, cung quy uoc voi o Ngan sach o PostTaskPage.tsx. */
function PriceProposalDialog({ busy, onClose, onSubmit }: PriceProposalDialogProps) {
  useLockBodyScroll(true)
  const [amountThousand, setAmountThousand] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const value = Number(amountThousand)
    if (!amountThousand.trim() || Number.isNaN(value) || value < PROPOSAL_MIN_THOUSAND || value > PROPOSAL_MAX_THOUSAND) {
      setError(`Mức giá phải từ ${(PROPOSAL_MIN_THOUSAND * 1000).toLocaleString('vi-VN')} ₫ đến ${(PROPOSAL_MAX_THOUSAND * 1000).toLocaleString('vi-VN')} ₫.`)
      return
    }
    onSubmit(value * 1000, note.trim())
  }

  return (
    <DialogViewport>
      <Dialog title="Đề xuất giá" subtitle="Đề xuất này hiện ngay trong hội thoại và vào lịch sử giá của việc" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <Field label="Mức bạn đề nghị" required error={error} hint={amountThousand ? formatVnd(Number(amountThousand) * 1000) : undefined}>
            <Input
              numeric inputMode="numeric" suffix="nghìn đ"
              value={amountThousand}
              onChange={(e) => { setAmountThousand(e.target.value.replace(/\D/g, '')); setError('') }}
              disabled={busy}
              error={!!error}
            />
          </Field>
          <Field label="Lời nhắn" hint="Giải thích lý do mức giá này, đối phương sẽ thấy ngay trong hội thoại.">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </Field>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Huỷ</Button>
            <Button icon="hand-coins" onClick={handleSubmit} disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi đề xuất'}
            </Button>
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}

interface RescheduleProposalDialogProps {
  busy: boolean
  onClose: () => void
  onSubmit: (proposedTimeIso: string, note: string) => void
}

/**
 * Modal "Đề xuất đổi lịch" mo tu composer - chi hien khi task da ASSIGNED (ca 2 phia deu de
 * xuat duoc, khac UC07 Tang 3 chi Poster sua truoc khi ASSIGNED). Dung chung cap ngay/gio +
 * splitScheduledAt/buildScheduledAtIso voi EditTaskDialog.tsx (UC07) de khong lech quy uoc
 * dinh dang. proposedTime phai o tuong lai (khop @Future tren CreateRescheduleProposalRequest).
 */
function RescheduleProposalDialog({ busy, onClose, onSubmit }: RescheduleProposalDialogProps) {
  useLockBodyScroll(true)
  const [date, setDate] = useState('')
  const [time, setTime] = useState(splitScheduledAt(undefined).time)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!date) {
      setError('Chọn ngày muốn đổi sang.')
      return
    }
    const iso = buildScheduledAtIso(date, time)
    if (!iso || new Date(iso).getTime() <= Date.now()) {
      setError('Thời gian mới phải ở tương lai.')
      return
    }
    onSubmit(iso, note.trim())
  }

  return (
    <DialogViewport>
      <Dialog title="Đề xuất đổi lịch" subtitle="Đối phương sẽ thấy đề xuất này ngay trong hội thoại và có thể đồng ý hoặc từ chối" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <Field label="Thời gian mới" required error={error}>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="date"
                min={tomorrowDateString()}
                value={date}
                onChange={(e) => { setDate(e.target.value); setError('') }}
                disabled={busy}
                error={!!error}
                style={{ maxWidth: 200 }}
              />
              <TimeSelect value={time} onChange={setTime} disabled={busy || !date} />
            </div>
          </Field>
          <Field label="Lời nhắn" hint="Giải thích lý do đổi lịch, đối phương sẽ thấy ngay trong hội thoại.">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </Field>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Huỷ</Button>
            <Button icon="calendar-clock" onClick={handleSubmit} disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi đề xuất'}
            </Button>
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}

interface ExtraCostRow {
  name: string
  amount: string
  photoUrl?: string
  uploading: boolean
}

interface ExtraCostDialogProps {
  applicationId: string
  busy: boolean
  onClose: () => void
  onSubmit: (note: string | undefined, items: ExtraCostItemInput[]) => void
}

/**
 * Modal "Chi phí phát sinh" (quyet dinh nguoi dung 2026-10-02) - CHI Tasker thay nut nay (thay
 * "Đề xuất giá" sau khi ASSIGNED + FULL_ESCROW, xem composer action row). Khac PriceProposalDialog
 * o cho cho phep gom NHIEU khoan trong 1 lan dang (moi khoan: ten + so tien bat buoc, anh tuy
 * chon qua uploadExtraCostImage) - mot batch gui 1 lan, khong sua tung khoan sau khi da dang (chi
 * Thu hoi ca batch roi dang lai, xem Javadoc BE TaskExtraCostBatch).
 */
function ExtraCostDialog({ applicationId, busy, onClose, onSubmit }: ExtraCostDialogProps) {
  useLockBodyScroll(true)
  const [rows, setRows] = useState<ExtraCostRow[]>([{ name: '', amount: '', photoUrl: undefined, uploading: false }])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [uploadRowIndex, setUploadRowIndex] = useState<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const updateRow = (index: number, patch: Partial<ExtraCostRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  const addRow = () => setRows((prev) => [...prev, { name: '', amount: '', photoUrl: undefined, uploading: false }])
  const removeRow = (index: number) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const handlePickPhoto = (index: number) => {
    setUploadRowIndex(index)
    photoInputRef.current?.click()
  }

  const handlePhotoSelected = (file: File | undefined) => {
    if (!file || uploadRowIndex == null) return
    const index = uploadRowIndex
    updateRow(index, { uploading: true })
    uploadExtraCostImage(applicationId, file)
      .then((photoUrl) => updateRow(index, { photoUrl, uploading: false }))
      .catch(() => {
        updateRow(index, { uploading: false })
        useToastStore.getState().pushToast('danger', 'Tải ảnh lên thất bại, thử lại sau.')
      })
  }

  const handleSubmit = () => {
    const items: ExtraCostItemInput[] = []
    for (const row of rows) {
      const amountThousand = Number(row.amount)
      if (!row.name.trim()) {
        setError('Mỗi khoản cần có tên.')
        return
      }
      if (!row.amount.trim() || Number.isNaN(amountThousand)
        || amountThousand < EXTRA_COST_ITEM_MIN_THOUSAND || amountThousand > EXTRA_COST_ITEM_MAX_THOUSAND) {
        setError(AMOUNT_RANGE_MESSAGE)
        return
      }
      items.push({ name: row.name.trim(), amount: amountThousand * 1000, photoUrl: row.photoUrl })
    }
    onSubmit(note.trim() || undefined, items)
  }

  // True khi da nhap mot gia tri (khac rong) nhung ngoai khoang 10.000 d - 10.000.000 d - rong
  // chua tinh la sai (chua go gi thi khong bao do), de khop dung yeu cau "nhap vao thi bao do
  // ngay, khong doi den luc bam Gui" (nguoi dung 2026-10-03).
  const isAmountOutOfRange = (amount: string) => {
    if (!amount.trim()) return false
    const n = Number(amount)
    return Number.isNaN(n) || n < EXTRA_COST_ITEM_MIN_THOUSAND || n > EXTRA_COST_ITEM_MAX_THOUSAND
  }
  const hasOutOfRangeRow = rows.some((row) => isAmountOutOfRange(row.amount))

  return (
    <DialogViewport>
      <Dialog
        title="Chi phí phát sinh"
        subtitle="Ghi lại khoản bạn đã ứng trước mua vật tư hoặc công làm phát sinh — Poster xem và duyệt ngay trong hội thoại"
        onClose={onClose}
        footer={
          <div className="flex gap-3 justify-end" style={{ width: '100%' }}>
            <Button variant="secondary" onClick={onClose} disabled={busy}>Huỷ</Button>
            <Button icon="receipt" onClick={handleSubmit} disabled={busy || hasOutOfRangeRow}>
              {busy ? 'Đang gửi…' : 'Đăng chi phí phát sinh'}
            </Button>
          </div>
        }
      >
        {/* Noi dung co the dai (nhieu khoan) - gioi han chieu cao va cho cuon rieng, tranh dialog
            cao qua man hinh che mat tieu de/nut hanh dong (nguoi dung bao cao 2026-10-03). Nut
            Huy/Dang chuyen sang footer cua Dialog de luon co dinh, thay vi cuon theo noi dung. */}
        <div className="flex flex-col gap-4" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 'var(--sp-1)' }}>
          {rows.map((row, index) => (
            <div key={index} className="flex flex-col gap-3" style={{ border: 'var(--bw) solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <Field label="Tên khoản" required>
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      disabled={busy}
                      placeholder="Vd: Cụm vòi rửa gắn tường mới"
                    />
                  </Field>
                </div>
                {rows.length > 1 && (
                  <IconButton
                    icon="trash-2" label="Xoá khoản" title="Xoá khoản" size="sm" variant="ghost"
                    onClick={() => removeRow(index)} disabled={busy}
                    style={{ marginTop: 26, color: 'var(--danger)' }}
                  />
                )}
              </div>
              <Field
                label="Số tiền" required
                error={isAmountOutOfRange(row.amount) ? AMOUNT_RANGE_MESSAGE : undefined}
                hint={!isAmountOutOfRange(row.amount) && row.amount ? formatVnd(Number(row.amount) * 1000) : undefined}
              >
                <Input
                  numeric inputMode="numeric" suffix="nghìn đ"
                  value={row.amount}
                  onChange={(e) => updateRow(index, { amount: e.target.value.replace(/\D/g, '') })}
                  disabled={busy}
                  error={isAmountOutOfRange(row.amount)}
                />
              </Field>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary" icon="image" onClick={() => handlePickPhoto(index)}
                  disabled={busy || row.uploading}
                >
                  {row.uploading ? 'Đang tải ảnh…' : row.photoUrl ? 'Đổi ảnh' : 'Thêm ảnh minh chứng (tuỳ chọn)'}
                </Button>
                {row.photoUrl && !row.uploading && <Badge tone="success" icon="check">Đã đính kèm ảnh</Badge>}
              </div>
            </div>
          ))}
          {error && <Alert tone="danger" title="Thiếu thông tin">{error}</Alert>}
          <Button variant="ghost" icon="plus" onClick={addRow} disabled={busy} style={{ border: 'var(--bw) solid var(--border)' }}>
            Thêm khoản
          </Button>
          <Field label="Ghi chú chung" hint="Giải thích lý do phát sinh, Poster sẽ thấy ngay trong hội thoại.">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
          </Field>
        </div>
        <input
          ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
          onChange={(e) => { handlePhotoSelected(e.target.files?.[0]); e.target.value = '' }}
        />
      </Dialog>
    </DialogViewport>
  )
}

interface ThreadListItemProps {
  item: ChatInboxItemResponse
  active: boolean
  onSelect: () => void
}

/** Mot dong hoi thoai trong hop thu ben trai - bo cuc theo file thiet ke tham khao "Tin nhắn & chốt giá". */
function ThreadListItem({ item, active, onSelect }: ThreadListItemProps) {
  return (
    <div
      onClick={onSelect}
      className="flex gap-3"
      style={{
        padding: 'var(--sp-4)',
        borderBottom: 'var(--bw-hair) solid var(--border-subtle)',
        borderLeft: active ? 'var(--bw) solid var(--brand)' : 'var(--bw) solid transparent',
        background: active ? 'var(--bg-section)' : 'transparent',
        cursor: 'pointer',
        opacity: item.status === 'CLOSED' ? 0.72 : 1,
      }}
    >
      <Avatar name={item.counterpartName ?? 'Người dùng'} src={item.counterpartAvatarUrl ?? undefined} size={40} />
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="flex items-baseline gap-2">
          <strong style={{ fontSize: 'var(--fs-body)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.counterpartName ?? 'Người dùng'}
          </strong>
          <span className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{formatChatTime(item.lastMessageAt)}</span>
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--teal-700)', fontWeight: 'var(--fw-semibold)', display: 'block' }}>
          {item.taskTitle}
        </span>
        {item.lastMessagePreview && (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.lastMessagePreview}
          </span>
        )}
        <div className="flex flex-wrap gap-2" style={{ marginTop: 6 }}>
          {/* Khi kenh da CLOSED, applicationStatus (vd REJECTED_AUTO/WITHDRAWN) khong con phan
              biet duoc "tung la INQUIRING" hay "tung la don ung tuyen that" - BE cascade ca hai
              ve chung 1 gia tri terminal khi Poster chon xong nguoi thang (xem
              isCascadeEligible() trong TaskApplicationService.java), nen "Bạn ứng tuyển" luc do
              co the sai (bao cao nguoi dung 2026-09-28). Chi con dang OPEN moi con doc duoc dung
              tu applicationStatus - CLOSED thi bo qua badge nay, de closedReasonLabel ben duoi
              tu giai thich ly do dong (van dung cho ca 2 truong hop). */}
          {(item.viewerRole === 'POSTER' || item.status === 'OPEN') && (
            <Badge tone={item.viewerRole === 'POSTER' ? 'brand' : 'neutral'}>
              {item.viewerRole === 'POSTER'
                ? 'Bạn là người đăng'
                : item.applicationStatus === 'INQUIRING' ? 'Đang hỏi thêm' : 'Bạn ứng tuyển'}
            </Badge>
          )}
          {item.needsResponse && <Badge tone="money">Cần phản hồi</Badge>}
          {item.status === 'CLOSED' && <Badge tone="neutral" icon="lock">{closedReasonLabel(item.applicationStatus, item.taskStatus)}</Badge>}
        </div>
      </div>
    </div>
  )
}

/**
 * Man "Tin nhắn & chốt giá" - Inbox 4 tab + chi tiet hoi thoai, ghep chung 1 trang (khac 2
 * file rieng InboxPage/ChatPage trong ke hoach ban dau) vi thiet ke tham khao giu danh sach
 * hoi thoai va khung chat CUNG luc tren man hinh (giong Messenger/Slack), tach thanh 2 route
 * rieng se phai nhan doi cot danh sach - route "/tin-nhan/:applicationId" chi doi phan giua/phai,
 * cot trai luon con nguyen. Ket noi STOMP that (useChatSocket) song suot vong doi trang, khong
 * polling. UC16.
 */
export function InboxPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { applicationId: selectedApplicationId } = useParams<{ applicationId?: string }>()
  const contactHint = (location.state as ChatContactHint | null) ?? null
  const accountId = useAuthStore((state) => state.session?.account.id) ?? ''

  const [tab, setTab] = useState<InboxTab>('ALL')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ChatInboxItemResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')

  const [messages, setMessages] = useState<ChatMessageResponse[] | null>(null)
  const [messagesError, setMessagesError] = useState('')
  // Id cua 1 SYSTEM message (UC07) dang mo dialog "Xem chi tiết thay đổi" - null nghia la dong.
  const [taskEditMessageId, setTaskEditMessageId] = useState<string | null>(null)
  // Trang thai application/task cho 1 cuoc tro chuyen CHUA nam trong Inbox (selectedItem null vi
  // kenh chat chua tung duoc lazy-create) - dung de biet truoc co nen chan bat dau hoi thoai hay
  // khong (xem preemptiveBlocked ben duoi), thay vi de nguoi dung tu gui roi moi bao loi toast.
  const [noChannelStatus, setNoChannelStatus] = useState<ChatApplicationStatusResponse | null>(null)
  const [taskContext, setTaskContext] = useState<TaskContextSummary | null>(null)
  const [taskDetailSource, setTaskDetailSource] = useState<ChatTaskDetailSource | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null)
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [proposalSubmitting, setProposalSubmitting] = useState(false)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [composerActionBusy, setComposerActionBusy] = useState(false)
  const [posterConfirmOpen, setPosterConfirmOpen] = useState(false)
  // Chi phi phat sinh (quyet dinh nguoi dung 2026-10-02) - summary tai lai moi khi doi hoi thoai
  // VA chi khi paymentMethod cua booking la FULL_ESCROW (xem useEffect ben duoi), null nghia la
  // chua tai/khong ap dung cho hoi thoai dang mo.
  const [extraCostDialogOpen, setExtraCostDialogOpen] = useState(false)
  const [extraCostSubmitting, setExtraCostSubmitting] = useState(false)
  const [extraCostSummary, setExtraCostSummary] = useState<ExtraCostMoneySummaryResponse | null>(null)
  const [extraCostActionBusyId, setExtraCostActionBusyId] = useState<string | null>(null)

  // Them 2026-09-26: tra loi (quote), thu hoi/tha cam xuc/ghim, va gui anh/video/file dinh kem.
  const [replyTarget, setReplyTarget] = useState<ChatMessageResponse | null>(null)
  const [messageActionBusyId, setMessageActionBusyId] = useState<string | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [composerEmojiPickerOpen, setComposerEmojiPickerOpen] = useState(false)
  // Ngan ghi am toi da (giay) - doc tu /system-parameters, dung fallback tam thoi khi chua tai
  // xong (xem DEFAULT_VOICE_MAX_DURATION_SECONDS).
  const [voiceMaxDurationSeconds, setVoiceMaxDurationSeconds] = useState(DEFAULT_VOICE_MAX_DURATION_SECONDS)
  // Toan bo nguong /system-parameters (them 2026-09-26) - dung de chan phia client TRUOC khi
  // upload anh/video/file/voice vuot gioi han, xem validateAttachmentSelection(). null cho den
  // khi tai xong, luc do BE van la nguon that su (khong chan nham).
  const [attachmentLimitParams, setAttachmentLimitParams] = useState<SystemParametersResponse | null>(null)
  const imageOrVideoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedItem = useMemo(
    () => items?.find((item) => item.applicationId === selectedApplicationId) ?? null,
    [items, selectedApplicationId],
  )

  const refreshInbox = () => {
    getInbox('ALL')
      .then(setItems)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách hội thoại.'))
  }

  useEffect(refreshInbox, [])

  // Tai 1 lan luc vao trang - dung cho nguong ghi am (VoiceRecorderButton) va chan phia client
  // truoc khi upload anh/video/file/voice vuot gioi han (validateAttachmentSelection).
  useEffect(() => {
    getSystemParameters()
      .then((params) => {
        setVoiceMaxDurationSeconds(params.chatVoiceMaxDurationSeconds)
        setAttachmentLimitParams(params)
      })
      .catch(() => { /* giu fallback DEFAULT_VOICE_MAX_DURATION_SECONDS, attachmentLimitParams=null neu tai loi */ })
  }, [])

  const refreshMessages = (applicationId: string) => {
    getMessages(applicationId)
      .then(setMessages)
      .catch((error) => setMessagesError(error instanceof ApiError ? error.message : 'Không tải được nội dung hội thoại.'))
  }

  useEffect(() => {
    setMessages(null)
    setMessagesError('')
    setTaskContext(null)
    setTaskDetailSource(null)
    setExtraCostSummary(null)
    if (selectedApplicationId) refreshMessages(selectedApplicationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplicationId])

  /**
   * Tong hop "Tien cua viec nay" phan chi phi phat sinh (quyet dinh nguoi dung 2026-10-02) - CHI
   * tai khi hoi thoai da ASSIGNED va booking chon FULL_ESCROW (API van tra duoc cho FEE_ONLY_ESCROW
   * nhung khong co y nghia hien thi, xem Javadoc BE ExtraCostMoneySummaryResponse) - tranh goi API
   * thua cho phan lon hoi thoai (OPEN/chua co booking/PA khac). Goi lai khi 2 truong dung de gate
   * (taskStatus/paymentMethod) doi, khong phai moi lan selectedItem doi tham chieu (vd
   * needsResponse/lastMessageAt doi lien tuc khi co tin nhan moi).
   */
  const refreshExtraCostSummary = () => {
    if (!selectedApplicationId || !selectedItem || selectedItem.taskStatus !== 'ASSIGNED'
      || selectedItem.paymentMethod !== 'FULL_ESCROW') {
      setExtraCostSummary(null)
      return
    }
    getExtraCostSummary(selectedApplicationId).then(setExtraCostSummary).catch(() => setExtraCostSummary(null))
  }

  useEffect(() => {
    refreshExtraCostSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplicationId, selectedItem?.taskStatus, selectedItem?.paymentMethod])

  // Chi goi khi Inbox da tai xong VA applicationId dang mo khong nam trong do (kenh chua tung
  // duoc lazy-create) - vd bam "Nhắn tin" tu 1 don PENDING chua ai gui gi, hoac tu 1 don da
  // WITHDRAWN/REJECTED/bi Admin tu choi task tu truoc ma chua ai tung chat. Neu applicationId
  // NAM TRONG items (co kenh that), selectedItem da du du lieu (channelClosed ben duoi), khong
  // can goi them.
  useEffect(() => {
    if (!selectedApplicationId || !items || selectedItem) { setNoChannelStatus(null); return }
    getApplicationChatStatus(selectedApplicationId)
      .then(setNoChannelStatus)
      .catch(() => setNoChannelStatus(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplicationId, items, selectedItem])

  const refreshTaskContext = () => {
    if (!selectedItem) return
    loadTaskContext(selectedItem)
      .then((result) => {
        setTaskContext(result?.summary ?? null)
        setTaskDetailSource(result?.detailSource ?? null)
      })
      .catch(() => { setTaskContext(null); setTaskDetailSource(null) })
  }

  useEffect(refreshTaskContext, [selectedItem])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useChatSocket({
    applicationId: selectedApplicationId ?? null,
    onMessage: (message) => {
      setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]))
      // SYSTEM message co the di kem 1 thay doi proposalStatus AM THAM tren chinh tin de xuat
      // (backend chi tra ve/publish SYSTEM message, khong publish rieng tin de xuat da doi -
      // xem ChatService.appendProposalOutcomeSystemMessage) - lam moi lai toan bo de chac chan
      // dung, thay vi doan mo ta trong noi dung SYSTEM message. Tu UC07: SYSTEM message cung co
      // the bao Poster vua sua task (gia/gio) - lam moi ca taskContext de "Thời gian mới" tren
      // TimeChangeReconfirmCard/sidebar khong bi cu neu kenh dang mo san luc Poster sua. Cung
      // theo huong nay: approve/reject/withdraw chi phi phat sinh cung chi publish 1 dong SYSTEM
      // (xem TaskExtraCostService) - phai lam moi extraCostSummary o day thi nut "Chi phí phát
      // sinh" cua Tasker (gate theo extraCostSummary?.pendingBatch) moi het bi khoa NGAY, khong
      // phai doi Tasker tu reload trang (loi nguoi dung bao 2026-10-04).
      if (message.messageType === 'SYSTEM' && selectedApplicationId) {
        refreshMessages(selectedApplicationId)
        refreshTaskContext()
        refreshExtraCostSummary()
      }
    },
    onInboxPing: refreshInbox,
  })

  const filtered = useMemo(() => {
    if (!items) return []
    const byTab = items.filter((item) => matchesTab(tab, item))
    // Tab "Tat ca" gom ca hoi thoai CLOSED lan OPEN - day CLOSED xuong duoi, OPEN nam tren.
    // Sort on dinh (Array.prototype.sort da dam bao stable) nen giu nguyen thu tu tuong doi
    // (theo lastMessageAt tu BE) ben trong tung nhom, khong xao tron them.
    const sorted = [...byTab].sort((a, b) => Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED'))
    const term = search.trim().toLowerCase()
    if (!term) return sorted
    return sorted.filter(
      (item) => item.taskTitle.toLowerCase().includes(term) || (item.counterpartName ?? '').toLowerCase().includes(term),
    )
  }, [items, tab, search])

  const tabCounts = useMemo(() => {
    const counts: Record<InboxTab, number> = { ALL: 0, NEEDS_RESPONSE: 0, IN_PROGRESS: 0, CLOSED: 0 }
    for (const item of items ?? []) {
      for (const config of TAB_CONFIG) {
        if (matchesTab(config.value, item)) counts[config.value] += 1
      }
    }
    return counts
  }, [items])

  const pendingPriceProposal = messages?.find((m) => m.messageType === 'PRICE_PROPOSAL' && m.proposalStatus === 'PROPOSED') ?? null
  const pendingRescheduleProposal = messages?.find((m) => m.messageType === 'RESCHEDULE_PROPOSAL' && m.proposalStatus === 'PROPOSED') ?? null
  // Tin nhan EXTRA_COST_BATCH dang cho duyet (neu co) - dung de cuon toi dung the trong khung
  // chat khi bam "Xem trong đoạn chat" o rail "Tiền của việc này" (nguoi dung yeu cau 2026-10-03:
  // chi phi phat sinh phai hien nhu 1 tin nhan rieng trong chat, giong het Đề xuất giá).
  const pendingExtraCostMessage = messages?.find((m) => m.messageType === 'EXTRA_COST_BATCH' && m.extraCostBatch?.status === 'PENDING') ?? null
  // UC07 Tang 3: tin SYSTEM "doi gio" GAN NHAT trong lich su - chi tin nay (neu co) moi duoc
  // hien nut "Van nhan viec" tren TimeChangeReconfirmCard, tranh hien lai nut tren 1 lan doi gio
  // CU da duoc Tasker xac nhan xong tu truoc (xem Javadoc TimeChangeReconfirmCard.tsx).
  const lastTimeChangeReconfirmMessageId = messages
    ?.filter((m) => m.messageType === 'SYSTEM' && m.body === TIME_CHANGE_RECONFIRM_BODY)
    .at(-1)?.id ?? null
  const channelClosed = selectedItem?.status === 'CLOSED'
  // Hoi thoai CHUA TUNG co kenh (selectedItem null) nhung don/task da o trang thai khong con chat
  // duoc nua - vd task vua bi Admin tu choi hau kiem truoc khi ai gui tin nhan dau tien, hoac 1
  // don da WITHDRAWN/REJECTED tu truoc ma chua ai tung nhan tin. Khac channelClosed: khong co
  // kenh vat ly nao de "dong", chi la khong duoc PHEP bat dau.
  const preemptiveBlocked = !selectedItem && noChannelStatus != null
    && (TERMINAL_APPLICATION_STATUSES.includes(noChannelStatus.applicationStatus) || noChannelStatus.taskStatus === 'REJECTED')
  const chatBlocked = channelClosed || preemptiveBlocked
  const blockedReasonLabel = channelClosed && selectedItem
    ? closedReasonLabel(selectedItem.applicationStatus, selectedItem.taskStatus)
    : preemptiveBlocked && noChannelStatus
      ? closedReasonLabel(noChannelStatus.applicationStatus, noChannelStatus.taskStatus)
      : null

  // Gia da chot cua application nay - tin PRICE_PROPOSAL ACCEPTED gan nhat trong `messages`
  // (moi application toi da 1 de xuat PROPOSED tai 1 thoi diem, xem dac ta muc 3, nen tin ACCEPTED
  // co createdAt lon nhat chinh la lan chot gan nhat, khong can field acceptedAt rieng). Doc
  // thang tu `messages` (da tu cap nhat qua WebSocket/refreshMessages() moi khi co SYSTEM message
  // moi) de rail "Tien cua viec nay" tu dong cap nhat realtime, khong can goi API rieng - truoc day
  // rail nay chi hien task.budgetAmount tinh, khong bao gio phan anh gia da Dong y qua chat
  // (nguoi dung bao cao 2026-09-21).
  const agreedPriceAmount = (messages ?? [])
    .filter((m) => m.messageType === 'PRICE_PROPOSAL' && m.proposalStatus === 'ACCEPTED')
    .reduce<ChatMessageResponse | null>(
      (latest, m) => (!latest || new Date(m.createdAt) > new Date(latest.createdAt) ? m : latest),
      null,
    )?.priceProposalAmount ?? null

  const handleSend = () => {
    if (!selectedApplicationId || !draft.trim()) return
    // Tin nhan dau tien trong 1 kenh moi lazy-create ca 1 SYSTEM message mo dau CUNG luc (BE
    // ChatService.requireOpenChannelLazyCreate) nhung sendTextMessage() chi tra ve dung message
    // TEXT vua gui, khong keo theo SYSTEM message do - append thang vao messages se thieu mat
    // dong "X da ung tuyen..." cho toi khi F5. Phat hien la tin dau tien = messages rong luc bam
    // gui, khi do goi lai refreshMessages() de lay du ca 2 dong thay vi chi append 1 dong.
    const isFirstMessage = (messages?.length ?? 0) === 0
    setSending(true)
    sendTextMessage(selectedApplicationId, draft.trim(), replyTarget?.id)
      .then((message) => {
        if (isFirstMessage) {
          refreshMessages(selectedApplicationId)
        } else {
          setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]))
        }
        setDraft('')
        setReplyTarget(null)
        refreshInbox()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Gửi tin nhắn thất bại.'))
      .finally(() => setSending(false))
  }

  /**
   * Gui 1 tin nhan IMAGE/FILE/VIDEO (them 2026-09-26): tai tuan tu tung file len S3 qua presigned
   * URL (uploadChatAttachments), roi tao tin nhan tham chieu cac file da tai xong. Cung xu ly
   * "tin dau tien trong kenh moi" nhu handleSend() (xem Javadoc isFirstMessage o do).
   */
  /**
   * Nut "Ảnh/Video" dung CHUNG 1 input (gop 2 icon lam 1 theo yeu cau nguoi dung 2026-09-26) -
   * xac dinh KIND (IMAGE hay VIDEO) tu chinh file nguoi dung vua chon, khong bat nguoi dung tu
   * chon loai truoc: toan bo file duoc chon la video -> VIDEO (toi da 1 video/lan, khop gioi han
   * da chot); co it nhat 1 anh -> IMAGE (bo qua video lan trong, tranh gui lan giua 2 loai vi
   * BE luu MOI tin nhan dinh kem la MOT loai duy nhat).
   */
  const handleImageOrVideoFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const videos = files.filter((f) => f.type.startsWith('video/'))
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (videos.length > 0 && images.length > 0) {
      useToastStore.getState().pushToast('danger', 'Không thể gửi chung ảnh và video trong 1 lần, hãy chọn riêng từng loại.')
      return
    }
    if (videos.length > 1) {
      useToastStore.getState().pushToast('danger', 'Chỉ gửi được 1 video mỗi lần.')
      return
    }
    if (videos.length === 1) {
      handleAttachmentFilesSelected('VIDEO', videos)
    } else {
      handleAttachmentFilesSelected('IMAGE', images)
    }
  }

  /** Nhan File[] (khong phai FileList nua) de dung chung duoc voi bo loc cua handleImageOrVideoFilesSelected(). */
  const handleAttachmentFilesSelected = (kind: ChatMessageType, files: File[]) => {
    if (!selectedApplicationId || files.length === 0) return
    const limitError = validateAttachmentSelection(kind, files, attachmentLimitParams)
    if (limitError) {
      useToastStore.getState().pushToast('danger', limitError)
      return
    }
    const isFirstMessage = (messages?.length ?? 0) === 0
    setAttachmentUploading(true)
    uploadChatAttachments(selectedApplicationId, kind, files)
      .then((attachments) => sendAttachmentMessage(selectedApplicationId, kind, attachments, {
        replyToMessageId: replyTarget?.id,
      }))
      .then((message) => {
        if (isFirstMessage) {
          refreshMessages(selectedApplicationId)
        } else {
          setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]))
        }
        setReplyTarget(null)
        refreshInbox()
      })
      .catch((error) => useToastStore.getState().pushToast(
        'danger',
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Gửi tệp đính kèm thất bại.',
      ))
      .finally(() => setAttachmentUploading(false))
  }

  /**
   * Hanh dong tren TUNG tin nhan (thu hoi/tha cam xuc/ghim/bo ghim, them 2026-09-26) - response
   * da la snapshot day du cua DUNG tin nhan do (khong keo theo SYSTEM message rieng nhu de xuat
   * gia/doi lich), nen merge truc tiep la du, khong can refreshMessages() toan bo nhu runProposalAction.
   */
  const runMessageAction = (messageId: string, action: Promise<ChatMessageResponse>) => {
    if (!selectedApplicationId) return
    setMessageActionBusyId(messageId)
    action
      .then((message) => setMessages((prev) => (prev ? mergeMessage(prev, message) : [message])))
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Thao tác thất bại, thử lại sau.'))
      .finally(() => {
        setMessageActionBusyId(null)
        refreshInbox()
      })
  }

  const handleRecallMessage = (messageId: string) => {
    if (!selectedApplicationId) return
    runMessageAction(messageId, recallMessage(selectedApplicationId, messageId))
  }

  const handleReactToMessage = (messageId: string, emoji: string) => {
    if (!selectedApplicationId) return
    runMessageAction(messageId, reactToMessage(selectedApplicationId, messageId, emoji))
  }

  const handlePinMessage = (messageId: string) => {
    if (!selectedApplicationId) return
    runMessageAction(messageId, pinMessage(selectedApplicationId, messageId))
  }

  const handleUnpinMessage = (messageId: string) => {
    if (!selectedApplicationId) return
    runMessageAction(messageId, unpinMessage(selectedApplicationId, messageId))
  }

  const handleCreatePriceProposal = (amount: number, note: string) => {
    if (!selectedApplicationId) return
    // Cung 1 ly do voi handleSend: de xuat gia cung co the la hanh dong DAU TIEN trong 1 kenh
    // moi (vd Poster de nghi gia ngay khi vao khung chat cua 1 don PENDING chua ai nhan tin) -
    // lazy-create keo theo 1 SYSTEM message ma createPriceProposal() khong tra ve.
    const isFirstMessage = (messages?.length ?? 0) === 0
    setProposalSubmitting(true)
    createPriceProposal(selectedApplicationId, amount, note || undefined)
      .then((message) => {
        if (isFirstMessage) {
          refreshMessages(selectedApplicationId)
        } else {
          setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]))
        }
        setProposalDialogOpen(false)
        refreshInbox()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Gửi đề xuất giá thất bại.'))
      .finally(() => setProposalSubmitting(false))
  }

  /** Cung mau voi handleCreatePriceProposal - de xuat doi lich cung co the la hanh dong dau tien trong 1 kenh moi. */
  const handleCreateRescheduleProposal = (proposedTimeIso: string, note: string) => {
    if (!selectedApplicationId) return
    const isFirstMessage = (messages?.length ?? 0) === 0
    setRescheduleSubmitting(true)
    createRescheduleProposal(selectedApplicationId, proposedTimeIso, note || undefined)
      .then((message) => {
        if (isFirstMessage) {
          refreshMessages(selectedApplicationId)
        } else {
          setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]))
        }
        setRescheduleDialogOpen(false)
        refreshInbox()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Gửi đề xuất đổi lịch thất bại.'))
      .finally(() => setRescheduleSubmitting(false))
  }

  /** Dung chung cho ca 6 hanh dong Dong y/Tu choi/Thu hoi cua ca 2 loai de xuat - server chi tra ve SYSTEM message ket qua (khong tra ve tin de xuat da doi trang thai), nen luon lam moi lai toan bo danh sach tin nhan sau khi thanh cong thay vi tu suy doan cap nhat cuc bo. */
  const runProposalAction = (messageId: string, action: Promise<ChatMessageResponse>) => {
    if (!selectedApplicationId) return
    setProposalBusyId(messageId)
    action
      .then(() => refreshMessages(selectedApplicationId))
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Thao tác thất bại, thử lại sau.'))
      .finally(() => {
        setProposalBusyId(null)
        refreshInbox()
      })
  }

  /**
   * Dung chung cho 4 hanh dong ap dung tren CA DON ung tuyen (khac runProposalAction - hanh
   * dong tren 1 tin de xuat cu the): rut ung tuyen, ung tuyen tu INQUIRING, tu choi ung vien,
   * chon ung vien - dat thanh 1 hang nut nho phia tren o nhap chat (2026-09-22), doi ung dung 4
   * nut da co san tren CandidateCard (TaskCandidatesPage.tsx, phia Poster) va ApplicationRow
   * (TaskerJobsPage.tsx, phia Tasker) de nguoi dung khong phai roi khung chat ve lai danh sach
   * moi thao tac duoc. Luon lam moi ca inbox (doi status/badge dong kenh) va tin nhan (SYSTEM
   * message ket qua) sau khi thanh cong - da co WS realtime rieng (xem PROGRESS-CHAT-MODULE.md
   * 2026-09-22) nhung van refetch de chac chan dung ngay ca khi WS tre.
   */
  const runApplicationAction = (
    action: Promise<unknown>,
    successMessage: string,
    failMessage: string,
    onSuccess?: () => void,
  ) => {
    setComposerActionBusy(true)
    action
      .then(() => {
        useToastStore.getState().pushToast('success', successMessage)
        refreshInbox()
        if (selectedApplicationId) refreshMessages(selectedApplicationId)
        onSuccess?.()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : failMessage))
      .finally(() => setComposerActionBusy(false))
  }

  const handleWithdraw = () => {
    if (!selectedItem) return
    runApplicationAction(
      withdrawApplication(selectedItem.taskId, selectedItem.applicationId),
      'Đã rút ứng tuyển.',
      'Rút ứng tuyển thất bại, thử lại sau.',
    )
  }

  // UC07 Tang 3: Poster doi thoi gian mong muon luc don dang PENDING - don treo o
  // TIME_CHANGED_NEEDS_RECONFIRM cho toi khi Tasker bam "Van nhan viec" (tro ve PENDING).
  // Cung 1 API voi nut cung ten tren TaskerJobsPage.tsx, chi khac diem goi (tu trong chat).
  const handleReconfirm = () => {
    if (!selectedItem) return
    runApplicationAction(
      reconfirmApplication(selectedItem.taskId, selectedItem.applicationId),
      'Đã xác nhận lại, bạn vẫn nhận việc này.',
      'Xác nhận thất bại, thử lại sau.',
    )
  }

  const handleApplyFromInquiry = () => {
    if (!selectedItem) return
    runApplicationAction(
      applyFromInquiry(selectedItem.taskId, selectedItem.applicationId),
      'Đã gửi ứng tuyển.',
      'Gửi ứng tuyển thất bại, thử lại sau.',
    )
  }

  const handleRejectCandidate = () => {
    if (!selectedItem) return
    runApplicationAction(
      rejectApplication(selectedItem.taskId, selectedItem.applicationId),
      'Đã từ chối ứng viên này.',
      'Từ chối thất bại, thử lại sau.',
    )
  }

  // Nut "Chon nguoi nay" van hien (khong an) khi bi chan boi 1 trong 3 dieu kien cua
  // canConfirmFromChat, nhung truoc day disabled im lang khong phan hoi gi - gay hoang mang
  // (bao cao nguoi dung 2026-10-02). Gio nut luon bam duoc (tru luc composerActionBusy), bam
  // vao khi dang bi chan se bao toast dung ly do thay vi khong lam gi.
  const handlePosterSelectClick = () => {
    if (canConfirmFromChat) {
      setPosterConfirmOpen(true)
      return
    }
    const message = posterFeeBase == null
      ? 'Chưa có mức giá nào được chốt — thương lượng qua chat trước khi chọn người này.'
      : taskContext?.scheduledAt == null
        ? 'Công việc chưa có thời gian mong muốn — bổ sung trước khi chọn người này.'
        : 'Đang có một đề xuất giá chờ trả lời — xử lý đề xuất đó trước khi chọn người này.'
    useToastStore.getState().pushToast('danger', message)
  }

  const handleConfirmCandidate = (paymentMethod: PaymentMethod) => {
    if (!selectedItem) return
    runApplicationAction(
      confirmApplication(selectedItem.taskId, selectedItem.applicationId, paymentMethod),
      'Đã chọn Tasker này cho công việc.',
      'Xác nhận thất bại, thử lại sau.',
      () => setPosterConfirmOpen(false),
    )
  }

  /** Tasker dang 1 batch chi phi phat sinh moi - xem Javadoc ExtraCostDialog. */
  const handleSubmitExtraCost = (note: string | undefined, items: ExtraCostItemInput[]) => {
    if (!selectedApplicationId) return
    setExtraCostSubmitting(true)
    submitExtraCostBatch(selectedApplicationId, note, items)
      .then((summary) => {
        setExtraCostSummary(summary)
        setExtraCostDialogOpen(false)
        useToastStore.getState().pushToast('success', 'Đã đăng chi phí phát sinh.')
        refreshMessages(selectedApplicationId)
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Đăng chi phí phát sinh thất bại, thử lại sau.'))
      .finally(() => setExtraCostSubmitting(false))
  }

  /** Dung chung cho 4 hanh dong tren 1 batch chi phi phat sinh (Thu hoi/Dong y/Tu choi/Nap) - cung khuon voi runApplicationAction. */
  const runExtraCostAction = (batchId: string, action: Promise<ExtraCostMoneySummaryResponse>, successMessage: string, failMessage: string) => {
    if (!selectedApplicationId) return
    setExtraCostActionBusyId(batchId)
    action
      .then((summary) => {
        setExtraCostSummary(summary)
        useToastStore.getState().pushToast('success', successMessage)
        refreshMessages(selectedApplicationId)
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : failMessage))
      .finally(() => setExtraCostActionBusyId(null))
  }

  const handleWithdrawExtraCost = (batchId: string) => {
    if (!selectedApplicationId) return
    runExtraCostAction(batchId, withdrawExtraCostBatch(selectedApplicationId, batchId), 'Đã thu hồi khoản chi phí phát sinh.', 'Thu hồi thất bại, thử lại sau.')
  }

  const handleApproveExtraCost = (batchId: string) => {
    if (!selectedApplicationId) return
    runExtraCostAction(batchId, approveExtraCostBatch(selectedApplicationId, batchId), 'Đã đồng ý khoản chi phí phát sinh.', 'Thao tác thất bại, thử lại sau.')
  }

  const handleRejectExtraCost = (batchId: string) => {
    if (!selectedApplicationId) return
    runExtraCostAction(batchId, rejectExtraCostBatch(selectedApplicationId, batchId), 'Đã từ chối khoản chi phí phát sinh.', 'Thao tác thất bại, thử lại sau.')
  }

  /** Poster bam "Nạp" - dung chung id dac biet 'top-up' lam busy key (khong gan voi 1 batch cu the). */
  const handleTopUpExtraCost = () => {
    if (!selectedApplicationId) return
    runExtraCostAction('top-up', topUpExtraCostEscrow(selectedApplicationId), 'Đã nạp thêm.', 'Nạp thêm thất bại, thử lại sau.')
  }

  // "Chon nguoi nay" tu khung chat - dung KHOP dieu kien canConfirm cua CandidateCard
  // (TaskCandidatesPage.tsx): can 1 feeBase (gia da chot qua chat HOAC ngan sach task) va
  // khong co de xuat gia nao dang PROPOSED, don phai con o trang thai co the chon. Them
  // !hasBooking (sua bug 2026-09-22, bao cao nguoi dung): applicationStatus cua ung vien
  // THANG giu nguyen PENDING sau khi confirm (thiet ke co chu dich, xem Javadoc
  // TaskApplicationService.confirm() - BE), nen rieng no khong du de biet "da duoc chon roi".
  // hasBooking (channel.bookingId != null, gan boi ChatFacade.attachBooking() dung luc confirm)
  // moi la tin hieu dung "da duoc chon" - thieu dieu kien nay khien nut Chon nguoi
  // nay/Tu choi van hien sau khi da xac nhan xong.
  const posterFeeBase = agreedPriceAmount ?? taskContext?.budgetAmount ?? null
  // Ty le phi nen tang doc tu /system-parameters (attachmentLimitParams da tai san toan bo
  // payload nay, xem useEffect goi getSystemParameters() o tren) - khong hardcode 0.08 o day de
  // luon khop ty le that su admin cau hinh, dung de hien breakdown "Phi nen tang" / "Tasker thuc
  // nhan" duoi the de xuat gia va o the "Tien cua viec nay".
  const platformFeeRate = attachmentLimitParams?.platformFeeRate ?? null
  const isPosterSelectable = selectedItem?.viewerRole === 'POSTER' && !selectedItem.hasBooking
    && (selectedItem.applicationStatus === 'PENDING' || selectedItem.applicationStatus === 'INVITED')
  // Yeu cau nguoi dung 2026-09-30: "Chon nguoi nay" bat buoc task phai co scheduledAt - khop
  // dung guard MISSING_SCHEDULED_AT moi them o TaskApplicationService.confirm() (BE).
  const canConfirmFromChat = isPosterSelectable && posterFeeBase != null
    && taskContext?.scheduledAt != null && !pendingPriceProposal

  return (
    <AppShell
      navValue="chat"
      title="Tin nhắn & chốt giá"
      subtitle="Hỏi rõ trước, chốt giá sau — mọi lần đổi giá đều là một hành động có ghi nhận"
      collapsibleHeader
    >
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 'var(--sp-3)' }}>
        <span className="tc-label" style={{ marginRight: 'var(--sp-2)' }}>Hộp thư</span>
        {TAB_CONFIG.map((config) => (
          <Chip
            key={config.value}
            selected={tab === config.value}
            onClick={() => setTab(config.value)}
          >
            {config.label} <span className="tc-num">{tabCounts[config.value]}</span>
          </Chip>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr) 320px', gap: 'var(--sp-5)', alignItems: 'start' }}>
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 'var(--sp-4)', borderBottom: 'var(--bw) solid var(--border)', background: 'var(--bg-sunken)' }}>
            <Input icon="search" placeholder="Tìm theo tên hoặc công việc" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ maxHeight: 640, overflowY: 'auto' }}>
            {items == null && !loadError && (
              <p style={{ margin: 0, padding: 'var(--sp-5)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tải…</p>
            )}
            {items != null && filtered.length === 0 && (
              <div style={{ padding: 'var(--sp-6)' }}>
                <EmptyState icon="message-square" title="Chưa có hội thoại nào ở đây">
                  Hội thoại mở ra ngay khi có người ứng tuyển việc của bạn, khi bạn mời một tasker, hoặc khi ai đó bấm hỏi thêm.
                </EmptyState>
              </div>
            )}
            {filtered.map((item) => (
              <ThreadListItem
                key={item.applicationId}
                item={item}
                active={item.applicationId === selectedApplicationId}
                onSelect={() => navigate(`/tin-nhan/${item.applicationId}`)}
              />
            ))}
          </div>
        </Card>

        <Card padding="0" style={{ display: 'flex', flexDirection: 'column', height: 720, overflow: 'hidden', minWidth: 0 }}>
          {!selectedApplicationId && (
            <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--sp-8)' }}>
              <EmptyState icon="message-square" title="Chọn một hội thoại để bắt đầu">
                Chat mở ngay khi có ứng viên — bạn hỏi rõ phạm vi công việc trước, chốt giá sau, không cần chờ giao việc.
              </EmptyState>
            </div>
          )}

          {selectedApplicationId && (
            <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
              <div className="flex items-center gap-3" style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: 'var(--bw) solid var(--border)', background: 'var(--bg-sunken)' }}>
                <Avatar
                  name={selectedItem?.counterpartName ?? noChannelStatus?.counterpartName ?? contactHint?.counterpartName ?? 'Người dùng'}
                  src={(selectedItem?.counterpartAvatarUrl ?? noChannelStatus?.counterpartAvatarUrl ?? contactHint?.counterpartAvatarUrl) ?? undefined}
                  size={36}
                />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 'var(--fs-body)', display: 'block' }}>
                    {selectedItem?.counterpartName ?? noChannelStatus?.counterpartName ?? contactHint?.counterpartName ?? 'Cuộc trò chuyện mới'}
                  </strong>
                  {(selectedItem ?? noChannelStatus) && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{(selectedItem ?? noChannelStatus)?.taskTitle}</span>
                  )}
                </div>
                {chatBlocked && blockedReasonLabel && <Badge tone="neutral" icon="lock">{blockedReasonLabel}</Badge>}
              </div>

              {messages && (
                <PinnedMessagesBar messages={messages} busyMessageId={messageActionBusyId} onUnpin={handleUnpinMessage} />
              )}
              <div className="flex flex-col gap-3" style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)', background: 'var(--surface-card-alt)' }}>
                {messagesError && <Alert tone="danger" title="Không tải được dữ liệu">{messagesError}</Alert>}
                {channelClosed && (
                  <Alert tone="info" icon="lock" title="Hội thoại đã đóng">
                    Bạn vẫn xem lại được toàn bộ nội dung và lịch sử giá, nhưng không gửi thêm tin nhắn hay đề xuất giá.
                  </Alert>
                )}
                {preemptiveBlocked && (
                  <Alert tone="info" icon="lock" title="Không thể bắt đầu hội thoại">
                    {noChannelStatus?.taskStatus === 'REJECTED'
                      ? 'Quản trị viên đã từ chối công việc này, bạn không thể nhắn tin cho công việc này nữa.'
                      : 'Ứng tuyển này đã kết thúc, bạn không thể bắt đầu hội thoại nữa.'}
                  </Alert>
                )}
                {messages != null && messages.length === 0 && !chatBlocked && (
                  <p style={{ margin: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    Chưa có tin nhắn nào — gửi tin đầu tiên để bắt đầu hội thoại.
                  </p>
                )}
                {messages?.map((message) => {
                  if (message.messageType === 'SYSTEM' && message.body === TIME_CHANGE_RECONFIRM_BODY) {
                    return (
                      <TimeChangeReconfirmCard
                        key={message.id}
                        createdAt={message.createdAt}
                        newScheduledAtLabel={taskContext?.scheduledAt ? formatWeekdayTime(taskContext.scheduledAt) : null}
                        pendingResponse={message.id === lastTimeChangeReconfirmMessageId && selectedItem?.applicationStatus === 'TIME_CHANGED_NEEDS_RECONFIRM'}
                        canReconfirm={selectedItem?.viewerRole === 'TASKER'}
                        busy={composerActionBusy}
                        onReconfirm={handleReconfirm}
                        actionLabel={message.refTaskEditId ? 'Xem chi tiết thay đổi' : undefined}
                        onAction={message.refTaskEditId ? () => setTaskEditMessageId(message.id) : undefined}
                      />
                    )
                  }
                  if (message.messageType === 'SYSTEM') {
                    return (
                      <SystemMessageRow
                        key={message.id}
                        body={message.body ?? ''}
                        createdAt={message.createdAt}
                        actionLabel={message.refTaskEditId ? 'Xem chi tiết thay đổi' : undefined}
                        onAction={message.refTaskEditId ? () => setTaskEditMessageId(message.id) : undefined}
                      />
                    )
                  }
                  if (message.messageType === 'PRICE_PROPOSAL') {
                    return (
                      <PriceProposalCard
                        key={message.id}
                        message={message}
                        viewerAccountId={accountId}
                        platformFeeRate={platformFeeRate}
                        busy={proposalBusyId === message.id}
                        onAccept={() => runProposalAction(message.id, acceptPriceProposal(selectedApplicationId, message.id))}
                        onReject={() => runProposalAction(message.id, rejectPriceProposal(selectedApplicationId, message.id))}
                        onWithdraw={() => runProposalAction(message.id, withdrawPriceProposal(selectedApplicationId, message.id))}
                      />
                    )
                  }
                  if (message.messageType === 'RESCHEDULE_PROPOSAL') {
                    return (
                      <RescheduleProposalCard
                        key={message.id}
                        message={message}
                        viewerAccountId={accountId}
                        busy={proposalBusyId === message.id}
                        onAccept={() => runProposalAction(message.id, acceptRescheduleProposal(selectedApplicationId, message.id))}
                        onReject={() => runProposalAction(message.id, rejectRescheduleProposal(selectedApplicationId, message.id))}
                        onWithdraw={() => runProposalAction(message.id, withdrawRescheduleProposal(selectedApplicationId, message.id))}
                      />
                    )
                  }
                  if (message.messageType === 'EXTRA_COST_BATCH') {
                    const batchId = message.extraCostBatch?.id
                    return (
                      <ExtraCostBatchCard
                        key={message.id}
                        message={message}
                        viewerAccountId={accountId}
                        busy={!!batchId && extraCostActionBusyId === batchId}
                        onApprove={() => batchId && handleApproveExtraCost(batchId)}
                        onReject={() => batchId && handleRejectExtraCost(batchId)}
                        onWithdraw={() => batchId && handleWithdrawExtraCost(batchId)}
                      />
                    )
                  }
                  return (
                    <ChatMessageBubble
                      key={message.id}
                      message={message}
                      allMessages={messages ?? []}
                      viewerAccountId={accountId}
                      busy={messageActionBusyId === message.id}
                      onReply={setReplyTarget}
                      onRecall={handleRecallMessage}
                      onReact={handleReactToMessage}
                      onPin={handlePinMessage}
                      onUnpin={handleUnpinMessage}
                    />
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ borderTop: 'var(--bw) solid var(--border)', background: 'var(--surface-card)' }}>
                {pendingPriceProposal && !chatBlocked && (
                  <div className="flex items-center gap-3" style={{ padding: 'var(--sp-3) var(--sp-5)', background: 'var(--money-tint)', borderBottom: 'var(--bw-hair) solid var(--amber-200)' }}>
                    <span className="flex-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.5 }}>
                      Đang có một đề xuất giá chờ trả lời. Mỗi công việc chỉ có một đề xuất mở tại một thời điểm — xử lý đề xuất hiện tại trước khi gửi đề xuất mới.
                    </span>
                    <IconButton
                      icon="more-horizontal" label="Xem đề xuất giá đang chờ" title="Xem đề xuất giá đang chờ" size="sm" variant="ghost"
                      onClick={() => document.getElementById(`chat-message-${pendingPriceProposal.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    />
                  </div>
                )}
                {/* Chi hien voi Tasker: gate "khong duoc dang chi phi phat sinh moi khi con 1 batch
                    PENDING" chi chan chinh Tasker (nut composer da disabled qua
                    extraCostSummary?.pendingBatch), Poster khong bi anh huong nen khong can thay
                    banner nay - cung bo cuc voi banner de xuat gia o tren (nguoi dung bao cao
                    2026-10-04: co rang buoc nhung khong co gi noi ro dieu do). */}
                {pendingExtraCostMessage && !chatBlocked && selectedItem?.viewerRole === 'TASKER' && (
                  <div className="flex items-center gap-3" style={{ padding: 'var(--sp-3) var(--sp-5)', background: 'var(--money-tint)', borderBottom: 'var(--bw-hair) solid var(--amber-200)' }}>
                    <span className="flex-1" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.5 }}>
                      Đang có một khoản chi phí phát sinh chờ Poster duyệt. Chỉ được đăng khoản mới sau khi khoản này được xử lý xong.
                    </span>
                    <IconButton
                      icon="more-horizontal" label="Xem chi phí phát sinh đang chờ" title="Xem chi phí phát sinh đang chờ" size="sm" variant="ghost"
                      onClick={() => document.getElementById(`chat-message-${pendingExtraCostMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    />
                  </div>
                )}
                {chatBlocked ? (
                  <div className="flex items-center gap-3" style={{ padding: 'var(--sp-4) var(--sp-5)', background: 'var(--bg-sunken)' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                      {channelClosed ? 'Hội thoại đã đóng — không gửi được tin nhắn.' : 'Không thể bắt đầu hội thoại — không gửi được tin nhắn.'}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Hang nut nho "hanh dong tren don" - gop ca "De xuat gia" (2026-09-22) va
                        4 icon dinh kem/emoji (2026-09-26) vao day. Ca hang deu la icon-vien co
                        title tooltip, chia 2 nhom trai/phai (2026-09-27, theo yeu cau nguoi dung):
                        trai la dinh kem (ghost, mau trung tinh), phai la hanh dong tren don (vien
                        mau theo y nghia - do cho huy/tu choi, xanh brand cho xac nhan/de xuat). */}
                    <div className="flex items-center justify-between gap-2 flex-wrap" style={{ padding: 'var(--sp-3) var(--sp-5) 0' }}>
                      <div className="flex items-center gap-2">
                        {/* title = tooltip trinh duyet khi tro chuot vao, khong chi doc man hinh (aria-label da co qua label). */}
                        <IconButton
                          icon="image" label="Gửi ảnh hoặc video" title="Gửi ảnh hoặc video" size="sm" variant="ghost"
                          disabled={attachmentUploading} onClick={() => imageOrVideoInputRef.current?.click()}
                        />
                        <IconButton
                          icon="paperclip" label="Gửi file" title="Gửi file" size="sm" variant="ghost"
                          disabled={attachmentUploading} onClick={() => fileInputRef.current?.click()}
                        />
                        <IconButton
                          icon="smile" label="Chèn biểu tượng cảm xúc" title="Chèn biểu tượng cảm xúc" size="sm" variant="ghost"
                          disabled={sending} onClick={() => setComposerEmojiPickerOpen(true)}
                        />
                        <VoiceRecorderButton
                          disabled={sending || attachmentUploading}
                          maxDurationSeconds={voiceMaxDurationSeconds}
                          onRecorded={(file) => handleAttachmentFilesSelected('VOICE', [file])}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* danger: rut ung tuyen/tu choi la hanh dong huy - icon vien do. !hasBooking:
                            an nut nay ngay khi Poster da "Chon nguoi nay" - luc do applicationStatus
                            van la PENDING nhung da co booking nen khong con rut duoc nua. */}
                        {/* Mo rong sang TIME_CHANGED_NEEDS_RECONFIRM (UC07 Tang 3, dong bo voi TaskerJobsPage.tsx) -
                            Tasker khong dong y gio moi thi rut duoc ngay tu day, khong phai roi khung chat. */}
                        {selectedItem?.viewerRole === 'TASKER'
                          && (selectedItem.applicationStatus === 'PENDING' || selectedItem.applicationStatus === 'TIME_CHANGED_NEEDS_RECONFIRM')
                          && !selectedItem.hasBooking && (
                          <IconButton
                            icon="undo-2" label={composerActionBusy ? 'Đang rút…' : 'Rút ứng tuyển'}
                            title={composerActionBusy ? 'Đang rút…' : 'Rút ứng tuyển'}
                            size="sm" variant="outline" disabled={composerActionBusy} onClick={handleWithdraw}
                            style={{ color: 'var(--danger)', border: 'var(--bw) solid var(--danger)' }}
                          />
                        )}
                        {selectedItem?.viewerRole === 'TASKER' && selectedItem.applicationStatus === 'INQUIRING' && (
                          <IconButton
                            icon="send" label={composerActionBusy ? 'Đang gửi…' : 'Ứng tuyển'}
                            title={composerActionBusy ? 'Đang gửi…' : 'Ứng tuyển'}
                            size="sm" variant="outline" disabled={composerActionBusy} onClick={handleApplyFromInquiry}
                            style={{ color: 'var(--brand-strong)', border: 'var(--bw) solid var(--brand-strong)' }}
                          />
                        )}
                        {isPosterSelectable && (
                          <>
                            <IconButton
                              icon="user-round-check" label="Chọn người này"
                              title="Chọn người này"
                              size="sm" variant="outline" disabled={composerActionBusy}
                              onClick={handlePosterSelectClick}
                              style={{ color: 'var(--brand-strong)', border: 'var(--bw) solid var(--brand-strong)' }}
                            />
                            <IconButton
                              icon="x" label="Từ chối" title="Từ chối" size="sm" variant="outline"
                              disabled={composerActionBusy} onClick={handleRejectCandidate}
                              style={{ color: 'var(--danger)', border: 'var(--bw) solid var(--danger)' }}
                            />
                          </>
                        )}
                        {/* "De xuat gia" chi con y nghia TRUOC khi ASSIGNED (thuong luong gia chot) - sau
                            ASSIGNED doi thanh "Chi phi phat sinh" (quyet dinh nguoi dung 2026-10-02),
                            CHI Tasker thay va CHI khi booking chon FULL_ESCROW (PA FEE_ONLY_ESCROW da
                            thanh toan 92% ngoai he thong tu dau, khong can ghi nhan gi them o day). */}
                        {selectedItem?.taskStatus !== 'ASSIGNED' && (
                          <IconButton
                            icon="hand-coins" label="Đề xuất giá" title="Đề xuất giá" size="sm" variant="outline"
                            disabled={!!pendingPriceProposal} onClick={() => setProposalDialogOpen(true)}
                            style={{ color: 'var(--brand-strong)', border: 'var(--bw) solid var(--brand-strong)' }}
                          />
                        )}
                        {selectedItem?.taskStatus === 'ASSIGNED' && selectedItem.viewerRole === 'TASKER'
                          && selectedItem.paymentMethod === 'FULL_ESCROW' && (
                          <IconButton
                            icon="receipt" label="Chi phí phát sinh" title="Chi phí phát sinh" size="sm" variant="outline"
                            disabled={!!extraCostSummary?.pendingBatch} onClick={() => setExtraCostDialogOpen(true)}
                            style={{ color: 'var(--brand-strong)', border: 'var(--bw) solid var(--brand-strong)' }}
                          />
                        )}
                        {/* Doi lich 2 chieu, CHI sau khi ASSIGNED (co booking that) - khac UC07 Tang 3
                            (chi Poster sua truoc ASSIGNED, khong co nut nay). Gate y het BE
                            (BookingFacadeImpl.proposeReschedule: taskStatus == ASSIGNED). */}
                        {selectedItem?.taskStatus === 'ASSIGNED' && (
                          <IconButton
                            icon="calendar-clock" label="Đề xuất đổi lịch" title="Đề xuất đổi lịch" size="sm" variant="outline"
                            disabled={!!pendingRescheduleProposal} onClick={() => setRescheduleDialogOpen(true)}
                            style={{ color: 'var(--brand-strong)', border: 'var(--bw) solid var(--brand-strong)' }}
                          />
                        )}
                      </div>
                    </div>
                    {replyTarget && (
                      <ReplyComposerBar target={replyTarget} viewerAccountId={accountId} onCancel={() => setReplyTarget(null)} />
                    )}
                    <div className="flex gap-3 items-center" style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <Input
                          placeholder={attachmentUploading ? 'Đang tải tệp lên…' : 'Nhập tin nhắn…'}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSend() }}
                          disabled={sending || attachmentUploading}
                        />
                      </div>
                      <IconButton icon="send" label="Gửi" variant="brand" disabled={sending || attachmentUploading || !draft.trim()} onClick={handleSend} />
                    </div>
                    {/* Input file an - kich hoat qua cac IconButton phia tren, khong hien truc tiep tren giao dien.
                        Anh/video dung CHUNG 1 input (gop icon theo yeu cau nguoi dung) - kind duoc suy tu
                        chinh file da chon, xem handleImageOrVideoFilesSelected(). */}
                    <input
                      ref={imageOrVideoInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple
                      style={{ display: 'none' }}
                      onChange={(e) => { handleImageOrVideoFilesSelected(e.target.files); e.target.value = '' }}
                    />
                    <input
                      ref={fileInputRef} type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => { handleAttachmentFilesSelected('FILE', Array.from(e.target.files ?? [])); e.target.value = '' }}
                    />
                  </>
                )}
              </div>
              {composerEmojiPickerOpen && (
                <EmojiPickerDialog
                  onClose={() => setComposerEmojiPickerOpen(false)}
                  onSelect={(emoji) => setDraft((prev) => prev + emoji)}
                />
              )}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)', maxHeight: 720, overflowY: 'auto' }}>
          {selectedApplicationId && taskContext && (
            <>
              <Card tone="money" padding="var(--sp-5)" >
                <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Tiền của việc này</div>
                <DataRow
                  label={
                    agreedPriceAmount != null && selectedItem?.paymentMethod === 'FULL_ESCROW' ? (
                      <>
                        Chi phí chốt ban đầu
                        <span style={{ display: 'block', marginTop: 'var(--sp-1)' }}>
                          <Badge tone="money" icon="lock">Đã tạm giữ</Badge>
                        </span>
                      </>
                    ) : agreedPriceAmount != null ? 'Giá đã chốt' : 'Ngân sách ban đầu'
                  }
                  value={
                    agreedPriceAmount != null
                      ? formatVnd(agreedPriceAmount)
                      : taskContext.budgetAmount != null
                        ? formatVnd(taskContext.budgetAmount)
                        : 'Thoả thuận'
                  }
                  numeric strong
                />
                {posterFeeBase != null && platformFeeRate != null && (
                  <>
                    <DataRow
                      label={
                        selectedItem?.paymentMethod === 'FEE_ONLY_ESCROW' ? (
                          <>
                            {`Phí nền tảng (${Math.round(platformFeeRate * 100)}%)`}
                            <span style={{ display: 'block', marginTop: 'var(--sp-1)' }}>
                              <Badge tone="money" icon="lock">Đã tạm giữ</Badge>
                            </span>
                          </>
                        ) : `Phí nền tảng (${Math.round(platformFeeRate * 100)}%)`
                      }
                      value={`−${formatVnd(posterFeeBase * platformFeeRate)}`}
                      numeric
                    />
                    <DataRow
                      label="Tasker thực nhận"
                      value={formatVnd(posterFeeBase * (1 - platformFeeRate))}
                      numeric strong
                    />
                    {selectedItem?.paymentMethod === 'FEE_ONLY_ESCROW' && (
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 'var(--sp-1)' }}>
                        {formatVnd(posterFeeBase * (1 - platformFeeRate))} còn lại hai bên tự thanh toán trực tiếp ngoài hệ thống — hệ thống không quản lý phần này.
                      </p>
                    )}
                  </>
                )}
                {extraCostSummary && selectedItem && (
                  <ExtraCostBreakdownCard
                    summary={extraCostSummary}
                    viewerRole={selectedItem.viewerRole === 'POSTER' ? 'POSTER' : 'TASKER'}
                    showFeeBaseRow={false}
                    topUpBusy={extraCostActionBusyId === 'top-up'}
                    actionBusyBatchId={extraCostActionBusyId}
                    onViewPendingInChat={pendingExtraCostMessage
                      ? () => document.getElementById(`chat-message-${pendingExtraCostMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      : undefined}
                    onTopUp={handleTopUpExtraCost}
                    onApprove={handleApproveExtraCost}
                    onReject={handleRejectExtraCost}
                    onWithdraw={handleWithdrawExtraCost}
                  />
                )}
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-body)', lineHeight: 1.55, marginTop: 'var(--sp-3)' }}>
                  Số trong chat chỉ là lời nói. Giá chốt chỉ đổi khi một đề xuất được bấm Đồng ý.
                </p>
              </Card>
              <Card padding="var(--sp-5)">
                <div className="flex items-center justify-between gap-2" style={{ marginBottom: 'var(--sp-3)' }}>
                  <strong style={{ fontSize: 'var(--fs-body)', color: 'var(--text-title)', lineHeight: 1.35 }}>{taskContext.title}</strong>
                  {taskDetailSource && (
                    <IconButton
                      icon="eye" label="Xem chi tiết công việc" variant="outline" size="sm"
                      onClick={() => setTaskDetailOpen(true)}
                      style={{ flex: '0 0 auto' }}
                    />
                  )}
                </div>
                <DataRow label="Địa điểm" value={taskContext.addressText} />
                <DataRow label="Thời gian" value={taskContext.scheduledAt ? formatWeekdayTime(taskContext.scheduledAt) : 'Thoả thuận'} />
                <DataRow label="Danh mục" value={taskContext.categoryName} />
                <div style={{ marginTop: 'var(--sp-4)' }}>
                  <Button variant="secondary" block icon="history" onClick={() => setHistoryOpen(true)}>Xem lịch sử giá</Button>
                </div>
              </Card>
            </>
          )}
          <Alert tone="info" title="Nội dung chat được lưu lại">
            Nếu phát sinh khiếu nại, cả hội thoại và từng lần đổi giá đều là căn cứ xử lý.
          </Alert>
        </div>
      </div>

      {proposalDialogOpen && (
        <PriceProposalDialog
          busy={proposalSubmitting}
          onClose={() => setProposalDialogOpen(false)}
          onSubmit={handleCreatePriceProposal}
        />
      )}

      {rescheduleDialogOpen && (
        <RescheduleProposalDialog
          busy={rescheduleSubmitting}
          onClose={() => setRescheduleDialogOpen(false)}
          onSubmit={handleCreateRescheduleProposal}
        />
      )}

      {extraCostDialogOpen && selectedApplicationId && (
        <ExtraCostDialog
          applicationId={selectedApplicationId}
          busy={extraCostSubmitting}
          onClose={() => setExtraCostDialogOpen(false)}
          onSubmit={handleSubmitExtraCost}
        />
      )}

      {posterConfirmOpen && selectedItem && posterFeeBase != null && (
        <ConfirmDialog
          taskerName={selectedItem.counterpartName}
          feeBase={posterFeeBase}
          onClose={() => setPosterConfirmOpen(false)}
          onConfirmed={handleConfirmCandidate}
        />
      )}

      {historyOpen && selectedApplicationId && (
        <DialogViewport>
          <Dialog title="Lịch sử giá" subtitle={selectedItem?.taskTitle} onClose={() => setHistoryOpen(false)}>
            <PriceHistoryPanel applicationId={selectedApplicationId} />
          </Dialog>
        </DialogViewport>
      )}

      {taskEditMessageId && selectedApplicationId && (
        <TaskEditDiffDialog
          applicationId={selectedApplicationId}
          messageId={taskEditMessageId}
          onClose={() => setTaskEditMessageId(null)}
        />
      )}

      {taskDetailOpen && taskDetailSource?.role === 'POSTER' && (
        <TaskDetailDialog
          task={taskDetailSource.task}
          onClose={() => setTaskDetailOpen(false)}
        />
      )}
      {taskDetailOpen && taskDetailSource?.role === 'TASKER' && (
        <ApplicationDetailDialog application={taskDetailSource.application} onClose={() => setTaskDetailOpen(false)} />
      )}
    </AppShell>
  )
}
