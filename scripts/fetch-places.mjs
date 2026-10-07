// 월계1동 식당·카페 목록과 동 경계를 OpenStreetMap에서 받아 src/data/wolgye1.json으로 저장한다.
// 사용법: node scripts/fetch-places.mjs
// Overpass가 느리거나 504를 주면 Nominatim fallback으로 최신 데이터를 보완한다.
import { readFile, writeFile } from 'node:fs/promises';

const RELATION_ID = 3882987; // 서울 노원구 월계1동
const HOSTS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const CATEGORY = { restaurant: '음식점', cafe: '카페', fast_food: '패스트푸드', bar: '술집', pub: '술집' };

async function overpass(query) {
  for (const host of [...HOSTS, ...HOSTS]) {
    try {
      const res = await fetch(host, {
        method: 'POST',
        headers: { 'User-Agent': '26_COMs-hackathon/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return await res.json();
      console.warn(host, res.status);
    } catch (err) {
      console.warn(host, err.message);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('모든 Overpass 서버 요청 실패');
}

async function getFallbackBoundary() {
  try {
    const dataText = await readFile(new URL('../src/data/wolgye1.json', import.meta.url), 'utf8');
    const data = JSON.parse(dataText);
    if (Array.isArray(data.boundary) && data.boundary.length > 2) {
      return data.boundary;
    }
  } catch {
    // 파일이 없거나 읽기 실패해도 다음 기본 bbox로 진행
  }

  return [
    [37.630158, 127.059016],
    [37.627705, 127.055166],
    [37.627174, 127.054333],
    [37.625458, 127.05164],
    [37.624407, 127.049989],
    [37.623463, 127.050836],
    [37.622095, 127.052145],
    [37.620941, 127.05332],
    [37.619966, 127.054506],
    [37.619179, 127.055714],
    [37.618472, 127.056663],
    [37.617647, 127.057441],
    [37.616487, 127.059282],
    [37.615771, 127.060671],
    [37.615067, 127.060858],
    [37.614875, 127.06112],
    [37.614632, 127.061591],
    [37.61441, 127.062014],
    [37.614379, 127.062181],
    [37.614315, 127.062512],
    [37.614435, 127.063169],
    [37.614489, 127.063517],
    [37.614554, 127.063946],
    [37.614879, 127.065397],
    [37.614951, 127.0658],
    [37.61915, 127.064079],
    [37.622062, 127.063197],
    [37.623747, 127.062455],
    [37.625425, 127.061133],
    [37.627502, 127.06008],
    [37.62814, 127.059824],
    [37.630158, 127.059016],
  ];
}

async function fetchNominatimPlaces(bounds) {
  const types = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub'];
  const byId = new Map();

  for (const type of types) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ko&limit=200&bounded=1&viewbox=${bounds.minlon},${bounds.maxlat},${bounds.maxlon},${bounds.minlat}&amenity=${type}`;
    const res = await fetch(url, { headers: { 'User-Agent': '26_COMs-hackathon/1.0', Accept: 'application/json' } });
    if (!res.ok) {
      console.warn('Nominatim fallback failed', type, res.status);
      continue;
    }

    const data = await res.json();
    for (const place of data) {
      const lat = Number(place.lat);
      const lng = Number(place.lon);
      const id = `${place.osm_type}/${place.osm_id}`;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !place.name) continue;
      byId.set(id, {
        id,
        name: place.name.replace(/\s*\([A-Za-z0-9 .,'&\-()]+\)\s*$/, '').trim(),
        category: CATEGORY[place.type] ?? '음식점',
        cuisine: '',
        address: place.display_name || '',
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

let boundary = await getFallbackBoundary();
let ring = boundary;

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function inside([lat, lng]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

let list = [];
let bounds = { minlat: Math.min(...boundary.map(([lat]) => lat)), minlon: Math.min(...boundary.map(([, lng]) => lng)), maxlat: Math.max(...boundary.map(([lat]) => lat)), maxlon: Math.max(...boundary.map(([, lng]) => lng)) };

try {
  const data = await overpass(`[out:json][timeout:60];rel(${RELATION_ID});out geom;`);
  const rel = data.elements[0];
  if (rel?.members) {
    const ways = rel.members
      .filter((m) => m.type === 'way' && m.role === 'outer')
      .map((m) => m.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]));

    if (ways.length) {
      const ringStart = [...ways.shift()];
      const ring2 = [...ringStart];
      while (ways.length) {
        const last = ring2.at(-1);
        const index = ways.findIndex((w) => same(w[0], last) || same(w.at(-1), last));
        if (index < 0) break;
        const [w] = ways.splice(index, 1);
        ring2.push(...(same(w[0], last) ? w : w.reverse()).slice(1));
      }
      boundary = ring2;
      ring = boundary;
      bounds = {
        minlat: Math.min(...boundary.map(([lat]) => lat)),
        minlon: Math.min(...boundary.map(([, lng]) => lng)),
        maxlat: Math.max(...boundary.map(([lat]) => lat)),
        maxlon: Math.max(...boundary.map(([, lng]) => lng)),
      };
    }
  }
} catch (err) {
  console.warn('Boundary fetch failed, using saved boundary fallback:', err.message);
}

// OSM에 식당·카페로 잘못 등록된 편의점 (대학 건물 안 매점 등). 동네 가게 지도·"176곳 중 N곳"에서 뺀다
const NOT_A_RESTAURANT = /^(CU|GS25|7-?Eleven|세븐일레븐|이마트24|emart24|미니스톱|MINISTOP)$/i;
const isRestaurant = (p) => !NOT_A_RESTAURANT.test(p.name);

try {
  const placesRes = await overpass(`[out:json][timeout:60];
nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](${bounds.minlat},${bounds.minlon},${bounds.maxlat},${bounds.maxlon});
out center tags;`);

  list = placesRes.elements
    .map((e) => {
      const t = e.tags;
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const address = t['addr:full'] || [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
      const name = (t['name:ko'] || t.name || '').replace(/\s*\([A-Za-z0-9 .,'&\-()]+\)\s*$/, '').trim();
      return {
        id: `${e.type}/${e.id}`,
        name,
        category: CATEGORY[t.amenity] ?? '음식점',
        cuisine: t.cuisine ?? '',
        address,
        lat: Number(lat?.toFixed(6)),
        lng: Number(lng?.toFixed(6)),
      };
    })
    .filter((p) => p.name && isRestaurant(p) && Number.isFinite(p.lat) && Number.isFinite(p.lng) && inside([p.lat, p.lng]))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
} catch (err) {
  console.warn('Overpass place fetch failed, using Nominatim fallback:', err.message);
  list = (await fetchNominatimPlaces(bounds)).filter((p) => p.name && isRestaurant(p) && inside([p.lat, p.lng]));
}

if (!list.length) {
  list = (await fetchNominatimPlaces(bounds)).filter((p) => p.name && isRestaurant(p) && inside([p.lat, p.lng]));
}

if (!list.length) {
  throw new Error('최신 식당 데이터를 가져오지 못했습니다.');
}

await writeFile(
  new URL('../src/data/wolgye1.json', import.meta.url),
  JSON.stringify({ source: '© OpenStreetMap contributors (ODbL)', fetchedAt: new Date().toISOString().slice(0, 10), boundary: ring, places: list }),
);
console.log(`places: ${list.length}, boundary points: ${ring.length}`);
