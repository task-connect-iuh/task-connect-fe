import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Chip } from '@ds/components/core/Chip'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Field } from '@ds/components/forms/Field'
import { Icon } from '@ds/components/core/Icon'
import { Input } from '@ds/components/forms/Input'
import { KycStatus } from '@ds/components/marketplace/KycStatus'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { Tabs } from '@ds/components/navigation/Tabs'
import { AppShell } from '../components/AppShell.tsx'
import { browseOpenTasks } from '../api/tasks.ts'
import type { TaskFeedItemResponse } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { toKycStatusState, useTaskerEligibility } from '../features/tasker/useTaskerEligibility.ts'

type SortMode = 'newest' | 'pay'

function formatScheduleLabel(iso: string | null) {
  if (!iso) return 'Thời gian thoả thuận'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`
}

interface FeedJobCardProps {
  job: TaskFeedItemResponse
  eligible: boolean
  onClick: () => void
}

/** The che 1 viec trong feed - phong theo bo cuc TaskRow cua MyTasksPage.tsx (Poster) de dong
 * bo giao dien giua 2 vai tro. KHONG hien khoang cach (chua co Geo, xem api/tasks.ts) va KHONG
 * hien so nguoi ung tuyen (yeu cau nguoi dung: tang bao mat, khong lo so luong doi thu canh
 * tranh cho Tasker khac xem). */
function FeedJobCard({ job, eligible, onClick }: FeedJobCardProps) {
  return (
    <Card
      interactive
      padding="var(--sp-4)"
      onClick={onClick}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge tone="brand">{job.categoryName}</Badge>
        {!eligible && <Badge tone="warning" icon="lock">Cần chứng chỉ</Badge>}
      </div>
      <strong style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.35, color: 'var(--text-title)' }}>{job.title}</strong>
      <div className="flex flex-wrap gap-3" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1"><Icon name="map-pin" size={15} />{job.addressText}</span>
        <span className="flex items-center gap-1"><Icon name="clock" size={15} />{formatScheduleLabel(job.scheduledAt)}</span>
      </div>
      {job.budgetAmount != null
        ? <MoneyAmount value={job.budgetAmount} size="md" />
        : <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Ngân sách thoả thuận</span>}
    </Card>
  )
}

/**
 * Viec quanh ban (UC10, phan tim/duyet viec) - Tasker. Danh muc loc dung DUNG 5 nhom dich vu
 * that tu listServiceCategories() (khong hardcode), va danh dau "Can chung chi" cho viec thuoc
 * nhom Tasker CHUA co ky nang VERIFIED (thuc thi that o TaskerJobDetailPage khi bam Gui ung
 * tuyen, o day chi la goi y truoc). Danh sach viec goi that qua browseOpenTasks() (module Task,
 * khong con la MOCK_FEED_JOBS - xem docs/TASK-MODULE-SPLIT.md). Chua co bo loc/sap xep theo
 * khoang cach vi Matching/Redis Geo chua ton tai (OQ-02 con MO, xem docs/OPEN-QUESTIONS.md) -
 * chi con loc theo tu khoa + danh muc va sap theo moi nhat/tra cao. KHONG hien so nguoi ung
 * tuyen (yeu cau nguoi dung, tang bao mat). Chi role TASKER vao duoc (RoleGuard o App.tsx).
 */
export function TaskerFeedPage() {
  const navigate = useNavigate()
  const { ready, loadError: eligibilityError, categories, kycStatus, isEligibleForCategory } = useTaskerEligibility()
  const [jobs, setJobs] = useState<TaskFeedItemResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [sort, setSort] = useState<SortMode>('newest')

  useEffect(() => {
    browseOpenTasks()
      .then(setJobs)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách công việc.'))
  }, [])

  const filtered = useMemo(() => {
    const list = (jobs ?? [])
      .filter((job) => categoryId === 'all' || job.categoryId === categoryId)
      .filter((job) => job.title.toLowerCase().includes(q.toLowerCase()))
    return [...list].sort((a, b) => {
      if (sort === 'pay') return (b.budgetAmount ?? 0) - (a.budgetAmount ?? 0)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [jobs, q, categoryId, sort])

  return (
    <AppShell navValue="feed" title="Việc quanh bạn" subtitle="5 nhóm dịch vụ điện – nước">
      {(loadError || eligibilityError) && <Alert tone="danger" title="Không tải được dữ liệu">{loadError || eligibilityError}</Alert>}

      {ready && kycStatus !== 'VERIFIED' && (
        <KycStatus
          state={toKycStatusState(kycStatus)}
          reason={
            kycStatus === 'VERIFYING'
              ? 'Hồ sơ của bạn đang chờ duyệt (thường trong 24 giờ). Bạn xem được toàn bộ feed, nhưng chưa thể ứng tuyển.'
              : kycStatus === 'REJECTED'
                ? 'Hồ sơ xác minh danh tính bị từ chối. Nộp lại để có thể ứng tuyển việc.'
                : 'Bạn cần xác minh danh tính (KYC) trước khi ứng tuyển việc.'
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('/xac-thuc-danh-tinh')}>
              {kycStatus === 'VERIFYING' || kycStatus === 'REJECTED' ? 'Xem hồ sơ xác minh' : 'Đến xác minh'}
            </Button>
          }
          style={{ marginBottom: 'var(--sp-5)' }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--sp-6)', alignItems: 'start' }}>
        <div className="flex flex-col gap-5" style={{ position: 'sticky', top: 'var(--sp-5)' }}>
          <Card padding="var(--sp-5)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Field label="Từ khoá">
              <Input icon="search" placeholder="sửa điện, sửa nước…" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <div>
              <div className="tc-label" style={{ marginBottom: 'var(--sp-2)' }}>Danh mục</div>
              <div className="flex flex-col items-start gap-2">
                <Chip selected={categoryId === 'all'} onClick={() => setCategoryId('all')}>Tất cả danh mục</Chip>
                {(categories ?? []).map((c) => (
                  <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>{c.name}</Chip>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Tabs value={sort} onChange={(v) => setSort(v as SortMode)} tabs={[{ value: 'newest', label: 'Mới nhất' }, { value: 'pay', label: 'Trả cao' }]} style={{ flex: 1 }} />
            <span className="tc-num" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filtered.length} việc</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            {filtered.map((job) => (
              <FeedJobCard
                key={job.id}
                job={job}
                eligible={isEligibleForCategory(job.categoryId)}
                onClick={() => navigate(`/tim-viec/${job.id}`)}
              />
            ))}
          </div>

          {jobs && filtered.length === 0 && (
            <EmptyState
              icon="search-x"
              title="Không có việc nào khớp bộ lọc"
              action={<Button variant="secondary" size="sm" onClick={() => { setQ(''); setCategoryId('all') }}>Xoá bộ lọc</Button>}
            >
              Thử đổi từ khoá hoặc bỏ bớt danh mục.
            </EmptyState>
          )}
        </div>
      </div>
    </AppShell>
  )
}
