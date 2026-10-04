import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Dialog } from '@ds/components/feedback/Dialog'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Icon } from '@ds/components/core/Icon'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Tabs } from '@ds/components/navigation/Tabs'
import { AppShell } from '../components/AppShell.tsx'
import { DialogViewport } from '../components/DialogViewport.tsx'
import { DirectionsModal } from '../components/DirectionsModal.tsx'
import { ImageLightbox } from '../components/ImageLightbox.tsx'
import { applyFromInquiry, getMyApplications, reconfirmApplication, withdrawApplication } from '../api/tasks.ts'
import type { MyApplicationResponse, TaskApplicationStatus } from '../api/tasks.ts'
import { acceptInvite, declineInvite, getMyInvites } from '../api/matching.ts'
import type { MyInviteResponse, TaskerInviteStatus } from '../api/matching.ts'
import { ApiError } from '../api/client.ts'
import { getSystemParameters } from '../api/systemParameters.ts'
import { LOCATION_TYPE_LABELS } from '../utils/locationType.ts'
import { SUPPLIES_STATUS_LABELS } from '../utils/suppliesStatus.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'
import { useToastStore } from '../stores/useToastStore.ts'

// Nhan/tone rieng cho TaskApplicationStatus - KHONG dung vocabulary cua StatusPill (component
// do chi danh cho trang thai booking/thanh toan, xem 01-domain-glossary.md), cung nguyen tac
// da ap dung cho TASK_STATUS_LABEL o MyTasksPage.tsx (Poster). Mo rong tu 4 len 10 gia tri o
// Round B0-B6 module Chat - xem TaskApplicationStatus trong api/tasks.ts.
const APPLICATION_STATUS_LABEL: Record<TaskApplicationStatus, string> = {
  PENDING: 'Chờ xác nhận',
  ACCEPTED: 'Đã nhận việc',
  NEEDS_RECONFIRM: 'Cần ứng tuyển lại',
  REJECTED: 'Bị từ chối',
  INQUIRING: 'Đang hỏi thêm',
  INVITED: 'Bạn được mời',
  WITHDRAWN: 'Đã rút ứng tuyển',
  REJECTED_AUTO: 'Việc đã giao người khác',
  DECLINED: 'Đã từ chối lời mời',
  INVITE_EXPIRED: 'Lời mời đã hết hạn',
  // Them cho UC07 (Poster huy/sua viec da dang).
  CANCELLED: 'Công việc đã huỷ',
  TIME_CHANGED_NEEDS_RECONFIRM: 'Cần bạn xác nhận lại',
}
const APPLICATION_STATUS_TONE: Record<TaskApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
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

/**
 * Nhan/tone badge trang thai 1 don, uu tien hasBooking truoc status - don UNG VIEN THANG cua
 * UC11 "Chon nguoi nay" GIU NGUYEN status=PENDING (xem Javadoc TaskApplicationService.confirm()
 * ben BE) nen APPLICATION_STATUS_LABEL[PENDING]="Chờ xác nhận" se sai hoan toan mot khi da co
 * booking - phai ghi de rieng thanh "Đã nhận việc" (yeu cau nguoi dung 2026-09-28).
 */
function applicationStatusBadge(application: MyApplicationResponse): { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' } {
  if (application.hasBooking) return { label: 'Đã nhận việc', tone: 'success' }
  return { label: APPLICATION_STATUS_LABEL[application.status], tone: APPLICATION_STATUS_TONE[application.status] }
}

/** "Thứ 5, 14:00" - dung cho lich viec sap toi va nhan gio trong danh sach. */
function formatWeekdayTime(iso: string) {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

// formatBudget/formatDateTime: cung mau MyTasksPage.tsx (Poster) - dung cho ApplicationDetailDialog.
function formatBudget(amount: number | null) {
  return amount != null ? `${amount.toLocaleString('vi-VN')} đ` : 'Thoả thuận'
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN')
}

interface ScheduleClash {
  first: MyApplicationResponse
  second: MyApplicationResponse
  gapMinutes: number
}

/**
 * Canh bao 2 viec DA NHAN (status ACCEPTED) co scheduledAt cach nhau duoi 1 gio trong cung 1
 * ngay (ke ca trung gio, gap am) - dung du lieu that (taskScheduledAt) thay vi startHour/
 * durationHours minh hoa nhu truoc, vi backend chua co thoi luong du kien cho tung viec.
 */
function findScheduleClashes(jobs: MyApplicationResponse[]): ScheduleClash[] {
  const withSchedule = jobs.filter((j) => j.taskScheduledAt != null)
  const sorted = [...withSchedule].sort(
    (a, b) => new Date(a.taskScheduledAt!).getTime() - new Date(b.taskScheduledAt!).getTime(),
  )
  const clashes: ScheduleClash[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const current = sorted[i]
    const gapMinutes = Math.round(
      (new Date(current.taskScheduledAt!).getTime() - new Date(prev.taskScheduledAt!).getTime()) / 60000,
    )
    if (gapMinutes < 60) clashes.push({ first: prev, second: current, gapMinutes })
  }
  return clashes
}

interface ApplicationDetailDialogProps {
  application: MyApplicationResponse
  onClose: () => void
}

/** Xem chi tiet 1 viec da ung tuyen/da nhan - tuong tu TaskDetailDialog cua MyTasksPage.tsx
 * (Poster) de dong bo giao dien giua 2 vai tro, nhung khong co LifecycleTracker/ApplicantsPanel
 * (Tasker khong xac nhan ung vien). Dung lai du lieu da co san tu getMyApplications(), khong
 * goi rieng request nao khac. Loai dia diem/luu y/tinh trang vat tu (2026-09-14) hien bang
 * DataRow, an han khi null/rong (tru "Tinh trang vat tu" - luon bat buoc co gia tri). */
export function ApplicationDetailDialog({ application, onClose }: ApplicationDetailDialogProps) {
  useLockBodyScroll(true)
  const lightbox = useImageLightbox()

  return (
    <DialogViewport>
      <Dialog title={application.taskTitle} subtitle={application.categoryName} onClose={onClose} style={{ maxWidth: 640 }}>
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 'var(--sp-1)' }}>
          <div className="flex flex-col gap-4">
            <Badge tone={applicationStatusBadge(application).tone}>{applicationStatusBadge(application).label}</Badge>
            {application.taskStatus === 'REJECTED' && <Badge tone="danger">Việc bị admin từ chối</Badge>}

            {application.taskImageUrls.length > 0 && (
              <Button
                variant="secondary" size="sm" icon="image"
                onClick={() => lightbox.open(application.taskImageUrls, 0)}
                style={{ alignSelf: 'flex-start' }}
              >
                Xem ảnh ({application.taskImageUrls.length})
              </Button>
            )}

            <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{application.taskDescription}</p>

            <DataRow label="Địa chỉ" value={application.taskAddressText} />
            {application.taskLocationType && <DataRow label="Loại địa điểm" value={LOCATION_TYPE_LABELS[application.taskLocationType]} />}
            {application.taskArrivalNotes && <DataRow label="Lưu ý khi tới nơi" value={application.taskArrivalNotes} />}
            <DataRow label="Tình trạng vật tư" value={SUPPLIES_STATUS_LABELS[application.taskSuppliesStatus]} />
            {application.taskSuppliesNote && <DataRow label="Mô tả thêm về vật tư" value={application.taskSuppliesNote} />}
            <DataRow label={application.taskBudgetAmount != null ? 'Ngân sách ban đầu' : 'Ngân sách'} value={formatBudget(application.taskBudgetAmount)} numeric />
            <DataRow label="Thời gian mong muốn" value={application.taskScheduledAt ? formatDateTime(application.taskScheduledAt) : 'Chưa xác định'} />
            <DataRow label="Ứng tuyển lúc" value={formatDateTime(application.createdAt)} />

            {application.message && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                Lời nhắn của bạn: <span style={{ color: 'var(--text-body)' }}>{application.message}</span>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {lightbox.viewerUrl && (
        <ImageLightbox
          url={lightbox.viewerUrl}
          zoom={lightbox.viewerZoom}
          rotation={lightbox.viewerRotation}
          onClose={lightbox.close}
          onZoomIn={lightbox.zoomIn}
          onZoomOut={lightbox.zoomOut}
          onRotate={lightbox.rotate}
          index={lightbox.index}
          total={lightbox.total}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
          onGoTo={lightbox.goTo}
        />
      )}
    </DialogViewport>
  )
}

interface ApplicationRowProps {
  application: MyApplicationResponse
  platformFeeRate: number | null
  onOpenDetail: () => void
  onWithdraw: () => void
  withdrawing: boolean
  onApplyFromInquiry: () => void
  applying: boolean
  onReconfirm: () => void
  reconfirming: boolean
}

/** Mot dong viec da ung tuyen/da nhan - phong theo bo cuc TaskRow cua MyTasksPage.tsx (Poster) de dong bo giao dien giua 2 vai tro. */
function ApplicationRow({
  application, platformFeeRate, onOpenDetail, onWithdraw, withdrawing, onApplyFromInquiry, applying,
  onReconfirm, reconfirming,
}: ApplicationRowProps) {
  // Uu tien gia THAT da chot qua chat (agreedPriceAmount, doc tu task_price_history ben BE) -
  // chi fallback ve ngan sach goc khi chua co de xuat nao duoc chap nhan. Ca hai null (viec
  // "thoa thuan" ma chua chot gia lan nao) thi khong co gi de tru phi, giu nguyen nhan "Ngan
  // sach"/"Thoa thuan" nhu cu (yeu cau nguoi dung 2026-09-28).
  const payoutBaseAmount = application.agreedPriceAmount ?? application.taskBudgetAmount
  const navigate = useNavigate()
  const [showDirections, setShowDirections] = useState(false)
  const isDimmed = application.status === 'WITHDRAWN' || application.status === 'REJECTED' || application.taskStatus === 'REJECTED'
  return (
    <Card
      tone={isDimmed ? 'sunken' : 'plain'}
      padding="var(--sp-4) var(--sp-5)"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <div className="flex gap-4 items-start">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="brand">{application.categoryName}</Badge>
            <Badge tone={applicationStatusBadge(application).tone}>{applicationStatusBadge(application).label}</Badge>
            {application.taskStatus === 'REJECTED' && <Badge tone="danger">Việc bị admin từ chối</Badge>}
          </div>
          <strong style={{ display: 'block', marginTop: 6, fontSize: 'var(--fs-body-lg)', color: 'var(--text-title)', lineHeight: 1.35 }}>
            {application.taskTitle}
          </strong>
          <div className="flex flex-wrap gap-4" style={{ marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{application.taskAddressText}</span>
            <span className="flex items-center gap-1">
              <Icon name="clock" size={15} />
              {application.taskScheduledAt ? formatWeekdayTime(application.taskScheduledAt) : 'Thời gian thoả thuận'}
            </span>
            <span className="flex items-center gap-1"><Icon name="user" size={15} />{application.posterName ?? 'Người đăng việc'}</span>
          </div>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {payoutBaseAmount != null
            ? (platformFeeRate != null
                ? (
                    <MoneyAmount
                      value={payoutBaseAmount * (1 - platformFeeRate)}
                      size="md" tone="money" label="Bạn nhận được"
                      style={{ alignItems: 'flex-end' }}
                    />
                  )
                : <MoneyAmount value={payoutBaseAmount} size="md" label="Ngân sách" style={{ alignItems: 'flex-end' }} />)
            : (
                <div className="flex flex-col" style={{ alignItems: 'flex-end' }}>
                  <span className="tc-label" style={{ fontSize: 'var(--fs-label)' }}>Bạn nhận được</span>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Chưa chốt giá</span>
                </div>
              )}
        </div>
      </div>

      {application.message && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          Lời nhắn của bạn: <span style={{ color: 'var(--text-body)' }}>{application.message}</span>
        </div>
      )}

      {application.status === 'TIME_CHANGED_NEEDS_RECONFIRM' && application.taskStatus === 'OPEN' && (
        <Alert tone="warning" title="Người đăng vừa đổi thời gian mong muốn">
          Thời gian mới: <strong>{application.taskScheduledAt ? formatWeekdayTime(application.taskScheduledAt) : 'Chưa xác định'}</strong>.
          Bấm "Vẫn nhận việc" nếu bạn vẫn làm được, hoặc "Rút ứng tuyển" nếu giờ mới không phù hợp.
        </Alert>
      )}

      <div className="flex items-center gap-3" style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        <Button variant="secondary" size="sm" icon="eye" onClick={onOpenDetail}>Xem chi tiết</Button>
        <Button
          variant="secondary" size="sm" icon="message-square"
          onClick={() => navigate(`/tin-nhan/${application.applicationId}`, {
            state: { counterpartName: application.posterName },
          })}
        >
          Nhắn tin
        </Button>
        {application.status === 'ACCEPTED' && (
          <>
            <Button size="sm" icon="badge-check" disabled title="Báo hoàn tất sẽ có khi module Booking hoàn thành">Báo hoàn tất</Button>
            <Button variant="ghost" size="sm" icon="navigation" onClick={() => setShowDirections(true)}>
              Chỉ đường
            </Button>
          </>
        )}
        {application.status === 'NEEDS_RECONFIRM' && (
          <Button size="sm" icon="refresh-cw" onClick={() => navigate(`/tim-viec/${application.taskId}`)}>Ứng tuyển lại</Button>
        )}
        {application.status === 'INQUIRING' && application.taskStatus === 'OPEN' && (
          <Button size="sm" icon="send" disabled={applying} onClick={onApplyFromInquiry}>
            {applying ? 'Đang gửi…' : 'Ứng tuyển'}
          </Button>
        )}
        {/* UC07 Tier 3: Poster doi thoi gian mong muon luc don dang PENDING - don treo o
            TIME_CHANGED_NEEDS_RECONFIRM cho toi khi Tasker bam nut nay (tro ve PENDING). */}
        {application.status === 'TIME_CHANGED_NEEDS_RECONFIRM' && application.taskStatus === 'OPEN' && (
          <Button size="sm" icon="check" disabled={reconfirming} onClick={onReconfirm}>
            {reconfirming ? 'Đang xác nhận…' : 'Vẫn nhận việc'}
          </Button>
        )}
        {/* danger: rut ung tuyen la hanh dong huy, dung mau do de canh bao ro rang (dong bo voi InboxPage).
            taskStatus === 'OPEN': an nut nay ngay khi Poster da "Chon nguoi nay" - luc do status
            van la PENDING nhung task da ASSIGNED nen khong con rut duoc nua. Mo rong sang
            TIME_CHANGED_NEEDS_RECONFIRM (UC07 Tier 3) - Tasker khong dong y gio moi thi rut. */}
        {(application.status === 'PENDING' || application.status === 'TIME_CHANGED_NEEDS_RECONFIRM')
          && application.taskStatus === 'OPEN' && (
          <Button variant="danger" size="sm" icon="undo-2" disabled={withdrawing} onClick={onWithdraw}>
            {withdrawing ? 'Đang rút…' : 'Rút ứng tuyển'}
          </Button>
        )}
        <div style={{ marginLeft: 'auto' }} />
        {application.status !== 'REJECTED' && (
          <Button variant="ghost" size="sm" icon="receipt-text" disabled title="Ví chưa khả dụng">Xem giao dịch</Button>
        )}
      </div>
      {showDirections && (
        <DirectionsModal
          destination={{ lat: application.taskLat, lng: application.taskLng, addressText: application.taskAddressText }}
          onClose={() => setShowDirections(false)}
        />
      )}
    </Card>
  )
}

// Nhan/tone rieng cho TaskerInviteStatus - loi moi Poster chu dong gui (UC09 mo rong, xem
// api/matching.ts), doc lap voi TaskApplicationStatus (Tasker tu ung tuyen) o tren.
const INVITE_STATUS_LABEL: Record<TaskerInviteStatus, string> = {
  PENDING: 'Chờ bạn phản hồi',
  ACCEPTED: 'Đã nhận lời mời',
  DECLINED: 'Đã từ chối',
  EXPIRED: 'Đã hết hạn',
}
const INVITE_STATUS_TONE: Record<TaskerInviteStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  EXPIRED: 'neutral',
}

interface InvitesPanelProps {
  invites: MyInviteResponse[]
  onResponded: () => void
}

/**
 * Loi moi Poster chu dong gui cho Tasker (UC09 mo rong - AI goi y Tasker, Poster bam "Mời làm
 * việc này" o SuggestedTaskersPanel), doc lap hoan toan voi luong Tasker tu ung tuyen
 * (ApplicationRow/getMyApplications o tren). Chi hien nut Chap nhan/Tu choi khi con PENDING -
 * cac trang thai khac chi hien Badge de xem lai. Khong render gi khi danh sach rong, tranh
 * chiem cho tren trang khi Tasker chua tung duoc moi lan nao.
 */
function InvitesPanel({ invites, onResponded }: InvitesPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const handleAccept = (invite: MyInviteResponse) => {
    setProcessingId(invite.inviteId)
    acceptInvite(invite.taskId, invite.inviteId)
      .then(() => {
        useToastStore.getState().pushToast('success', `Đã nhận lời mời cho việc "${invite.taskTitle}".`)
        onResponded()
      })
      .catch((error) => setActionError(error instanceof ApiError ? error.message : 'Chấp nhận lời mời thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  const handleDecline = (invite: MyInviteResponse) => {
    setProcessingId(invite.inviteId)
    declineInvite(invite.taskId, invite.inviteId)
      .then(() => {
        useToastStore.getState().pushToast('success', 'Đã từ chối lời mời này.')
        onResponded()
      })
      .catch((error) => setActionError(error instanceof ApiError ? error.message : 'Từ chối lời mời thất bại, thử lại sau.'))
      .finally(() => setProcessingId(null))
  }

  if (invites.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="tc-label">Lời mời từ người đăng việc</div>
      {actionError && <Alert tone="danger" title="Thao tác thất bại">{actionError}</Alert>}
      {invites.map((invite) => (
        <Card key={invite.inviteId} padding="var(--sp-4) var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div className="flex items-start gap-3">
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone="brand">{invite.categoryName}</Badge>
                <Badge tone={INVITE_STATUS_TONE[invite.status]}>{INVITE_STATUS_LABEL[invite.status]}</Badge>
              </div>
              <strong style={{ display: 'block', marginTop: 6, fontSize: 'var(--fs-body)' }}>{invite.taskTitle}</strong>
              <div className="flex flex-wrap gap-4" style={{ marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Icon name="user" size={15} />{invite.posterName ?? 'Người đăng việc'}</span>
                <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{invite.taskAddressText}</span>
              </div>
            </div>
            {invite.taskBudgetAmount != null && <MoneyAmount value={invite.taskBudgetAmount} size="sm" label="Ngân sách" />}
          </div>
          {invite.status === 'PENDING' && (
            <div className="flex gap-2" style={{ marginTop: 'var(--sp-1)' }}>
              <Button size="sm" icon="check" disabled={processingId != null} onClick={() => handleAccept(invite)}>
                {processingId === invite.inviteId ? 'Đang xử lý…' : 'Chấp nhận'}
              </Button>
              <Button variant="secondary" size="sm" icon="x" disabled={processingId != null} onClick={() => handleDecline(invite)}>
                Từ chối
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

type JobTab = 'accepted' | 'waiting' | 'inquiring' | 'all'

/**
 * Viec ban da nhan (UC10/UC11, phan xem sau khi ung tuyen) - Tasker. Du lieu that qua
 * getMyApplications() (module Task, khong con la MOCK_ACCEPTED_JOBS - xem
 * docs/TASK-MODULE-SPLIT.md). Backend chua co Booking nen khong co payout/HELD/BOOKED/
 * COMPLETED - nhom theo dung TaskApplicationStatus that (PENDING/ACCEPTED/NEEDS_RECONFIRM/
 * REJECTED). Canh bao "2 viec sat gio nhau" tinh tren taskScheduledAt that (khong con
 * startHour/durationHours minh hoa). Tien te (thu nhap, Mo vi) van disabled dung yeu cau
 * "de sau" cua nguoi dung. Chi role TASKER vao duoc. Nut "Xem chi tiết" tren moi dong
 * (2026-09-14) mo ApplicationDetailDialog, dong bo voi TaskDetailDialog cua MyTasksPage.tsx
 * (Poster) - can taskDescription/taskLocationType/taskArrivalNotes/taskSuppliesStatus/
 * taskSuppliesNote moi trong MyApplicationResponse (BE) de hien du thong tin.
 * Tab "Dang hoi them" (2026-09-20) loc rieng status INQUIRING (don tao boi createInquiry() o
 * TaskerJobDetailPage.tsx khi Tasker bam "Nhan tin hoi them" - chua phai don ung tuyen that).
 * Nut "Rut ung tuyen" tren cac the PENDING o tab "Cho xac nhan" goi withdrawApplication() da co
 * san (BE cung cho rut don INQUIRING, nhung UI nay chi gan cho PENDING theo dung yeu cau).
 * SUA 2026-09-21: nut "Ung tuyen" tren the INQUIRING BAN DAU dieu huong sang /tim-viec/:taskId
 * nhung LUON 404 - browse/apply deu coi INQUIRING la trang thai "dang chan"
 * (BLOCKING_APPLICATION_STATUSES o TaskApplicationService), nen backend tu loai chinh task nay
 * khoi ket qua browse cua chinh Tasker dang co don INQUIRING do (coi nhu TASK_NOT_FOUND). Doi
 * sang goi thang applyFromInquiry() (API moi applyFromInquiry() trong api/tasks.ts, xem
 * TaskApplicationService.applyFromInquiry() o BE) de chuyen thang don INQUIRING thanh PENDING -
 * MO RONG business rule ngoai dac ta muc 3 (ban dau chi nang cap qua acceptPriceProposal trong
 * chat), da hoi va duoc nguoi dung xac nhan chon huong nay (xem PROGRESS-TASK-TASKER-MODULE.md).
 */
export function TaskerJobsPage() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<MyApplicationResponse[] | null>(null)
  const [invites, setInvites] = useState<MyInviteResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<JobTab>('accepted')
  const [detailApplication, setDetailApplication] = useState<MyApplicationResponse | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [reconfirmingId, setReconfirmingId] = useState<string | null>(null)
  // Ty le phi nen tang doc tu /system-parameters (khong hardcode) - dung de hien "Ban nhan duoc"
  // (sau khi tru phi) o rail phai tung dong ApplicationRow. null cho den khi tai xong.
  const [platformFeeRate, setPlatformFeeRate] = useState<number | null>(null)

  useEffect(() => {
    getMyApplications()
      .then(setApplications)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách việc đã ứng tuyển.'))
  }, [])

  useEffect(() => {
    getSystemParameters()
      .then((params) => setPlatformFeeRate(params.platformFeeRate))
      .catch(() => { /* giu null, ApplicationRow fallback ve nhan "Ngan sach" khi chua tai duoc */ })
  }, [])

  const refreshInvites = () => {
    getMyInvites()
      .then(setInvites)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách lời mời.'))
  }
  useEffect(refreshInvites, [])

  // Don UNG VIEN THANG cua UC11 "Chon nguoi nay" GIU NGUYEN status=PENDING (xem Javadoc
  // TaskApplicationService.confirm() ben BE) - hasBooking moi la tin hieu dung "da duoc chon",
  // khong the chi dua vao status=ACCEPTED (gia tri legacy, khong con code path nao set nua).
  const accepted = useMemo(() => (applications ?? []).filter((a) => a.status === 'ACCEPTED' || a.hasBooking), [applications])
  // Viec bi admin tu choi (taskStatus=REJECTED) khong con gi de cho ca du don van PENDING - loai
  // khoi tab "Cho xac nhan" (yeu cau nguoi dung 2026-09-28). Da co booking thi thuoc tab "Da nhan"
  // o tren, khong con thuoc "Cho xac nhan" nua.
  const waiting = useMemo(
    () => (applications ?? []).filter((a) => (a.status === 'PENDING' || a.status === 'NEEDS_RECONFIRM'
        || a.status === 'TIME_CHANGED_NEEDS_RECONFIRM')
      && !a.hasBooking && a.taskStatus !== 'REJECTED'),
    [applications],
  )
  // Cung nguyen tac voi "waiting" o tren: viec bi admin tu choi khong con gi de hoi them ca -
  // loai khoi tab "Dang hoi them" (yeu cau nguoi dung 2026-09-28).
  const inquiring = useMemo(
    () => (applications ?? []).filter((a) => a.status === 'INQUIRING' && a.taskStatus !== 'REJECTED'),
    [applications],
  )
  const shown = tab === 'accepted' ? accepted : tab === 'waiting' ? waiting : tab === 'inquiring' ? inquiring : (applications ?? [])

  /** Rut mot don dang PENDING - dung lai withdrawApplication() da co san cho man Hoi them, chi khac o tab hien thi. */
  const handleWithdraw = (application: MyApplicationResponse) => {
    setWithdrawingId(application.applicationId)
    withdrawApplication(application.taskId, application.applicationId)
      .then((updated) => {
        setApplications((prev) => prev?.map((a) => (a.applicationId === updated.id ? { ...a, status: updated.status } : a)) ?? null)
        useToastStore.getState().pushToast('success', 'Đã rút ứng tuyển.')
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Rút ứng tuyển thất bại, thử lại sau.'))
      .finally(() => setWithdrawingId(null))
  }

  /** Chuyen thang 1 don dang INQUIRING (the "Dang hoi them") thanh PENDING - xem Javadoc TaskApplicationService.applyFromInquiry() o BE. */
  const handleApplyFromInquiry = (application: MyApplicationResponse) => {
    setApplyingId(application.applicationId)
    applyFromInquiry(application.taskId, application.applicationId)
      .then((updated) => {
        setApplications((prev) => prev?.map((a) => (a.applicationId === updated.id ? { ...a, status: updated.status } : a)) ?? null)
        useToastStore.getState().pushToast('success', 'Đã gửi ứng tuyển.')
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Gửi ứng tuyển thất bại, thử lại sau.'))
      .finally(() => setApplyingId(null))
  }

  /** Tasker bam "Van nhan viec" sau khi Poster doi thoi gian mong muon (UC07 Tier 3) - don tro ve PENDING. */
  const handleReconfirm = (application: MyApplicationResponse) => {
    setReconfirmingId(application.applicationId)
    reconfirmApplication(application.taskId, application.applicationId)
      .then((updated) => {
        setApplications((prev) => prev?.map((a) => (a.applicationId === updated.id ? { ...a, status: updated.status } : a)) ?? null)
        useToastStore.getState().pushToast('success', 'Đã xác nhận vẫn nhận công việc này.')
      })
      .catch((error) => useToastStore.getState().pushToast('danger', error instanceof ApiError ? error.message : 'Xác nhận thất bại, thử lại sau.'))
      .finally(() => setReconfirmingId(null))
  }

  const clashes = useMemo(() => findScheduleClashes(accepted), [accepted])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return accepted
      .filter((a) => a.taskScheduledAt && new Date(a.taskScheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.taskScheduledAt!).getTime() - new Date(b.taskScheduledAt!).getTime())
      .slice(0, 5)
  }, [accepted])

  return (
    <AppShell
      navValue="jobs"
      title="Việc bạn đã nhận"
      subtitle={`${accepted.length} việc đã nhận · ${waiting.length} đang chờ xác nhận`}
      actions={<Button icon="layout-list" onClick={() => navigate('/tim-viec')}>Tìm việc mới</Button>}
    >
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '2.3fr 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-4)' }}>
            <Card padding="var(--sp-5)">
              <div className="tc-label">Đã nhận việc</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>{accepted.length}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>người đăng đã xác nhận</div>
            </Card>
            <Card padding="var(--sp-5)">
              <div className="tc-label">Chờ xác nhận</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>{waiting.length}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>đang chờ người đăng phản hồi</div>
            </Card>
            <Card tone="money" padding="var(--sp-5)">
              <div className="tc-label">Thu nhập</div>
              <div className="tc-num" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', lineHeight: 1.1, marginTop: 4 }}>—</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>chưa khả dụng</div>
            </Card>
          </div>

          {clashes.map((clash) => (
            <Alert
              key={`${clash.first.applicationId}-${clash.second.applicationId}`}
              tone="warning"
              title="Hai việc đã nhận sát giờ nhau"
            >
              <strong>{clash.first.taskTitle}</strong> và <strong>{clash.second.taskTitle}</strong> cách nhau chỉ{' '}
              {clash.gapMinutes < 0 ? 'trùng giờ' : `${clash.gapMinutes} phút`}. Nhắn tin với người đăng việc để sắp xếp lại lịch.
            </Alert>
          ))}

          {invites != null && <InvitesPanel invites={invites} onResponded={refreshInvites} />}

          <Tabs
            value={tab}
            onChange={(v) => setTab(v as JobTab)}
            tabs={[
              { value: 'accepted', label: 'Đã nhận', count: accepted.length },
              { value: 'waiting', label: 'Chờ xác nhận', count: waiting.length },
              { value: 'inquiring', label: 'Đang hỏi thêm', count: inquiring.length },
              { value: 'all', label: 'Tất cả', count: applications?.length ?? 0 },
            ]}
          />

          <div className="flex flex-col gap-4">
            {shown.map((application) => (
              <ApplicationRow
                key={application.applicationId}
                application={application}
                platformFeeRate={platformFeeRate}
                onOpenDetail={() => setDetailApplication(application)}
                onWithdraw={() => handleWithdraw(application)}
                withdrawing={withdrawingId === application.applicationId}
                onApplyFromInquiry={() => handleApplyFromInquiry(application)}
                applying={applyingId === application.applicationId}
                onReconfirm={() => handleReconfirm(application)}
                reconfirming={reconfirmingId === application.applicationId}
              />
            ))}
            {applications && shown.length === 0 && (
              <EmptyState icon="layout-list" title="Chưa có việc nào ở đây" action={<Button icon="layout-list" onClick={() => navigate('/tim-viec')}>Tìm việc mới</Button>} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          <Card padding="var(--sp-5)">
            <div className="tc-label" style={{ marginBottom: 'var(--sp-3)' }}>Lịch việc sắp tới</div>
            {upcoming.length === 0 && (
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Chưa có việc nào đặt thời gian sắp tới.</p>
            )}
            {upcoming.map((application) => (
              <div key={application.applicationId} style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}>
                <div className="tc-num" style={{ flex: '0 0 auto', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--teal-700)' }}>
                  {formatWeekdayTime(application.taskScheduledAt!)}
                </div>
                <div style={{ flex: 1, fontSize: 'var(--fs-sm)', lineHeight: 1.4 }}>{application.taskTitle}</div>
              </div>
            ))}
          </Card>

          <Card padding="var(--sp-5)">
            <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Thu nhập theo trạng thái</div>
            <DataRow label="Đang tạm giữ" value="—" numeric strong />
            <DataRow label="Chờ thanh toán" value="—" numeric />
            <DataRow label="Phí nền tảng dự kiến" value="—" numeric />
            <Button block variant="money" size="sm" icon="banknote-arrow-down" disabled title="Ví chưa khả dụng" style={{ marginTop: 'var(--sp-3)' }}>Mở ví</Button>
          </Card>

          <Alert tone="info" title="Nhận nhiều việc không làm tăng thứ hạng">
            Xếp hạng dựa trên tỷ lệ hoàn tất và đúng giờ. Nhận quá tay rồi huỷ sẽ làm giảm điểm.
          </Alert>
        </div>
      </div>

      {detailApplication && (
        <ApplicationDetailDialog application={detailApplication} onClose={() => setDetailApplication(null)} />
      )}
    </AppShell>
  )
}
