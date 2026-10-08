// 캔버스로 그리는 지도는 Tailwind 클래스를 쓸 수 없어서 색을 여기 둔다.
// 강조색(BRAND)은 tailwind.config.js의 BRAND.main과 같은 값으로 맞춘다.
export const BRAND = '#F2552C';

/** 오래된 동네 약도처럼 누런 종이색 땅 위에, 다녀간 건물만 노을빛으로 물든다 */
export const MAP_COLORS = {
  /** 동 바깥 땅 */
  land: '#EDE6DC',
  /** 동 안쪽 땅 */
  landInside: '#F6F1EA',
  boundary: '#CDBFAF',
  road: '#FFFDF9',
  rail: '#CBBFB1',
  water: '#D4E2E6',
  green: '#E2E8D3',
  /** 가게가 없는 건물 */
  building: '#E5DDD2',
  buildingStroke: '#D7CDBF',
  /** 가게가 있는 건물 */
  store: '#D9CEC0',
  storeStroke: '#BFB2A2',
  /** 영상이 있는 건물: 영상(방문) 수에 따라 연한 살구색 → 강조색 → 진한 주황 5단계 */
  heat: ['#FFC8B4', '#FFA486', '#FF7E57', BRAND, '#CF3A12'],
  heatStroke: '#A8300C',
  /** 영상이 있는 건물 아래로 번지는 빛 (rgb만, 투명도는 단계별로) */
  glow: '242, 85, 44',
  selected: '#2B221C',
};
