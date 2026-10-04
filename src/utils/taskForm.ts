// Hang so + helper dung chung giua form dang viec (PostTaskPage.tsx) va form sua viec
// (EditTaskDialog.tsx, UC07) - tach ra day de 2 noi khong lech gia tri voi nhau va voi
// @Min/@Max tren CreateTaskRequest/UpdateTaskRequest ben BE.

// Bien do ngan sach Poster duoc phep dat, don vi NGHIN dong (o nhap nhan don vi nghin - go "50"
// nghia la 50.000 d). Nguong nghiep vu chot cung nguoi dung 2026-09-16: 100.000 d den
// 50.000.000 d - khop @Min/@Max tren budgetAmount ben BE. De trong van hop le ("thoa thuan").
export const BUDGET_MIN_THOUSAND = 100
export const BUDGET_MAX_THOUSAND = 50_000
export const BUDGET_RANGE_MESSAGE = `Ngân sách phải từ ${(BUDGET_MIN_THOUSAND * 1000).toLocaleString('vi-VN')} đ đến ${(BUDGET_MAX_THOUSAND * 1000).toLocaleString('vi-VN')} đ.`

export function formatVnd(amount: number) {
  return `${amount.toLocaleString('vi-VN')} đ`
}

/** Chuoi so nguyen nguoi dung nhap (don vi nghin dong) -> chuoi tien VND day du, vd "50" -> "50.000 đ". Rong hoac khong phai so tra ve rong. */
export function formatThousandVnd(digitsInThousand: string) {
  const n = Number(digitsInThousand)
  if (!digitsInThousand || Number.isNaN(n)) return ''
  return formatVnd(n * 1000)
}

/** Ngay mai theo gio dia phuong trinh duyet, dang "yyyy-mm-dd" - dung lam min cho lich chon "Thoi gian mong muon" (phai sau hom nay). */
export function tomorrowDateString() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Ghep ngay ("yyyy-mm-dd") + gio ("HH:mm") thanh chuoi Instant ISO-8601 hop le (co giay va
 * "Z") de BE Instant.parse() doc duoc - vd "2026-10-15T09:00:00.000Z". Rong neu chua chon
 * ngay - scheduledAt tuy chon.
 */
export function buildScheduledAtIso(date: string, time: string): string | undefined {
  if (!date) return undefined
  return new Date(`${date}T${time}:00`).toISOString()
}

/**
 * Nguoc lai buildScheduledAtIso() - tach 1 Instant ISO-8601 tu BE thanh cap ngay/gio theo GIO
 * DIA PHUONG trinh duyet, de dien san vao <input type="date"> + TimeSelect khi mo form sua
 * viec (UC07). Tra ve rong ca 2 truong neu iso la null/undefined (chua xac dinh thoi gian).
 */
export function splitScheduledAt(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '09:00' }
  const d = new Date(iso)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { date, time }
}
