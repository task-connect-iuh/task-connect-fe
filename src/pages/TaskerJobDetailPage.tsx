import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import { KycStatus } from '@ds/components/marketplace/KycStatus'
import { LifecycleTracker } from '@ds/components/marketplace/LifecycleTracker'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Radio } from '@ds/components/forms/Radio'
import { Textarea } from '@ds/components/forms/Textarea'
import { AppShell } from '../components/AppShell.tsx'
import { ImageLightbox } from '../components/ImageLightbox.tsx'
import { listCertificateRequirements, getMyCertifications } from '../api/users.ts'
import type { CategoryCertificateRequirementResponse, CertificationDetailResponse } from '../api/users.ts'
import { applyToTask, createInquiry, getFeedTask } from '../api/tasks.ts'
import type { TaskFeedItemResponse } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { toKycStatusState, useTaskerEligibility } from '../features/tasker/useTaskerEligibility.ts'
import { LOCATION_TYPE_LABELS } from '../utils/locationType.ts'
import { SUPPLIES_STATUS_LABELS } from '../utils/suppliesStatus.ts'
import { BUDGET_MAX_THOUSAND, BUDGET_MIN_THOUSAND, BUDGET_RANGE_MESSAGE, formatThousandVnd } from '../utils/taskForm.ts'
import { useImageLightbox } from '../utils/useImageLightbox.ts'
import { useToastStore } from '../stores/useToastStore.ts'

// Ty le phi nen tang DA CHOT (8%, xem 02-source-of-truth.md) - CHI de xem truoc so tien o rail
// ben phai, cung cach dung nhu PostTaskPage.tsx. Khong phai tinh toan escrow that.
const PLATFORM_FEE_RATE = 0.08

function formatVnd(amount: number) {
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`
}

function formatScheduleLabel(iso: string | null) {
  if (!iso) return 'Thời gian thoả thuận'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

interface RequirementRow {
  requirement: CategoryCertificateRequirementResponse
  approved: boolean
}

/**
 * Chi tiet 1 viec + form gui ung tuyen (UC10) - Tasker. Viec goi that qua getFeedTask() (module
 * Task, khong con la findMockFeedJob - xem docs/TASK-MODULE-SPLIT.md), yeu cau chung chi va
 * trang thai KYC cung la DU LIEU THAT (listCertificateRequirements, getMyCertifications,
 * useTaskerEligibility). "Thoi gian ban co the toi" (proposedArrivalText) van BO khoi form (yeu
 * cau nguoi dung truoc do). "Gia ban de xuat" da BO truoc do, THEM LAI 2026-09-30 (yeu cau nguoi
 * dung) duoi dang 2 lua chon o "Muc tien ban nhan": chap nhan nguyen gia/thoa thuan sau (mac
 * dinh, KHONG gui proposedPrice) hoac "De nghi mot muc khac" (bat buoc nhap ca gia va ly do,
 * priceProposalValid chan nut Gui ung tuyen neu thieu 1 trong 2 - BE con chan lai lan nua qua
 * PRICE_REASON_REQUIRED). Lua chon nay CHI ap dung cho Gui ung tuyen - "Nhan tin hoi them"
 * (handleInquire) giu nguyen khong doi. Dieu kien chung chi la OR, khong phai AND - chi can
 * DUYET 1 TRONG SO cac chung chi yeu cau cho danh muc nay la du dieu kien (khong bat buoc co du
 * tat ca), va chan nut Gui ung tuyen khi KYC chua VERIFIED. Nut "Xem ho so nguoi dang" van
 * disabled - khong phai vi thieu accountId that nua
 * (job.posterId gio la that) ma vi module Review chua ton tai, chua co diem uy tin de hien thi
 * dang hoang, xem TaskFeedItemResponse. Chi role TASKER vao duoc (RoleGuard o App.tsx).
 * locationType/arrivalNotes/suppliesStatus/suppliesNote (2026-09-14) hien bang DataRow, an
 * han khi null/rong - cung du lieu Poster da khai bao luc dang viec (PostTaskPage.tsx).
 */
export function TaskerJobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState<TaskFeedItemResponse | null | undefined>(undefined)
  const { ready, categories, kycStatus, kycVerified } = useTaskerEligibility()
  const lightbox = useImageLightbox()

  const [requirements, setRequirements] = useState<CategoryCertificateRequirementResponse[] | null>(null)
  const [myCertifications, setMyCertifications] = useState<CertificationDetailResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  // "Muc tien ban nhan" (2026-09-30) - mac dinh 'accept' (nguyen gia nguoi dang ghi, hoac thoa
  // thuan sau neu budgetAmount null), KHONG gui proposedPrice/priceReason. 'propose' bat buoc
  // ca proposedPrice va priceReason (xem priceProposalValid), CHI anh huong Gui ung tuyen -
  // Nhan tin hoi them (handleInquire) khong doc 2 state nay. proposedPrice nhap theo DON VI
  // NGHIN dong (giong budget cua PostTaskPage.tsx/EditTaskDialog.tsx - go "50" nghia la
  // 50.000 d, xem formatThousandVnd/BUDGET_MIN_THOUSAND/BUDGET_MAX_THOUSAND o utils/taskForm.ts),
  // nhan 1000 luc gui request de khop don vi dong nguyen ben BE.
  const [priceChoice, setPriceChoice] = useState<'accept' | 'propose'>('accept')
  const [proposedPrice, setProposedPrice] = useState('')
  const [priceReason, setPriceReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [inquiring, setInquiring] = useState(false)
  // true = vua phat hien Poster sua thong tin cong viec (UC07) ngay truoc luc gui ung tuyen/hoi
  // them - banner dang hien, job da duoc cap nhat gia tri moi nhat. Lan bam nut KE TIEP se gui
  // thang (khong kiem tra lai) vi Tasker da thay du lieu moi truoc khi quyet dinh tiep tuc -
  // canh bao NHE (khong chan cung), xem Javadoc refreshAndCheckStale().
  const [staleNotice, setStaleNotice] = useState(false)

  useEffect(() => {
    if (!jobId) { setJob(null); return }
    getFeedTask(jobId)
      .then(setJob)
      .catch((error) => {
        setJob(null)
        if (!(error instanceof ApiError && error.code === 'TSK-404-TASK_NOT_FOUND')) {
          setLoadError(error instanceof ApiError ? error.message : 'Không tải được việc này.')
        }
      })
  }, [jobId])

  // job.categoryId la id that (khong con categoryCode minh hoa), tra category that theo id.
  const category = job ? (categories ?? []).find((c) => c.id === job.categoryId) : undefined

  useEffect(() => {
    if (!category) return
    Promise.all([listCertificateRequirements(category.id), getMyCertifications(category.id)])
      .then(([reqs, certs]) => { setRequirements(reqs); setMyCertifications(certs) })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được yêu cầu chứng chỉ.'))
  }, [category])

  if (job === undefined) {
    return (
      <AppShell navValue="feed" title="Chi tiết việc">
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Đang tải…</p>
      </AppShell>
    )
  }

  if (!job) {
    return (
      <AppShell navValue="feed" title="Chi tiết việc">
        {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}
        <EmptyState icon="search-x" title="Không tìm thấy việc này" action={<Button onClick={() => navigate('/tim-viec')}>Về danh sách việc</Button>} />
      </AppShell>
    )
  }

  const requirementRows: RequirementRow[] = (requirements ?? []).map((requirement) => ({
    requirement,
    approved: (myCertifications ?? []).some((c) => c.certificateTypeId === requirement.certificateTypeId && c.status === 'APPROVED'),
  }))
  // OR, khong phai AND: chi can 1 trong so cac chung chi yeu cau cho danh muc nay duoc duyet
  // la du dieu kien (yeu cau nguoi dung) - neu khong co chung chi nao yeu cau thi khong chan.
  const hasRequiredCert = requirementRows.length === 0 || requirementRows.some((row) => row.approved)
  const certsReady = requirements != null && myCertifications != null
  const canApply = certsReady && kycVerified && hasRequiredCert

  // "De nghi mot muc khac" bat buoc CA 2: gia trong khoang [BUDGET_MIN_THOUSAND,
  // BUDGET_MAX_THOUSAND] va ly do khong rong (yeu cau nguoi dung 2026-09-30, hard block - khong
  // cho gui thieu/sai 1 trong 2). proposedPriceThousand la don vi NGHIN dong nguoi dung go
  // (giong budget cua PostTaskPage.tsx) - nhan 1000 luc gui request o handleApply(). Chon
  // 'accept' luon hop le.
  const proposedPriceThousand = Number(proposedPrice)
  const proposedPriceOutOfRange = proposedPrice.trim() !== ''
    && (Number.isNaN(proposedPriceThousand) || proposedPriceThousand < BUDGET_MIN_THOUSAND
      || proposedPriceThousand > BUDGET_MAX_THOUSAND)
  const priceProposalValid = priceChoice !== 'propose'
    || (proposedPrice.trim() !== '' && !proposedPriceOutOfRange && priceReason.trim().length > 0)

  // So 6 truong Poster sua duoc (UC07) giua ban dang hien thi (current) va ban vua tai lai
  // (fresh) - dung truoc luc gui ung tuyen/hoi them, KHONG dung de hien thi thuong (chi goi luc
  // bam nut). title/description/anh/addressText khoa cung vinh vien nen khong can so.
  const hasEditableInfoChanged = (current: TaskFeedItemResponse, fresh: TaskFeedItemResponse): boolean => (
    current.locationType !== fresh.locationType
      || current.arrivalNotes !== fresh.arrivalNotes
      || current.suppliesStatus !== fresh.suppliesStatus
      || current.suppliesNote !== fresh.suppliesNote
      || current.budgetAmount !== fresh.budgetAmount
      || current.scheduledAt !== fresh.scheduledAt
  )

  /**
   * Kiem tra ngam ngay TRUOC luc thuc su gui ung tuyen/hoi them - Poster co the vua sua thong
   * tin (UC07) sau khi Tasker mo trang nay, ma trang khong tu dong lam moi (getFeedTask() chi
   * goi 1 lan luc mount). Canh bao NHE (theo yeu cau nguoi dung, khong chan cung): neu phat
   * hien khac, cap nhat lai "job" ve gia tri moi nhat + hien banner roi DUNG LAI (chua gui) -
   * Tasker xem lai thong tin moi rong bam nut (Ung tuyen hoac Hoi them, doc lap voi nhau) mot
   * lan nua moi thuc su gui: luc do "job" da la gia tri moi nhat nen lan kiem tra ke tiep se tu
   * thay khong con khac biet va cho qua - KHONG dung co bypass rieng, tranh truong hop bam nut
   * A bi canh bao roi bam nut B lai bo qua kiem tra vi con "nho" trang thai cua nut A. Task
   * khong con OPEN nua (da bi giao/huy) thi coi nhu khong con tim thay, dong bo voi cach !job
   * hien EmptyState o tren. Loi mang khac (khong phai TASK_NOT_FOUND) thi khong chan - de request
   * gui thuc su quyet dinh, BE van la nguon xac nhan cuoi cung.
   */
  const refreshAndCheckStale = async (): Promise<boolean> => {
    try {
      const fresh = await getFeedTask(job.id)
      if (hasEditableInfoChanged(job, fresh)) {
        setJob(fresh)
        setStaleNotice(true)
        return false
      }
      setStaleNotice(false)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TSK-404-TASK_NOT_FOUND') {
        setJob(null)
        return false
      }
      return true
    }
  }

  const handleApply = async () => {
    if (!(await refreshAndCheckStale())) return
    setSubmitting(true)
    applyToTask(job.id, {
      message: message || undefined,
      proposedPrice: priceChoice === 'propose' ? proposedPriceThousand * 1000 : undefined,
      priceReason: priceChoice === 'propose' ? priceReason.trim() : undefined,
    })
      .then(() => {
        setSubmitted(true)
        useToastStore.getState().pushToast('success', 'Đã gửi ứng tuyển. Chờ người đăng xác nhận.')
      })
      .catch((error) => {
        setLoadError(error instanceof ApiError ? error.message : 'Gửi ứng tuyển thất bại, thử lại sau.')
      })
      .finally(() => setSubmitting(false))
  }

  // "Hoi them" (INQUIRING) dung chung dieu kien VERIFIED voi "Gui ung tuyen" (canApply) - Tasker
  // phai co chung chi phu hop danh muc nay moi duoc mo kenh chat hoi truoc, khong rieng dieu
  // kien nao khac (UC16 muc 2). Thanh cong thi dieu huong thang sang khung chat vua mo.
  const handleInquire = async () => {
    if (!(await refreshAndCheckStale())) return
    setInquiring(true)
    createInquiry(job.id, message.trim())
      .then((application) => {
        useToastStore.getState().pushToast('success', 'Đã gửi yêu cầu hỏi thêm.')
        navigate(`/tin-nhan/${application.id}`, {
          state: { counterpartName: job.posterName, counterpartAvatarUrl: job.posterAvatarUrl },
        })
      })
      .catch((error) => {
        setLoadError(error instanceof ApiError ? error.message : 'Gửi yêu cầu hỏi thêm thất bại, thử lại sau.')
      })
      .finally(() => setInquiring(false))
  }

  return (
    <AppShell navValue="feed" title="Chi tiết việc" subtitle={category?.name ?? job.categoryName}>
      <Link
        to="/tim-viec"
        className="flex items-center gap-1"
        style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)', marginBottom: 'var(--sp-4)', width: 'fit-content' }}
      >
        <Icon name="arrow-left" size={15} />Về danh sách việc
      </Link>

      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5">
          <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Badge tone="brand" style={{ alignSelf: 'flex-start' }}>{category?.name ?? job.categoryName}</Badge>
            <h2 style={{ fontSize: 'var(--fs-h1)' }}>{job.title}</h2>
            <div className="flex gap-5 flex-wrap" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{job.addressText}</span>
              <span className="flex items-center gap-1"><Icon name="clock" size={15} />{formatScheduleLabel(job.scheduledAt)}</span>
              <span className="flex items-center gap-1"><Icon name="lock" size={15} />Trả qua tạm giữ</span>
            </div>
            <p style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--text-body)', lineHeight: 1.6, maxWidth: 620 }}>{job.description}</p>

            {job.locationType && <DataRow label="Loại địa điểm" value={LOCATION_TYPE_LABELS[job.locationType]} />}
            {job.arrivalNotes && <DataRow label="Lưu ý khi tới nơi" value={job.arrivalNotes} />}
            <DataRow label="Tình trạng vật tư" value={SUPPLIES_STATUS_LABELS[job.suppliesStatus]} />
            {job.suppliesNote && <DataRow label="Mô tả thêm về vật tư" value={job.suppliesNote} />}

            {job.imageUrls.length > 0 && (
              <Button variant="secondary" size="sm" icon="image" style={{ alignSelf: 'flex-start' }} onClick={() => lightbox.open(job.imageUrls, 0)}>
                Xem ảnh ({job.imageUrls.length})
              </Button>
            )}

            <LifecycleTracker current={1} />
          </Card>

          <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <h3>Gửi ứng tuyển</h3>

            {ready && !kycVerified && (
              <KycStatus
                state={toKycStatusState(kycStatus)}
                reason="Bạn cần xác minh danh tính (KYC) trước khi ứng tuyển bất kỳ việc nào."
                action={<Button size="sm" variant="secondary" onClick={() => navigate('/xac-thuc-danh-tinh')}>Xác minh ngay</Button>}
              />
            )}

            {requirementRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="tc-label">Chứng chỉ cho việc này — chỉ cần có 1 trong số dưới đây</div>
                {requirementRows.map((row) => (
                  <div key={row.requirement.certificateTypeId} className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: row.approved ? 'var(--text-body)' : 'var(--text-muted)' }}>
                    <Icon name={row.approved ? 'badge-check' : 'circle-alert'} size={16} />
                    {row.requirement.certificateTypeName}
                    <Badge tone={row.approved ? 'success' : 'danger'}>{row.approved ? 'Đã có' : 'Chưa chứng minh'}</Badge>
                  </div>
                ))}
              </div>
            )}

            {certsReady && !hasRequiredCert && (
              <Alert
                tone="danger"
                title="Chưa đủ điều kiện để ứng tuyển"
                action={<Button size="sm" icon="upload" onClick={() => navigate('/ho-so-nang-luc')}>Tải chứng chỉ lên</Button>}
              >
                Việc này cần ít nhất 1 trong {requirementRows.length} chứng chỉ ở trên được duyệt. Gửi bản chụp để thẩm định — thường xong trong 1–3 ngày làm việc.
              </Alert>
            )}

            {staleNotice && (
              <Alert tone="warning" title="Thông tin công việc vừa được cập nhật">
                Người đăng vừa sửa lại một số thông tin — trang đã tự tải lại nội dung mới nhất ở trên. Xem lại rồi bấm nút bên dưới một lần nữa nếu bạn vẫn muốn tiếp tục.
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <div className="tc-label">Mức tiền bạn nhận</div>
              <Card
                tone={priceChoice === 'accept' ? 'brand' : 'plain'} interactive padding="var(--sp-4)"
                style={{ cursor: submitted ? 'default' : 'pointer' }}
                onClick={() => !submitted && setPriceChoice('accept')}
              >
                <Radio
                  name="price-choice" value="accept" checked={priceChoice === 'accept'} disabled={submitted}
                  onChange={() => setPriceChoice('accept')}
                  label={job.budgetAmount != null ? `Nhận đúng ${formatVnd(job.budgetAmount)} như người đăng ghi` : 'Thoả thuận giá sau'}
                  description={job.budgetAmount != null
                    ? 'Không cần lý do. Người đăng chọn bạn là giá chốt ngay.'
                    : 'Trao đổi giá phù hợp với người đăng sau khi ứng tuyển.'}
                />
              </Card>
              <Card
                tone={priceChoice === 'propose' ? 'brand' : 'plain'} interactive padding="var(--sp-4)"
                style={{ cursor: submitted ? 'default' : 'pointer' }}
                onClick={() => !submitted && setPriceChoice('propose')}
              >
                <Radio
                  name="price-choice" value="propose" checked={priceChoice === 'propose'} disabled={submitted}
                  onChange={() => setPriceChoice('propose')}
                  label="Đề nghị một mức khác"
                  description="Không giới hạn mức đề nghị, nhưng bắt buộc kèm lý do — người đăng thấy cả hai con số và lý do của bạn."
                />
              </Card>
            </div>

            {priceChoice === 'propose' && (
              <div className="flex gap-3 flex-wrap">
                <Field
                  label="Mức bạn đề nghị"
                  hint="Nhập theo đơn vị nghìn đồng — vd nhập 50 nghĩa là 50.000 đ."
                  error={proposedPriceOutOfRange ? BUDGET_RANGE_MESSAGE : undefined}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  <Input
                    numeric inputMode="numeric"
                    suffix={proposedPrice ? formatThousandVnd(proposedPrice) : 'nghìn đ'}
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(e.target.value.replace(/\D/g, ''))}
                    disabled={submitted}
                    error={proposedPriceOutOfRange}
                  />
                </Field>
                <Field
                  label="Lý do đề nghị khác mức người đăng ghi"
                  hint="Bắt buộc. Lý do này được lưu vào lịch sử giá của công việc."
                  style={{ flex: 2, minWidth: 260 }}
                >
                  <Textarea
                    rows={2} placeholder="Vòi gắn tường phải tháo cả cụm, mất thêm khoảng 1 tiếng…"
                    value={priceReason} onChange={(e) => setPriceReason(e.target.value)} disabled={submitted}
                  />
                </Field>
              </div>
            )}

            <Field label="Lời nhắn ngắn" hint="Nói rõ kinh nghiệm liên quan và cách bạn xử lý — hoặc nêu câu hỏi nếu muốn hỏi thêm trước.">
              <Textarea rows={3} placeholder="Tôi làm điện nước 6 năm, có thể tới đúng giờ…" value={message} onChange={(e) => setMessage(e.target.value)} disabled={submitted} />
            </Field>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                size="lg" icon={submitted ? 'check' : 'send'}
                disabled={!canApply || submitting || inquiring || submitted || !priceProposalValid}
                onClick={() => void handleApply()}
              >
                {submitted ? 'Đã gửi ứng tuyển' : submitting ? 'Đang gửi…' : 'Gửi ứng tuyển'}
              </Button>
              <Button
                variant="secondary" size="lg" icon="message-square"
                disabled={!canApply || submitting || inquiring || submitted || message.trim().length === 0}
                title={!canApply ? 'Cần đủ điều kiện chứng chỉ như khi ứng tuyển mới hỏi thêm được' : message.trim().length === 0 ? 'Nhập câu hỏi trước khi gửi' : undefined}
                onClick={() => void handleInquire()}
              >
                {inquiring ? 'Đang gửi…' : 'Nhắn tin hỏi thêm'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          <Card tone="money" padding="var(--sp-5)">
            {job.budgetAmount != null ? (
              <>
                <MoneyAmount value={job.budgetAmount} size="lg" tone="money" label="Ngân sách người đăng đưa ra" />
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <DataRow label="Phí nền tảng (8%)" value={`−${formatVnd(job.budgetAmount * PLATFORM_FEE_RATE)}`} numeric />
                  <DataRow label="Bạn nhận được" value={formatVnd(job.budgetAmount * (1 - PLATFORM_FEE_RATE))} numeric strong />
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="tc-label" style={{ fontSize: 'var(--fs-label)' }}>Ngân sách</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--amber-700)' }}>
                  <Icon name="handshake" size={20} />
                  Thoả thuận trực tiếp
                </span>
                <p style={{ margin: 0, marginTop: 'var(--sp-1)', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  Trao đổi giá phù hợp với người đăng khi ứng tuyển.
                </p>
              </div>
            )}
          </Card>

          <Alert tone="money" title="Tiền được giữ trước khi bạn bắt đầu">
            Khi người đăng chọn bạn, ngân sách chuyển sang trạng thái tạm giữ. Bạn thấy trạng thái đó trong ví trước khi tới nơi làm.
          </Alert>

          <Card padding="var(--sp-5)" className="flex items-center gap-3">
            <Avatar name={job.posterName ?? 'Người đăng'} src={job.posterAvatarUrl ?? undefined} size={44} />
            <div className="flex-1">
              <strong style={{ fontSize: 'var(--fs-body)' }}>{job.posterName ?? 'Người đăng việc'}</strong>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Người đăng việc</div>
            </div>
          </Card>
          <Button variant="secondary" block icon="user-search" disabled title="Chưa có điểm uy tín — module Đánh giá chưa hoàn thành">
            Xem hồ sơ người đăng
          </Button>
        </div>
      </div>

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
    </AppShell>
  )
}
