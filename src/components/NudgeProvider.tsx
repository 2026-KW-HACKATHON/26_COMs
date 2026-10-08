import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';
import { NudgeContext } from '../lib/nudgeContext';
import { countUnreadNudges, getNudge } from '../lib/nudges';
import { syncPush } from '../lib/push';
import { safeNextPath } from '../lib/social';
import { supabase } from '../lib/supabase';
import type { Nudge } from '../types/social';
import Avatar from './Avatar';

const TOAST_MS = 6000;

/**
 * 친구가 보낸 조르기를 앱 전체에 알린다: 안 읽은 수(헤더 벨), 앱을 보고 있을 때 위에서 내려오는 배너.
 * 앱을 닫아 뒀을 때는 폰 알림(public/push-sw.js)이 대신 뜬다.
 */
export default function NudgeProvider({ children }: { children: ReactNode }) {
  const me = useAuth().session?.user.id ?? '';
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [version, setVersion] = useState(0);
  const [counted, setCounted] = useState<{ me: string; unread: number } | null>(null);
  const [latest, setLatest] = useState<Nudge | null>(null);
  const [toast, setToast] = useState<Nudge | null>(null);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // 안 읽은 수: 로그인할 때, 앱으로 돌아올 때, 새 조르기를 받을 때, refresh()
  useEffect(() => {
    if (!SOCIAL_ENABLED || !me) return;
    let alive = true;
    countUnreadNudges(me)
      .then((unread) => alive && setCounted({ me, unread }))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [me, version]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // 새 조르기를 실시간으로 받는다 (Supabase Realtime, schema.sql 11번)
  useEffect(() => {
    if (!supabase || !me) return;
    const client = supabase;
    let alive = true;
    const channel = client
      .channel(`nudges:${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nudges', filter: `receiver_id=eq.${me}` }, (payload) => {
        refresh();
        getNudge(String(payload.new.id))
          .then((nudge) => {
            if (!alive || !nudge) return;
            setLatest(nudge);
            setToast(nudge);
            navigator.vibrate?.([80, 40, 80]);
          })
          .catch((err) => console.error(err));
      })
      .subscribe();
    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
  }, [me, refresh]);

  // 이 기기에서 폰 알림을 켜 뒀다면 로그인한 계정으로 구독을 다시 저장
  useEffect(() => {
    if (SOCIAL_ENABLED && me) syncPush().catch((err) => console.warn(err));
  }, [me]);

  // 폰 알림을 누르면 열려 있던 앱이 그 화면으로 이동한다 (public/push-sw.js가 보낸 메시지)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type === 'open' && typeof data.url === 'string') navigate(safeNextPath(data.url));
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const unread = SOCIAL_ENABLED && me && counted?.me === me ? counted.unread : 0;

  // 홈 화면에 추가한 앱 아이콘에 안 읽은 수 (지원하는 기기만)
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    (unread ? navigator.setAppBadge(unread) : navigator.clearAppBadge()).catch(() => undefined);
  }, [unread]);

  const value = useMemo(() => ({ unread, latest, refresh }), [unread, latest, refresh]);
  // 알림 목록을 보고 있으면 목록에 바로 나타나니 배너는 띄우지 않는다
  const shownToast = toast && pathname !== '/notifications' ? toast : null;

  return (
    <NudgeContext.Provider value={value}>
      {children}
      {shownToast && (
        <NudgeToast
          key={shownToast.id}
          nudge={shownToast}
          onOpen={() => {
            setToast(null);
            navigate(shownToast.capsuleId ? `/video/${shownToast.capsuleId}` : '/notifications');
          }}
          onClose={() => setToast(null)}
        />
      )}
    </NudgeContext.Provider>
  );
}

function NudgeToast({ nudge, onOpen, onClose }: { nudge: Nudge; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] pt-safe pointer-events-none" role="status" aria-live="polite">
      <div className="max-w-md mx-auto px-3 pt-2">
        <div className="nudge-drop pointer-events-auto flex items-center rounded-2xl glass-panel text-gray-900 shadow-float">
          <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-3 text-left" type="button">
            <span className="relative shrink-0">
              <Avatar profile={nudge.sender} size={40} />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full accent-gradient text-white ring-2 ring-white flex items-center justify-center">
                <span className="material-symbols-rounded icon-fill text-[12px]">waving_hand</span>
              </span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-label-lg font-bold truncate">{nudge.sender?.displayName ?? '친구'}님이 또 가자고 졸라요</span>
              <span className="block text-label-md text-gray-600 truncate">
                {nudge.placeName}
                {nudge.capsuleId ? ' · 같이 남긴 영상 보기' : ''}
              </span>
            </span>
          </button>
          <button onClick={onClose} className="w-11 h-11 mr-1 shrink-0 flex items-center justify-center text-gray-500" type="button" aria-label="알림 닫기">
            <span className="material-symbols-rounded text-[20px]">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
