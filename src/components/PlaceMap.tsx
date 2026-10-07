import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getMapData, type Building, type LatLng } from '../data/mapData';
import { getPlace, type Place } from '../data/places';
import { MAP_COLORS } from '../lib/theme';

interface PlaceMapProps {
  selectedId: string | null;
  onSelect: (place: Place) => void;
  /** 장소별 영상 개수. 영상이 있는 건물은 색이 채워진다 */
  videoCount?: Map<string, number>;
  className?: string;
}

/** 도로 폭(m). 줌에 맞춰 화면 두께를 다시 계산한다 */
const ROAD_METERS = { major: 15, minor: 7, lane: 4 };
/** 이 줌 이상에서 가게 이름을 보여 준다 */
const NAME_ZOOM = 18;
const FOCUS_ZOOM = 17;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function label(at: LatLng, html: string, className: string, zIndexOffset = 0, style = '') {
  return L.marker(at, {
    icon: L.divIcon({ className: '', html: `<div class="map-label ${className}" style="${style}">${html}</div>`, iconSize: [0, 0] }),
    interactive: false,
    keyboard: false,
    zIndexOffset,
  });
}

/** 영상 수가 많을수록 진하게 */
function videoOpacity(count: number) {
  return count >= 4 ? 0.95 : count >= 2 ? 0.72 : 0.5;
}

function storeStyle(count: number, selected: boolean): L.PathOptions {
  const base: L.PathOptions = count
    ? { fillColor: MAP_COLORS.video, fillOpacity: videoOpacity(count), color: MAP_COLORS.video, weight: 1, opacity: 1 }
    : { fillColor: MAP_COLORS.store, fillOpacity: 1, color: MAP_COLORS.storeStroke, weight: 1, opacity: 1 };
  return selected ? { ...base, color: MAP_COLORS.selected, weight: 2.5, ...(count ? {} : { fillColor: '#B0B8C1' }) } : base;
}

/** 건물 안 가게가 여러 곳이면 누른 곳에서 가장 가까운 가게 */
function nearestPlace(places: Place[], at: L.LatLng) {
  return places.reduce((a, b) => (at.distanceTo([b.lat, b.lng]) < at.distanceTo([a.lat, a.lng]) ? b : a));
}

/** "고씨네 외 2" */
function summaryName(places: Place[]) {
  return places.length > 1 ? `${places[0].name} 외 ${places.length - 1}` : places[0].name;
}

export default function PlaceMap({ selectedId, onSelect, videoCount, className = '' }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const dynamicRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
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

    const renderer = L.canvas({ padding: 0.4, tolerance: 6 });
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
      { renderer, interactive: false, fillColor: MAP_COLORS.building, fillOpacity: 1, color: MAP_COLORS.buildingStroke, weight: 0.8, fillRule: 'nonzero' },
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

    mapRef.current = map;
    return () => {
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

    const draw = (b: Building) => {
      const count = b.places.reduce((s, p) => s + countOf(p), 0);
      const selected = b.places.find((p) => p.id === selectedId);
      L.polygon(b.ring, { renderer, ...storeStyle(count, !!selected) })
        .on('click', (e: L.LeafletMouseEvent) => onSelectRef.current(nearestPlace(b.places, e.latlng)))
        .addTo(layer);

      if (selected) {
        const own = countOf(selected);
        layer.addLayer(label(b.center, `${own ? `<b>${own}</b>` : ''}<span>${esc(selected.name)}</span>`, `map-pill map-pill-selected ${own ? '' : 'map-pill-plain'}`, 1000));
      } else if (count) {
        const withVideo = b.places.filter((p) => countOf(p)).sort((x, y) => countOf(y) - countOf(x));
        layer.addLayer(label(b.center, `<b>${count}</b><span>${esc(summaryName(withVideo))}</span>`, 'map-pill', 500 + count));
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
        const html = `${count ? `<b>${count}</b>` : ''}<span>${esc(p.name)}</span>`;
        layer.addLayer(label([p.lat, p.lng], html, `map-pill ${selected ? 'map-pill-selected' : ''} ${count ? '' : 'map-pill-plain'}`, selected ? 1000 : 500));
      } else {
        layer.addLayer(label([p.lat, p.lng], esc(p.name), 'map-label-place map-label-dot'));
      }
    }
  }, [selectedId, videoCount]);

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
