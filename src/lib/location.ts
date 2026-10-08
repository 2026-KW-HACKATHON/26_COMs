// 현장 인증: 앱에서 촬영할 때 기기 위치가 가게 근처인지 확인한다. 위치는 이 판단에만 쓰고 저장하지 않는다.

/** 가게에서 이 거리(m) 안이면 현장 인증 */
export const ONSITE_METERS = 100;
/** GPS 오차를 이만큼(m)까지는 봐준다 (실내에서는 수십 m 틀리기 쉽다) */
const MAX_ACCURACY_ALLOWANCE = 50;

export interface Fix {
  lat: number;
  lng: number;
  /** 위치 오차 반경(m) */
  accuracy: number;
}

interface FixOptions {
  timeoutMs?: number;
  /** GPS까지 켜서 정확하게 (느리다). 지도 첫 화면처럼 대략이면 되는 곳은 끈다 */
  highAccuracy?: boolean;
  /** 이만큼 지난 위치까지는 새로 잡지 않고 쓴다 */
  maxAgeMs?: number;
}

/** 지금 기기 위치. 권한을 거절했거나 위치를 못 잡으면 null */
export function getFix({ timeoutMs = 10_000, highAccuracy = true, maxAgeMs = 30_000 }: FixOptions = {}): Promise<Fix | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maxAgeMs },
    ),
  );
}

/** 두 지점 사이 거리(m) */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isOnSite(fix: Fix, place: { lat: number; lng: number }) {
  return distanceMeters(fix, place) - Math.min(fix.accuracy, MAX_ACCURACY_ALLOWANCE) <= ONSITE_METERS;
}

/** 35m · 1.2km */
export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}
