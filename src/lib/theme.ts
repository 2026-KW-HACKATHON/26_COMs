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
  buildingStroke: '#D5D9DF',
  /** 가게가 있는 건물 */
  store: '#CDD2D9',
  storeStroke: '#AEB5BF',
  /** 영상이 있는 건물: 영상 수에 따라 진해진다 */
  video: BRAND,
  selected: '#191F28',
};
