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
import { MessageBubble } from '@ds/components/marketplace/MessageBubble'
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
  getInbox,
  getMessages,
  rejectPriceProposal,
  rejectRescheduleProposal,
  sendTextMessage,
  withdrawPriceProposal,
  withdrawRescheduleProposal,
} from '../api/chat.ts'
import type { ChatInboxItemResponse, ChatMessageResponse, InboxTab } from '../api/chat.ts'
import { applyFromInquiry, confirmApplication, getMyApplications, getTask, rejectApplication, withdrawApplication } from '../api/tasks.ts'
import type { MyApplicationResponse, TaskApplicationStatus, TaskResponse } from '../api/tasks.ts'
import { formatChatTime, formatVnd } from '../features/chat/chatFormat.ts'
import { TaskDetailDialog } from './MyTasksPage.tsx'
import { ApplicationDetailDialog } from './TaskerJobsPage.tsx'
import { ConfirmDialog } from './TaskCandidatesPage.tsx'
import { PriceHistoryPanel } from '../features/chat/components/PriceHistoryPanel.tsx'
import { PriceProposalCard } from '../features/chat/components/PriceProposalCard.tsx'
import { RescheduleProposalCard } from '../features/chat/components/RescheduleProposalCard.tsx'
import { SystemMessageRow } from '../features/chat/components/SystemMessageRow.tsx'
import { useChatSocket } from '../features/chat/useChatSocket.ts'

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
}

/** Nhan badge hien cho 1 channel CLOSED - xem CLOSED_REASON_LABEL. */
function closedReasonLabel(applicationStatus: TaskApplicationStatus): string {
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
          <Badge tone={item.viewerRole === 'POSTER' ? 'brand' : 'neutral'}>
            {item.viewerRole === 'POSTER' ? 'Bạn là người đăng' : 'Bạn ứng tuyển'}
          </Badge>
          {item.needsResponse && <Badge tone="money">Cần phản hồi</Badge>}
          {item.status === 'CLOSED' && <Badge tone="neutral" icon="lock">{closedReasonLabel(item.applicationStatus)}</Badge>}
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
  const [taskContext, setTaskContext] = useState<TaskContextSummary | null>(null)
  const [taskDetailSource, setTaskDetailSource] = useState<ChatTaskDetailSource | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null)
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [proposalSubmitting, setProposalSubmitting] = useState(false)
  const [composerActionBusy, setComposerActionBusy] = useState(false)
  const [posterConfirmOpen, setPosterConfirmOpen] = useState(false)

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
    if (selectedApplicationId) refreshMessages(selectedApplicationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplicationId])

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
      // dung, thay vi doan mo ta trong noi dung SYSTEM message.
      if (message.messageType === 'SYSTEM' && selectedApplicationId) refreshMessages(selectedApplicationId)
    },
    onInboxPing: refreshInbox,
  })

  const filtered = useMemo(() => {
    if (!items) return []
    const byTab = items.filter((item) => matchesTab(tab, item))
    const term = search.trim().toLowerCase()
    if (!term) return byTab
    return byTab.filter(
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
  const channelClosed = selectedItem?.status === 'CLOSED'

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
    sendTextMessage(selectedApplicationId, draft.trim())
      .then((message) => {
        if (isFirstMessage) {
          refreshMessages(selectedApplicationId)
        } else {
          setMessages((prev) => (prev ? mergeMessage(prev, message) : [message]))
        }
        setDraft('')
        refreshInbox()
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Gửi tin nhắn thất bại.'))
      .finally(() => setSending(false))
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

  const handleConfirmCandidate = () => {
    if (!selectedItem) return
    runApplicationAction(
      confirmApplication(selectedItem.taskId, selectedItem.applicationId),
      'Đã chọn Tasker này cho công việc.',
      'Xác nhận thất bại, thử lại sau.',
      () => setPosterConfirmOpen(false),
    )
  }

  // "Chon nguoi nay" tu khung chat - dung KHOP dieu kien canConfirm cua CandidateCard
  // (TaskCandidatesPage.tsx): can 1 feeBase (gia da chot qua chat HOAC ngan sach task) va
  // khong co de xuat gia nao dang PROPOSED, don phai con o trang thai co the chon.
  const posterFeeBase = agreedPriceAmount ?? taskContext?.budgetAmount ?? null
  const isPosterSelectable = selectedItem?.viewerRole === 'POSTER'
    && (selectedItem.applicationStatus === 'PENDING' || selectedItem.applicationStatus === 'INVITED')
  const canConfirmFromChat = isPosterSelectable && posterFeeBase != null && !pendingPriceProposal

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
                  name={selectedItem?.counterpartName ?? contactHint?.counterpartName ?? 'Người dùng'}
                  src={(selectedItem?.counterpartAvatarUrl ?? contactHint?.counterpartAvatarUrl) ?? undefined}
                  size={36}
                />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 'var(--fs-body)', display: 'block' }}>
                    {selectedItem?.counterpartName ?? contactHint?.counterpartName ?? 'Cuộc trò chuyện mới'}
                  </strong>
                  {selectedItem && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{selectedItem.taskTitle}</span>
                  )}
                </div>
                {channelClosed && selectedItem && <Badge tone="neutral" icon="lock">{closedReasonLabel(selectedItem.applicationStatus)}</Badge>}
              </div>

              <div className="flex flex-col gap-3" style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)', background: 'var(--surface-card-alt)' }}>
                {messagesError && <Alert tone="danger" title="Không tải được dữ liệu">{messagesError}</Alert>}
                {channelClosed && (
                  <Alert tone="info" icon="lock" title="Hội thoại đã đóng">
                    Bạn vẫn xem lại được toàn bộ nội dung và lịch sử giá, nhưng không gửi thêm tin nhắn hay đề xuất giá.
                  </Alert>
                )}
                {messages != null && messages.length === 0 && !channelClosed && (
                  <p style={{ margin: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    Chưa có tin nhắn nào — gửi tin đầu tiên để bắt đầu hội thoại.
                  </p>
                )}
                {messages?.map((message) => {
                  if (message.messageType === 'SYSTEM') {
                    return <SystemMessageRow key={message.id} body={message.body ?? ''} createdAt={message.createdAt} />
                  }
                  if (message.messageType === 'PRICE_PROPOSAL') {
                    return (
                      <PriceProposalCard
                        key={message.id}
                        message={message}
                        viewerAccountId={accountId}
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
                  return (
                    <MessageBubble key={message.id} mine={message.senderAccountId === accountId} time={formatChatTime(message.createdAt)}>
                      {message.body}
                    </MessageBubble>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ borderTop: 'var(--bw) solid var(--border)', background: 'var(--surface-card)' }}>
                {pendingPriceProposal && !channelClosed && (
                  <div className="flex items-center gap-3" style={{ padding: 'var(--sp-3) var(--sp-5)', background: 'var(--money-tint)', borderBottom: 'var(--bw-hair) solid var(--amber-200)' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.5 }}>
                      Đang có một đề xuất giá chờ trả lời. Mỗi công việc chỉ có một đề xuất mở tại một thời điểm — xử lý đề xuất hiện tại trước khi gửi đề xuất mới.
                    </span>
                  </div>
                )}
                {channelClosed ? (
                  <div className="flex items-center gap-3" style={{ padding: 'var(--sp-4) var(--sp-5)', background: 'var(--bg-sunken)' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Hội thoại đã đóng — không gửi được tin nhắn.</span>
                  </div>
                ) : (
                  <>
                    {/* Hang nut nho "hanh dong tren don" - gop ca "De xuat gia" vao day de o nhap
                        ben duoi dai hon (2026-09-22), thay vi nam rieng canh o nhap nhu truoc. */}
                    <div className="flex gap-2 items-center flex-wrap" style={{ padding: 'var(--sp-3) var(--sp-5) 0' }}>
                      {selectedItem?.viewerRole === 'TASKER' && selectedItem.applicationStatus === 'PENDING' && (
                        <Button variant="ghost" size="sm" icon="undo-2" disabled={composerActionBusy} onClick={handleWithdraw}>
                          {composerActionBusy ? 'Đang rút…' : 'Rút ứng tuyển'}
                        </Button>
                      )}
                      {selectedItem?.viewerRole === 'TASKER' && selectedItem.applicationStatus === 'INQUIRING' && (
                        <Button size="sm" icon="send" disabled={composerActionBusy} onClick={handleApplyFromInquiry}>
                          {composerActionBusy ? 'Đang gửi…' : 'Ứng tuyển'}
                        </Button>
                      )}
                      {isPosterSelectable && (
                        <>
                          <Button
                            size="sm" icon="user-round-check"
                            disabled={!canConfirmFromChat || composerActionBusy}
                            onClick={() => setPosterConfirmOpen(true)}
                          >
                            Chọn người này
                          </Button>
                          <Button variant="ghost" size="sm" icon="x" disabled={composerActionBusy} onClick={handleRejectCandidate}>
                            Từ chối
                          </Button>
                        </>
                      )}
                      <Button
                        variant="secondary" size="sm" icon="hand-coins"
                        disabled={!!pendingPriceProposal}
                        onClick={() => setProposalDialogOpen(true)}
                      >
                        Đề xuất giá
                      </Button>
                    </div>
                    <div className="flex gap-3 items-center" style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <Input
                          placeholder="Nhập tin nhắn…"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSend() }}
                          disabled={sending}
                        />
                      </div>
                      <IconButton icon="send" label="Gửi" variant="brand" disabled={sending || !draft.trim()} onClick={handleSend} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          {selectedApplicationId && taskContext && (
            <>
              <Card tone="money" padding="var(--sp-5)">
                <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Tiền của việc này</div>
                <DataRow
                  label={agreedPriceAmount != null ? 'Giá đã chốt' : 'Ngân sách'}
                  value={
                    agreedPriceAmount != null
                      ? formatVnd(agreedPriceAmount)
                      : taskContext.budgetAmount != null
                        ? formatVnd(taskContext.budgetAmount)
                        : 'Thoả thuận'
                  }
                  numeric strong
                />
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

      {taskDetailOpen && taskDetailSource?.role === 'POSTER' && (
        <TaskDetailDialog
          task={taskDetailSource.task}
          onClose={() => setTaskDetailOpen(false)}
          onApplicantConfirmed={refreshTaskContext}
        />
      )}
      {taskDetailOpen && taskDetailSource?.role === 'TASKER' && (
        <ApplicationDetailDialog application={taskDetailSource.application} onClose={() => setTaskDetailOpen(false)} />
      )}
    </AppShell>
  )
}
