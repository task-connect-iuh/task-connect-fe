import { apiFetch } from './client.ts'

// Khop MapController.java (backend proxy VietMap) - FE KHONG goi thang maps.vietmap.vn cho
// reverse geocode/autocomplete/place/route, tranh lo VIETMAP_API_KEY qua network tab/bundle
// JS. Rieng tile/style ban do (VietMapMap.tsx) goi thang tu trinh duyet bang tilemap-key
// (VITE_VIETMAP_TILEMAP_KEY) - key do buoc phai cong khai de MapLibre tai duoc, khac ban chat
// voi apikey dung o day.

export interface GeocodeResult {
  addressText: string
  operatingArea: string
  supported: boolean
  lat: number | null
  lng: number | null
}

/** Toa do -> dia chi gan nhat. */
export function reverseGeocodeApi(lat: number, lng: number) {
  return apiFetch<GeocodeResult>(`/map/reverse-geocode?lat=${lat}&lng=${lng}`)
}

export interface AddressSuggestionApi {
  refId: string
  label: string
  addressText: string
  operatingArea: string
  /** Chi khac null khi backend fallback sang Photon (VietMap het quota/sap he thong) - Photon
   *  tra toa do ngay trong ket qua tim kiem, khac VietMap phai goi rieng resolvePlaceApi(). */
  lat: number | null
  lng: number | null
}

/** Goi y dia chi tu chuoi go tim - KHONG kem toa do, xem resolvePlaceApi(). */
export function autocompleteApi(text: string, signal?: AbortSignal) {
  return apiFetch<AddressSuggestionApi[]>(`/map/autocomplete?text=${encodeURIComponent(text)}`, { signal })
}

export interface PlaceDetailApi {
  addressText: string
  operatingArea: string
  lat: number
  lng: number
}

/** Phan giai 1 goi y (refId) thanh dia chi day du + toa do - goi khi nguoi dung chon 1 dong trong dropdown. */
export function resolvePlaceApi(refId: string) {
  return apiFetch<PlaceDetailApi>(`/map/place?refId=${encodeURIComponent(refId)}`)
}

export interface LatLngApi {
  lat: number
  lng: number
}

export interface RouteResultApi {
  distanceMeters: number
  durationSeconds: number
  path: LatLngApi[]
}

export type VietMapVehicle = 'car' | 'motorcycle'

/** Chi duong giua 2 diem - mac dinh xe may (phuong tien pho bien nhat cua Tasker tai Viet Nam). */
export function getRouteApi(fromLat: number, fromLng: number, toLat: number, toLng: number, vehicle: VietMapVehicle = 'motorcycle') {
  return apiFetch<RouteResultApi>(
    `/map/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}&vehicle=${vehicle}`,
  )
}
