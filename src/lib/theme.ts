// 캔버스로 그리는 지도는 Tailwind 클래스를 쓸 수 없어서 색을 여기 둔다.
// 강조색(BRAND)은 tailwind.config.js의 BRAND.main과 같은 값으로 맞춘다.
export const BRAND = '#5E68C4';

export const MAP_COLORS = {
  /** 동 바깥 땅 */
  land: '#EEF0F6',
  /** 동 안쪽 땅 */
  landInside: '#F8F9FC',
  boundary: '#C6CBDD',
  road: '#FFFFFF',
  rail: '#CACFDE',
  water: '#DAE6F7',
  green: '#E3F1EA',
  /** 가게가 없는 건물 */
  building: '#E7EAF2',
  buildingStroke: '#DADEEA',
  /** 가게가 있는 건물 */
  store: '#DDE1EE',
  storeStroke: '#C3C9DC',
  /** 영상이 있는 건물: 영상(방문) 수에 따라 옅은 하늘색 → 라벤더 → 페리윙클 5단계 */
  heat: ['#C3CFF0', '#AEB7E6', '#A79BDA', '#8E80CD', BRAND],
  heatStroke: '#4E56A8',
  /** 영상이 있는 건물 아래로 번지는 빛 (rgb만, 투명도는 단계별로) */
  glow: '122, 104, 194',
  selected: '#2C3346',
};
