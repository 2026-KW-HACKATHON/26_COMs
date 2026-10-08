import { useNavigate } from 'react-router-dom';
import GroupInviteCard from '../components/GroupInviteCard';
import { MemberStack } from '../components/MemberAvatar';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { SOCIAL_ENABLED } from '../lib/capsuleStore';

/** 그룹: 친구들과 만든 그룹 목록과 받은 초대. 그룹을 누르면 그룹 지도와 그룹원 순위 */
export default function Groups() {
  const navigate = useNavigate();
  const me = useAuth().session?.user.id ?? '';
  const { list } = useGroups();
  const invites = list?.filter((g) => g.myStatus === 'invited') ?? [];
  const groups = list?.filter((g) => g.myStatus === 'member') ?? [];

  return (
    <div className="flex flex-col w-full pt-4 pb-8 gap-6">
      <section className="px-1 pt-1">
        <p className="text-label-md font-bold text-primary">노원구 월계1동</p>
        <h2 className="text-headline-md text-on-surface">친구들과 동네 땅따먹기</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          그룹을 만들면 그룹원들이 다녀간 가게가 한 지도에 모여요. 가게마다 가장 많이 간 사람의 색으로 칠해져요.
        </p>
      </section>

      {!SOCIAL_ENABLED ? (
        <p className="py-10 text-center text-body-md text-on-surface-variant">그룹은 로그인해서 친구와 함께 쓸 수 있어요.</p>
      ) : list === null ? (
        <ul className="flex flex-col gap-2" aria-label="불러오는 중">
          {[0, 1].map((i) => (
            <li key={i} className="h-[88px] rounded-2xl bg-gray-50 animate-pulse" />
          ))}
        </ul>
      ) : (
        <>
          {invites.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-headline-sm text-on-surface">받은 초대 {invites.length}</h3>
              {invites.map((g) => (
                <GroupInviteCard key={g.id} group={g} me={me} onAccepted={() => navigate(`/groups/${g.id}`)} />
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-headline-sm text-on-surface">내 그룹 {groups.length}</h3>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center text-center py-12 px-6 flat-card rounded-3xl text-on-surface-variant">
                <div className="w-16 h-16 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
                  <span className="material-symbols-rounded icon-fill text-[32px]">groups</span>
                </div>
                <p className="mt-3 text-body-md font-semibold text-on-surface">아직 그룹이 없어요</p>
                <p className="mt-1 text-body-sm">친구를 초대해서 누가 동네 가게를 가장 많이 차지하는지 겨뤄 보세요.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {groups.map((g) => {
                  const members = g.members.filter((m) => m.status === 'member');
                  const invited = g.members.length - members.length;
                  return (
                    <li key={g.id}>
                      <button onClick={() => navigate(`/groups/${g.id}`)} className="w-full flex items-center gap-3 p-4 flat-card text-left pressable" type="button">
                        <span className="flex-1 min-w-0">
                          <span className="block text-label-lg font-bold text-on-surface truncate">{g.name}</span>
                          <span className="mt-2 flex items-center gap-2">
                            <MemberStack members={members} />
                            <span className="text-label-sm text-on-surface-variant">
                              {members.length}명{invited > 0 && ` · ${invited}명 초대 중`}
                            </span>
                          </span>
                        </span>
                        <span className="material-symbols-rounded text-[22px] text-gray-400">chevron_right</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <button
            onClick={() => navigate('/groups/new')}
            className="h-14 rounded-2xl bg-primary text-on-primary text-[16px] font-bold flex items-center justify-center gap-1.5 pressable"
            type="button"
          >
            <span className="material-symbols-rounded text-[22px]">group_add</span>
            새 그룹 만들기
          </button>
        </>
      )}
    </div>
  );
}
