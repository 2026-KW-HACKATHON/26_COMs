import { useEffect, useRef } from 'react';
import { BOUNDARY, CATEGORY_EMOJI, type Place } from '../data/places';

type KakaoMap = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => any;
  CustomOverlay: new (options: Record<string, unknown>) => any;
  LatLng: new (lat: number, lng: number) => any;
  LatLngBounds: new () => any;
  Polygon: new (options: Record<string, unknown>) => any;
  load: (callback: () => void) => void;
  event: {
    addListener: (target: any, type: string, handler: () => void) => void;
  };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMap };
  }
}

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
    ? 'ring-3 ring-primary-container scale-110'
    : count
      ? 'ring-2 ring-primary-container'
      : 'ring-1 ring-outline-variant';
  const badge = count
    ? `<span class="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-primary text-on-primary text-[9px] font-bold leading-[14px] text-center">${count}</span>`
    : '';
  const label = `<span class="place-label absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap px-1.5 rounded bg-surface-container-lowest/90 text-[10px] font-bold text-on-surface shadow-sm ${selected ? 'place-label-always' : ''}">${place.name}</span>`;
  return `<div class="relative -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center text-[13px] transition-transform ${ring}">${CATEGORY_EMOJI[place.category] ?? '📍'}${badge}${label}</div>`;
}

export default function PlaceMap({ places, selectedId, onSelect, videoCount, className = '' }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const polygonRef = useRef<any | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const initMap = () => {
      const kakao = window.kakao;
      if (!kakao?.maps) return;

      const bounds = new kakao.maps.LatLngBounds();
      BOUNDARY.forEach(([lat, lng]) => {
        bounds.extend(new kakao.maps.LatLng(lat, lng));
      });

      const map = new kakao.maps.Map(el, {
        center: new kakao.maps.LatLng(37.6287, 127.057),
        level: 1,
      });
      map.setMinLevel(1);
      map.setMaxLevel(19);
      map.setBounds(bounds, 20, 20, 20, 20);
      map.setLevel(1);

      const polygon = new kakao.maps.Polygon({
        path: BOUNDARY.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng)),
        strokeWeight: 2,
        strokeColor: '#a63a19',
        strokeStyle: 'dash',
        strokeOpacity: 1,
        fillColor: '#a63a19',
        fillOpacity: 0.03,
      });
      polygon.setMap(map);
      polygonRef.current = polygon;

      const syncLabels = () => {
        el.classList.toggle('map-hide-labels', map.getLevel() > LABEL_MIN_ZOOM);
      };
      kakao.maps.event.addListener(map, 'zoom_changed', syncLabels);
      syncLabels();

      mapRef.current = map;
    };

    const ensureKakaoSdk = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(initMap);
        return;
      }

      const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY;
      if (!apiKey) {
        el.innerHTML = '<div class="flex h-full items-center justify-center px-4 text-center text-sm text-on-surface-variant">카카오 지도 API 키를 설정해 주세요.</div>';
        return;
      }

      const existing = document.getElementById('kakao-map-sdk');
      if (existing) {
        existing.addEventListener('load', () => window.kakao?.maps.load(initMap), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = 'kakao-map-sdk';
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
      script.onload = () => {
        window.kakao?.maps.load(initMap);
      };
      script.onerror = () => {
        console.error('Kakao Maps SDK 로드 실패: 도메인 허용 여부와 앱 키를 확인해 주세요.');
        el.innerHTML = '<div class="flex h-full items-center justify-center px-4 text-center text-sm text-on-surface-variant">카카오 지도 로드에 실패했습니다. 앱 키와 허용 도메인을 확인해 주세요.</div>';
      };
      document.head.appendChild(script);
    };

    ensureKakaoSdk();

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    for (const place of places) {
      const count = videoCount?.get(place.id) ?? 0;
      const selected = place.id === selectedId;
      const markerContent = document.createElement('div');
      markerContent.innerHTML = pinHtml(place, count, selected);
      markerContent.style.position = 'relative';
      markerContent.style.display = 'block';
      markerContent.style.pointerEvents = 'auto';
      markerContent.style.transform = 'translate(-50%, -50%)';
      markerContent.style.cursor = 'pointer';

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(place.lat, place.lng),
        content: markerContent,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: selected ? 1000 : count ? 500 : 0,
        clickable: true,
      });

      overlay.setMap(map);
      markerContent.addEventListener('click', () => onSelectRef.current(place));
      markersRef.current.push(overlay);
    }
  }, [places, selectedId, videoCount]);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao;
    const place = places.find((p) => p.id === selectedId);
    if (!map || !kakao?.maps || !place) return;

    const target = new kakao.maps.LatLng(place.lat, place.lng);
    const currentBounds = map.getBounds();
    if (!currentBounds.contain(target)) {
      map.panTo(target);
    }
  }, [places, selectedId]);

  return <div ref={containerRef} className={`isolate bg-surface-container-low ${className}`} />;
}
