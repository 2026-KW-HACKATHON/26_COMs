import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import NudgeButton from '../components/NudgeButton';
import { useAuth } from '../hooks/useAuth';
import { useNudges } from '../hooks/useNudges';
import { formatRelative } from '../lib/format';
import { listNudges, markNudgesRead } from '../lib/nudges';
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push';
import type { Nudge } from '../types/social';

export default function Notifications() {
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  const { latest, refresh } = useNudges();
  const [list, setList] = useState<Nudge[] | null>(null);
  const [failed, setFailed] = useState(false);

  // 열 때와 새 조르기를 받을 때 다시 불러오고 모두 읽음으로 표시한다.
  // 이번에 처음 본 알림은 화면을 나갈 때까지 점으로 표시해 둔다
  useEffect(() => {
    if (!me) return;
    let alive = true;
    listNudges(me)
      .then(async (nudges) => {
        if (!alive) return;
        setList((prev) => {
          const seen = new Set(prev?.filter((n) => !n.read).map((n) => n.id));
          return nudges.map((n) => (seen.has(n.id) ? { ...n, read: false } : n));
        });
        setFailed(false);
        if (nudges.some((n) => !n.read)) {
          await markNudgesRead(me);
          refresh();
        }
      })
      .catch((err) => {
        console.error(err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [me, latest, refresh]);

  return (
    <div className="flex flex-col w-full pb-8 pt-3 gap-4">
      <PushCard />

      {failed && !list ? (
        <p className="py-10 text-center text-body-md text-on-surface-variant">알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      ) : !list ? null : list.length === 0 ? (
        <div className="flex flex-col items-center text-center py-14 px-6 app-card text-on-surface-variant">
          <div className="w-16 h-16 rounded-full pastel-gradient flex items-center justify-center text-primary">
            <span className="material-symbols-rounded text-[34px] icon-fill">notifications</span>
          </div>
          <p className="mt-2 text-body-md text-on-surface">아직 받은 알림이 없어요</p>
          <p className="mt-1 text-label-md">같이 간 친구가 "또 가자"고 조르면 여기에 떠요.</p>
          <p className="text-label-md">나도 영상 화면에서 같이 간 친구를 조를 수 있어요.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 glass border border-white/80 rounded-[28px] overflow-hidden">
          {list.map((n) => (
            <NudgeItem key={n.id} nudge={n} onOpen={() => n.capsuleId && navigate(`/video/${n.capsuleId}`)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NudgeItem({ nudge: n, onOpen }: { nudge: Nudge; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-2 py-3 px-4">
      <button onClick={onOpen} disabled={!n.capsuleId} className="flex-1 min-w-0 flex items-center gap-3 text-left" type="button">
        <span className="relative shrink-0">
          <Avatar profile={n.sender} size={44} />
          {!n.read && <span className="absolute top-0 -left-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white" aria-label="새 알림" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-body-sm text-on-surface">
            <b>{n.sender?.displayName ?? '친구'}</b>님이 <b>{n.placeName}</b> 또 가자고 졸라요
          </span>
          <span className="block text-label-sm text-on-surface-variant">
            {formatRelative(n.createdAt)}
            {n.capsuleId ? '' : ' · 영상이 지워졌어요'}
          </span>
        </span>
      </button>
      {n.capsuleId && n.sender && <NudgeButton capsuleId={n.capsuleId} friend={n.sender} label="나도 조르기" />}
    </li>
  );
}

/** 폰 알림 켜기·끄기 안내 */
function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unsupported'));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) setState(await enablePush());
      else {
        await disablePush();
        setState('off');
      }
    } catch (err) {
      console.error(err);
      alert('알림 설정을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  if (!state || state === 'unsupported') return null;

  if (state === 'on') {
    return (
      <div className="flex items-center gap-2 h-11 pl-3 pr-1.5 rounded-full glass border border-white/80 shadow-[0_10px_22px_rgba(90,100,160,0.04)]">
        <span className="material-symbols-rounded icon-fill text-[20px] text-primary">notifications_active</span>
        <span className="flex-1 text-label-md text-gray-700">이 기기에서 폰 알림을 받고 있어요</span>
        <button onClick={() => toggle(false)} disabled={busy} className="h-8 px-3 rounded-full text-label-md font-semibold text-gray-500 bg-gray-100 pressable disabled:opacity-50" type="button">
          끄기
        </button>
      </div>
    );
  }

  const copy: Record<Exclude<PushState, 'on' | 'unsupported'>, { title: string; body: string }> = {
    off: { title: '폰 알림 켜기', body: '친구가 조르면 앱을 닫아 둬도 폰으로 알려 드려요.' },
    denied: { title: '알림이 꺼져 있어요', body: '휴대폰 설정이나 브라우저 사이트 설정에서 이 앱의 알림을 허용해 주세요.' },
    install: { title: '홈 화면에 추가하면 알림이 와요', body: '아이폰은 사파리 공유 버튼 → "홈 화면에 추가"로 설치한 앱에서 알림을 켤 수 있어요.' },
  };
  const { title, body } = copy[state];

  return (
    <div className="flex items-center gap-3 p-4 rounded-[28px] glass border border-white/80 shadow-[0_12px_24px_rgba(90,100,160,0.06)]">
      <span className="material-symbols-rounded icon-fill text-[28px] text-primary shrink-0">
        {state === 'off' ? 'notifications_active' : state === 'denied' ? 'notifications_off' : 'add_to_home_screen'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-label-lg font-bold text-on-surface">{title}</p>
        <p className="text-label-sm text-on-surface-variant">{body}</p>
      </div>
      {state === 'off' && (
        <button onClick={() => toggle(true)} disabled={busy} className="h-9 px-3.5 shrink-0 rounded-full accent-gradient text-white text-label-md font-bold pressable disabled:opacity-50" type="button">
          켜기
        </button>
      )}
    </div>
  );
}
