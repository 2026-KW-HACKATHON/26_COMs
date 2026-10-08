import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { USERNAME_PATTERN, UsernameTakenError, isAutoUsername, safeNextPath, signOut, updateMyProfile } from '../lib/social';
import type { Profile } from '../types/social';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleSignOut = async () => {
    if (!confirm('로그아웃할까요?')) return;
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="flex flex-col w-full pb-8 pt-3 gap-5">
      {profile ? (
        // 프로필이 바뀌면(다른 계정) 입력값을 새로 채우도록 key를 준다
        <ProfileForm key={profile.id} profile={profile} />
      ) : (
        <p className="text-body-md text-on-surface-variant">프로필을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      )}

      <button onClick={handleSignOut} className="h-12 rounded-2xl bg-gray-100 text-gray-600 text-label-lg pressable" type="button">
        로그아웃
      </button>
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setProfile } = useAuth();
  // 첫 로그인 직후 아이디 정하기 단계: 저장하면 원래 가려던 화면으로
  const setup = params.get('setup') === '1';
  const next = params.has('next') ? safeNextPath(params.get('next')) : '/log';

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(setup && isAutoUsername(profile.username) ? '' : profile.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const name = displayName.trim();
  const usernameValid = USERNAME_PATTERN.test(username);
  const canSave = name.length >= 1 && name.length <= 30 && usernameValid && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      setProfile(await updateMyProfile(profile.id, { username, displayName: name }));
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof UsernameTakenError) setError('이미 쓰고 있는 아이디예요. 다른 아이디를 입력해 주세요.');
      else {
        console.error(err);
        setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {setup && (
        <div className="flex flex-col gap-1">
          <h2 className="text-headline-md text-on-surface">아이디를 정해 주세요</h2>
          <p className="text-body-md text-on-surface-variant">친구가 이 아이디로 나를 찾고 영상에 태그해요.</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 py-2">
        <Avatar profile={{ displayName: name || profile.displayName, avatarUrl: profile.avatarUrl }} size={88} />
        <p className="text-label-sm text-on-surface-variant">사진은 로그인한 계정의 프로필 사진을 써요</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface-variant">이름</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={30}
          className="h-14 px-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none focus:border-primary focus:bg-white text-[16px] text-on-surface transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface-variant">아이디 (친구가 나를 찾고 태그할 때 써요)</span>
        <div className="h-14 px-4 rounded-2xl bg-gray-50 border border-gray-200 focus-within:border-primary focus-within:bg-white flex items-center gap-1 transition-colors">
          <span className="text-[16px] text-gray-400">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            maxLength={20}
            placeholder="예: seongjun.kim"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-on-surface placeholder:text-gray-400"
          />
        </div>
        <span className={`text-label-sm ${username && !usernameValid ? 'text-error' : 'text-on-surface-variant'}`}>
          영문 소문자·숫자·마침표(.)·밑줄(_)로 3~20자
        </span>
      </label>

      {error && <p className="text-label-md text-error">{error}</p>}

      <button
        disabled={!canSave}
        className="h-14 rounded-2xl brand-gradient shadow-brand text-[17px] font-bold pressable"
        type="submit"
      >
        {saving ? '저장 중…' : setup ? '시작하기' : '저장'}
      </button>
      {setup && (
        <button onClick={() => navigate(next, { replace: true })} className="h-10 text-label-md text-on-surface-variant" type="button">
          나중에 할게요
        </button>
      )}
    </form>
  );
}
