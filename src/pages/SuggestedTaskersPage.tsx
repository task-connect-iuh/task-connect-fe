import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Icon } from '@ds/components/core/Icon'
import { AppShell } from '../components/AppShell.tsx'
import { getMyTasks, getTask } from '../api/tasks.ts'
import type { TaskResponse } from '../api/tasks.ts'
import { ApiError } from '../api/client.ts'
import { SuggestedTaskersPanel } from '../features/matching/SuggestedTaskersPanel.tsx'

/**
 * Trang "Tasker gợi ý" (UC09 mở rộng) - mục nav riêng ở HEADER (AppShell.tsx, value "matches"),
 * KHÔNG phải tab phụ trong dialog chi tiết việc của MyTasksPage.tsx (đã bỏ, xem lịch sử sửa
 * trong PROGRESS-AI-MATCHING-MODULE.md). Mục "matches" vốn đã có sẵn trong POSTER_ONLY_NAV
 * (AppShell.tsx) nhưng chưa gán `to` (hiện "Sắp ra mắt", bấm không đi đâu) - giờ nối route thật
 * vào đây, đúng đề nghị trực tiếp của người dùng: "thêm giao diện mới cho tab tasker gợi ý ở
 * header" thay vì chỉ 1 nút trong dialog.
 *
 * 2 route dùng chung page này (App.tsx):
 * - `/goi-y-tasker` (không taskId): danh sách việc đang OPEN của Poster để CHỌN xem gợi ý cho
 *   việc nào - gợi ý luôn gắn với 1 Task cụ thể, không có khái niệm "gợi ý chung chung".
 * - `/goi-y-tasker/:taskId`: gợi ý cho đúng 1 việc đã chọn (hoặc mở thẳng từ nút trong
 *   MyTasksPage.tsx / dialog sau khi đăng việc ở PostTaskPage.tsx).
 */
export function SuggestedTaskersPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskResponse | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!taskId) return
    setTask(undefined)
    getTask(taskId)
      .then(setTask)
      .catch((error) => {
        setTask(null)
        setLoadError(error instanceof ApiError ? error.message : 'Không tải được công việc này.')
      })
  }, [taskId])

  if (!taskId) {
    return <TaskPicker onPick={(id) => navigate(`/goi-y-tasker/${id}`)} />
  }

  if (task === undefined) {
    return (
      <AppShell navValue="matches" title="Tasker gợi ý">
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Đang tải…</p>
      </AppShell>
    )
  }

  if (!task) {
    return (
      <AppShell navValue="matches" title="Tasker gợi ý">
        {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}
        <EmptyState icon="search-x" title="Không tìm thấy công việc này" action={<Button onClick={() => navigate('/goi-y-tasker')}>Chọn việc khác</Button>} />
      </AppShell>
    )
  }

  return (
    <AppShell navValue="matches" title="Tasker gợi ý" subtitle={task.title}>
      <Link
        to="/goi-y-tasker"
        className="flex items-center gap-1"
        style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)', marginBottom: 'var(--sp-4)', width: 'fit-content' }}
      >
        <Icon name="arrow-left" size={15} />Chọn việc khác
      </Link>

      <SuggestedTaskersPanel taskId={task.id} task={task} />
    </AppShell>
  )
}

interface TaskPickerProps {
  onPick: (taskId: string) => void
}

/**
 * Danh sách việc đang OPEN của Poster để chọn xem gợi ý Tasker - gợi ý AI luôn gắn với 1 Task
 * cụ thể (khoảng cách/giá/lịch rảnh so với đúng việc đó), không có trang "gợi ý chung" cho mọi
 * việc cùng lúc. Chỉ liệt kê OPEN (ASSIGNED đã có Tasker, mời thêm không còn ý nghĩa - cùng
 * điều kiện với nút trong MyTasksPage.tsx và TaskerInviteService.create() ở backend).
 */
function TaskPicker({ onPick }: TaskPickerProps) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskResponse[] | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getMyTasks()
      .then(setTasks)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được danh sách công việc.'))
  }, [])

  const openTasks = (tasks ?? []).filter((t) => t.status === 'OPEN')

  return (
    <AppShell navValue="matches" title="Tasker gợi ý" subtitle="Chọn một việc đang mở để xem Tasker được AI xếp hạng">
      {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}

      {tasks == null && !loadError && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>Đang tải…</p>
      )}

      {tasks != null && openTasks.length === 0 && (
        <EmptyState
          icon="radar"
          title="Chưa có việc nào đang mở"
          action={<Button icon="file-plus-2" onClick={() => navigate('/dang-viec')}>Đăng việc mới</Button>}
        />
      )}

      <div className="flex flex-col gap-3">
        {openTasks.map((task) => (
          <Card
            key={task.id}
            padding="var(--sp-4) var(--sp-5)"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', cursor: 'pointer' }}
            onClick={() => onPick(task.id)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone="brand">{task.categoryName}</Badge>
              </div>
              <strong style={{ display: 'block', marginTop: 6, fontSize: 'var(--fs-body)' }}>{task.title}</strong>
              <span className="flex items-center gap-1" style={{ marginTop: 4, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                <Icon name="map-pin" size={15} />{task.addressText}
              </span>
            </div>
            <Button size="sm" icon="sparkles" onClick={() => onPick(task.id)}>Xem gợi ý</Button>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}
