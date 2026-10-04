import { useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Dialog } from '@ds/components/feedback/Dialog'
import { DialogViewport } from '../../../components/DialogViewport.tsx'
import { useLockBodyScroll } from '../../../utils/useLockBodyScroll.ts'
import { cancelTask } from '../../../api/tasks.ts'
import type { TaskResponse } from '../../../api/tasks.ts'
import { ApiError } from '../../../api/client.ts'
import { useToastStore } from '../../../stores/useToastStore.ts'

interface CancelTaskDialogProps {
  task: TaskResponse
  onClose: () => void
  onCancelled: () => void
}

/**
 * Poster tu huy cong viec cua chinh minh (UC07) - chi mo khi task.status con OPEN/PENDING_REVIEW.
 * Tu do hoan toan khong phan biet co ung vien hay khong (khac EditTaskDialog.tsx, khong co
 * dieu kien khoa nao o day) - dialog xac nhan chi de tranh bam nham, khong phai gate nghiep vu.
 */
export function CancelTaskDialog({ task, onClose, onCancelled }: CancelTaskDialogProps) {
  useLockBodyScroll(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleCancel = async () => {
    setBusy(true)
    setError('')
    try {
      await cancelTask(task.id)
      useToastStore.getState().pushToast('success', 'Đã huỷ công việc.')
      onCancelled()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không huỷ được công việc. Kiểm tra mạng rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogViewport>
      <Dialog title="Xác nhận huỷ công việc" subtitle={task.title} onClose={onClose} style={{ maxWidth: 440 }}>
        <div className="flex flex-col gap-4">
          {error && <Alert tone="danger" title="Không huỷ được công việc">{error}</Alert>}
          <Alert tone="danger" title="Không thể hoàn tác">
            Công việc sẽ chuyển sang trạng thái "Đã huỷ".
            {task.pendingApplicantCount > 0 && ` Hiện có ${task.pendingApplicantCount} người đang chờ bạn xác nhận, `}
            {task.pendingApplicantCount > 0 ? 'họ' : 'Mọi người đang ứng tuyển/hỏi thêm'} sẽ nhận được thông báo và hội thoại liên quan sẽ được đóng lại.
          </Alert>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" disabled={busy} onClick={onClose}>Để sau</Button>
            <Button variant="danger" icon="trash-2" disabled={busy} onClick={() => void handleCancel()}>
              {busy ? 'Đang huỷ…' : 'Huỷ công việc'}
            </Button>
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}
