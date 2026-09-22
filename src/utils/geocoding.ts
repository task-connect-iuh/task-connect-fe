// Reverse geocoding + autocomplete dia chi qua VietMap (maps.vietmap.vn), goi qua backend
// (api/map.ts) de khong lo VIETMAP_API_KEY ra frontend. Truoc day dung Photon (photon.komoot.io,
// mien phi khong key) - doi sang VietMap theo yeu cau nguoi dung: du lieu dia chi Viet Nam
// chinh xac hon, va co san API dinh tuyen (chi duong) dung chung 1 provider - xem
// components/DirectionsModal.tsx. Backend TU DONG fallback ve lai Photon khi VietMap het
// quota/sap he thong (xem MapService.java) - module nay khong can biet dieu do, chi doc
// lat/lng co san hay khong tren tung goi y (xem resolveSuggestion()).
import { autocompleteApi, reverseGeocodeApi, resolvePlaceApi } from '../api/map.ts'
import type { AddressSuggestionApi } from '../api/map.ts'

export interface ReverseGeocodeResult {
  addressText: string
  operatingArea: string
  /** true khi VietMap tra duoc it nhat 1 ket qua cho toa do nay. false khi khong co du lieu
   *  (vd giua bien, ngoai vung phu) - VietMap chi phu Viet Nam nen "supported" o day chu yeu
   *  phan biet "co ket qua" voi "khong co ket qua", khac y nghia cu (trong/ngoai Viet Nam) khi
   *  con dung Photon (OSM toan cau). */
  supported: boolean
}

/**
 * Suy ra dia chi (duong/khu vuc gan) va khu vuc hoat dong (phuong/xa + tinh/thanh) tu 1 toa do.
 * Ket qua chi la goi y, luon de nguoi dung sua lai tay.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const result = await reverseGeocodeApi(lat, lng)
  return { addressText: result.addressText, operatingArea: result.operatingArea, supported: result.supported }
}

export interface AddressSuggestion {
  /** Id noi bo VietMap dung de goi Place v4 lay toa do that su khi nguoi dung chon dong nay. */
  refId: string
  /** Chuoi hien trong dropdown goi y. */
  label: string
  addressText: string
  operatingArea: string
  /** Chi khac null khi backend dang fallback sang Photon (xem api/map.ts) - da co toa do san,
   *  resolveSuggestion() se bo qua buoc goi Place API. */
  lat: number | null
  lng: number | null
}

/**
 * Tim goi y dia chi tu chuoi nguoi dung dang go (autocomplete kieu GrabFood). VietMap
 * Autocomplete v4 KHONG tra toa do truc tiep (tiet kiem quota vi 1 lan go co the ra 8+ goi y
 * nhung nguoi dung chi chon 1) - goi resolveSuggestion() rieng khi nguoi dung THAT SU chon 1
 * dong. Nhan AbortSignal de noi goi tu huy request cu khi nguoi dung go tiep.
 */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const items: AddressSuggestionApi[] = await autocompleteApi(query, signal)
  return items.map((item) => ({
    refId: item.refId,
    label: item.label,
    addressText: item.addressText,
    operatingArea: item.operatingArea,
    lat: item.lat,
    lng: item.lng,
  }))
}

export interface ResolvedAddress {
  addressText: string
  operatingArea: string
  lat: number
  lng: number
}

/**
 * Phan giai 1 goi y (tu searchAddress) thanh dia chi day du + toa do that su - xem
 * AddressAutocomplete.tsx. Goi y da co san lat/lng (backend dang fallback Photon, xem
 * AddressSuggestion.lat/lng) thi tra ve NGAY, khong goi them Place API - VietMap moi can
 * buoc phan giai rieng nay, Photon da tra toa do tu luc tim kiem.
 */
export async function resolveSuggestion(suggestion: AddressSuggestion): Promise<ResolvedAddress> {
  if (suggestion.lat != null && suggestion.lng != null) {
    return { addressText: suggestion.addressText, operatingArea: suggestion.operatingArea, lat: suggestion.lat, lng: suggestion.lng }
  }
  const place = await resolvePlaceApi(suggestion.refId)
  return {
    addressText: place.addressText || suggestion.addressText,
    operatingArea: place.operatingArea || suggestion.operatingArea,
    lat: place.lat,
    lng: place.lng,
  }
}
