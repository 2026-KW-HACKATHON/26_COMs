import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getMapData, type Building, type LatLng } from '../data/mapData';
import { getPlace, type Place } from '../data/places';
import { getFix } from '../lib/location';
import { MAP_COLORS, type TerritoryColor } from '../lib/theme';

/** 가게 이름표에 붙이는 표시: 앞에 이모지(메달·단골 별), 뒤에 짧은 글(오랜만) */
export interface PlaceMark {
  emoji?: string;
  note?: string;
}

/** 그룹 지도의 땅 주인: 그 그룹원의 색과 말풍선에 넣을 글(이름 첫 글자) */
export interface PlaceOwner {
  color: TerritoryColor;
  badge: string;
}

interface PlaceMapProps {
  selectedId: string | null;
  onSelect: (place: Place) => void;
  /** 장소별 영상(동네 지도는 방문, 그룹 지도는 땅 주인의 방문) 수. 많을수록 건물 색이 진해지고 빛이 번진다 */
  videoCount?: Map<string, number>;
  /** 가게별 이름표 표시 (내 지도는 단골·오랜만) */
  marks?: Map<string, PlaceMark>;
  /** 가게별 땅 주인 (그룹 지도). 있으면 영상 수 단계 대신 주인 색으로 칠하고 말풍선에 주인을 표시한다 */
  owners?: Map<string, PlaceOwner>;
  /** 이 가게들이 모두 보이게 맞춘다 (그룹 지도: 그룹원들의 땅). 목록이 바뀔 때마다 다시 맞추고, 주면 내 위치로 옮기지 않는다 */
  fitPlaceIds?: string[];
  /** 내 위치(파란 점)를 보여 주고 동네 안이면 그곳으로 옮긴다. 기본은 켬 (그룹 지도는 끔) */
  showMyLocation?: boolean;
  /** 손가락으로 지도를 끄는 동안 세로로 움직인 픽셀 (위로 밀면 양수). 홈 지도가 검색창을 함께 밀어 올린다 */
  onPan?: (dy: number) => void;
  /** 지도를 다 끌고 손을 뗐을 때 */
  onPanEnd?: () => void;
  className?: string;
}

/** 도로 폭(m). 줌에 맞춰 화면 두께를 다시 계산한다 */
const ROAD_METERS = { major: 15, minor: 7, lane: 4 };
/** 이 줌 이상에서 영상(방문)이 없는 가게 이름도 보여 준다 */
const NAME_ZOOM = 18.5;
/** 이 줌 이상에서 가게 말풍선(이름·영상 수)을 보여 준다. 그보다 축소하면 말풍선을 통째로 숨긴다 */
const PILL_ZOOM = 17.25;
/** 이 줌보다 축소하면 작은 길·학교·공원 이름을 숨긴다 */
const LANDMARK_ZOOM = 16.5;
/** 내 위치·그룹 땅으로 옮길 때 (말풍선은 보이고, 나머지 가게 이름은 조금 더 확대해야 보인다) */
const LOCATE_ZOOM = 18;
const FOCUS_ZOOM = 17;
/** 내 위치가 이 시간(ms) 안에 잡히면 움직이는 효과 없이 바로 그 자리에서 시작한다 */
const INSTANT_FIX_MS = 400;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function label(at: LatLng, html: string, className: string, zIndexOffset = 0, style = '') {
  return L.marker(at, {
    icon: L.divIcon({ className: '', html: `<div class="map-label ${className}" style="${style}">${html}</div>`, iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
    zIndexOffset,
  });
}

/** 영상 수 → 색 단계 (0~4) */
function heatLevel(count: number) {
  return count >= 8 ? 4 : count >= 5 ? 3 : count >= 3 ? 2 : count >= 2 ? 1 : 0;
}

/** 단계별 빛 번짐: 흐림 반경(px)과 진하기 */
const GLOW = [
  { blur: 5, alpha: 0.35 },
  { blur: 8, alpha: 0.45 },
  { blur: 11, alpha: 0.55 },
  { blur: 15, alpha: 0.65 },
  { blur: 20, alpha: 0.75 },
];

interface GlowOptions extends L.PathOptions {
  /** 번지는 빛: 그림자 색, 흐림 반경, 빛을 내는 도형을 채울 색 */
  glow?: { color: string; blur: number; fill: string };
  /** 왼쪽 위 → 오른쪽 아래로 채울 두 색 (영상이 있는 건물) */
  gradient?: readonly [string, string];
}

/**
 * 가게 건물의 테두리 두께(px): 가게 < 다녀간 가게 < 고른 가게.
 * 테두리는 칠한 색과 같은 색이라 다른 선처럼 보이지 않고 건물이 그만큼 조금 넓어진 것처럼 보인다
 */
const STROKE = { store: 1.5, visited: 3, selected: 4 };

/** 가게는 진한 회색, 다녀간 가게는 단계별 그라데이션(땅 주인이 있으면 주인 색). 테두리도 같은 색(그라데이션이면 같은 그라데이션) */
function storeStyle(count: number, selected: boolean, owner?: TerritoryColor): GlowOptions {
  const heat = MAP_COLORS.heat[heatLevel(count)];
  const fill: Pick<GlowOptions, 'fillColor' | 'gradient'> = owner
    ? { fillColor: owner.main, gradient: owner.fill }
    : count
      ? { fillColor: heat[1], gradient: heat }
      : { fillColor: selected ? MAP_COLORS.storeSelected : MAP_COLORS.store };
  const weight = selected ? STROKE.selected : owner || count ? STROKE.visited : STROKE.store;
  return { ...fill, color: fill.fillColor, fillOpacity: 1, opacity: 1, weight };
}

function glowStyle(count: number, owner?: TerritoryColor): GlowOptions {
  const { blur, alpha } = GLOW[heatLevel(count)];
  const rgb = owner?.glow ?? MAP_COLORS.glow;
  return { interactive: false, stroke: false, glow: { color: `rgba(${rgb}, ${alpha})`, blur, fill: `rgb(${rgb})` } };
}

/** Leaflet 캔버스 렌더러의 내부 함수 (빛 번짐을 그리려고 덮어쓴다) */
interface CanvasInternals {
  _fillStroke(ctx: CanvasRenderingContext2D, layer: L.Path): void;
  _extendRedrawBounds(layer: L.Path): void;
  _redrawBounds?: L.Bounds;
}
const canvasBase = L.Canvas.prototype as unknown as CanvasInternals;
const glowOf = (layer: L.Path) => (layer.options as GlowOptions).glow;
/** 도형이 캔버스에서 차지하는 영역 (그리는 좌표와 같은 기준) */
const pxBoundsOf = (layer: L.Path) => (layer as unknown as { _pxBounds?: L.Bounds })._pxBounds;
/** Leaflet은 고해상도 화면에서 캔버스를 2배로 그리는데, 그림자 흐림은 그 배율을 따르지 않아서 직접 곱한다 */
const CANVAS_SCALE = L.Browser.retina ? 2 : 1;

/**
 * glow 옵션이 있는 도형은 자기 모양의 흐린 빛만 그린다 (그 위에 같은 건물을 다시 그려 덮는다).
 * gradient 옵션이 있는 도형은 자기 영역에 맞춘 대각선 그라데이션으로 채운다 (지도를 움직일 때마다 다시 계산)
 */
const GlowCanvas = L.Canvas.extend({
  _fillStroke(this: CanvasInternals, ctx: CanvasRenderingContext2D, layer: L.Path) {
    const glow = glowOf(layer);
    const { gradient } = layer.options as GlowOptions;
    const px = pxBoundsOf(layer);
    if (!glow && gradient && px?.min && px.max) {
      const fill = ctx.createLinearGradient(px.min.x, px.min.y, px.max.x, px.max.y);
      fill.addColorStop(0, gradient[0]);
      fill.addColorStop(1, gradient[1]);
      // Leaflet은 fillColor·color를 그대로 ctx.fillStyle·strokeStyle에 넣으므로 그리는 동안만 그라데이션으로 바꿔 끼운다
      // (테두리도 같은 그라데이션이라 건물이 조금 넓어진 것처럼 보인다)
      const options = layer.options as { fillColor?: string | CanvasGradient; color?: string | CanvasGradient };
      const { fillColor, color } = options;
      options.fillColor = fill;
      options.color = fill;
      canvasBase._fillStroke.call(this, ctx, layer);
      options.fillColor = fillColor;
      options.color = color;
      return;
    }
    if (!glow) return canvasBase._fillStroke.call(this, ctx, layer);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur * CANVAS_SCALE;
    ctx.fillStyle = glow.fill;
    ctx.fill();
    ctx.restore();
  },
  // 빛이 번진 만큼 다시 그릴 영역을 넓힌다 (좁으면 지운 자리에 빛 자국이 남는다)
  _extendRedrawBounds(this: CanvasInternals, layer: L.Path) {
    canvasBase._extendRedrawBounds.call(this, layer);
    const glow = glowOf(layer);
    const px = pxBoundsOf(layer);
    if (glow && px?.min && px.max && this._redrawBounds) {
      const pad = glow.blur * 2;
      this._redrawBounds.extend(px.min.subtract([pad, pad]));
      this._redrawBounds.extend(px.max.add([pad, pad]));
    }
  },
}) as unknown as new (options?: L.RendererOptions) => L.Canvas;

/** 건물 안 가게가 여러 곳이면 누른 곳에서 가장 가까운 가게 */
function nearestPlace(places: Place[], at: L.LatLng) {
  return places.reduce((a, b) => (at.distanceTo([b.lat, b.lng]) < at.distanceTo([a.lat, a.lng]) ? b : a));
}

/** "고씨네 외 2" */
function summaryName(places: Place[]) {
  return places.length > 1 ? `${places[0].name} 외 ${places.length - 1}` : places[0].name;
}

export default function PlaceMap({ selectedId, onSelect, videoCount, marks, owners, fitPlaceIds, showMyLocation = true, onPan, onPanEnd, className = '' }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const dynamicRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const onPanRef = useRef(onPan);
  const onPanEndRef = useRef(onPanEnd);
  const fitsPlacesRef = useRef(fitPlaceIds !== undefined);
  // 바탕 지도는 처음 한 번만 그려서 처음 값을 쓴다
  const showMyLocationRef = useRef(showMyLocation);
  const fittedKeyRef = useRef('');

  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedIdRef.current = selectedId;
    onPanRef.current = onPan;
    onPanEndRef.current = onPanEnd;
  });

  // 바탕 지도: 한 번만 그린다. 종류별로 하나의 레이어로 묶어 캔버스에 그려서 가볍다
  useEffect(() => {
    const el = containerRef.current!;
    const data = getMapData();
    const view = L.latLngBounds(data.view);
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      maxZoom: 19,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBounds: view,
      maxBoundsViscosity: 0.9,
    });
    // 처음에는 가게가 모여 있는 곳을 보여 준다 (레이어보다 먼저 화면 위치를 정해야 캔버스가 바로 그려진다)
    map.fitBounds(L.latLngBounds(data.focus), { padding: [8, 8] });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution(
      `© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>${data.attribution.includes('Overture') ? ' · Overture Maps' : ''}`,
    );

    const renderer = new GlowCanvas({ padding: 0.4, tolerance: 6 });
    rendererRef.current = renderer;
    const flat = { renderer, interactive: false, stroke: false, fillOpacity: 1 } as const;
    const line = { renderer, interactive: false, lineCap: 'round', lineJoin: 'round' } as const;

    L.polygon(data.boundary, { ...flat, fillColor: MAP_COLORS.landInside }).addTo(map);
    L.polygon(data.green.map((r) => [r]), { ...flat, fillColor: MAP_COLORS.green }).addTo(map);
    L.polygon(data.water.map((r) => [r]), { ...flat, fillColor: MAP_COLORS.water }).addTo(map);
    L.polyline(data.waterways, { ...line, color: MAP_COLORS.water, weight: 3 }).addTo(map);
    const roads = {
      lane: L.polyline(data.roads.lane, { ...line, color: MAP_COLORS.road }).addTo(map),
      minor: L.polyline(data.roads.minor, { ...line, color: MAP_COLORS.road }).addTo(map),
      major: L.polyline(data.roads.major, { ...line, color: MAP_COLORS.road }).addTo(map),
    };
    L.polyline(data.rail, { ...line, color: MAP_COLORS.rail, weight: 2, dashArray: '6 5', lineCap: 'butt' }).addTo(map);
    // 가게가 없는 건물은 전부 한 레이어 (가게가 있는 건물은 아래 effect에서 따로)
    L.polygon(
      data.buildings.filter((b) => !b.places.length).map((b) => [b.ring]),
      { renderer, interactive: false, fillColor: MAP_COLORS.building, fillOpacity: 1, color: MAP_COLORS.buildingStroke, weight: 0.5, fillRule: 'nonzero' },
    ).addTo(map);
    L.polygon(data.boundary, { renderer, interactive: false, fill: false, color: MAP_COLORS.boundary, weight: 1.5 }).addTo(map);

    const labels = L.layerGroup().addTo(map);
    for (const l of data.labels) {
      if (l.kind === 'road' || l.kind === 'road-major') {
        labels.addLayer(label([l.lat, l.lng], esc(l.name), `map-label-road ${l.kind === 'road-major' ? 'map-label-major' : ''}`, -100, `transform: translate(-50%, -50%) rotate(${l.angle ?? 0}deg)`));
      } else {
        const icon = l.kind === 'station' ? 'train' : l.kind === 'park' ? 'park' : 'school';
        labels.addLayer(label([l.lat, l.lng], `<span class="material-symbols-rounded">${icon}</span>${esc(l.name)}`, `map-label-landmark map-label-${l.kind}`, -100));
      }
    }

    dynamicRef.current = L.layerGroup().addTo(map);

    const lat = view.getCenter().lat;
    const syncZoom = () => {
      const z = map.getZoom();
      const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
      roads.major.setStyle({ weight: Math.max(2.5, ROAD_METERS.major / metersPerPixel) });
      roads.minor.setStyle({ weight: Math.max(1.5, ROAD_METERS.minor / metersPerPixel) });
      roads.lane.setStyle({ weight: Math.max(1, ROAD_METERS.lane / metersPerPixel) });
      el.classList.toggle('map-z-low', z < LANDMARK_ZOOM);
      el.classList.toggle('map-hide-pills', z < PILL_ZOOM);
      el.classList.toggle('map-hide-names', z < NAME_ZOOM);
    };
    map.on('zoomend', syncZoom);

    // 동 전체가 보이는 정도까지만 축소할 수 있다
    map.setMinZoom(Math.max(13, map.getBoundsZoom(L.latLngBounds(data.boundary)) - 0.5));
    syncZoom();

    // 화면 크기가 바뀌면(주소창 접힘 등) 캔버스 크기를 다시 맞춘다
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(el);

    // 내 위치가 동네 안이면 그곳을 가게 이름이 보이는 만큼 확대해서 보여 준다 (위치는 기기 안에서만 쓴다).
    // 위치를 잡기 전에 지도를 움직였거나 가게를 골랐으면 그대로 둔다. 내 위치를 끈 지도(그룹 지도)는 위치를 묻지도 않는다
    let alive = true;
    let touched = false;
    const touch = () => {
      touched = true;
    };
    map.on('dragstart', touch);
    el.addEventListener('wheel', touch, { passive: true });
    el.addEventListener('touchstart', touch, { passive: true });
    const askedAt = performance.now();
    void (showMyLocationRef.current ? getFix() : Promise.resolve(null)).then((fix) => {
      if (!alive || !fix) return;
      const here = L.latLng(fix.lat, fix.lng);
      if (!view.contains(here)) return;
      L.marker(here, {
        icon: L.divIcon({ className: '', html: '<div class="map-me"></div>', iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(map);
      if (touched || selectedIdRef.current || fitsPlacesRef.current) return;
      if (performance.now() - askedAt < INSTANT_FIX_MS) map.setView(here, LOCATE_ZOOM, { animate: false });
      else map.flyTo(here, LOCATE_ZOOM, { duration: 0.8 });
    });

    // 끄는 동안 세로 이동량을 알려 준다. 보이는 영역의 위쪽 끝(픽셀)이 아래로 가면 지도를 위로 민 것
    let lastTop = 0;
    const panTop = () => map.getPixelBounds().min?.y ?? 0;
    map.on('dragstart', () => {
      lastTop = panTop();
    });
    map.on('drag', () => {
      const top = panTop();
      onPanRef.current?.(top - lastTop);
      lastTop = top;
    });
    map.on('dragend', () => onPanEndRef.current?.());

    mapRef.current = map;
    return () => {
      alive = false;
      el.removeEventListener('wheel', touch);
      el.removeEventListener('touchstart', touch);
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      rendererRef.current = null;
      dynamicRef.current = null;
    };
  }, []);

  // 가게가 있는 건물: 영상 수·선택 상태에 따라 색을 칠한다
  useEffect(() => {
    const layer = dynamicRef.current;
    const renderer = rendererRef.current;
    if (!layer || !renderer) return;
    layer.clearLayers();
    const data = getMapData();
    const countOf = (p: Place) => videoCount?.get(p.id) ?? 0;
    const buildingCount = (b: Building) => b.places.reduce((s, p) => s + countOf(p), 0);
    const ownerOf = (p: Place | undefined) => (p ? owners?.get(p.id) : undefined);
    /** 건물에서 영상(방문)이 가장 많은 가게. 건물은 이 가게의 땅 주인 색으로 칠한다 */
    const topPlace = (b: Building) => b.places.reduce<Place | undefined>((top, p) => (countOf(p) > (top ? countOf(top) : 0) ? p : top), undefined);
    /** 이름표 글: 이모지 + 이름 + 짧은 글 */
    const named = (p: Place | undefined, name: string) => {
      const mark = p && marks?.get(p.id);
      return `${mark?.emoji ? `${mark.emoji} ` : ''}${esc(name)}${mark?.note ? `<i>${esc(mark.note)}</i>` : ''}`;
    };
    /** 말풍선 앞 동그라미: 땅 주인(주인 색 + 이름 첫 글자) 또는 영상 수 */
    const bubble = (p: Place | undefined, count: number) => {
      const owner = ownerOf(p);
      return owner ? `<b style="background:${owner.color.main}">${esc(owner.badge)}</b>` : count ? `<b>${count}</b>` : '';
    };

    // 빛 번짐을 먼저 모두 그려야 옆 건물을 덮지 않고 건물 아래로 깔린다 (약한 것부터)
    const glows = [
      ...data.placeBuildings.map((b) => ({ count: buildingCount(b), owner: ownerOf(topPlace(b)), make: (s: GlowOptions) => L.polygon(b.ring, { renderer, ...s }) })),
      ...data.unmatched.map((p) => ({ count: countOf(p), owner: ownerOf(p), make: (s: GlowOptions) => L.circleMarker([p.lat, p.lng], { renderer, radius: 5.5, ...s }) })),
    ];
    glows
      .filter((g) => g.count > 0)
      .sort((a, b) => a.count - b.count)
      .forEach((g) => g.make(glowStyle(g.count, g.owner?.color)).addTo(layer));

    const draw = (b: Building) => {
      const count = buildingCount(b);
      const top = topPlace(b);
      const selected = b.places.find((p) => p.id === selectedId);
      L.polygon(b.ring, { renderer, ...storeStyle(count, !!selected, ownerOf(top)?.color) })
        .on('click', (e: L.LeafletMouseEvent) => onSelectRef.current(nearestPlace(b.places, e.latlng)))
        .addTo(layer);

      if (selected) {
        const dot = bubble(selected, countOf(selected));
        layer.addLayer(label(b.center, `${dot}<span>${named(selected, selected.name)}</span>`, `map-pill map-pill-selected ${dot ? '' : 'map-pill-plain'}`, 1000));
      } else if (count) {
        const withVideo = b.places.filter((p) => countOf(p)).sort((x, y) => countOf(y) - countOf(x));
        layer.addLayer(label(b.center, `${bubble(top, count)}<span>${named(top, summaryName(withVideo))}</span>`, 'map-pill', 500 + count));
      } else {
        layer.addLayer(label(b.center, esc(summaryName(b.places)), 'map-label-place'));
      }
    };

    // 선택된 건물의 테두리가 다른 건물에 가리지 않게 마지막에 그린다
    const selectedBuilding = data.placeBuildings.find((b) => b.places.some((p) => p.id === selectedId));
    data.placeBuildings.filter((b) => b !== selectedBuilding).forEach(draw);
    if (selectedBuilding) draw(selectedBuilding);

    // 건물을 찾지 못한 가게는 점으로
    for (const p of data.unmatched) {
      const count = countOf(p);
      const selected = p.id === selectedId;
      L.circleMarker([p.lat, p.lng], { renderer, radius: selected ? 7 : 5.5, ...storeStyle(count, selected, ownerOf(p)?.color) })
        .on('click', () => onSelectRef.current(p))
        .addTo(layer);
      if (selected || count) {
        const dot = bubble(p, count);
        const html = `${dot}<span>${named(p, p.name)}</span>`;
        layer.addLayer(label([p.lat, p.lng], html, `map-pill ${selected ? 'map-pill-selected' : ''} ${dot ? '' : 'map-pill-plain'}`, selected ? 1000 : 500 + count));
      } else {
        layer.addLayer(label([p.lat, p.lng], esc(p.name), 'map-label-place map-label-dot'));
      }
    }
  }, [selectedId, videoCount, marks, owners]);

  // 맞출 가게 목록이 바뀌면(처음 불러옴, 그룹원 한 명만 보기) 그 가게들이 모두 보이게
  const fitKey = fitPlaceIds?.join(',') ?? '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitKey || fitKey === fittedKeyRef.current) return;
    fittedKeyRef.current = fitKey;
    const data = getMapData();
    const points = fitKey.split(',').flatMap((id): L.LatLngExpression[] => {
      const place = getPlace(id);
      const index = data.buildingOf.get(id);
      return !place ? [] : index === undefined ? [[place.lat, place.lng]] : [data.buildings[index].center];
    });
    if (points.length) map.flyToBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: LOCATE_ZOOM, duration: 0.6 });
  }, [fitKey]);

  // 선택된 장소가 화면 밖(검색으로 고른 경우 등)이면 그쪽으로 이동
  useEffect(() => {
    const map = mapRef.current;
    const place = getPlace(selectedId);
    if (!map || !place) return;
    const data = getMapData();
    const index = data.buildingOf.get(place.id);
    const target = L.latLng(index === undefined ? [place.lat, place.lng] : data.buildings[index].center);
    if (!map.getBounds().pad(-0.2).contains(target) || map.getZoom() < 16) {
      map.flyTo(target, Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.6 });
    }
  }, [selectedId]);

  // isolate: Leaflet 내부 z-index(400~)가 고정 헤더·네비 위로 올라오지 않도록
  return <div ref={containerRef} className={`isolate ${className}`} style={{ background: MAP_COLORS.land }} />;
}
