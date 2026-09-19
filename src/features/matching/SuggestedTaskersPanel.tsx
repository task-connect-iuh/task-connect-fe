import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { AISuggestion } from '@ds/components/marketplace/AISuggestion'
import { Avatar } from '@ds/components/core/Avatar'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Icon } from '@ds/components/core/Icon'
import { createInvite, getSuggestedTaskers } from '../../api/matching.ts'
import type { SuggestedTaskerResponse } from '../../api/matching.ts'
import type { TaskResponse } from '../../api/tasks.ts'
import { ApiError } from '../../api/client.ts'
import { useToastStore } from '../../stores/useToastStore.ts'
import { SuggestionsLoading } from './SuggestionsLoading.tsx'
import { SuggestedTaskerDetailDialog } from './SuggestedTaskerDetailDialog.tsx'

/** "1.2 km" - 1 chu so thap phan, dung chung quy uoc voi cac man khac hien khoang cach. */
function formatDistance(km: number) {
  return `${km.toFixed(1)} km`
}

function formatVnd(amount: number) {
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`
}

/** "300.000 đ - 500.000 đ" - khop quy uoc tien te da dung o MyTasksPage/TaskerJobDetailPage (formatBudget/formatVnd), khong dung ky hieu ₫ rieng de dong bo voi phan con lai cua app that. */
function formatPriceRange(min: number | null, max: number | null) {
  if (min == null && max == null) return 'Giá thoả thuận'
  if (min != null && max != null) return `${formatVnd(min)} – ${formatVnd(max)}`
  if (min != null) return `Từ ${formatVnd(min)}`
  return `Đến ${formatVnd(max as number)}`
}

function formatBudget(amount: number | null) {
  return amount != null ? formatVnd(amount) : 'Thoả thuận'
}

/** "Thứ 7, 08:00" - cung dinh dang voi formatWeekdayTime o MyTasksPage.tsx, dung rieng ban sao vi khong export dung chung giua cac trang. */
function formatWeekdayTime(iso: string) {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

type InviteState = 'idle' | 'inviting' | 'invited'

function verifiedLabel(tasker: SuggestedTaskerResponse) {
  return tasker.kycStatus === 'VERIFIED' ? 'Đã xác minh danh tính' : 'Chưa xác minh danh tính'
}

function matchColor(tasker: SuggestedTaskerResponse) {
  return tasker.lowConfidence ? 'var(--warning)' : 'var(--teal-700)'
}

interface FeaturedTaskerCardProps {
  tasker: SuggestedTaskerResponse
  inviteState: InviteState
  onOpenDetail: () => void
  onInvite: () => void
  onToggleDismiss: () => void
}

/**
 * The day du cho goi y xep hang cao nhat (rank 1) - bo cuc phong theo man tham chieu
 * "TASKER GỢI Ý & MỜI" (file demo nguoi dung cung cap), vien teal (--brand) de tach voi cac
 * the gon o duoi. "Xem ho so" mo SuggestedTaskerDetailDialog (doi chieu voi thong tin cong
 * viec), tach biet voi "Boi qua goi y nay" (an khoi luoi, xem toggleDismiss o component cha).
 */
function FeaturedTaskerCard({ tasker, inviteState, onOpenDetail, onInvite, onToggleDismiss }: FeaturedTaskerCardProps) {
  const verified = tasker.kycStatus === 'VERIFIED'

  return (
    <Card padding="var(--sp-5)" style={{ border: 'var(--bw) solid var(--brand)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="flex items-start gap-4">
        <Avatar name={tasker.fullName} src={tasker.avatarUrl ?? undefined} size={56} verified={verified} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 'var(--fs-body-lg)', display: 'block' }}>{tasker.fullName}</strong>
          <div className="flex gap-4 flex-wrap" style={{ marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            <span className="tc-num">{formatDistance(tasker.distanceKm)}</span>
            <span className="tc-num">{formatPriceRange(tasker.priceMin, tasker.priceMax)}</span>
            <span>{verifiedLabel(tasker)}</span>
          </div>
        </div>
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          <span className="tc-label" style={{ display: 'block' }}>Độ khớp</span>
          <span className="tc-num" style={{ fontSize: 'var(--fs-amount)', fontWeight: 'var(--fw-black)', color: matchColor(tasker), lineHeight: 1.2 }}>
            {tasker.confidence}%
          </span>
        </div>
      </div>

      {tasker.reasons.length > 0 && (
        <div style={{ background: 'var(--success-tint)', border: 'var(--bw-hair) solid var(--teal-200)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
          <div className="tc-label" style={{ color: 'var(--teal-700)', marginBottom: 'var(--sp-2)' }}>Vì sao AI gợi ý người này</div>
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasker.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', listStyle: 'none', lineHeight: 1.5 }}>
                <Icon name="circle-check" size={15} strokeColor="var(--success)" style={{ marginTop: 2 }} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tasker.concerns.length > 0 && (
        <div style={{ background: 'var(--warning-tint)', border: 'var(--bw-hair) solid var(--amber-200)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
          <div className="tc-label" style={{ color: 'var(--amber-700)', marginBottom: 'var(--sp-2)' }}>Điểm cần lưu ý</div>
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasker.concerns.map((concern, i) => (
              <li key={i} className="flex items-start gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', listStyle: 'none', lineHeight: 1.5 }}>
                <Icon name="triangle-alert" size={15} strokeColor="var(--warning)" style={{ marginTop: 2 }} />
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Độ tin cậy {tasker.confidence}% — gợi ý dựa trên dữ liệu việc đã hoàn tất, không phải cam kết về chất lượng.
      </p>

      <div className="flex gap-3 flex-wrap" style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        <Button
          icon={inviteState === 'invited' ? 'check' : 'send'}
          disabled={inviteState !== 'idle'}
          onClick={onInvite}
        >
          {inviteState === 'invited' ? 'Đã mời' : inviteState === 'inviting' ? 'Đang gửi…' : 'Mời làm việc này'}
        </Button>
        <Button variant="secondary" icon="user-search" onClick={onOpenDetail}>Xem hồ sơ</Button>
        <Button variant="ghost" icon="x" onClick={onToggleDismiss}>Bỏ qua gợi ý này</Button>
      </div>
    </Card>
  )
}

interface CompactTaskerCardProps {
  tasker: SuggestedTaskerResponse
  inviteState: InviteState
  onOpenDetail: () => void
  onInvite: () => void
}

/**
 * The gon cho cac goi y con lai (rank 2+) - bam vao bat ky cho nao tren the (tru nut "Moi")
 * deu mo SuggestedTaskerDetailDialog, thay vi phai co rieng nut "Xem ho so" nhu the featured
 * (yeu cau nguoi dung: "khi bam vao nguoi khac thi no se hien chi tiet ra").
 */
function CompactTaskerCard({ tasker, inviteState, onOpenDetail, onInvite }: CompactTaskerCardProps) {
  const verified = tasker.kycStatus === 'VERIFIED'
  const summary = `Cách ${formatDistance(tasker.distanceKm)} · ${formatPriceRange(tasker.priceMin, tasker.priceMax)} · ${tasker.completedJobsNearby} việc đã hoàn tất gần đây.`

  return (
    <Card
      padding="var(--sp-5)"
      interactive
      onClick={onOpenDetail}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', cursor: 'pointer' }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={tasker.fullName} src={tasker.avatarUrl ?? undefined} size={44} verified={verified} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 'var(--fs-body)', display: 'block' }}>{tasker.fullName}</strong>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{verifiedLabel(tasker)}</span>
        </div>
        <span className="tc-num" style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 'var(--fw-black)', color: matchColor(tasker), flex: '0 0 auto' }}>
          {tasker.confidence}%
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.6 }}>{summary}</p>
      <div onClick={(e) => e.stopPropagation()}>
        <Button
          variant="secondary"
          size="sm"
          block
          icon={inviteState === 'invited' ? 'check' : 'send'}
          disabled={inviteState !== 'idle'}
          onClick={onInvite}
        >
          {inviteState === 'invited' ? 'Đã mời' : inviteState === 'inviting' ? 'Đang gửi…' : 'Mời'}
        </Button>
      </div>
    </Card>
  )
}

interface SuggestedTaskersPanelProps {
  taskId: string
  /** Thong tin co ban cua chinh cong viec - hien o rail phai ("Việc đang mời") va trong modal chi tiet. */
  task: TaskResponse
}

// So lan thu toi da khi goi API goi y that bai (loi mang/server, KHONG phai loi nghiep vu tu AI -
// backend da tu xu ly loi AI bang template fallback, xem Javadoc AiSuggestionService). GET nay
// khong doi trang thai server (idempotent) nen thu lai an toan; 3 lan la nguong hop ly giua "cho
// mang chap chon" va "khong lam nguoi dung cho qua lau".
const MAX_FETCH_ATTEMPTS = 3
// Khoang cach giua cac lan thu (ms), tang dan de tranh don dap server ngay khi dang gap su co.
const RETRY_DELAYS_MS = [800, 1600]

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Goi getSuggestedTaskers voi co che thu lai toi da MAX_FETCH_ATTEMPTS lan - neu tat ca deu
 * that bai, nem loi cuoi cung ra ngoai de noi goi quyet dinh gia tri mac dinh + thong bao
 * nguoi dung (khong de UI ket lai o trang thai dang tai vo thoi han).
 */
async function fetchSuggestionsWithRetry(taskId: string, expand: boolean): Promise<SuggestedTaskerResponse[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      return await getSuggestedTaskers(taskId, expand)
    } catch (error) {
      lastError = error
      if (attempt < RETRY_DELAYS_MS.length) {
        await delay(RETRY_DELAYS_MS[attempt])
      }
    }
  }
  throw lastError
}

/**
 * Danh sach Tasker AI goi y cho 1 cong viec cua Poster (UC09 mo rong, xem
 * plan kind-zooming-bumblebee.md) - toi da 10 ket qua (hoac 20 sau khi bam "Xem them"), GIU
 * NGUYEN thu tu backend tra ve (da sap tot->kem san), KHONG tu sap xep lai. Bo cuc 2 cot phong
 * theo man demo "TASKER GỢI Ý & MỜI" nguoi dung cung cap: cot trai la banner AI + the day du
 * cho goi y hang 1 (FeaturedTaskerCard) + luoi 2 cot cho cac goi y con lai (CompactTaskerCard);
 * cot phai dinh (sticky) la the tom tat cong viec dang moi + 2 Alert giai thich luong moi. Goi
 * y bi "Bo qua" bi AN HAN khoi luoi (khong chi mo di) - trang thai chi o FE, khong goi API - va
 * co 1 nut "Hoan tac" DUY NHAT o thanh phia tren de phuc hoi dung goi y vua bo qua gan nhat.
 */
export function SuggestedTaskersPanel({ taskId, task }: SuggestedTaskersPanelProps) {
  const [suggestions, setSuggestions] = useState<SuggestedTaskerResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [inviteStates, setInviteStates] = useState<Record<string, InviteState>>({})
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  // Ngan xep thu tu bo qua (LIFO) - nut "Hoan tac" duy nhat luon phuc hoi dung phan tu bi an gan nhat.
  const [dismissOrder, setDismissOrder] = useState<string[]>([])
  const [selectedTaskerId, setSelectedTaskerId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [expanding, setExpanding] = useState(false)

  const loadSuggestions = (expand: boolean) => {
    setLoadError('')
    fetchSuggestionsWithRetry(taskId, expand)
      .then(setSuggestions)
      .catch((error) => {
        // Da thu du MAX_FETCH_ATTEMPTS lan van loi - tra ve gia tri mac dinh (danh sach rong)
        // thay vi de nguyen trang thai "dang tai" mai mai, kem thong bao ro cho nguoi dung.
        setSuggestions([])
        const message = error instanceof ApiError ? error.message : 'Không tải được danh sách Tasker gợi ý.'
        setLoadError(message)
        useToastStore.getState().pushToast('danger', `${message} (đã thử lại ${MAX_FETCH_ATTEMPTS} lần)`)
      })
  }

  useEffect(() => {
    setSuggestions(null)
    loadSuggestions(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const handleInvite = (tasker: SuggestedTaskerResponse) => {
    setInviteStates((prev) => ({ ...prev, [tasker.taskerId]: 'inviting' }))
    createInvite(taskId, tasker.taskerId)
      .then(() => {
        setInviteStates((prev) => ({ ...prev, [tasker.taskerId]: 'invited' }))
        useToastStore.getState().pushToast('success', `Đã gửi lời mời tới ${tasker.fullName}.`)
      })
      .catch((error) => {
        setInviteStates((prev) => ({ ...prev, [tasker.taskerId]: 'idle' }))
        useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Gửi lời mời thất bại, thử lại sau.')
      })
  }

  const dismiss = (taskerId: string) => {
    setDismissedIds((prev) => new Set(prev).add(taskerId))
    setDismissOrder((prev) => [...prev, taskerId])
    if (selectedTaskerId === taskerId) setSelectedTaskerId(null)
  }

  const undoLastDismiss = () => {
    setDismissOrder((prev) => {
      if (prev.length === 0) return prev
      const lastId = prev[prev.length - 1]
      setDismissedIds((ids) => {
        const next = new Set(ids)
        next.delete(lastId)
        return next
      })
      return prev.slice(0, -1)
    })
  }

  const handleLoadMore = () => {
    setExpanding(true)
    fetchSuggestionsWithRetry(taskId, true)
      .then((next) => {
        setSuggestions(next)
        setExpanded(true)
      })
      .catch((error) => {
        useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Không mở rộng được tìm kiếm, thử lại sau.')
      })
      .finally(() => setExpanding(false))
  }

  if (suggestions == null) {
    return <SuggestionsLoading />
  }

  const visibleSuggestions = suggestions.filter((t) => !dismissedIds.has(t.taskerId))
  const selectedTasker = selectedTaskerId ? suggestions.find((t) => t.taskerId === selectedTaskerId) ?? null : null
  // Dem so loi moi da gui TRONG PHIEN NAY (khong co endpoint liet ke loi moi da gui cho Poster
  // o backend hien tai - xem MatchingController - nen day chi la so dem cuc bo, co the it hon
  // so that neu Poster da moi tu truoc do o phien khac).
  const invitedCount = Object.values(inviteStates).filter((s) => s === 'invited').length

  const rightRail = (
    <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
      <Card padding="var(--sp-5)">
        <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Việc đang mời</div>
        <strong style={{ fontSize: 'var(--fs-body-lg)', display: 'block', marginBottom: 'var(--sp-3)' }}>{task.title}</strong>
        <DataRow label="Địa điểm" value={task.addressText} />
        <DataRow label="Thời gian" value={task.scheduledAt ? formatWeekdayTime(task.scheduledAt) : 'Chưa chọn giờ cụ thể'} />
        <DataRow label="Ngân sách" value={formatBudget(task.budgetAmount)} />
        <DataRow label="Đã mời" value={`${invitedCount} người`} numeric strong style={{ borderBottom: 'none' }} />
      </Card>
      <Alert tone="info" title="Mời không phải là giao việc">
        Lời mời tạo một ứng viên chờ Tasker chấp nhận. Việc chỉ chuyển sang Đã nhận khi họ bấm Chấp nhận.
      </Alert>
      <Alert tone="warning" title="Có thể mời nhiều người cùng lúc">
        Việc sẽ được giao cho Tasker đầu tiên bấm Chấp nhận. Các lời mời còn lại vẫn ở trạng thái chờ cho đến khi chính họ phản hồi.
      </Alert>
    </div>
  )

  // Copy muon theo tinh than ma loi MATCH-404-NO_TASKER_FOUND (backend) - khong phai loi that,
  // chi la danh sach rong (0 Tasker phu hop du dieu kien de goi y), tru khi day la fallback sau
  // khi da het luot thu lai vi loi mang (loadError van con).
  if (visibleSuggestions.length === 0 && dismissOrder.length === 0) {
    return (
      <div className="tc-suggested-layout">
        {loadError ? (
          <Alert tone="danger" title="Không tải được dữ liệu">
            {loadError}
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <Button size="sm" icon="refresh-cw" onClick={() => { setSuggestions(null); loadSuggestions(false) }}>Thử lại</Button>
            </div>
          </Alert>
        ) : (
          <EmptyState icon="user-search" title="Chưa tìm được Tasker phù hợp." />
        )}
        {rightRail}
      </div>
    )
  }

  const [featured, ...rest] = visibleSuggestions

  return (
    <div className="tc-suggested-layout">
      <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>
        {featured && (
          <AISuggestion label="Gợi ý từ AI" confidence={featured.confidence}>
            {visibleSuggestions.length} tasker dưới đây khớp với "{task.title}" theo khoảng cách, kỹ năng đã xác minh và lịch rảnh. Bạn mời ai cũng được, hoặc tự tìm người khác.
          </AISuggestion>
        )}

        {dismissOrder.length > 0 && (
          <div className="flex items-center justify-between gap-3" style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--paper-1)', border: 'var(--bw-hair) solid var(--border-subtle)', borderRadius: 'var(--r-md)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đã bỏ qua {dismissOrder.length} gợi ý.</span>
            <Button variant="ghost" size="sm" icon="rotate-ccw" onClick={undoLastDismiss}>Hoàn tác</Button>
          </div>
        )}

        {visibleSuggestions.length === 0 ? (
          <EmptyState icon="user-search" title="Đã bỏ qua hết gợi ý hiện có." />
        ) : (
          <>
            <FeaturedTaskerCard
              tasker={featured}
              inviteState={inviteStates[featured.taskerId] ?? 'idle'}
              onOpenDetail={() => setSelectedTaskerId(featured.taskerId)}
              onInvite={() => handleInvite(featured)}
              onToggleDismiss={() => dismiss(featured.taskerId)}
            />
            {rest.length > 0 && (
              <div className="tc-suggested-grid">
                {rest.map((tasker) => (
                  <CompactTaskerCard
                    key={tasker.taskerId}
                    tasker={tasker}
                    inviteState={inviteStates[tasker.taskerId] ?? 'idle'}
                    onOpenDetail={() => setSelectedTaskerId(tasker.taskerId)}
                    onInvite={() => handleInvite(tasker)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!expanded && (
          <Button
            variant="ghost"
            size="md"
            icon="search"
            disabled={expanding}
            onClick={handleLoadMore}
            style={{ alignSelf: 'center' }}
          >
            {expanding ? 'Đang tìm thêm…' : 'Xem thêm gợi ý (mở rộng phạm vi tìm kiếm)'}
          </Button>
        )}
      </div>

      {rightRail}

      {selectedTasker && (
        <SuggestedTaskerDetailDialog
          task={task}
          tasker={selectedTasker}
          inviteState={inviteStates[selectedTasker.taskerId] ?? 'idle'}
          dismissed={dismissedIds.has(selectedTasker.taskerId)}
          onClose={() => setSelectedTaskerId(null)}
          onInvite={() => handleInvite(selectedTasker)}
          onToggleDismiss={() => {
            if (dismissedIds.has(selectedTasker.taskerId)) {
              setDismissedIds((ids) => {
                const next = new Set(ids)
                next.delete(selectedTasker.taskerId)
                return next
              })
              setDismissOrder((prev) => prev.filter((id) => id !== selectedTasker.taskerId))
            } else {
              dismiss(selectedTasker.taskerId)
            }
          }}
        />
      )}
    </div>
  )
}
