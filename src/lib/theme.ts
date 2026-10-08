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
  /** 가게가 없는 건물 (누를 수 없음): 바탕에 묻히게 옅은 회색 */
  building: '#E6E8EC',
  buildingStroke: '#DCDFE4',
  /** 가게가 있는 건물 (누를 수 있음): 옅은 건물·흰 길과 확실히 구별되게 진한 회색 면 + 더 진한 테두리 */
  store: '#A7B0BB',
  storeStroke: '#4E5968',
  /** 고른 가게 (아직 안 간 곳) */
  storeSelected: '#8B95A1',
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

/** 그룹 지도에서 한 그룹원의 땅을 칠하는 색 */
export interface TerritoryColor {
  main: string;
  /** 왼쪽 위(연하게) → 오른쪽 아래(진하게) 그라데이션 */
  fill: readonly [string, string];
  /** 다녀간 가게의 두꺼운 테두리 (주인 색보다 진하게) */
  stroke: string;
  /** 아래로 번지는 빛 (rgb만) */
  glow: string;
}

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
/** 흰색과 섞어 연하게 */
const tint = (hex: string, white: number) => toHex(rgbOf(hex).map((c) => c + (255 - c) * white));
/** 검은색과 섞어 진하게 */
const shade = (hex: string, black: number) => toHex(rgbOf(hex).map((c) => c * (1 - black)));

/**
 * 그룹원 색 (schema.sql의 group_members.color 번호 순서, 8개라 그룹은 8명까지).
 * 이웃한 번호끼리 색약에서도 구분되는 순서로 검증한 팔레트. 연한 색은 바탕과 대비가 낮아서
 * 지도 말풍선에 땅 주인 이름 첫 글자를 함께 붙여 색만으로 구분하지 않게 한다
 */
export const GROUP_COLORS: TerritoryColor[] = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#4A3AA7', '#E34948'].map(
  (main) => ({ main, fill: [tint(main, 0.45), main], stroke: shade(main, 0.3), glow: rgbOf(main).join(', ') }),
);
export const groupColor = (index: number) => GROUP_COLORS[index] ?? GROUP_COLORS[0];
