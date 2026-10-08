import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getMapData, type Building, type LatLng } from '../data/mapData';
import { getPlace, type Place } from '../data/places';
import { getFix } from '../lib/location';
import { MAP_COLORS } from '../lib/theme';

/** 가게 이름표에 붙이는 표시: 앞에 이모지(메달·단골 별), 뒤에 짧은 글(오랜만) */
export interface PlaceMark {
  emoji?: string;
  note?: string;
}

interface PlaceMapProps {
  selectedId: string | null;
  onSelect: (place: Place) => void;
  /** 장소별 영상(동네 지도는 방문) 수. 많을수록 건물 색이 진해지고 빛이 번진다 */
  videoCount?: Map<string, number>;
  /** 가게별 이름표 표시 (동네 지도는 1~3위 메달, 내 지도는 단골·오랜만) */
  marks?: Map<string, PlaceMark>;
  className?: string;
}

/** 도로 폭(m). 줌에 맞춰 화면 두께를 다시 계산한다 */
const ROAD_METERS = { major: 15, minor: 7, lane: 4 };
/** 이 줌 이상에서 가게 이름을 보여 준다 */
const NAME_ZOOM = 18;
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
  { blur: 5, alpha: 0.2 },
  { blur: 8, alpha: 0.26 },
  { blur: 11, alpha: 0.32 },
  { blur: 15, alpha: 0.38 },
  { blur: 20, alpha: 0.44 },
];

/** 테두리는 얇게(고해상도 화면에서 1픽셀 남짓), 색은 단계별로 채운다 */
function storeStyle(count: number, selected: boolean): L.PathOptions {
  const base: L.PathOptions = count
    ? { fillColor: MAP_COLORS.heat[heatLevel(count)], fillOpacity: 1, color: MAP_COLORS.heatStroke, opacity: 0.3, weight: 0.6 }
    : { fillColor: MAP_COLORS.store, fillOpacity: 1, color: MAP_COLORS.storeStroke, opacity: 1, weight: 0.6 };
  return selected ? { ...base, color: MAP_COLORS.selected, opacity: 1, weight: 2, ...(count ? {} : { fillColor: '#C3C9DC' }) } : base;
}

interface GlowOptions extends L.PathOptions {
  glow?: { color: string; blur: number };
}

function glowStyle(count: number): GlowOptions {
  const { blur, alpha } = GLOW[heatLevel(count)];
  return { interactive: false, stroke: false, glow: { color: `rgba(${MAP_COLORS.glow}, ${alpha})`, blur } };
}

/** Leaflet 캔버스 렌더러의 내부 함수 (빛 번짐을 그리려고 덮어쓴다) */
interface CanvasInternals {
  _fillStroke(ctx: CanvasRenderingContext2D, layer: L.Path): void;
  _extendRedrawBounds(layer: L.Path): void;
  _redrawBounds?: L.Bounds;
}
const canvasBase = L.Canvas.prototype as unknown as CanvasInternals;
const glowOf = (layer: L.Path) => (layer.options as GlowOptions).glow;
/** Leaflet은 고해상도 화면에서 캔버스를 2배로 그리는데, 그림자 흐림은 그 배율을 따르지 않아서 직접 곱한다 */
const CANVAS_SCALE = L.Browser.retina ? 2 : 1;

/** glow 옵션이 있는 도형은 자기 모양의 흐린 빛만 그린다 (그 위에 같은 건물을 다시 그려 덮는다) */
const GlowCanvas = L.Canvas.extend({
  _fillStroke(this: CanvasInternals, ctx: CanvasRenderingContext2D, layer: L.Path) {
    const glow = glowOf(layer);
    if (!glow) return canvasBase._fillStroke.call(this, ctx, layer);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur * CANVAS_SCALE;
    ctx.fillStyle = `rgb(${MAP_COLORS.glow})`;
    ctx.fill();
    ctx.restore();
  },
  // 빛이 번진 만큼 다시 그릴 영역을 넓힌다 (좁으면 지운 자리에 빛 자국이 남는다)
  _extendRedrawBounds(this: CanvasInternals, layer: L.Path) {
    canvasBase._extendRedrawBounds.call(this, layer);
    const glow = glowOf(layer);
    const px = (layer as unknown as { _pxBounds?: L.Bounds })._pxBounds;
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

export default function PlaceMap({ selectedId, onSelect, videoCount, marks, className = '' }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const dynamicRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedIdRef.current = selectedId;
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
      el.classList.toggle('map-z-low', z < 16.5);
      el.classList.toggle('map-z-mid', z >= 16.5 && z < NAME_ZOOM);
      el.classList.toggle('map-z-high', z >= NAME_ZOOM);
    };
    map.on('zoomend', syncZoom);

    // 동 전체가 보이는 정도까지만 축소할 수 있다
    map.setMinZoom(Math.max(13, map.getBoundsZoom(L.latLngBounds(data.boundary)) - 0.5));
    syncZoom();

    // 화면 크기가 바뀌면(주소창 접힘 등) 캔버스 크기를 다시 맞춘다
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(el);

    // 내 위치가 동네 안이면 그곳을 가게 이름이 보이는 만큼 확대해서 보여 준다 (위치는 기기 안에서만 쓴다).
    // 위치를 잡기 전에 지도를 움직였거나 가게를 골랐으면 그대로 둔다
    let alive = true;
    let touched = false;
    const touch = () => {
      touched = true;
    };
    map.on('dragstart', touch);
    el.addEventListener('wheel', touch, { passive: true });
    el.addEventListener('touchstart', touch, { passive: true });
    const askedAt = performance.now();
    void getFix().then((fix) => {
      if (!alive || !fix) return;
      const here = L.latLng(fix.lat, fix.lng);
      if (!view.contains(here)) return;
      L.marker(here, {
        icon: L.divIcon({ className: '', html: '<div class="map-me"></div>', iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(map);
      if (touched || selectedIdRef.current) return;
      if (performance.now() - askedAt < INSTANT_FIX_MS) map.setView(here, NAME_ZOOM, { animate: false });
      else map.flyTo(here, NAME_ZOOM, { duration: 0.8 });
    });

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
    /** 이름표 글: 이모지 + 이름 + 짧은 글 */
    const named = (p: Place | undefined, name: string) => {
      const mark = p && marks?.get(p.id);
      return `${mark?.emoji ? `${mark.emoji} ` : ''}${esc(name)}${mark?.note ? `<i>${esc(mark.note)}</i>` : ''}`;
    };

    // 빛 번짐을 먼저 모두 그려야 옆 건물을 덮지 않고 건물 아래로 깔린다 (약한 것부터)
    const glows = [
      ...data.placeBuildings.map((b) => ({ count: buildingCount(b), make: (s: GlowOptions) => L.polygon(b.ring, { renderer, ...s }) })),
      ...data.unmatched.map((p) => ({ count: countOf(p), make: (s: GlowOptions) => L.circleMarker([p.lat, p.lng], { renderer, radius: 5.5, ...s }) })),
    ];
    glows
      .filter((g) => g.count > 0)
      .sort((a, b) => a.count - b.count)
      .forEach((g) => g.make(glowStyle(g.count)).addTo(layer));

    const draw = (b: Building) => {
      const count = buildingCount(b);
      const selected = b.places.find((p) => p.id === selectedId);
      L.polygon(b.ring, { renderer, ...storeStyle(count, !!selected) })
        .on('click', (e: L.LeafletMouseEvent) => onSelectRef.current(nearestPlace(b.places, e.latlng)))
        .addTo(layer);

      if (selected) {
        const own = countOf(selected);
        layer.addLayer(label(b.center, `${own ? `<b>${own}</b>` : ''}<span>${named(selected, selected.name)}</span>`, `map-pill map-pill-selected ${own ? '' : 'map-pill-plain'}`, 1000));
      } else if (count) {
        const withVideo = b.places.filter((p) => countOf(p)).sort((x, y) => countOf(y) - countOf(x));
        layer.addLayer(label(b.center, `<b>${count}</b><span>${named(withVideo[0], summaryName(withVideo))}</span>`, 'map-pill', 500 + count));
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
      L.circleMarker([p.lat, p.lng], { renderer, radius: selected ? 7 : 5.5, ...storeStyle(count, selected) })
        .on('click', () => onSelectRef.current(p))
        .addTo(layer);
      if (selected || count) {
        const html = `${count ? `<b>${count}</b>` : ''}<span>${named(p, p.name)}</span>`;
        layer.addLayer(label([p.lat, p.lng], html, `map-pill ${selected ? 'map-pill-selected' : ''} ${count ? '' : 'map-pill-plain'}`, selected ? 1000 : 500 + count));
      } else {
        layer.addLayer(label([p.lat, p.lng], esc(p.name), 'map-label-place map-label-dot'));
      }
    }
  }, [selectedId, videoCount, marks]);

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
