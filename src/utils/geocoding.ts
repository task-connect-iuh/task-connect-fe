// Reverse geocoding (toa do -> dia chi) qua Photon (photon.komoot.io) - mien phi, khong can
// API key, du lieu nen la OpenStreetMap. Ban dau dung Nominatim (nominatim.openstreetmap.org)
// nhung domain openstreetmap.org bi mang/tuong lua chan hoan toan luc test thuc te (curl tra
// ve loi ket noi, khong phai loi HTTP) - Photon la dich vu cong khai khac cua Komoot, cung du
// lieu OSM nhung khac domain nen ne duoc cho chan. Xem docs/PROGRESS-FE-USER-MODULE.md.
// Chinh sach dung Photon: mien phi cho luu luong vua phai, khuyen tu host lai neu len
// production luu luong lon - hop quy mo do an, khong hop production that.
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse'

interface PhotonProperties {
  name?: string
  street?: string
  housenumber?: string
  locality?: string
  district?: string
  city?: string
  state?: string
  osm_value?: string
  countrycode?: string
}

interface PhotonResponse {
  features?: Array<{ properties?: PhotonProperties }>
}

export interface ReverseGeocodeResult {
  addressText: string
  operatingArea: string
  /** true khi Photon xac dinh duoc toa do nam trong Viet Nam (countrycode "VN"). false khi
   *  o ngoai bien/nuoc khac/khong xac dinh duoc (vd giua bien, khong co du lieu OSM gan do) -
   *  01-domain-glossary.md gioi han pham vi 5 nhom dich vu dien-nuoc tai Viet Nam, nen toa do
   *  ngoai Viet Nam khong co y nghia nghiep vu, khong nen luu vao ho so. */
  supported: boolean
}

// Photon doi khi tra ten hanh chinh Viet Nam kem tien to/hau to tieng Phap (du lieu OSM quoc
// te gan them ten kieu thuoc dia cu cho vai tinh/thanh lon) thay vi thuan Viet, vd
// "Province de Vinh Long" hay "Hô Chi Minh-Ville". Lam sach tot nhat co the (khong bat buoc,
// theo yeu cau nguoi dung) - bo tien to/hau to Phap chung bang regex, va doi rieng ten 2
// thanh pho hay gap nhat bang bang tra thu cong (regex khong sua duoc phan dau/thanh dieu
// thieu cua chinh ten, vd "Hô Chi Minh" van thieu dau so voi "Hồ Chí Minh").
const FRENCH_ADMIN_AFFIXES = /^(Province|Département|Ville) (de |du |des |d')|-Ville$/gi
const KNOWN_NAME_FIXES: Record<string, string> = {
  'hô chi minh': 'Hồ Chí Minh',
  'ho chi minh': 'Hồ Chí Minh',
  hanoi: 'Hà Nội',
  hanoï: 'Hà Nội',
}

function cleanAdminName(raw: string | undefined): string | undefined {
  if (!raw) return raw
  const stripped = raw.replace(FRENCH_ADMIN_AFFIXES, '').trim()
  const known = KNOWN_NAME_FIXES[stripped.toLowerCase()]
  return known ?? stripped
}

/**
 * Suy ra dia chi (duong/khu vuc gan) va khu vuc hoat dong (quan/phuong + tinh thanh) tu 1 toa
 * do. Ket qua chi la goi y, luon de nguoi dung sua lai tay - du lieu OSM cho Viet Nam khong
 * dong nhat 100% ve cach gan nhan phuong/quan/tinh (dac biet sau dot sap nhap hanh chinh gan
 * day), khong the coi day la nguon chinh xac tuyet doi. Photon khong luon tra ve dia chi
 * duong pho ro rang - co the tra ve ten dia diem/toa nha gan nhat (osm_value khac "highway")
 * neu toa do khong nam sat mot con duong da gan nhan trong OSM.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url = `${PHOTON_REVERSE_URL}?lon=${lng}&lat=${lat}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Không tra được địa chỉ (HTTP ${response.status}).`)
  }
  const payload: PhotonResponse = await response.json()
  const properties = payload.features?.[0]?.properties ?? {}
  const supported = properties.countrycode === 'VN'

  if (!supported) {
    return { addressText: '', operatingArea: '', supported: false }
  }

  const streetLine = [properties.housenumber, properties.street || properties.name].filter(Boolean).join(' ')
  const district = cleanAdminName(properties.district)
  const province = cleanAdminName(properties.city || properties.state)
  const operatingArea = [district, province].filter(Boolean).join(', ')
  const addressText = [streetLine, properties.locality].filter(Boolean).join(', ')

  return { addressText, operatingArea, supported: true }
}
