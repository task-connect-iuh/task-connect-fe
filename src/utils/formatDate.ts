/** Dinh dang mot ISO datetime/date string sang dd/mm/yyyy theo locale vi-VN, dung chung cho cac man hinh Ho so ky nang. */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('vi-VN')
}
