import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { BOUNDARY, CATEGORY_EMOJI, type Place } from '../data/places';

interface PlaceMapProps {
  places: Place[];
  selectedId: string | null;
  onSelect: (place: Place) => void;
  /** 장소별 내 영상 개수 (핀에 배지로 표시) */
  videoCount?: Map<string, number>;
  className?: string;
}

const LABEL_MIN_ZOOM = 17;

function pinHtml(place: Place, count: number, selected: boolean) {
  const ring = selected
    ? 'ring-4 ring-primary-container scale-125'
    : count
      ? 'ring-2 ring-primary-container'
      : 'ring-1 ring-outline-variant';
  const badge = count
    ? `<span class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold leading-4 text-center">${count}</span>`
    : '';
  // 이름 라벨은 확대했을 때만 (place-label은 index.css에서 줌에 따라 토글)
  const label = `<span class="place-label absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap px-1.5 rounded bg-surface-container-lowest/90 text-[11px] font-bold text-on-surface shadow-sm ${selected ? 'place-label-always' : ''}">${place.name}</span>`;
  return `<div class="relative -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center text-[15px] transition-transform ${ring}">${CATEGORY_EMOJI[place.category] ?? '📍'}${badge}${label}</div>`;
}

export default function PlaceMap({ places, selectedId, onSelect, videoCount, className = '' }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const el = containerRef.current!;
    const bounds = L.latLngBounds(BOUNDARY);
    const map = L.map(el, {
      zoomControl: false,
      minZoom: 14,
      maxZoom: 19,
      maxBounds: bounds.pad(0.6),
    });
    map.fitBounds(bounds, { padding: [8, 8] });
    map.setZoom(Math.max(map.getZoom(), 16));

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.polygon(BOUNDARY, { color: '#a63a19', weight: 2, dashArray: '6 6', fillOpacity: 0.03, interactive: false }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);

    const syncLabels = () => el.classList.toggle('map-hide-labels', map.getZoom() < LABEL_MIN_ZOOM);
    map.on('zoomend', syncLabels);
    syncLabels();

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markersRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const place of places) {
      const count = videoCount?.get(place.id) ?? 0;
      const selected = place.id === selectedId;
      L.marker([place.lat, place.lng], {
        icon: L.divIcon({ className: '', html: pinHtml(place, count, selected), iconSize: [0, 0] }),
        title: place.name,
        zIndexOffset: selected ? 1000 : count ? 500 : 0,
      })
        .on('click', () => onSelectRef.current(place))
        .addTo(layer);
    }
  }, [places, selectedId, videoCount]);

  // 선택된 장소가 화면 밖(검색으로 고른 경우 등)이면 그쪽으로 이동
  useEffect(() => {
    const map = mapRef.current;
    const place = places.find((p) => p.id === selectedId);
    if (!map || !place) return;
    const target = L.latLng(place.lat, place.lng);
    if (!map.getBounds().pad(-0.2).contains(target)) {
      map.flyTo(target, Math.max(map.getZoom(), LABEL_MIN_ZOOM), { duration: 0.6 });
    }
  }, [places, selectedId]);

  // isolate: Leaflet 내부 z-index(400~)가 고정 헤더·네비 위로 올라오지 않도록
  return <div ref={containerRef} className={`isolate bg-surface-container-low ${className}`} />;
}
