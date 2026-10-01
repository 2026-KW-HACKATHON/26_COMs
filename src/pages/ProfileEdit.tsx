import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { USERNAME_PATTERN, UsernameTakenError, signOut, updateMyProfile } from '../lib/social';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { session, profile, setProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const name = displayName.trim();
  const usernameError = username && !USERNAME_PATTERN.test(username) ? '영문 소문자·숫자·마침표(.)·밑줄(_)로 3~20자' : '';
  const canSave = !!session && !!profile && name.length >= 1 && name.length <= 30 && !usernameError && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || !session) return;
    setSaving(true);
    setError('');
    try {
      setProfile(await updateMyProfile(session.user.id, { username, displayName: name }));
      navigate('/log', { replace: true });
    } catch (err) {
      if (err instanceof UsernameTakenError) setError('이미 쓰고 있는 아이디예요. 다른 아이디를 입력해 주세요.');
      else {
        console.error(err);
        setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      setSaving(false);
    }
  };

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
    <div className="flex flex-col w-full pb-6 pt-3 gap-5">
      {!profile ? (
        <p className="font-body-md text-body-md text-on-surface-variant">프로필을 불러오지 못했어요. 서버 설정(supabase/schema.sql)을 확인해 주세요.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <Avatar profile={{ displayName: name || profile.displayName, avatarUrl: profile.avatarUrl }} size={88} />
            <p className="font-label-sm text-label-sm text-on-surface-variant">사진은 로그인한 계정의 프로필 사진을 써요</p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">이름</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              className="h-12 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 outline-none focus:border-primary font-body-md text-body-md text-on-surface"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">아이디 (친구가 나를 찾고 태그할 때 써요)</span>
            <div className="h-12 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 focus-within:border-primary flex items-center gap-1">
              <span className="font-body-md text-body-md text-on-surface-variant">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 min-w-0 bg-transparent outline-none font-body-md text-body-md text-on-surface"
              />
            </div>
            {usernameError && <span className="font-label-sm text-label-sm text-error">{usernameError}</span>}
          </label>

          {error && <p className="font-label-md text-label-md text-error">{error}</p>}

          <button
            disabled={!canSave}
            className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold disabled:opacity-50"
            type="submit"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </form>
      )}

      <button onClick={handleSignOut} className="h-12 rounded-xl bg-surface-container-low text-on-surface-variant font-label-lg text-label-lg" type="button">
        로그아웃
      </button>
    </div>
  );
}
