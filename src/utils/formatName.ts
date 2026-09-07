/**
 * Chuan hoa ho ten kieu "Title Case" (viet hoa chu cai dau moi tu, phan con lai viet thuong) -
 * vd "lE khanh" -> "Le khanh", "NGUYỄN THỊ MAI" -> "Nguyễn Thị Mai". Gom nhieu khoang trang
 * lien tiep thanh mot. Dung truoc khi luu ho ten o form Dang ky va Xac thuc danh tinh (KYC).
 */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase('vi') + word.slice(1).toLocaleLowerCase('vi'))
    .join(' ')
}
