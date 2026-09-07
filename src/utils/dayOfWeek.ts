// 1 = Thu 2 ... 7 = Chu nhat, khop dung quy uoc BE (xem TaskerAvailability.java).
export const DAY_LABELS: Record<number, string> = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' }
export const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: DAY_LABELS[day] }))
// Nhan rut gon cho Chip chon nhieu ngay cung luc (vd khung gio ranh) - khong du cho o dai nhu DAY_LABELS.
export const DAY_SHORT_LABELS: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }
