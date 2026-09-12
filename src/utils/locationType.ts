import type { LocationType } from '../api/users.ts'

// Khop dung vn.taskconnect.user.api.LocationType o BE - dung chung cho Select "Loai dia
// diem" o ca ProfilePage.tsx (ho so Poster) va PostTaskPage.tsx (Noi lam viec cua tung tin dang).
export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  NHA_RIENG: 'Nhà riêng',
  CAN_HO_CHUNG_CU: 'Căn hộ chung cư',
  CUA_HANG: 'Cửa hàng',
  VAN_PHONG: 'Văn phòng',
}

export const LOCATION_TYPE_OPTIONS: { value: LocationType, label: string }[] = (
  Object.keys(LOCATION_TYPE_LABELS) as LocationType[]
).map((value) => ({ value, label: LOCATION_TYPE_LABELS[value] }))
