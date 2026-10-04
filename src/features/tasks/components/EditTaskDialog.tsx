import { useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { Dialog } from '@ds/components/feedback/Dialog'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'
import { Select } from '@ds/components/forms/Select'
import { Textarea } from '@ds/components/forms/Textarea'
import { DialogViewport } from '../../../components/DialogViewport.tsx'
import { TimeSelect } from '../../../components/TimeSelect.tsx'
import { useLockBodyScroll } from '../../../utils/useLockBodyScroll.ts'
import { LOCATION_TYPE_OPTIONS } from '../../../utils/locationType.ts'
import { SUPPLIES_STATUS_OPTIONS } from '../../../utils/suppliesStatus.ts'
import {
  BUDGET_MAX_THOUSAND, BUDGET_MIN_THOUSAND, BUDGET_RANGE_MESSAGE,
  buildScheduledAtIso, formatThousandVnd, splitScheduledAt, tomorrowDateString,
} from '../../../utils/taskForm.ts'
import { FIELD_LOCKED_ERROR_CODE, getTask, updateTask } from '../../../api/tasks.ts'
import type { SuppliesStatus, TaskEditableField, TaskResponse, UpdateTaskPayload } from '../../../api/tasks.ts'
import type { LocationType } from '../../../api/users.ts'
import { ApiError } from '../../../api/client.ts'
import { useToastStore } from '../../../stores/useToastStore.ts'

interface EditTaskDialogProps {
  task: TaskResponse
  onClose: () => void
  onSaved: () => void
}

/**
 * Poster sua mot cong viec da dang (UC07) - chi mo khi task.status con OPEN/PENDING_REVIEW
 * (TaskRow.tsx trong MyTasksPage.tsx chi hien nut "Sửa" trong 2 truong hop nay). 3 tang field:
 * Tang 1 (loai dia diem, luu y khi toi noi) luon sua tu do; Tang 2 tach 2 muc khoa doc lap nhau
 * (yeu cau nguoi dung 2026-09-30, vong 2): ngan sach disable khi task.budgetLocked (con BAT KY
 * don PENDING/INQUIRING/INVITED/TIME_CHANGED_NEEDS_RECONFIRM - nhay cam hon nen khoa som hon),
 * vat tu disable khi task.suppliesLocked (HEP hon, CHI khi con PENDING/TIME_CHANGED_NEEDS_RECONFIRM
 * - INQUIRING/INVITED khong khoa vat tu); Tang 3 (thoi gian mong muon) luon sua duoc. Tieu de/
 * mo ta/anh/dia chi khoa cung vinh vien - hien read-only o dau dialog, khong co o nhap. Nhanh
 * rieng cho FIELD_LOCKED_HAS_APPLICANTS (tinh huong dua hiem: co don moi phat sinh giua luc mo
 * form va luc bam Luu) giu nguyen gia tri Poster vua nhap trong preservedDraft, chi reset dung
 * cac field bi khoa ve gia tri moi nhat tu server.
 */
export function EditTaskDialog({ task, onClose, onSaved }: EditTaskDialogProps) {
  useLockBodyScroll(true)

  const [budgetLocked, setBudgetLocked] = useState(task.budgetLocked)
  const [suppliesLocked, setSuppliesLocked] = useState(task.suppliesLocked)
  // Rieng cho hint cua Tang 3 (chi don PENDING moi bi flag TIME_CHANGED_NEEDS_RECONFIRM khi doi
  // gio - INQUIRING/INVITED khong bi anh huong) - khac 2 co tren, KHONG dung chung.
  const [pendingApplicantCount, setPendingApplicantCount] = useState(task.pendingApplicantCount)

  const [locationType, setLocationType] = useState<LocationType | ''>(task.locationType ?? '')
  const [arrivalNotes, setArrivalNotes] = useState(task.arrivalNotes ?? '')
  const [suppliesStatus, setSuppliesStatus] = useState<SuppliesStatus | ''>(task.suppliesStatus)
  const [suppliesNote, setSuppliesNote] = useState(task.suppliesNote ?? '')
  const [budget, setBudget] = useState(task.budgetAmount != null ? String(task.budgetAmount / 1000) : '')
  const initialSchedule = splitScheduledAt(task.scheduledAt)
  const [scheduledDate, setScheduledDate] = useState(initialSchedule.date)
  const [scheduledTime, setScheduledTime] = useState(initialSchedule.time)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  // Tinh huong dua hiem: BE tra 409 FIELD_LOCKED_HAS_APPLICANTS du form da disable Tang 2 (co
  // ung vien PENDING moi phat sinh giua luc mo form va luc bam Luu, hoac 2 tab cung mo). Giu lai
  // nhung gia tri Poster vua nhap o day de ho xem lai/chep, KHONG mat trang khi submit that bai.
  const [raceLockedFields, setRaceLockedFields] = useState<TaskEditableField[] | null>(null)
  const [preservedDraft, setPreservedDraft] = useState<{ suppliesStatus: SuppliesStatus | ''; suppliesNote: string; budget: string } | null>(null)
  const [showPreservedDraft, setShowPreservedDraft] = useState(false)

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {}
    if (!suppliesStatus) nextErrors.suppliesStatus = 'Chọn tình trạng vật tư.'
    if (scheduledDate && scheduledDate < tomorrowDateString()) {
      nextErrors.scheduledAt = 'Thời gian mong muốn phải sau hôm nay.'
    }
    if (budget.trim()) {
      const budgetInThousand = Number(budget)
      if (Number.isNaN(budgetInThousand) || budgetInThousand < BUDGET_MIN_THOUSAND || budgetInThousand > BUDGET_MAX_THOUSAND) {
        nextErrors.budgetAmount = BUDGET_RANGE_MESSAGE
      }
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const payload: UpdateTaskPayload = {
      locationType: locationType || null,
      arrivalNotes: arrivalNotes.trim() || null,
      suppliesStatus: suppliesStatus as SuppliesStatus,
      suppliesNote: suppliesStatus !== 'UNKNOWN' ? (suppliesNote.trim() || null) : null,
      budgetAmount: budget.trim() ? Number(budget) * 1000 : null,
      scheduledAt: buildScheduledAtIso(scheduledDate, scheduledTime) ?? null,
    }

    setFormError('')
    setBusy(true)
    try {
      await updateTask(task.id, payload)
      useToastStore.getState().pushToast('success', 'Đã cập nhật công việc.')
      onSaved()
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.code === FIELD_LOCKED_ERROR_CODE) {
        const locked = (error.details as { lockedFields?: TaskEditableField[] } | undefined)?.lockedFields ?? []
        setPreservedDraft({ suppliesStatus, suppliesNote, budget })
        setRaceLockedFields(locked)
        try {
          const fresh = await getTask(task.id)
          setBudgetLocked(fresh.budgetLocked)
          setSuppliesLocked(fresh.suppliesLocked)
          setPendingApplicantCount(fresh.pendingApplicantCount)
          setSuppliesStatus(fresh.suppliesStatus)
          setSuppliesNote(fresh.suppliesNote ?? '')
          setBudget(fresh.budgetAmount != null ? String(fresh.budgetAmount / 1000) : '')
        } catch {
          // Khong lay duoc gia tri moi nhat - van giu banner giai thich, Poster tu bam Luu lai sau.
        }
        return
      }
      const fieldErrors = error instanceof ApiError && error.details && typeof error.details === 'object'
        ? error.details as Record<string, string>
        : null
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }))
      } else {
        setFormError(error instanceof ApiError ? error.message : 'Không sửa được công việc. Kiểm tra mạng rồi thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogViewport>
      <Dialog title="Sửa công việc" subtitle={task.title} onClose={onClose} style={{ maxWidth: 560 }}>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: 'var(--sp-1)' }}>
          <div className="flex flex-col gap-4">
            {formError && <Alert tone="danger" title="Không sửa được công việc">{formError}</Alert>}

            {raceLockedFields && raceLockedFields.length > 0 && (
              <Alert
                tone="warning"
                title="Vừa có người ứng tuyển"
                action={
                  <Button size="sm" variant="secondary" icon="eye" onClick={() => setShowPreservedDraft(true)}>
                    Xem thông tin vừa nhập
                  </Button>
                }
              >
                Có người ứng tuyển ngay khi bạn đang sửa, nên ngân sách/tình trạng vật tư đã khoá lại
                và được đặt về giá trị hiện tại. Các thay đổi khác của bạn vẫn được giữ nguyên.
              </Alert>
            )}

            <DataRow label="Tiêu đề" value={task.title} />
            <DataRow label="Địa chỉ" value={task.addressText} />

            <Field label="Loại địa điểm">
              <Select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType | '')}
                disabled={busy}
                options={[{ value: '', label: 'Chưa chọn' }, ...LOCATION_TYPE_OPTIONS]}
              />
            </Field>

            <Field label="Lưu ý khi tới nơi">
              <Input value={arrivalNotes} maxLength={500} onChange={(e) => setArrivalNotes(e.target.value)} disabled={busy} />
            </Field>

            <Field label="Tình trạng vật tư" required error={errors.suppliesStatus}>
              <Select
                value={suppliesStatus}
                onChange={(e) => setSuppliesStatus(e.target.value as SuppliesStatus | '')}
                disabled={busy || suppliesLocked}
                error={!!errors.suppliesStatus}
                options={[{ value: '', label: 'Chọn tình trạng vật tư' }, ...SUPPLIES_STATUS_OPTIONS]}
              />
            </Field>

            {(suppliesStatus === 'FULL' || suppliesStatus === 'PARTIAL') && (
              <Field label="Mô tả thêm (không bắt buộc)">
                <Textarea
                  rows={3}
                  value={suppliesNote}
                  onChange={(e) => setSuppliesNote(e.target.value)}
                  disabled={busy || suppliesLocked}
                />
              </Field>
            )}

            <Field
              label="Ngân sách"
              hint="Đơn vị nghìn đồng — để trống hiển thị 'thoả thuận'"
              error={errors.budgetAmount}
              style={{ maxWidth: 280 }}
            >
              <Input
                numeric inputMode="numeric"
                suffix={budget ? formatThousandVnd(budget) : 'nghìn đ'}
                value={budget}
                onChange={(e) => { setBudget(e.target.value.replace(/\D/g, '')); setErrors((prev) => ({ ...prev, budgetAmount: '' })) }}
                disabled={busy || budgetLocked}
                error={!!errors.budgetAmount}
              />
            </Field>

            <Field
              label="Thời gian mong muốn"
              hint={pendingApplicantCount > 0 ? 'Đổi thời gian sẽ yêu cầu những người đang ứng tuyển xác nhận lại.' : undefined}
              error={errors.scheduledAt}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  min={tomorrowDateString()}
                  value={scheduledDate}
                  onChange={(e) => { setScheduledDate(e.target.value); setErrors((prev) => ({ ...prev, scheduledAt: '' })) }}
                  disabled={busy}
                  error={!!errors.scheduledAt}
                  style={{ maxWidth: 200 }}
                />
                <TimeSelect value={scheduledTime} onChange={setScheduledTime} disabled={busy || !scheduledDate} />
              </div>
            </Field>

            <Button size="lg" icon="save" disabled={busy} onClick={() => void handleSubmit()} style={{ alignSelf: 'flex-start' }}>
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      </Dialog>

      {showPreservedDraft && preservedDraft && (
        <DialogViewport>
          <Dialog title="Thông tin bạn vừa nhập" onClose={() => setShowPreservedDraft(false)} style={{ maxWidth: 420 }}>
            <div className="flex flex-col gap-3">
              <DataRow label="Tình trạng vật tư" value={preservedDraft.suppliesStatus ? SUPPLIES_STATUS_OPTIONS.find((o) => o.value === preservedDraft.suppliesStatus)?.label ?? '' : 'Chưa chọn'} />
              {preservedDraft.suppliesNote && <DataRow label="Mô tả thêm về vật tư" value={preservedDraft.suppliesNote} />}
              <DataRow label="Ngân sách" value={preservedDraft.budget ? formatThousandVnd(preservedDraft.budget) : 'Thoả thuận'} numeric />
              <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Đây là giá trị bạn vừa nhập trước khi bị khoá lại — chưa được lưu vào công việc. Bạn có thể chép lại để nhập lần sau khi hết bị khoá.
              </p>
            </div>
          </Dialog>
        </DialogViewport>
      )}
    </DialogViewport>
  )
}
