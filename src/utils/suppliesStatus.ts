import type { SuppliesStatus } from '../api/tasks.ts'

// Khop dung vn.taskconnect.task.api.SuppliesStatus o BE - dung cho Select "Tinh trang vat tu"
// o PostTaskPage.tsx.
export const SUPPLIES_STATUS_LABELS: Record<SuppliesStatus, string> = {
  FULL: 'Tôi đã có sẵn vật tư',
  PARTIAL: 'Có một phần, cần mang thêm',
  UNKNOWN: 'Chưa rõ, cần Tasker tư vấn',
}

export const SUPPLIES_STATUS_OPTIONS: { value: SuppliesStatus, label: string }[] = (
  Object.keys(SUPPLIES_STATUS_LABELS) as SuppliesStatus[]
).map((value) => ({ value, label: SUPPLIES_STATUS_LABELS[value] }))
