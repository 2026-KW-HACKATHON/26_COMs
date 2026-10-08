// 캔버스로 그리는 지도는 Tailwind 클래스를 쓸 수 없어서 색을 여기 둔다.
// 강조색(BRAND)은 tailwind.config.js의 BRAND.main과 같은 값으로 맞춘다.
export const BRAND = '#F2552C';

export const MAP_COLORS = {
  /** 동 바깥 땅 */
  land: '#ECEEF1',
  /** 동 안쪽 땅 */
  landInside: '#F4F5F7',
  boundary: '#C9CED6',
  road: '#FFFFFF',
  rail: '#C2C8D0',
  water: '#D6E6F5',
  green: '#E1EFE3',
  /** 가게가 없는 건물 */
  building: '#E1E4E9',
  buildingStroke: '#D3D8DE',
  /** 가게가 있는 건물 */
  store: '#D0D5DC',
  storeStroke: '#B3BAC4',
  /** 영상이 있는 건물: 영상(방문) 수에 따라 연한 살구색 → 강조색 → 진한 주황 5단계 */
  heat: ['#FFC8B4', '#FFA486', '#FF7E57', BRAND, '#CF3A12'],
  heatStroke: '#A8300C',
  /** 영상이 있는 건물 아래로 번지는 빛 (rgb만, 투명도는 단계별로) */
  glow: '242, 85, 44',
  selected: '#191F28',
};
