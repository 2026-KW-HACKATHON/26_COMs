import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CapsuleVideo from '../components/CapsuleVideo';
import FriendTagPicker from '../components/FriendTagPicker';
import PlaceMap from '../components/PlaceMap';
import PlaceSearch from '../components/PlaceSearch';
import VideoRecorder from '../components/VideoRecorder';
import { placesInSameBuilding } from '../data/mapData';
import { CATEGORY_EMOJI, getPlace, placeSubtitle, type Place } from '../data/places';
import { useCapsules } from '../hooks/useCapsules';
import { useFriendships } from '../hooks/useFriendships';
import { SOCIAL_ENABLED, STORAGE_MODE, addCapsule } from '../lib/capsuleStore';
import { probeDuration, thumbnailAt } from '../lib/video';
import { CLIP_SECONDS, type Visibility } from '../types/capsule';
import type { Profile } from '../types/social';

/** 앱에서 방금 찍은 5초 (영상은 가게에서 그 자리에서 찍은 것만 남긴다) */
interface DraftVideo {
  blob: Blob;
  duration: number;
  thumbnail: Blob | null;
}

/**
 * 영상 남기기는 두 화면이다.
 * 1. /leave: 지도 전체에서 가게 고르기
 * 2. /leave?place=<가게>: 5초 영상·친구 태그·공개 범위
 * 같은 화면(컴포넌트)이 주소만 바꿔 가며 보여 주므로, 2에서 찍은 영상은 1로 돌아가 가게를 바꿔도 남아 있다.
 */
export default function Leave() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 주소의 가게가 곧 고른 가게. 없으면 지도에서 고르는 화면
  const place = getPlace(searchParams.get('place'));
  const placeId = place?.id ?? null;
  /** 지도 화면에서 누른 가게 (아직 확정 전). 가게를 바꾸러 돌아오면 원래 가게가 선택된 채로 */
  const [pickId, setPickId] = useState<string | null>(placeId);
  /** 지도 화면에서 넘어왔으면 '바꾸기'는 뒤로 가기 (기록이 쌓이지 않게) */
  const fromMapRef = useRef(false);
  const [video, setVideo] = useState<DraftVideo | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Profile[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const { list: friendships } = useFriendships();
  const friends = friendships?.filter((f) => f.status === 'friend') ?? null;

  // 화면이 바뀌면 맨 위부터
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [placeId]);

  const choosePlace = (p: Place) => {
    fromMapRef.current = true;
    navigate(`/leave?place=${encodeURIComponent(p.id)}`);
  };
  const changePlace = () => {
    setPickId(placeId);
    if (fromMapRef.current) {
      fromMapRef.current = false;
      navigate(-1);
    } else {
      // 홈 등에서 바로 들어왔으면 지금 화면을 지도 화면으로 바꾼다 (뒤로 가면 원래 화면)
      navigate('/leave', { replace: true });
    }
  };

  /** seconds: 실제로 촬영한 길이 (중간에 멈추면 5초보다 짧다) */
  const handleRecorded = async (blob: Blob, thumbnail: Blob | null, seconds: number) => {
    setRecorderOpen(false);
    const duration = await probeDuration(blob).catch(() => 0);
    setVideo({ blob, duration: duration || seconds, thumbnail });
  };

  const missing = !video ? '가게에서 5초를 찍어 주세요' : '';

  const handleLeave = async () => {
    if (!place || !video || saving) return;
    const clipDuration = Math.min(CLIP_SECONDS, video.duration);
    setSaving(true);
    try {
      const thumbnail = video.thumbnail ?? (await thumbnailAt(video.blob, Math.min(1, clipDuration / 2)).catch(() => null));
      await addCapsule({
        placeId: place.id,
        placeName: place.name,
        lat: place.lat,
        lng: place.lng,
        video: video.blob,
        clipStart: 0,
        clipDuration,
        thumbnail,
        tagIds: tags.map((t) => t.id),
        visibility,
      });
      navigator.vibrate?.(30);
      navigate('/', { replace: true, state: { placeId: place.id } });
    } catch (err) {
      console.error(err);
      alert(STORAGE_MODE === 'cloud' ? '영상을 올리지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.' : '영상을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
      setSaving(false);
    }
  };

  if (!place) {
    return <PickPlace pickId={pickId} onPick={setPickId} onChoose={choosePlace} />;
  }

  return (
    <div className="flex flex-col w-full pb-6 pt-2">
      {/* 고른 가게 (누르면 지도로 돌아가 바꾼다) */}
      <section className="pb-5">
        <div className="bg-surface-container-low rounded-2xl pl-4 pr-2 py-3 flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 rounded-full bg-surface flex items-center justify-center text-[20px]">{CATEGORY_EMOJI[place.category] ?? '📍'}</span>
          <div className="flex-1 flex flex-col min-w-0">
            <span className="text-label-lg text-on-surface font-bold truncate">{place.name}</span>
            <span className="text-label-sm text-on-surface-variant truncate">{[placeSubtitle(place), place.address].filter(Boolean).join(' · ')}</span>
          </div>
          <button onClick={changePlace} className="h-9 shrink-0 px-3 rounded-lg bg-surface text-gray-700 text-label-md font-semibold pressable" type="button">
            바꾸기
          </button>
        </div>
      </section>

      <Divider />

      <section className="flex flex-col gap-3 py-6">
        <div className="flex items-center justify-between">
          <StepTitle step={1} title="그 자리에서 5초를 찍어 주세요" />
          {video && (
            <span className="text-label-md text-primary font-bold px-2.5 py-1 bg-primary-fixed rounded-full">
              {Math.min(CLIP_SECONDS, video.duration).toFixed(1)}초
            </span>
          )}
        </div>

        {video ? (
          <>
            <CapsuleVideo src={video.blob} duration={Math.min(CLIP_SECONDS, video.duration)} className="w-full aspect-[3/4] rounded-2xl" />
            <button onClick={() => setRecorderOpen(true)} className="h-12 rounded-xl bg-surface-container text-gray-700 text-label-lg flex items-center justify-center gap-1 pressable" type="button">
              <span className="material-symbols-rounded text-[20px]">replay</span> 다시 찍기
            </button>
          </>
        ) : (
          <button
            onClick={() => setRecorderOpen(true)}
            className="h-40 rounded-2xl bg-primary-fixed flex flex-col items-center justify-center gap-2 pressable"
            type="button"
          >
            <span className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-rounded text-[30px] icon-fill">videocam</span>
            </span>
            <span className="text-label-lg font-bold text-on-primary-fixed">지금 이 가게에서 5초 찍기</span>
            <span className="text-label-sm text-on-primary-fixed/70">최대 5초 · 중간에 멈출 수 있어요</span>
          </button>
        )}
      </section>

      {SOCIAL_ENABLED && (
        <>
          <Divider />
          <section className="flex flex-col gap-3 py-6">
            <div className="flex items-center justify-between">
              <StepTitle step={2} title="함께한 친구가 있나요?" />
              <span className="text-label-sm text-gray-400">선택</span>
            </div>
            <FriendTagPicker friends={friends} selected={tags} onChange={setTags} />
          </section>

          <Divider />
          <section className="flex flex-col gap-3 py-6">
            <StepTitle step={3} title="누구에게 보여 줄까요?" />
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="공개 범위">
              {VISIBILITY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setVisibility(o.value)}
                  className={`p-3.5 rounded-2xl border-2 text-left flex flex-col gap-1 pressable transition-colors ${
                    visibility === o.value ? 'border-primary bg-primary-fixed' : 'border-transparent bg-surface-container'
                  }`}
                  type="button"
                  role="radio"
                  aria-checked={visibility === o.value}
                >
                  <span className={`material-symbols-rounded text-[22px] ${visibility === o.value ? 'text-primary icon-fill' : 'text-gray-500'}`}>{o.icon}</span>
                  <span className="text-label-lg font-bold text-on-surface">{o.label}</span>
                  <span className="text-label-sm text-on-surface-variant">{o.description}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={handleLeave}
          disabled={!!missing || saving}
          className="w-full h-14 rounded-2xl bg-primary text-on-primary text-[17px] font-bold flex items-center justify-center pressable disabled:bg-gray-200 disabled:text-gray-400"
          type="button"
        >
          {saving ? '남기는 중…' : '남기기'}
        </button>
        {missing && <p className="text-center text-label-sm text-on-surface-variant">{missing}</p>}
      </div>

      {recorderOpen && <VideoRecorder onRecorded={handleRecorded} onClose={() => setRecorderOpen(false)} />}
    </div>
  );
}

/** 1단계: 지도 전체에서 가게 고르기 (홈 지도처럼 화면을 꽉 채운다) */
function PickPlace({ pickId, onPick, onChoose }: { pickId: string | null; onPick: (id: string | null) => void; onChoose: (place: Place) => void }) {
  // 내가 영상을 남긴 건물은 색이 채워져 보인다
  const capsules = useCapsules();
  const videoCount = useMemo(() => {
    const counts = new Map<string, number>();
    capsules?.forEach((c) => counts.set(c.placeId, (counts.get(c.placeId) ?? 0) + 1));
    return counts;
  }, [capsules]);
  const picked = getPlace(pickId);
  const neighbors = picked ? placesInSameBuilding(picked) : [];

  return (
    <div className="relative w-full h-[calc(100dvh-7.5rem)]">
      <PlaceMap selectedId={pickId} onSelect={(p) => onPick(p.id)} videoCount={videoCount} className="absolute inset-0" />

      <div className="absolute top-3 inset-x-3 z-10">
        <PlaceSearch onPick={(p) => onPick(p.id)} />
      </div>

      {picked ? (
        <div className="absolute bottom-3 inset-x-3 z-10 bg-surface rounded-3xl p-5 shadow-sheet flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 shrink-0 rounded-full bg-surface-container flex items-center justify-center text-[22px]">
              {CATEGORY_EMOJI[picked.category] ?? '📍'}
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 className="text-headline-sm text-on-surface truncate">{picked.name}</h2>
              <p className="text-label-md text-on-surface-variant truncate">{[placeSubtitle(picked), picked.address].filter(Boolean).join(' · ')}</p>
            </div>
            <button onClick={() => onPick(null)} className="w-8 h-8 shrink-0 rounded-full bg-surface-container text-gray-500 flex items-center justify-center pressable" type="button" aria-label="선택 취소">
              <span className="material-symbols-rounded text-[20px]">close</span>
            </button>
          </div>

          {/* 한 건물에 가게가 여럿이면 여기서 바로 바꾼다 */}
          {neighbors.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
              {neighbors.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p.id)}
                  className={`h-8 shrink-0 px-3 rounded-full text-label-md font-semibold pressable ${
                    p.id === picked.id ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container text-gray-700'
                  }`}
                  type="button"
                  aria-pressed={p.id === picked.id}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => onChoose(picked)}
            className="h-14 rounded-2xl bg-primary text-on-primary text-[16px] font-bold flex items-center justify-center gap-1 pressable"
            type="button"
          >
            이 가게에서 남기기
            <span className="material-symbols-rounded text-[22px]">arrow_forward</span>
          </button>
        </div>
      ) : (
        <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full bg-inverse-surface/90 text-inverse-on-surface text-label-md font-semibold">어느 가게에서 남길까요? 지도에서 누르거나 검색해 주세요</span>
        </div>
      )}
    </div>
  );
}

const VISIBILITY_OPTIONS: { value: Visibility; icon: string; label: string; description: string }[] = [
  { value: 'friends', icon: 'group', label: '친구만', description: '친구와 태그된 사람만 봐요' },
  { value: 'town', icon: 'location_city', label: '동네 모두', description: '동네 사람 누구나 피드와 가게에서 봐요. 함께한 친구 이름은 친구에게만 보여요' },
];

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-inverse-surface text-inverse-on-surface text-[12px] font-bold flex items-center justify-center">{step}</span>
      <h2 className="text-headline-sm text-on-surface">{title}</h2>
    </div>
  );
}

/** 토스식 굵은 구분선 (화면 끝까지) */
function Divider() {
  return <div className="h-2 -mx-5 bg-surface-container" />;
}
