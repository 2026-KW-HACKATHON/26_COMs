// 캔버스로 그리는 지도는 Tailwind 클래스를 쓸 수 없어서 색을 여기 둔다.
// 강조색(BRAND)은 tailwind.config.js의 BRAND.main과 같은 값으로 맞춘다.
export const BRAND = '#3182F6';

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
   * (왼쪽 위는 하늘색으로 밝게, 오른쪽 아래는 파랑으로 진하게 → 빛을 받은 듯 입체적으로)
   */
  heat: [
    ['#E6F4FF', '#BCDBFE'],
    ['#CDEBFF', '#8DC0FB'],
    ['#A3DAFF', '#5DA2F8'],
    ['#6CC4FF', BRAND],
    ['#38A6F5', '#1953C0'],
  ] as [string, string][],
  heatStroke: '#164AA6',
  /** 영상이 있는 건물 아래로 번지는 빛 (rgb만, 투명도는 단계별로) */
  glow: '49, 130, 246',
  selected: '#191F28',
};
