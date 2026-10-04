import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Dialog } from '@ds/components/feedback/Dialog'
import { DialogViewport } from '../../../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../../../utils/useLockBodyScroll.ts'
import { getTaskEditOfMessage } from '../../../api/chat.ts'
import type { TaskEditDiffResponse } from '../../../api/chat.ts'
import type { TaskEditableField } from '../../../api/tasks.ts'
import { ApiError } from '../../../api/client.ts'
import { LOCATION_TYPE_LABELS } from '../../../utils/locationType.ts'
import { SUPPLIES_STATUS_LABELS } from '../../../utils/suppliesStatus.ts'
import { formatVnd } from '../../../utils/taskForm.ts'

// Nhan tieng Viet cho tung field sua duoc cua UC07 - khop TaskEditableField (api/tasks.ts).
const FIELD_LABEL: Record<TaskEditableField, string> = {
  LOCATION_TYPE: 'Loại địa điểm',
  ARRIVAL_NOTES: 'Lưu ý khi tới nơi',
  BUDGET_AMOUNT: 'Ngân sách',
  SUPPLIES_STATUS: 'Tình trạng vật tư',
  SUPPLIES_NOTE: 'Mô tả thêm về vật tư',
  SCHEDULED_AT: 'Thời gian mong muốn',
}

/**
 * Dinh dang 1 gia tri THO (tu TaskEditDiffResponse.changes, xem Javadoc BE
 * TaskEditEvent/TaskEditChange) thanh chuoi hien thi theo dung loai field - null nghia la
 * "Chưa có" (vd suppliesNote rong, budgetAmount = "thoả thuận").
 */
function formatEditValue(field: TaskEditableField, raw: string | null): string {
  if (raw == null) return 'Chưa có'
  switch (field) {
    case 'BUDGET_AMOUNT':
      return formatVnd(Number(raw))
    case 'SCHEDULED_AT':
      return new Date(raw).toLocaleString('vi-VN')
    case 'SUPPLIES_STATUS':
      return SUPPLIES_STATUS_LABELS[raw as keyof typeof SUPPLIES_STATUS_LABELS] ?? raw
    case 'LOCATION_TYPE':
      return LOCATION_TYPE_LABELS[raw as keyof typeof LOCATION_TYPE_LABELS] ?? raw
    default:
      return raw
  }
}

interface TaskEditDiffDialogProps {
  applicationId: string
  messageId: string
  onClose: () => void
}

/**
 * Chi tiet "cũ -> mới" cua 1 lan Poster sua cong viec (UC07) - mo khi bam nut "Xem chi tiết
 * thay đổi" tren 1 SYSTEM message co refTaskEditId (xem SystemMessageRow.tsx/InboxPage.tsx).
 */
export function TaskEditDiffDialog({ applicationId, messageId, onClose }: TaskEditDiffDialogProps) {
  useLockBodyScroll(true)
  const [diff, setDiff] = useState<TaskEditDiffResponse | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getTaskEditOfMessage(applicationId, messageId)
      .then(setDiff)
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được chi tiết thay đổi.'))
  }, [applicationId, messageId])

  return (
    <DialogViewport>
      <Dialog title="Chi tiết thay đổi" subtitle="Poster vừa cập nhật thông tin công việc" onClose={onClose} style={{ maxWidth: 480 }}>
        <div className="flex flex-col gap-3">
          {loadError && <Alert tone="danger" title="Không tải được dữ liệu">{loadError}</Alert>}
          {!diff && !loadError && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tải…</p>
          )}
          {diff?.changes.map((change, index) => (
            <div key={index} style={{ paddingBottom: 'var(--sp-2)', borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}>
              <div className="tc-label">{FIELD_LABEL[change.field]}</div>
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 4, fontSize: 'var(--fs-sm)' }}>
                <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                  {formatEditValue(change.field, change.oldValue)}
                </span>
                <span>→</span>
                <strong>{formatEditValue(change.field, change.newValue)}</strong>
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </DialogViewport>
  )
}
