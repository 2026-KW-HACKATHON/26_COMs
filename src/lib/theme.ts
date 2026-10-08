// 캔버스로 그리는 지도는 Tailwind 클래스를 쓸 수 없어서 색을 여기 둔다.
// 강조색(BRAND)은 tailwind.config.js의 BRAND.main과 같은 값으로 맞춘다.
export const BRAND = '#3B6FD4';

export const MAP_COLORS = {
  /** 동 바깥 땅 */
  land: '#EFF0F2',
  /** 동 안쪽 땅 */
  landInside: '#F9FAFB',
  boundary: '#C9CDD4',
  road: '#FFFFFF',
  rail: '#CDD1D7',
  water: '#DCE8F6',
  green: '#E2EFE5',
  /** 가게가 없는 건물 */
  building: '#E8EAED',
  buildingStroke: '#DADDE2',
  /** 가게가 있는 건물 */
  store: '#DEE1E6',
  storeStroke: '#C5CAD2',
  /** 영상이 있는 건물: 영상(방문) 수에 따라 옅은 블루 → 강조색 5단계 (단색 면) */
  heat: ['#CFDDF6', '#AFC6F0', '#8AAAE7', '#628CDD', BRAND],
  heatStroke: '#2F5DB8',
  /** 영상이 있는 건물 아래로 번지는 빛 (rgb만, 투명도는 단계별로). 플랫 디자인이라 PlaceMap에서 투명도 0 */
  glow: '59, 111, 212',
  selected: '#1F2329',
};
