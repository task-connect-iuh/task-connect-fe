// Dinh dang rieng cho man Chat/thuong luong gia, dung dung quy uoc 22-vietnamese-copy.md
// (tien "450.000 ₫", ngay gio "09/08 · 10:20" khong nam) - khac formatBudget/formatDateTime
// kieu cu o MyTasksPage.tsx/TaskerJobsPage.tsx (dung "đ" chu va toLocaleString day du), vi day
// la khu vuc code moi nen bam sat dung quy uoc thay vi lap lai cach cu.

/** "450.000 ₫". */
export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`
}

/**
 * "09/08 · 10:20" - khong hien nam, dau "·" phan cach. Dung escape "\u00A0" (khoang trang
 * khong ngat) quanh dau "·" de ngay va gio khong bao gio bi tach lam 2 dong trong cac card hep
 * (danh sach hoi thoai, dong SYSTEM, lich su gia...).
 */
export function formatChatTime(iso: string): string {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  const timePart = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${datePart}\u00A0\u00B7\u00A0${timePart}`
}
