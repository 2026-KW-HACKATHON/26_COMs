// 캔버스로 그리는 지도는 Tailwind 클래스를 쓸 수 없어서 색을 여기 둔다.
// 강조색(BRAND)은 tailwind.config.js의 BRAND.main과 같은 값으로 맞춘다.
export const BRAND = '#0C9A6B';

export const MAP_COLORS = {
  /** 동 바깥 땅 */
  land: '#ECEEF1',
  /** 동 안쪽 땅 */
  landInside: '#F4F5F7',
  boundary: '#C9CED6',
  road: '#FFFFFF',
  rail: '#C2C8D0',
  water: '#D6E6F5',
  green: '#E4EEE6',
  /** 가게가 없는 건물 */
  building: '#E1E4E9',
  buildingStroke: '#D3D8DE',
  /** 가게가 있는 건물 */
  store: '#D0D5DC',
  storeStroke: '#B3BAC4',
  /**
   * 영상이 있는 건물: 영상(방문) 수에 따라 5단계. 단계마다 [왼쪽 위, 오른쪽 아래] 두 색의 그라데이션으로 칠한다
   * (왼쪽 위는 푸른 민트로 밝게, 오른쪽 아래는 초록으로 진하게 → 빛을 받은 듯 입체적으로)
   */
  heat: [
    ['#DDF7F1', '#ADE8D2'],
    ['#B9F0E4', '#72DBB5'],
    ['#88E6D4', '#35C493'],
    ['#4BD6C2', BRAND],
    ['#1FBBA6', '#06704D'],
  ] as [string, string][],
  heatStroke: '#056143',
  /** 영상이 있는 건물 아래로 번지는 빛 (rgb만, 투명도는 단계별로) */
  glow: '18, 184, 134',
  selected: '#191F28',
};
