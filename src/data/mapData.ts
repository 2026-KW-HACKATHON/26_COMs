import raw from './wolgye1-map.json';
import { BOUNDARY, PLACES, type Place } from './places';

// 월계1동 벡터 지도 데이터 (건물 윤곽·도로 등, `node scripts/fetch-map.mjs`로 갱신)
// 좌표는 origin 기준 polyline(정밀도 1e-6) 문자열로 저장되어 있어 처음 쓸 때 한 번 푼다.

export type LatLng = [number, number];

export interface MapLabel {
  name: string;
  kind: 'road' | 'road-major' | 'station' | 'school' | 'park';
  lat: number;
  lng: number;
  angle?: number;
}

export interface Building {
  index: number;
  ring: LatLng[];
  /** 지도에 이름표를 붙일 위치 (윤곽의 무게중심) */
  center: LatLng;
  /** 이 건물에 있는 가게 (가게가 없는 건물은 빈 배열) */
  places: Place[];
}

/** 가게 위치가 건물 밖(인도 등)에 찍혀 있을 때 이 거리(m) 안의 가장 가까운 건물에 붙인다 */
const SNAP_METERS = 20;

const ORIGIN = raw.origin as LatLng;

function decode(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0;
  let lat = Math.round(ORIGIN[0] * 1e6);
  let lng = Math.round(ORIGIN[1] * 1e6);
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

// 동 하나 크기라 평면(m)으로 계산해도 충분하다
const M_LAT = 111_320;
const M_LNG = 111_320 * Math.cos((ORIGIN[0] * Math.PI) / 180);
const toXY = ([lat, lng]: LatLng): [number, number] => [(lng - ORIGIN[1]) * M_LNG, (lat - ORIGIN[0]) * M_LAT];

function insideRing([x, y]: [number, number], ring: [number, number][]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance([px, py]: [number, number], ring: [number, number][]) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function areaAndCentroid(ring: [number, number][]) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  a /= 2;
  if (Math.abs(a) < 1e-6) return { area: 0, centroid: ring[0] };
  return { area: Math.abs(a), centroid: [cx / (6 * a), cy / (6 * a)] as [number, number] };
}

function build() {
  const rings = raw.buildings.map(decode);
  const xy = rings.map((ring) => ring.map(toXY));
  const boxes = xy.map((ring) => {
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  });
  const shapes = xy.map(areaAndCentroid);

  const buildingOf = new Map<string, number>();
  const placesOf = new Map<number, Place[]>();
  const unmatched: Place[] = [];

  for (const place of PLACES) {
    const p = toXY([place.lat, place.lng]);
    let hit = -1;
    let hitArea = Infinity;
    let near = -1;
    let nearDist = SNAP_METERS;
    for (let i = 0; i < xy.length; i++) {
      const [x0, y0, x1, y1] = boxes[i];
      if (p[0] < x0 - SNAP_METERS || p[0] > x1 + SNAP_METERS || p[1] < y0 - SNAP_METERS || p[1] > y1 + SNAP_METERS) continue;
      // 건물끼리 겹치면 더 작은(구체적인) 건물
      if (insideRing(p, xy[i])) {
        if (shapes[i].area < hitArea) {
          hit = i;
          hitArea = shapes[i].area;
        }
      } else if (hit < 0) {
        const d = edgeDistance(p, xy[i]);
        if (d < nearDist) {
          near = i;
          nearDist = d;
        }
      }
    }
    const index = hit >= 0 ? hit : near;
    if (index < 0) {
      unmatched.push(place);
      continue;
    }
    buildingOf.set(place.id, index);
    placesOf.set(index, [...(placesOf.get(index) ?? []), place]);
  }

  const buildings: Building[] = rings.map((ring, index) => {
    const [cx, cy] = shapes[index].centroid;
    return {
      index,
      ring,
      center: [ORIGIN[0] + cy / M_LAT, ORIGIN[1] + cx / M_LNG],
      places: placesOf.get(index) ?? [],
    };
  });

  // 처음 보여 줄 범위: 가게가 모여 있는 곳 (멀리 떨어진 5%씩은 빼고)
  const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)];
  const lats = PLACES.map((p) => p.lat);
  const lngs = PLACES.map((p) => p.lng);
  const focus: [LatLng, LatLng] = [
    [quantile(lats, 0.05), quantile(lngs, 0.05)],
    [quantile(lats, 0.95), quantile(lngs, 0.95)],
  ];

  return {
    buildings,
    /** 가게가 있는 건물 */
    placeBuildings: buildings.filter((b) => b.places.length),
    /** 가게가 있는 건물을 찾지 못한 가게 (지도에 점으로 표시) */
    unmatched,
    buildingOf,
    roads: {
      major: raw.roads.major.map(decode),
      minor: raw.roads.minor.map(decode),
      lane: raw.roads.lane.map(decode),
    },
    rail: raw.rail.map(decode),
    water: raw.water.map(decode),
    waterways: raw.waterways.map(decode),
    green: raw.green.map(decode),
    labels: raw.labels as MapLabel[],
    focus,
    /** 지도 데이터가 있는 범위 (이 밖으로는 이동하지 않는다) */
    view: raw.view as [LatLng, LatLng],
    boundary: BOUNDARY as LatLng[],
    attribution: raw.source,
  };
}

let cache: ReturnType<typeof build> | null = null;

/** 지도 데이터 (처음 부를 때 한 번 풀어 둔다) */
export function getMapData() {
  cache ??= build();
  return cache;
}

/** 같은 건물에 있는 가게들 (자신 포함). 건물을 못 찾은 가게는 자신만 */
export function placesInSameBuilding(place: Place): Place[] {
  const data = getMapData();
  const index = data.buildingOf.get(place.id);
  return index === undefined ? [place] : data.buildings[index].places;
}
