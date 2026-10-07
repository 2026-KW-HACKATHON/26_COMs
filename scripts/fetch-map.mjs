// 월계1동 지도 데이터(건물 윤곽·도로·철도·물·공원·지명)를 OpenStreetMap에서 받아 src/data/wolgye1-map.json으로 저장한다.
// 사용법: node scripts/fetch-map.mjs
// 동 경계는 fetch-places.mjs가 만든 src/data/wolgye1.json을 쓴다.
// OSM_FILE=받아둔.json 을 주면 Overpass 대신 그 파일(Overpass `out geom` 응답)을 읽는다.
//
// 앱은 지도 타일 이미지 대신 이 데이터를 직접 그린다 (src/components/PlaceMap.tsx).
// 용량을 줄이려고 선을 단순화하고, 좌표는 origin 기준 Google polyline(정밀도 1e-6) 문자열로 저장한다.
import { readFile, writeFile } from 'node:fs/promises';

const HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const OUT = new URL('../src/data/wolgye1-map.json', import.meta.url);

/** 동 경계 바깥으로 이만큼(m)까지 도로·물·공원을 그린다. 건물은 동 안쪽만 */
const CONTEXT_PAD = 260;
/** 선 단순화 허용 오차(m) */
const TOLERANCE = { building: 0.35, road: 0.8, area: 1.5 };
/** 이보다 작은 건물(창고·부스)은 뺀다(㎡) */
const MIN_BUILDING_AREA = 6;

const ROAD_CLASS = [
  ['major', /^(motorway|trunk|primary|secondary)(_link)?$/],
  ['minor', /^(tertiary(_link)?|unclassified|residential)$/],
  ['lane', /^(living_street|service|pedestrian)$/],
];
const SKIP_SERVICE = new Set(['parking_aisle', 'driveway', 'drive-through', 'emergency_access']);

const { boundary } = JSON.parse(await readFile(new URL('../src/data/wolgye1.json', import.meta.url), 'utf8'));
if (!Array.isArray(boundary) || boundary.length < 3) throw new Error('wolgye1.json에 동 경계가 없습니다. 먼저 node scripts/fetch-places.mjs');

// ── 좌표계: 동 중심을 원점으로 하는 평면(m). 동 하나 크기라 왜곡은 무시할 만하다 ──
const lats = boundary.map(([lat]) => lat);
const lngs = boundary.map(([, lng]) => lng);
const origin = [round6((Math.min(...lats) + Math.max(...lats)) / 2), round6((Math.min(...lngs) + Math.max(...lngs)) / 2)];
const M_LAT = 111_320;
const M_LNG = 111_320 * Math.cos((origin[0] * Math.PI) / 180);
const toXY = ([lat, lng]) => [(lng - origin[1]) * M_LNG, (lat - origin[0]) * M_LAT];
const toLatLng = ([x, y]) => [origin[0] + y / M_LAT, origin[1] + x / M_LNG];

function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

const ringXY = boundary.map(toXY);
const xs = ringXY.map(([x]) => x);
const ys = ringXY.map(([, y]) => y);
const view = {
  minX: Math.min(...xs) - CONTEXT_PAD,
  maxX: Math.max(...xs) + CONTEXT_PAD,
  minY: Math.min(...ys) - CONTEXT_PAD,
  maxY: Math.max(...ys) + CONTEXT_PAD,
};

// ── Overpass ──
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

const [south, west] = toLatLng([view.minX, view.minY]);
const [north, east] = toLatLng([view.maxX, view.maxY]);
const bb = [south, west, north, east].map((v) => v.toFixed(6)).join(',');

const query = `[out:json][timeout:180];
(
  way["building"](${bb});
  relation["building"](${bb});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian)(_link)?$"](${bb});
  way["railway"~"^(rail|subway|light_rail)$"](${bb});
  way["natural"="water"](${bb});
  relation["natural"="water"](${bb});
  way["waterway"~"^(river|stream|canal|riverbank)$"](${bb});
  relation["waterway"="riverbank"](${bb});
  way["leisure"~"^(park|garden|playground|pitch)$"](${bb});
  relation["leisure"="park"](${bb});
  way["landuse"~"^(grass|recreation_ground|forest|meadow|village_green)$"](${bb});
  nwr["railway"="station"]["name"](${bb});
  nwr["amenity"~"^(school|university|college)$"]["name"](${bb});
);
out geom;`;

const osm = process.env.OSM_FILE ? JSON.parse(await readFile(process.env.OSM_FILE, 'utf8')) : await overpass(query);

// ── 기하 도구 (모두 평면 m 좌표) ──
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function insideRing([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function signedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

function centroid(ring) {
  const a = signedArea(ring);
  if (Math.abs(a) < 1e-9) {
    const n = ring.length;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas–Peucker */
function simplify(points, tol) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(points[i], points[s], points[e]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** 닫힌 고리(첫 점 = 끝 점)를 단순화. 결과는 끝 점을 반복하지 않는다 */
function simplifyRing(ring, tol) {
  const open = same(ring[0], ring.at(-1)) ? ring.slice(0, -1) : ring;
  if (open.length < 4) return open;
  // 고리를 가장 먼 두 점에서 둘로 나눠 단순화해야 모서리가 지워지지 않는다
  let far = 0;
  let farD = 0;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = simplify(open.slice(0, far + 1), tol);
  const b = simplify([...open.slice(far), open[0]], tol);
  return [...a, ...b.slice(1, -1)];
}

/** 직사각형 밖으로 나간 선을 잘라 직사각형 안의 조각들만 남긴다 (Liang–Barsky) */
function clipLine(points, r) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = clipSegment(points[i], points[i + 1], r);
    if (!seg) {
      if (cur.length > 1) parts.push(cur);
      cur = [];
      continue;
    }
    const [a, b] = seg;
    if (!cur.length || !same(cur.at(-1), a)) {
      if (cur.length > 1) parts.push(cur);
      cur = [a];
    }
    cur.push(b);
    // 다음 구간과 끊긴 경우(b가 잘린 점) 조각을 닫는다
    if (!same(b, points[i + 1])) {
      parts.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}

function clipSegment([x0, y0], [x1, y1], r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, x0 - r.minX],
    [dx, r.maxX - x0],
    [-dy, y0 - r.minY],
    [dy, r.maxY - y0],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  const a = t0 === 0 ? [x0, y0] : [x0 + t0 * dx, y0 + t0 * dy];
  const b = t1 === 1 ? [x1, y1] : [x0 + t1 * dx, y0 + t1 * dy];
  return [a, b];
}

/** 다각형을 직사각형으로 자른다 (Sutherland–Hodgman) */
function clipPolygon(ring, r) {
  const edges = [
    (p) => p[0] >= r.minX,
    (p) => p[0] <= r.maxX,
    (p) => p[1] >= r.minY,
    (p) => p[1] <= r.maxY,
  ];
  const cut = [
    (a, b) => lerpAt(a, b, (r.minX - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (r.maxX - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (r.minY - a[1]) / (b[1] - a[1])),
    (a, b) => lerpAt(a, b, (r.maxY - a[1]) / (b[1] - a[1])),
  ];
  let out = same(ring[0], ring.at(-1)) ? ring.slice(0, -1) : ring;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = edges[e](cur);
      const prevIn = edges[e](prev);
      if (curIn) {
        if (!prevIn) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(cut[e](prev, cur));
      }
    }
  }
  return out;
}

function lerpAt(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function lineLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return len;
}

/** 여러 조각(way)으로 나뉜 multipolygon의 바깥 고리를 이어 붙인다 */
function assembleRings(ways) {
  const rest = ways.map((w) => [...w]);
  const rings = [];
  while (rest.length) {
    const ring = rest.shift();
    while (!same(ring[0], ring.at(-1))) {
      const last = ring.at(-1);
      const idx = rest.findIndex((w) => same(w[0], last) || same(w.at(-1), last));
      if (idx < 0) break;
      const [w] = rest.splice(idx, 1);
      ring.push(...(same(w[0], last) ? w : w.reverse()).slice(1));
    }
    if (ring.length >= 4 && same(ring[0], ring.at(-1))) rings.push(ring);
  }
  return rings;
}

const wayPoints = (geometry) => geometry.map((p) => toXY([p.lat, p.lon]));

/** 요소의 바깥 고리들 (way면 하나, relation이면 outer 멤버를 이은 것들) */
function outerRings(el) {
  if (el.type === 'way' && el.geometry) {
    const ring = wayPoints(el.geometry);
    return ring.length >= 4 && same(ring[0], ring.at(-1)) ? [ring] : [];
  }
  if (el.type === 'relation' && el.members) {
    return assembleRings(el.members.filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry).map((m) => wayPoints(m.geometry)));
  }
  return [];
}

function elementCenter(el) {
  if (el.type === 'node') return toXY([el.lat, el.lon]);
  const rings = outerRings(el);
  if (rings.length) {
    const biggest = rings.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
    return centroid(biggest);
  }
  if (el.geometry?.length) return centroid(wayPoints(el.geometry));
  if (el.bounds) return toXY([(el.bounds.minlat + el.bounds.maxlat) / 2, (el.bounds.minlon + el.bounds.maxlon) / 2]);
  return null;
}

// ── polyline 인코딩 (origin 기준, 1e-6도 단위) ──
function encodeValue(v) {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let s = '';
  while (n >= 0x20) {
    s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return s + String.fromCharCode(n + 63);
}

const O_LAT = Math.round(origin[0] * 1e6);
const O_LNG = Math.round(origin[1] * 1e6);

function encode(pointsXY) {
  let pLat = O_LAT;
  let pLng = O_LNG;
  let out = '';
  for (const p of pointsXY) {
    const [lat, lng] = toLatLng(p);
    const iLat = Math.round(lat * 1e6);
    const iLng = Math.round(lng * 1e6);
    if (out && iLat === pLat && iLng === pLng) continue;
    out += encodeValue(iLat - pLat) + encodeValue(iLng - pLng);
    pLat = iLat;
    pLng = iLng;
  }
  return out;
}

// ── 분류 ──
const buildings = [];
const roads = { major: [], minor: [], lane: [] };
const rail = [];
const water = [];
const waterways = [];
const green = [];
const roadNames = new Map(); // name → { cls, pieces: [[x,y]...][] }
const landmarks = [];
const seenLandmark = new Set();

const inView = ([x, y]) => x >= view.minX && x <= view.maxX && y >= view.minY && y <= view.maxY;

for (const el of osm.elements ?? []) {
  const t = el.tags ?? {};

  // 역·학교 이름 (학교 건물 자체도 아래에서 건물로 그린다)
  if (t.railway === 'station' || /^(school|university|college)$/.test(t.amenity ?? '')) {
    const name = t['name:ko'] || t.name;
    const c = elementCenter(el);
    if (name && c && inView(c) && !seenLandmark.has(name)) {
      seenLandmark.add(name);
      landmarks.push({ name, kind: t.railway === 'station' ? 'station' : 'school', c });
    }
    if (el.type === 'node') continue;
  }

  if (t.building && t.building !== 'no') {
    for (const ring of outerRings(el)) {
      const area = Math.abs(signedArea(ring));
      if (area < MIN_BUILDING_AREA) continue;
      if (!insideRing(centroid(ring), ringXY)) continue;
      const simple = simplifyRing(ring, TOLERANCE.building);
      if (simple.length >= 3) buildings.push({ area, pts: simple });
    }
    continue;
  }

  if (t.highway && el.type === 'way' && el.geometry && t.area !== 'yes' && !t.tunnel?.match(/^(yes|building_passage)$/)) {
    if (t.highway === 'service' && SKIP_SERVICE.has(t.service)) continue;
    const cls = ROAD_CLASS.find(([, re]) => re.test(t.highway))?.[0];
    if (!cls) continue;
    for (const part of clipLine(wayPoints(el.geometry), view)) {
      const simple = simplify(part, TOLERANCE.road);
      roads[cls].push(simple);
      const name = t['name:ko'] || t.name;
      if (name && cls !== 'lane') {
        const entry = roadNames.get(name) ?? { cls, pieces: [] };
        if (cls === 'major') entry.cls = 'major';
        entry.pieces.push(simple);
        roadNames.set(name, entry);
      }
    }
    continue;
  }

  if (t.railway && el.type === 'way' && el.geometry && !t.tunnel) {
    if (/^(rail|subway|light_rail)$/.test(t.railway)) {
      for (const part of clipLine(wayPoints(el.geometry), view)) rail.push(simplify(part, TOLERANCE.road));
    }
  }

  if (t.waterway && /^(river|stream|canal)$/.test(t.waterway) && el.type === 'way' && el.geometry) {
    for (const part of clipLine(wayPoints(el.geometry), view)) waterways.push(simplify(part, TOLERANCE.area));
    continue;
  }

  const isWater = t.natural === 'water' || t.waterway === 'riverbank';
  const isGreen = /^(park|garden|playground|pitch)$/.test(t.leisure ?? '') || /^(grass|recreation_ground|forest|meadow|village_green)$/.test(t.landuse ?? '');
  if (isWater || isGreen) {
    for (const ring of outerRings(el)) {
      const clipped = clipPolygon(ring, view);
      if (clipped.length < 3 || Math.abs(signedArea(clipped)) < 30) continue;
      const simple = simplifyRing([...clipped, clipped[0]], TOLERANCE.area);
      if (simple.length >= 3) (isWater ? water : green).push(simple);
    }
    if (isGreen && t.leisure === 'park') {
      const name = t['name:ko'] || t.name;
      const c = elementCenter(el);
      if (name && c && inView(c) && !seenLandmark.has(name)) {
        seenLandmark.add(name);
        landmarks.push({ name, kind: 'park', c });
      }
    }
  }
}

// ── 도로 이름: 이름별로 가장 긴 조각의 가운데에, 도로 방향으로 하나씩 ──
const labels = [];
for (const [name, { cls, pieces }] of roadNames) {
  const total = pieces.reduce((s, p) => s + lineLength(p), 0);
  if (total < 160) continue;
  const longest = pieces.reduce((a, b) => (lineLength(b) > lineLength(a) ? b : a));
  const half = lineLength(longest) / 2;
  let acc = 0;
  for (let i = 1; i < longest.length; i++) {
    const [ax, ay] = longest[i - 1];
    const [bx, by] = longest[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (acc + seg >= half) {
      const t = seg ? (half - acc) / seg : 0;
      // 화면은 y가 아래로 커서 북쪽(+y)을 뒤집는다. 글자가 뒤집히지 않게 -90~90도로 맞춘다
      let angle = (Math.atan2(-(by - ay), bx - ax) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const [lat, lng] = toLatLng([ax + (bx - ax) * t, ay + (by - ay) * t]);
      labels.push({ name, kind: cls === 'major' ? 'road-major' : 'road', lat: round6(lat), lng: round6(lng), angle: Math.round(angle) });
      break;
    }
    acc += seg;
  }
}
for (const { name, kind, c } of landmarks) {
  const [lat, lng] = toLatLng(c);
  labels.push({ name, kind, lat: round6(lat), lng: round6(lng) });
}

// 큰 건물부터 그리면 겹친 작은 건물이 위에 보인다
buildings.sort((a, b) => b.area - a.area);

const result = {
  source: '© OpenStreetMap contributors (ODbL)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  origin,
  view: [toLatLng([view.minX, view.minY]).map(round6), toLatLng([view.maxX, view.maxY]).map(round6)],
  buildings: buildings.map((b) => encode(b.pts)),
  roads: { major: roads.major.map(encode), minor: roads.minor.map(encode), lane: roads.lane.map(encode) },
  rail: rail.map(encode),
  water: water.map(encode),
  waterways: waterways.map(encode),
  green: green.map(encode),
  labels,
};

const json = JSON.stringify(result);
await writeFile(OUT, json);
console.log(
  `buildings: ${buildings.length}, roads: ${roads.major.length}/${roads.minor.length}/${roads.lane.length}, rail: ${rail.length}, ` +
    `water: ${water.length}+${waterways.length}, green: ${green.length}, labels: ${labels.length}, ${(json.length / 1024).toFixed(1)} KB`,
);
