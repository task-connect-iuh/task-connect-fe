// Reverse geocoding (toa do -> dia chi) qua Photon (photon.komoot.io) - mien phi, khong can
// API key, du lieu nen la OpenStreetMap. Ban dau dung Nominatim (nominatim.openstreetmap.org)
// nhung domain openstreetmap.org bi mang/tuong lua chan hoan toan luc test thuc te (curl tra
// ve loi ket noi, khong phai loi HTTP) - Photon la dich vu cong khai khac cua Komoot, cung du
// lieu OSM nhung khac domain nen ne duoc cho chan. Xem docs/PROGRESS-FE-USER-MODULE.md.
// Chinh sach dung Photon: mien phi cho luu luong vua phai, khuyen tu host lai neu len
// production luu luong lon - hop quy mo do an, khong hop production that.
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse'
// Endpoint forward-geocoding/autocomplete cua chinh Photon (khac /reverse) - dung cho o goi y
// dia chi kieu GrabFood: go chu, tra ve danh sach ung vien kem toa do, khong can go du dia chi
// roi moi tra ve nhu /reverse. Cung mien phi, cung du lieu OSM, khong can API key.
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api'
// DA THU va BO bias lat/lon co dinh ve TP.HCM: kiem chung bang curl truoc khi chot cho thay
// bias nay lam LECH ket qua sang TP.HCM ngay ca voi dia diem noi tieng o tinh/thanh khac -
// vd go "cau long bien" (Ha Noi that) tra ve xen ca ket qua "Thanh pho Ho Chi Minh"/"Hoa Long"
// trong top 5 khi co bias, nhung toan bo top 5 dung la Ha Noi khi bo bias. Anh dia ly VN
// (goi y phai dung tinh/thanh nguoi dung go, khong chi rieng TP.HCM), nen KHONG truyen
// lat/lon o day - de Photon xep hang thuan tuy theo do khop van ban.

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

interface PhotonFeature {
  properties?: PhotonProperties
  geometry?: { coordinates?: [number, number] } // GeoJSON: [lon, lat]
}

interface PhotonResponse {
  features?: PhotonFeature[]
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
 * Ghep addressText/operatingArea tu properties tho cua Photon - dung chung cho reverseGeocode
 * (toa do -> dia chi) va searchAddress (go chu -> danh sach goi y), de 2 luong cho ra cung
 * dinh dang du liu, khong lech nhau ve cach hien thi.
 */
function toAddressParts(properties: PhotonProperties) {
  const streetLine = [properties.housenumber, properties.street || properties.name].filter(Boolean).join(' ')
  const district = cleanAdminName(properties.district)
  const province = cleanAdminName(properties.city || properties.state)
  const operatingArea = [district, province].filter(Boolean).join(', ')
  const addressText = [streetLine, properties.locality].filter(Boolean).join(', ')
  return { addressText, operatingArea }
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

  return { ...toAddressParts(properties), supported: true }
}

export interface AddressSuggestion {
  /** Chuoi hien trong dropdown goi y. */
  label: string
  addressText: string
  operatingArea: string
  lat: number
  lng: number
}

/**
 * Tim goi y dia chi tu chuoi nguoi dung dang go (autocomplete kieu GrabFood) - goi endpoint
 * /api (khac /reverse) cua Photon. Loc san countrycode !== "VN" ngay tai day, dropdown khong
 * bao gio hien goi y ngoai Viet Nam (cung ranh gioi nghiep vu voi reverseGeocode). Nhan
 * AbortSignal de noi goi tu huy request cu khi nguoi dung go tiep - tranh response cu ve tre
 * de len danh sach goi y moi (da gap loi tuong tu o CertificationQueuePage.tsx ben admin).
 */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  // KHONG truyen lang=vi: Photon public instance chi ho tro "default"/de/en/fr, truyen "vi"
  // bi tu choi thang voi loi "Language is not supported" (da test bang curl truoc khi chot).
  // "default" (bo qua param lang, giong cach reverseGeocode dang lam) van tra ten tieng Viet
  // dung, vi du la properties goc cua OSM, khong phai ban dich theo locale.
  const url = `${PHOTON_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=8`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Không tìm được địa chỉ (HTTP ${response.status}).`)
  }
  const payload: PhotonResponse = await response.json()
  const features = payload.features ?? []

  return features
    .filter((feature) => feature.properties?.countrycode === 'VN' && feature.geometry?.coordinates)
    .map((feature) => {
      const properties = feature.properties as PhotonProperties
      const [lng, lat] = feature.geometry!.coordinates!
      const { addressText, operatingArea } = toAddressParts(properties)
      const label = [addressText, operatingArea].filter(Boolean).join(', ') || properties.name || ''
      return { label, addressText, operatingArea, lat, lng }
    })
    .filter((suggestion) => suggestion.label)
}
