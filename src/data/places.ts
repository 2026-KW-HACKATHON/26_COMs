import data from './wolgye1.json';

// 월계1동 식당·카페 목록 (OpenStreetMap 스냅샷, `node scripts/fetch-places.mjs`로 갱신)
export interface Place {
  id: string;
  name: string;
  category: string;
  cuisine: string;
  address: string;
  lat: number;
  lng: number;
}

export const PLACES: Place[] = data.places;
export const BOUNDARY = data.boundary as [number, number][];

const byId = new Map(PLACES.map((p) => [p.id, p]));
export const getPlace = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

export const CATEGORY_EMOJI: Record<string, string> = {
  음식점: '🍚',
  카페: '☕',
  패스트푸드: '🍔',
  술집: '🍺',
};

const CUISINE: Record<string, string> = {
  korean: '한식',
  japanese: '일식',
  chinese: '중식',
  asian: '아시안',
  chicken: '치킨',
  burger: '버거',
  pizza: '피자',
  steak_house: '고기',
  fish: '생선',
  curry: '카레',
  coffee_shop: '커피',
  bubble_tea: '버블티',
  dessert: '디저트',
  donut: '도넛',
  sandwich: '샌드위치',
  salad: '샐러드',
};

/** 'curry;japanese' → '카레·일식'. 이미 한글이면 그대로 쓴다. */
export function cuisineLabel(cuisine: string) {
  return cuisine
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => CUISINE[c] ?? (/[가-힣]/.test(c) ? c : ''))
    .filter(Boolean)
    .join('·');
}

export function placeSubtitle(place: Place) {
  return [place.category, cuisineLabel(place.cuisine)].filter(Boolean).join(' · ');
}
