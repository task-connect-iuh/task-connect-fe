// 1 = Thu 2 ... 7 = Chu nhat, khop dung quy uoc BE (xem TaskerAvailability.java).
export const DAY_LABELS: Record<number, string> = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' }
export const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: DAY_LABELS[day] }))
