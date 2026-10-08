import { useState } from 'react';
import { NudgeCooldownError, nudgeFriend } from '../lib/nudges';
import type { Profile } from '../types/social';

type Status = 'idle' | 'sending' | 'sent' | 'cooldown' | 'error';

interface NudgeButtonProps {
  /** 같이 남긴 영상 */
  capsuleId: string;
  friend: Profile;
  label?: string;
}

/** "여기 또 가자" 조르기 버튼. 한 번 조르면 10분 동안은 같은 친구에게 다시 못 조른다 */
export default function NudgeButton({ capsuleId, friend, label = '조르기' }: NudgeButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const done = status === 'sent' || status === 'cooldown';

  const send = async () => {
    setStatus('sending');
    try {
      await nudgeFriend(capsuleId, friend.id);
      setStatus('sent');
    } catch (err) {
      if (err instanceof NudgeCooldownError) {
        setStatus('cooldown');
      } else {
        console.error(err);
        setStatus('error');
      }
    }
  };

  const text = { idle: label, sending: label, sent: '졸랐어요', cooldown: '방금 졸랐어요', error: '다시 시도' }[status];

  return (
    <button
      onClick={send}
      disabled={status === 'sending' || done}
      className={`h-9 px-3.5 shrink-0 rounded-full text-label-md font-bold flex items-center gap-1 pressable ${
        done ? 'bg-surface-container text-gray-500' : 'bg-sunset shadow-glow'
      } ${status === 'sending' ? 'opacity-70' : ''}`}
      type="button"
      title={`${friend.displayName}님에게 또 가자고 조르기`}
    >
      <span className={`material-symbols-rounded text-[18px] ${done ? '' : 'icon-fill'} ${status === 'sending' ? 'nudge-wiggle' : ''}`}>
        {done ? 'check' : 'waving_hand'}
      </span>
      {text}
    </button>
  );
}
