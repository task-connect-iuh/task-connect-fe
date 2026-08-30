/**
 * Goi y sua loi go ten mien email pho bien (vd "gmail.comm" -> "gmail.com").
 * Khong the xac minh mien co that su ton tai hay khong tu phia client (can tra DNS/MX,
 * ngoai pham vi FE) - day chi la goi y dua tren khoang cach chinh ta voi vai mien pho
 * bien nhat, nguoi dung van co the bo qua va giu nguyen email da nhap.
 */
const KNOWN_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com']

/** Khoang cach chinh ta Levenshtein chuan giua 2 chuoi. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const distances: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))

  for (let i = 0; i < rows; i++) distances[i][0] = i
  for (let j = 0; j < cols; j++) distances[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      )
    }
  }

  return distances[rows - 1][cols - 1]
}

/**
 * Tra ve email da sua neu ten mien gan giong (khoang cach 1-2 ky tu) mot mien pho bien
 * nhung khong khop tuyet doi; tra ve null neu email da dung mien pho bien, chua co "@",
 * hoac khong du giong mien nao de goi y (tranh goi y sai cho mien rieng hop le).
 */
export function suggestEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at === -1 || at === email.length - 1) return null

  const domain = email.slice(at + 1).toLowerCase()
  if (KNOWN_EMAIL_DOMAINS.includes(domain)) return null

  let bestMatch: string | null = null
  let bestDistance = Infinity
  for (const known of KNOWN_EMAIL_DOMAINS) {
    const distance = levenshteinDistance(domain, known)
    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = known
    }
  }

  if (bestMatch && bestDistance > 0 && bestDistance <= 2) {
    return email.slice(0, at + 1) + bestMatch
  }
  return null
}
