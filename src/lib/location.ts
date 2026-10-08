// 기기 위치: 지도를 내 주변으로 확대할 때만 쓴다. 기기 안에서만 쓰고 서버에 보내거나 저장하지 않는다.

export interface Fix {
  lat: number;
  lng: number;
  /** 위치 오차 반경(m) */
  accuracy: number;
}

interface FixOptions {
  timeoutMs?: number;
  /** GPS까지 켜서 정확하게 (느리다). 지도를 내 주변으로 옮기는 정도는 대략이면 된다 */
  highAccuracy?: boolean;
  /** 이만큼 지난 위치까지는 새로 잡지 않고 쓴다 */
  maxAgeMs?: number;
}

/** 지금 기기 위치. 권한을 거절했거나 위치를 못 잡으면 null */
export function getFix({ timeoutMs = 8_000, highAccuracy = false, maxAgeMs = 120_000 }: FixOptions = {}): Promise<Fix | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maxAgeMs },
    ),
  );
}
