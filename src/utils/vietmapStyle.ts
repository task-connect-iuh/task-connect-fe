// URL style ban do dung chung cho moi component dung vietmap-gl-js (LocationPickerMap,
// DirectionsModal) - tranh lap lai key/URL o nhieu noi. "tm" la style mac dinh cua VietMap
// (tuong duong "Streets"), du dung cho ca chon vi tri lan xem tuyen duong.
const TILEMAP_KEY = import.meta.env.VITE_VIETMAP_TILEMAP_KEY as string | undefined

export const VIETMAP_STYLE_URL = `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${TILEMAP_KEY ?? ''}`
