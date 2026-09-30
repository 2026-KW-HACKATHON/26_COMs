// 월계1동 식당·카페 목록과 동 경계를 OpenStreetMap(Overpass API)에서 받아 src/data/wolgye1.json으로 저장한다.
// 사용법: node scripts/fetch-places.mjs
import { writeFile } from 'node:fs/promises';

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

// 1) 동 경계 (outer way들을 이어 하나의 폴리곤으로)
const boundary = await overpass(`[out:json][timeout:60];rel(${RELATION_ID});out geom;`);
const rel = boundary.elements[0];
const ways = rel.members
  .filter((m) => m.type === 'way' && m.role === 'outer')
  .map((m) => m.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const ring = [...ways.shift()];
while (ways.length) {
  const last = ring.at(-1);
  const i = ways.findIndex((w) => same(w[0], last) || same(w.at(-1), last));
  if (i < 0) break;
  const [w] = ways.splice(i, 1);
  ring.push(...(same(w[0], last) ? w : w.reverse()).slice(1));
}

function inside([lat, lng]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// 2) 경계를 감싸는 사각형 범위의 식당·카페 → 경계 안쪽만 남김 (area 쿼리는 서버 타임아웃이 잦다)
const { minlat, minlon, maxlat, maxlon } = rel.bounds;
const places = await overpass(`[out:json][timeout:60];
nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"](${minlat},${minlon},${maxlat},${maxlon});
out center tags;`);

const list = places.elements
  .map((e) => {
    const t = e.tags;
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const address = t['addr:full'] || [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    return {
      id: `${e.type}/${e.id}`,
      // "두루곱창(DooRoo Gopchang)" → "두루곱창"
      name: (t['name:ko'] || t.name).replace(/\s*\([A-Za-z0-9 .,'&\-()]+\)\s*$/, '').trim(),
      category: CATEGORY[t.amenity],
      cuisine: t.cuisine ?? '',
      address,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
    };
  })
  .filter((p) => p.name && p.lat && inside([p.lat, p.lng]))
  .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

await writeFile(
  new URL('../src/data/wolgye1.json', import.meta.url),
  JSON.stringify({ source: '© OpenStreetMap contributors (ODbL)', fetchedAt: new Date().toISOString().slice(0, 10), boundary: ring, places: list }),
);
console.log(`places: ${list.length}, boundary points: ${ring.length}`);
