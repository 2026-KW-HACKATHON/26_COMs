-- 또갈래 서버 저장소 설정
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 Run. 여러 번 실행해도 된다.
-- 로그인(Google·카카오) 설정은 README의 "로그인 설정"을 따른다. 익명 로그인은 쓰지 않는다(켜져 있어도 차단됨).
-- 정책 테스트: npm run test:db
--
-- 공개 범위
--   영상: 본인, 수락된 친구, 그 영상에 태그된 사람만 본다. 작성자가 '동네 공개'로 둔 영상은 로그인한 모두가 본다
--         (태그된 친구는 동네 공개여도 원래 볼 수 있던 사람에게만 보인다).
--   프로필: 나와 관계가 있는 사람(친구·요청 주고받은 사람·같은 영상에 함께 나온 사람)만 조회.
--           모르는 사람은 search_profiles로 20명까지만 검색된다(전체 목록을 긁어갈 수 없음).
--   하트: 영상을 볼 수 있는 사람이 누른다. 다른 사람에게는 개수(capsules.like_count)만 보이고 누가 눌렀는지는 본인만 안다.
--   조르기: 같은 영상에 함께 나온 친구끼리만 보낼 수 있고, 보낸 사람·받은 사람만 본다.
--   동네 지도: 가게별 방문 수(숫자)만 누구나 본다. 누가 남겼는지·영상은 공개하지 않는다 (place_ranking).
--   그룹: 친구를 초대해 만든다. 그룹원끼리는 서로의 가게별 방문 수(숫자)를 본다 (group_map). 영상·날짜는 공개하지 않는다.
--         그룹원과 초대받은 사람끼리는 프로필이 보인다.
--   칭호: 나와 친구만 서로의 칭호(5번 이상 간 가게와 횟수)를 본다 (friend_titles). 영상·날짜는 공개하지 않는다.

-- 1) 프로필: 로그인하면 자동으로 만들어진다
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2) 친구 관계: A가 요청(pending) → B가 수락(accepted). 두 사람 사이에는 행이 하나만 있다
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_requester_accepted_idx on public.friendships (requester_id) where status = 'accepted';
create index if not exists friendships_addressee_accepted_idx on public.friendships (addressee_id) where status = 'accepted';

-- 3) 영상 기록. 파일 경로는 "<작성자 id>/<기록 id>.<확장자>"
create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  place_id text not null,
  place_name text not null,
  lat double precision not null,
  lng double precision not null,
  video_path text not null,
  thumbnail_path text,
  clip_start real not null default 0,
  clip_duration real not null,
  created_at timestamptz not null default now()
);
-- 작성자 정보를 함께 불러오도록 profiles를 참조한다 (이전 버전은 auth.users를 참조했음)
alter table public.capsules drop constraint if exists capsules_user_id_fkey;
-- 파일은 반드시 작성자 폴더 안에 있어야 한다. 아래 Storage 정책이 "볼 수 있는 기록이 가리키는 파일"을
-- 열어 주므로, 남의 파일을 가리키는 기록이 있으면 그 파일이 새어 나간다 (어떤 경로로 들어온 행이든 막음)
alter table public.capsules drop constraint if exists capsules_paths_in_owner_folder;
alter table public.capsules add constraint capsules_paths_in_owner_folder check (
  split_part(video_path, '/', 1) = user_id::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = user_id::text)
);
create index if not exists capsules_user_created_idx on public.capsules (user_id, created_at desc);
create index if not exists capsules_video_path_idx on public.capsules (video_path);
create index if not exists capsules_thumbnail_path_idx on public.capsules (thumbnail_path);
-- 공개 범위: friends(본인·친구·태그된 사람, 기본) / town(로그인한 동네 사람 모두). 작성자만 바꿀 수 있다
alter table public.capsules add column if not exists visibility text not null default 'friends';
alter table public.capsules drop constraint if exists capsules_visibility_check;
alter table public.capsules add constraint capsules_visibility_check check (visibility in ('friends', 'town'));
create index if not exists capsules_town_created_idx on public.capsules (created_at desc) where visibility = 'town';
-- 현장 인증: 앱에서 촬영할 때 기기 위치가 가게에서 100m 안이었는지 (좌표는 저장하지 않는다).
-- 앱이 기기에서 판단해 보내는 값이라 조작을 완전히 막지는 못한다. 앨범 영상은 늘 false
alter table public.capsules add column if not exists verified boolean not null default false;

-- 4) 기록에 태그한 친구 (인스타그램 태그처럼)
create table if not exists public.capsule_tags (
  capsule_id uuid not null references public.capsules (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (capsule_id, user_id)
);
create index if not exists capsule_tags_user_idx on public.capsule_tags (user_id);

-- 4a) 하트: 한 사람이 한 영상에 한 번. 개수는 아래 트리거가 capsules.like_count에 센다
--     (하트 행은 본인 것만 보여서 다른 사람 하트를 세려면 서버가 대신 세어 둬야 한다)
create table if not exists public.capsule_likes (
  capsule_id uuid not null references public.capsules (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (capsule_id, user_id)
);
create index if not exists capsule_likes_user_idx on public.capsule_likes (user_id);
alter table public.capsules add column if not exists like_count integer not null default 0;

create or replace function public.count_capsule_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.capsules set like_count = like_count + 1 where id = new.capsule_id;
  else
    -- 영상을 지울 때(cascade)는 영상 행이 이미 없어서 아무것도 바뀌지 않는다
    update public.capsules set like_count = greatest(like_count - 1, 0) where id = old.capsule_id;
  end if;
  return null;
end;
$$;

drop trigger if exists capsule_likes_count on public.capsule_likes;
create trigger capsule_likes_count
  after insert or delete on public.capsule_likes
  for each row execute function public.count_capsule_like();

-- 4b) 조르기: 같은 영상에 함께 나온(같이 간) 친구에게 "여기 또 가자" 알림. nudge_friend()로만 만든다
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  -- 영상이 지워져도 알림은 가게 이름과 함께 남는다
  capsule_id uuid references public.capsules (id) on delete set null,
  place_id text not null,
  place_name text not null,
  created_at timestamptz not null default now(),
  -- 받은 사람이 알림 목록을 연 시각
  read_at timestamptz,
  -- 폰 알림을 보낸 시각. 알림 서버(api/push.ts)가 조르기 하나에 한 번만 보내도록 기록한다
  pushed_at timestamptz,
  check (sender_id <> receiver_id)
);
create index if not exists nudges_receiver_created_idx on public.nudges (receiver_id, created_at desc);
create index if not exists nudges_sender_pair_idx on public.nudges (sender_id, receiver_id, place_id, created_at desc);

-- 4c) 폰 알림(웹 푸시) 구독: 알림을 켠 기기(브라우저)마다 한 줄. save_push_subscription()으로 저장하고,
--     남의 구독은 알림 서버(api/push.ts, secret key)만 읽는다
create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 4d) 그룹: 친구를 초대해서 만드는 모임. 그룹 지도에는 그룹원 모두의 가게 방문이 모이고, 가게마다 가장 많이 간
--     그룹원의 색으로 칠해진다(group_map). 만들기·초대·수락·나가기는 아래 RPC로만
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20 and name = btrim(name)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 그룹원(member)과 초대받은 사람(invited). 색은 그룹 안에서 겹치지 않는 번호(0~7, 앱의 GROUP_COLORS 순서)라서
-- 한 그룹은 초대 중인 사람을 포함해 8명까지
create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'member')),
  color smallint not null check (color between 0 and 7),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (group_id, color)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- 5) 새 로그인 사용자의 프로필 생성. 아이디는 임시로 "user_<무작위>"를 주고, 앱이 첫 로그인 때 직접 정하게 한다.
--    이메일 앞부분을 아이디·이름으로 쓰면 검색으로 남의 이메일 주소를 알아낼 수 있어서 이메일은 쓰지 않는다.
--    여기서 오류가 나면 가입(=로그인) 자체가 실패하므로 아이디가 겹쳐도 절대 실패하지 않게 한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display text := left(coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'nickname'), ''),
    nullif(btrim(meta ->> 'user_name'), ''),
    '친구'
  ), 30);
  -- 카카오 프로필 사진은 http 주소로 와서 https 사이트에서 막힐 수 있다
  avatar text := regexp_replace(coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', '')), '^http://', 'https://');
  candidate text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  -- 겹치면(누가 그 아이디로 바꿨거나 동시 가입) 임의 8자리로 다시. on conflict do nothing은 경합도 흡수한다
  for attempt in 1..10 loop
    insert into public.profiles (id, username, display_name, avatar_url)
    values (new.id, candidate, display, avatar)
    on conflict do nothing;
    exit when exists (select 1 from public.profiles where id = new.id);
    candidate := 'user_' || substr(md5(random()::text || clock_timestamp()::text || attempt::text), 1, 8);
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이 스크립트 전에 가입한 사용자(이전 버전의 익명 계정 등)에게도 프로필을 만든다
insert into public.profiles (id, username, display_name)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 12), '친구'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

alter table public.capsules
  add constraint capsules_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

-- 6) 공개 범위 판단 함수. 정책끼리 서로를 참조하며 무한 반복되지 않도록 security definer로 두고,
--    항상 "현재 로그인 사용자" 기준이라 다른 사람끼리의 관계는 알아낼 수 없다.
create or replace function public.is_friend(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = other)
        or (f.requester_id = other and f.addressee_id = auth.uid()))
  );
$$;

-- 내 친구 id 목록 / 내가 태그된 기록 id 목록: 정책에서 "in (select ...)"로 쓰면 쿼리마다 한 번만 계산된다
create or replace function public.my_friend_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  from public.friendships f
  where f.status = 'accepted' and (f.requester_id = auth.uid() or f.addressee_id = auth.uid());
$$;

create or replace function public.my_tagged_capsule_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.capsule_id from public.capsule_tags t where t.user_id = auth.uid();
$$;

-- 이 프로필을 볼 수 있는지: 나, 친구·요청을 주고받은 사람, 나를 태그한 사람, 내가 볼 수 있는 영상에 태그된 사람
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid()
    or exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = target)
         or (f.requester_id = target and f.addressee_id = auth.uid())
    )
    or exists (
      select 1 from public.capsule_tags t join public.capsules c on c.id = t.capsule_id
      where t.user_id = auth.uid() and c.user_id = target
    )
    or exists (
      select 1 from public.capsule_tags t join public.capsules c on c.id = t.capsule_id
      where t.user_id = target
        and (c.user_id = auth.uid()
          or c.user_id in (select public.my_friend_ids())
          or c.id in (select public.my_tagged_capsule_ids()))
    )
    -- 동네 공개 영상의 작성자 (태그된 사람은 공개하지 않는다)
    or exists (select 1 from public.capsules c where c.user_id = target and c.visibility = 'town')
    -- 같은 그룹의 그룹원·초대받은 사람
    or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and theirs.user_id = target
    );
$$;

-- 내가 들어가 있거나 초대받은 그룹 id. 그룹 정책이 group_members를 다시 읽으며 무한 반복되지 않도록 security definer
create or replace function public.my_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.group_id from public.group_members m where m.user_id = auth.uid();
$$;

-- 7) 테이블 권한: 필요한 것만 (TRUNCATE 등 Supabase 기본 권한은 회수). 행 단위 허용은 아래 정책이 정한다
revoke all on public.profiles, public.friendships, public.capsules, public.capsule_tags, public.capsule_likes, public.nudges, public.push_subscriptions,
  public.groups, public.group_members
  from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name) on public.profiles to authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
-- 작성 시각(created_at)은 서버가 정한다. 날짜를 지어내 동네 지도·그룹 지도의 방문 수를 부풀릴 수 없게
grant select, delete on public.capsules to authenticated;
grant insert (id, user_id, place_id, place_name, lat, lng, video_path, thumbnail_path, clip_start, clip_duration, visibility, verified)
  on public.capsules to authenticated;
grant update (visibility) on public.capsules to authenticated;
grant select, insert, delete on public.capsule_tags to authenticated;
-- 하트는 영상 id만 보낸다 (누른 사람·시각은 서버가 정하고, 개수는 트리거만 바꾼다)
grant select, delete on public.capsule_likes to authenticated;
grant insert (capsule_id) on public.capsule_likes to authenticated;
grant select on public.nudges to authenticated;
grant update (read_at) on public.nudges to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
-- 그룹은 읽기만 (만들기·초대·수락·나가기는 RPC가 친구 관계·인원·색을 확인하며 한다)
grant select on public.groups, public.group_members to authenticated;
-- 알림 서버(api/push.ts·api/recall.ts)가 secret key(service_role)로 읽고 쓴다. 최근 Supabase 프로젝트는 SQL로 만든 테이블에
-- 이 권한을 자동으로 주지 않아서 직접 준다 (service_role은 행 보안 정책을 건너뛰는 관리자 키라 앱에는 들어가지 않는다)
grant select, insert, update, delete
  on public.profiles, public.friendships, public.capsules, public.capsule_tags, public.capsule_likes, public.nudges, public.push_subscriptions,
    public.groups, public.group_members
  to service_role;

-- 8) 행 보안 정책
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.capsules enable row level security;
alter table public.capsule_tags enable row level security;
alter table public.capsule_likes enable row level security;
alter table public.nudges enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- 익명 로그인 계정은 어떤 데이터에도 접근할 수 없다 (대시보드에서 실수로 켜도 안전하게)
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'friendships', 'capsules', 'capsule_tags', 'capsule_likes', 'nudges', 'push_subscriptions', 'groups', 'group_members'] loop
    execute format('drop policy if exists %I on public.%I', t || ': 익명 계정 차단', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using ((select coalesce((auth.jwt() ->> ''is_anonymous'')::boolean, false)) = false)
         with check ((select coalesce((auth.jwt() ->> ''is_anonymous'')::boolean, false)) = false)',
      t || ': 익명 계정 차단', t);
  end loop;
end;
$$;

-- 프로필: 관계 있는 사람만 조회, 수정은 본인의 아이디·이름만
drop policy if exists "profiles: 로그인 사용자 조회" on public.profiles;
drop policy if exists "profiles: 관계 있는 사람 조회" on public.profiles;
create policy "profiles: 관계 있는 사람 조회" on public.profiles
  for select to authenticated using (public.can_see_profile(id));
drop policy if exists "profiles: 본인 수정" on public.profiles;
create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 친구 관계: 당사자만 조회·삭제, 요청은 본인 이름으로만, 수락은 받은 사람만
drop policy if exists "friendships: 당사자 조회" on public.friendships;
create policy "friendships: 당사자 조회" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
drop policy if exists "friendships: 요청" on public.friendships;
create policy "friendships: 요청" on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
drop policy if exists "friendships: 받은 요청 수락" on public.friendships;
create policy "friendships: 받은 요청 수락" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
drop policy if exists "friendships: 당사자 삭제" on public.friendships;
create policy "friendships: 당사자 삭제" on public.friendships
  for delete to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- 영상 기록: 본인·친구·태그된 사람(동네 공개면 모두)이 조회, 본인 이름·본인 폴더로만 생성,
--           삭제와 공개 범위 변경은 본인만 (다른 내용은 수정 없음)
drop policy if exists "capsules: 본인 기록 조회" on public.capsules;
drop policy if exists "capsules: 본인·친구·태그 조회" on public.capsules;
create policy "capsules: 본인·친구·태그 조회" on public.capsules
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (select public.my_friend_ids())
    or id in (select public.my_tagged_capsule_ids())
    or visibility = 'town'
  );
drop policy if exists "capsules: 본인 공개 범위 변경" on public.capsules;
create policy "capsules: 본인 공개 범위 변경" on public.capsules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "capsules: 본인 기록 생성" on public.capsules;
create policy "capsules: 본인 기록 생성" on public.capsules
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and split_part(video_path, '/', 1) = (select auth.uid())::text
    and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
  );
drop policy if exists "capsules: 본인 기록 삭제" on public.capsules;
create policy "capsules: 본인 기록 삭제" on public.capsules
  for delete to authenticated using (user_id = (select auth.uid()));

-- 태그: 기록을 볼 수 있는 사람(동네 공개로만 보는 사람은 제외)이 조회, 작성자만 친구를 태그, 작성자나 태그된 본인이 삭제
drop policy if exists "capsule_tags: 기록 조회 가능자" on public.capsule_tags;
create policy "capsule_tags: 기록 조회 가능자" on public.capsule_tags
  for select to authenticated
  using (exists (
    select 1 from public.capsules c
    where c.id = capsule_id
      and (c.user_id = (select auth.uid())
        or c.user_id in (select public.my_friend_ids())
        or c.id in (select public.my_tagged_capsule_ids()))
  ));
drop policy if exists "capsule_tags: 작성자가 친구 태그" on public.capsule_tags;
create policy "capsule_tags: 작성자가 친구 태그" on public.capsule_tags
  for insert to authenticated
  with check (
    exists (select 1 from public.capsules c where c.id = capsule_id and c.user_id = (select auth.uid()))
    and public.is_friend(user_id)
  );
drop policy if exists "capsule_tags: 작성자·태그된 본인 삭제" on public.capsule_tags;
create policy "capsule_tags: 작성자·태그된 본인 삭제" on public.capsule_tags
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.capsules c where c.id = capsule_id and c.user_id = (select auth.uid()))
  );

-- 하트: 본인 하트만 조회·취소, 누르기는 본인 이름으로 내가 볼 수 있는 영상에만 (영상 조회 정책을 그대로 따른다)
drop policy if exists "capsule_likes: 본인 조회" on public.capsule_likes;
create policy "capsule_likes: 본인 조회" on public.capsule_likes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "capsule_likes: 볼 수 있는 영상에 누르기" on public.capsule_likes;
create policy "capsule_likes: 볼 수 있는 영상에 누르기" on public.capsule_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.capsules c where c.id = capsule_id)
  );
drop policy if exists "capsule_likes: 본인 취소" on public.capsule_likes;
create policy "capsule_likes: 본인 취소" on public.capsule_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- 조르기: 보낸 사람·받은 사람만 조회, 읽음 표시는 받은 사람만. 만들기는 nudge_friend()로만
drop policy if exists "nudges: 당사자 조회" on public.nudges;
create policy "nudges: 당사자 조회" on public.nudges
  for select to authenticated
  using (receiver_id = (select auth.uid()) or sender_id = (select auth.uid()));
drop policy if exists "nudges: 받은 사람 읽음 표시" on public.nudges;
create policy "nudges: 받은 사람 읽음 표시" on public.nudges
  for update to authenticated
  using (receiver_id = (select auth.uid())) with check (receiver_id = (select auth.uid()));

-- 폰 알림 구독: 본인 기기만 조회·삭제(알림 끄기·로그아웃). 저장은 save_push_subscription()으로
drop policy if exists "push_subscriptions: 본인 조회" on public.push_subscriptions;
create policy "push_subscriptions: 본인 조회" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "push_subscriptions: 본인 삭제" on public.push_subscriptions;
create policy "push_subscriptions: 본인 삭제" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- 그룹: 그룹원과 초대받은 사람이 그룹 이름과 그룹원 목록을 본다
drop policy if exists "groups: 그룹원·초대받은 사람 조회" on public.groups;
create policy "groups: 그룹원·초대받은 사람 조회" on public.groups
  for select to authenticated using (id in (select public.my_group_ids()));
drop policy if exists "group_members: 같은 그룹 조회" on public.group_members;
create policy "group_members: 같은 그룹 조회" on public.group_members
  for select to authenticated using (group_id in (select public.my_group_ids()));

-- 이전 버전의 정책 함수 (위 정책이 더 이상 쓰지 않음)
drop function if exists public.can_view_capsule(uuid, uuid);

-- 9) 친구·조르기 RPC

-- 아이디 앞부분 또는 이름 일부로 사용자 검색 (나와의 관계 포함, 최대 20명).
-- 모르는 사람도 찾아야 해서 security definer로 프로필 정책을 우회하되, 결과는 검색어에 맞는 사람만 돌려준다
create or replace function public.search_profiles(q text)
returns table (id uuid, username text, display_name text, avatar_url text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (select lower(trim(q)) as t, lower(ltrim(trim(q), '@')) as handle)
  select p.id, p.username, p.display_name, p.avatar_url,
    case
      when f.status = 'accepted' then 'friend'
      when f.requester_id = auth.uid() then 'outgoing'
      when f.addressee_id = auth.uid() then 'incoming'
      else 'none'
    end
  from public.profiles p
  cross join term
  left join public.friendships f
    on (f.requester_id = auth.uid() and f.addressee_id = p.id)
    or (f.requester_id = p.id and f.addressee_id = auth.uid())
  where auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and p.id <> auth.uid()
    and char_length(term.handle) >= 2
    and (starts_with(p.username, term.handle) or strpos(lower(p.display_name), term.t) > 0)
  order by (p.username = term.handle) desc, p.username
  limit 20;
$$;

-- 내 친구·받은 요청·보낸 요청 (호출한 사용자 권한으로 실행되어 위 정책이 그대로 적용된다)
create or replace function public.list_friendships()
returns table (id uuid, username text, display_name text, avatar_url text, status text, created_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url,
    case
      when f.status = 'accepted' then 'friend'
      when f.requester_id = auth.uid() then 'outgoing'
      else 'incoming'
    end,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
  order by f.created_at desc;
$$;

-- 친구 요청. 상대가 이미 나에게 요청했다면 바로 수락한다. 결과 관계를 돌려준다
create or replace function public.request_friend(target uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.friendships;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if target = me then
    raise exception 'cannot befriend yourself';
  end if;
  select * into existing from public.friendships f
  where (f.requester_id = me and f.addressee_id = target)
     or (f.requester_id = target and f.addressee_id = me);
  if not found then
    begin
      insert into public.friendships (requester_id, addressee_id) values (me, target);
      return 'outgoing';
    exception when unique_violation then
      -- 상대도 동시에 나에게 요청한 경우: 그 요청을 수락한다
      update public.friendships set status = 'accepted'
      where requester_id = target and addressee_id = me and status = 'pending';
      return case when found then 'friend' else 'outgoing' end;
    end;
  elsif existing.status = 'accepted' then
    return 'friend';
  elsif existing.requester_id = me then
    return 'outgoing';
  end if;
  update public.friendships set status = 'accepted'
  where requester_id = target and addressee_id = me;
  return 'friend';
end;
$$;

-- 친구 끊기·요청 취소·요청 거절
create or replace function public.remove_friend(target uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.friendships
  where (requester_id = auth.uid() and addressee_id = target)
     or (requester_id = target and addressee_id = auth.uid());
$$;

-- 같이 간 친구에게 "여기 또 가자" 조르기. 두 사람 모두 이 영상에 나와야(작성자 또는 태그) 하고 지금 친구여야 한다.
-- 같은 친구에게 같은 가게로는 10분에 한 번. 만든 조르기 id를 돌려준다 (앱이 이 id로 폰 알림을 요청한다)
create or replace function public.nudge_friend(capsule uuid, target uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.capsules;
  new_id uuid;
begin
  if me is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not authenticated';
  end if;
  select * into c from public.capsules where id = capsule;
  if not found
    or target = me
    or not (c.user_id = me or exists (select 1 from public.capsule_tags t where t.capsule_id = c.id and t.user_id = me))
    or not (c.user_id = target or exists (select 1 from public.capsule_tags t where t.capsule_id = c.id and t.user_id = target))
    or not public.is_friend(target)
  then
    raise exception 'cannot nudge this person' using errcode = '42501';
  end if;
  -- 여러 번 연달아 눌러도(동시 요청) 한 번만 들어가게
  perform pg_advisory_xact_lock(hashtext(me::text || target::text || c.place_id));
  if exists (
    select 1 from public.nudges n
    where n.sender_id = me and n.receiver_id = target and n.place_id = c.place_id
      and n.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'nudge cooldown';
  end if;
  insert into public.nudges (sender_id, receiver_id, capsule_id, place_id, place_name)
  values (me, target, c.id, c.place_id, c.place_name)
  returning id into new_id;
  return new_id;
end;
$$;

-- 이 기기의 폰 알림 구독 저장. 같은 기기에서 다른 계정으로 로그인해 알림을 켜면 그 계정으로 옮긴다
create or replace function public.save_push_subscription(sub_endpoint text, sub_p256dh text, sub_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not authenticated';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (sub_endpoint, auth.uid(), sub_p256dh, sub_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

-- 동네 지도: 가게별 방문 수(방문 많은 순). 누가 남겼는지·영상은 드러내지 않고 숫자만 돌려줘서 로그인하지 않아도 볼 수 있다.
--   방문 = 영상에 나온 사람(작성자·태그된 친구) × 날짜(한국 시간). 한 사람이 같은 날 여러 개 남겨도 한 번이라
--          영상을 몰아서 올려도 순위가 오르지 않고, 다른 날 다시 오면 오른다.
--   단골 = 다른 날 두 번 이상 온 사람.
--   현장 인증 방문 = 그중 현장 인증된 영상(verified)이 있는 사람×날짜.
--   days: 오늘 포함 최근 며칠 (null이면 전체). 날짜 단위로만 받아서 영상을 남긴 시각을 좁혀 알아낼 수 없다.
--   가게 이름은 앱에 들어 있는 가게 목록에서 찾는다 (기록의 place_name은 사용자가 보낸 값이라 그대로 공개하지 않음)
-- 돌려주는 열이 바뀌면 create or replace로는 못 바꿔서 지우고 다시 만든다 (권한은 아래에서 다시 준다)
drop function if exists public.place_ranking(integer);
create function public.place_ranking(days integer default null)
returns table (place_id text, visits integer, people integer, regulars integer, videos integer, verified_visits integer)
language sql
stable
security definer
set search_path = ''
as $$
  with seen as (
    select c.id, c.place_id, c.created_at, c.verified, who.person, (c.created_at at time zone 'Asia/Seoul')::date as day
    from public.capsules c
    cross join lateral (
      select c.user_id as person
      union
      select t.user_id from public.capsule_tags t where t.capsule_id = c.id
    ) who
    where days is null
      or (c.created_at at time zone 'Asia/Seoul')::date > (now() at time zone 'Asia/Seoul')::date - least(greatest(days, 1), 3650)
  ),
  by_place as (
    select s.place_id, count(distinct s.id)::integer as videos, max(s.created_at) as last_at
    from seen s
    group by s.place_id
  ),
  by_person as (
    select s.place_id,
      count(distinct s.day)::integer as visit_days,
      (count(distinct s.day) filter (where s.verified))::integer as verified_days
    from seen s
    group by s.place_id, s.person
  )
  select b.place_id,
    sum(p.visit_days)::integer as visits,
    count(*)::integer as people,
    (count(*) filter (where p.visit_days >= 2))::integer as regulars,
    b.videos,
    sum(p.verified_days)::integer as verified_visits
  from by_place b
  join by_person p on p.place_id = b.place_id
  group by b.place_id, b.videos, b.last_at
  order by visits desc, people desc, b.last_at desc
  limit 200;
$$;

-- 9a) 그룹 RPC

-- 친구들을 그룹에 초대한다 (create_group·invite_to_group 안에서만 쓴다). 내 친구가 아니거나 이미 그룹에 있는 사람은 건너뛰고,
-- 그룹 색(8개)이 모자라면(초대 중 포함 8명) 실패한다. 초대한 사람 수를 돌려준다
create or replace function public.add_group_invites(target_group uuid, targets uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  next_color smallint;
  added integer := 0;
begin
  -- 동시에 초대해도 색이 겹치지 않게 그룹마다 한 번에 하나씩
  perform pg_advisory_xact_lock(hashtext('group:' || target_group::text));
  foreach target in array coalesce(targets, '{}'::uuid[]) loop
    continue when target is null
      or target = me
      or not public.is_friend(target)
      or exists (select 1 from public.group_members m where m.group_id = target_group and m.user_id = target);
    select min(c)::smallint into next_color
    from generate_series(0, 7) c
    where c not in (select m.color from public.group_members m where m.group_id = target_group);
    if next_color is null then
      raise exception 'group is full';
    end if;
    insert into public.group_members (group_id, user_id, status, color, invited_by)
    values (target_group, target, 'invited', next_color, me);
    added := added + 1;
  end loop;
  return added;
end;
$$;

-- 그룹 만들기: 이름(1~20자)을 정하고 친구들을 초대한다. 만든 사람은 바로 그룹원(첫 번째 색). 만든 그룹 id를 돌려준다
create or replace function public.create_group(group_name text, invitees uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not authenticated';
  end if;
  insert into public.groups (name, created_by) values (btrim(group_name), me) returning id into new_id;
  insert into public.group_members (group_id, user_id, status, color) values (new_id, me, 'member', 0);
  perform public.add_group_invites(new_id, invitees);
  return new_id;
end;
$$;

-- 그룹원이 자기 친구를 더 초대한다. 초대한 사람 수를 돌려준다
create or replace function public.invite_to_group(target_group uuid, targets uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not exists (
      select 1 from public.group_members m
      where m.group_id = target_group and m.user_id = auth.uid() and m.status = 'member'
    )
  then
    raise exception 'not a group member' using errcode = '42501';
  end if;
  return public.add_group_invites(target_group, targets);
end;
$$;

-- 받은 초대 수락 (이미 그룹원이면 그대로)
create or replace function public.accept_group_invite(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not authenticated';
  end if;
  update public.group_members set status = 'member'
  where group_id = target_group and user_id = auth.uid() and status = 'invited';
  if not found and not exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = auth.uid() and m.status = 'member'
  ) then
    raise exception 'no invitation' using errcode = '42501';
  end if;
end;
$$;

-- 그룹 나가기·초대 거절. 그룹원이 아무도 남지 않으면 그룹(남은 초대 포함)도 지운다
create or replace function public.leave_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('group:' || target_group::text));
  delete from public.group_members where group_id = target_group and user_id = auth.uid();
  if found and not exists (
    select 1 from public.group_members m where m.group_id = target_group and m.status = 'member'
  ) then
    delete from public.groups where id = target_group;
  end if;
end;
$$;

-- 아직 수락하지 않은 초대 취소 (그룹원 누구나)
create or replace function public.cancel_group_invite(target_group uuid, target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not exists (
      select 1 from public.group_members m
      where m.group_id = target_group and m.user_id = auth.uid() and m.status = 'member'
    )
  then
    raise exception 'not a group member' using errcode = '42501';
  end if;
  delete from public.group_members where group_id = target_group and user_id = target and status = 'invited';
end;
$$;

-- 내 그룹(초대받은 그룹 포함)과 각 그룹의 그룹원·초대받은 사람 (한 줄에 한 사람, 최근 만든 그룹부터 색 번호 순).
-- 호출한 사용자 권한으로 실행되어 위 정책이 그대로 적용된다
create or replace function public.list_groups()
returns table (
  group_id uuid, name text, created_at timestamptz,
  user_id uuid, username text, display_name text, avatar_url text,
  status text, color smallint, invited_by uuid
)
language sql
stable
set search_path = ''
as $$
  select g.id, g.name, g.created_at, p.id, p.username, p.display_name, p.avatar_url, m.status, m.color, m.invited_by
  from public.group_members m
  join public.groups g on g.id = m.group_id
  join public.profiles p on p.id = m.user_id
  order by g.created_at desc, g.id, m.color;
$$;

-- 그룹 지도: 그룹원별 가게 방문 수와 가게마다 땅 주인(가장 많이 간 그룹원). 그룹원만 부를 수 있다 (초대받은 사람은 수락한 뒤에).
--   방문 = 영상에 나온(작성자·태그) 날 수, 한국 날짜 기준 (place_ranking과 같은 기준). 영상의 공개 범위와 상관없이 세지만
--          숫자만 돌려주고 영상·날짜·시각은 드러내지 않는다 (그룹에 들어갈 때 앱이 안내한다).
--   같은 횟수면 그 횟수에 먼저 닿은 사람이 땅을 지킨다(뺏으려면 더 많이 가야 한다).
--   그래도 같으면(같은 영상에 함께 나온 경우) 그 가게 영상을 더 많이 찍은 사람
create or replace function public.group_map(target_group uuid)
returns table (place_id text, user_id uuid, visits integer, owner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select m.user_id as person
    from public.group_members m
    where m.group_id = target_group
      and m.status = 'member'
      and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      and exists (
        select 1 from public.group_members mine
        where mine.group_id = target_group and mine.user_id = auth.uid() and mine.status = 'member'
      )
  ),
  seen as (
    select c.place_id, c.user_id as person, c.created_at, true as filmed
    from public.capsules c
    where c.user_id in (select members.person from members)
    union all
    select c.place_id, t.user_id, c.created_at, false
    from public.capsule_tags t
    join public.capsules c on c.id = t.capsule_id
    where t.user_id in (select members.person from members)
  ),
  by_day as (
    select s.place_id, s.person, (s.created_at at time zone 'Asia/Seoul')::date as day,
      min(s.created_at) as first_at, count(*) filter (where s.filmed) as filmed
    from seen s
    group by s.place_id, s.person, (s.created_at at time zone 'Asia/Seoul')::date
  ),
  by_person as (
    select d.place_id, d.person, count(*)::integer as visits,
      -- 지금 횟수에 닿은 시각 = 마지막으로 간 날의 첫 영상
      max(d.first_at) as reached_at,
      sum(d.filmed) as filmed
    from by_day d
    group by d.place_id, d.person
  ),
  ranked as (
    select b.*, row_number() over (
      partition by b.place_id order by b.visits desc, b.reached_at, b.filmed desc, b.person
    ) as pos
    from by_person b
  )
  select r.place_id, r.person, r.visits, r.pos = 1
  from ranked r
  order by r.place_id, r.pos;
$$;

-- 9b) 칭호: 한 가게에 간 횟수로 "가게 이름 + 등급" (브론즈 5 · 실버 10 · 골드 20 · 플래티넘 30 · 다이아몬드 50번, 등급은 앱이 정한다).
--   방문 = 영상에 나온(작성자·태그) 날 수, 한국 날짜 기준 (place_ranking·group_map과 같은 기준). 전체 기간.
--   나와 친구의 칭호만 돌려준다 (친구끼리만 서로의 칭호를 본다). 5번 이상 간 가게와 횟수만 돌려주고 영상·날짜는 드러내지 않는다.
--   pos: 그 사람의 대표 칭호 순서 (많이 간 순, 같으면 그 횟수에 먼저 닿은 가게라서 새 가게가 따라와도 칭호가 바뀌지 않는다).
--   가게 이름은 앱에 들어 있는 가게 목록에서 찾는다 (기록의 place_name은 사용자가 보낸 값이라 그대로 공개하지 않음)
create or replace function public.friend_titles()
returns table (user_id uuid, place_id text, visits integer, pos integer)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select ids.person
    from (
      select auth.uid() as person
      union
      select public.my_friend_ids()
    ) ids
    where ids.person is not null
      and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  ),
  seen as (
    select c.place_id, c.user_id as person, c.created_at
    from public.capsules c
    where c.user_id in (select people.person from people)
    union all
    select c.place_id, t.user_id, c.created_at
    from public.capsule_tags t
    join public.capsules c on c.id = t.capsule_id
    where t.user_id in (select people.person from people)
  ),
  by_day as (
    select s.place_id, s.person, min(s.created_at) as first_at
    from seen s
    group by s.place_id, s.person, (s.created_at at time zone 'Asia/Seoul')::date
  ),
  by_person as (
    select d.place_id, d.person, count(*)::integer as visits,
      -- 지금 횟수에 닿은 시각 = 마지막으로 간 날의 첫 영상
      max(d.first_at) as reached_at
    from by_day d
    group by d.place_id, d.person
  )
  select b.person, b.place_id, b.visits,
    (row_number() over (partition by b.person order by b.visits desc, b.reached_at, b.place_id))::integer
  from by_person b
  where b.visits >= 5
  order by b.person, 4;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.count_capsule_like() from public, anon, authenticated;
revoke execute on function public.is_friend(uuid) from public, anon;
revoke execute on function public.my_friend_ids() from public, anon;
revoke execute on function public.my_tagged_capsule_ids() from public, anon;
revoke execute on function public.can_see_profile(uuid) from public, anon;
revoke execute on function public.search_profiles(text) from public, anon;
revoke execute on function public.list_friendships() from public, anon;
revoke execute on function public.request_friend(uuid) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.nudge_friend(uuid, uuid) from public, anon;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.place_ranking(integer) from public;
revoke execute on function public.my_group_ids() from public, anon;
revoke execute on function public.add_group_invites(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.create_group(text, uuid[]) from public, anon;
revoke execute on function public.invite_to_group(uuid, uuid[]) from public, anon;
revoke execute on function public.accept_group_invite(uuid) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.cancel_group_invite(uuid, uuid) from public, anon;
revoke execute on function public.list_groups() from public, anon;
revoke execute on function public.group_map(uuid) from public, anon;
revoke execute on function public.friend_titles() from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.my_friend_ids() to authenticated;
grant execute on function public.my_tagged_capsule_ids() to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.list_friendships() to authenticated;
grant execute on function public.request_friend(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.nudge_friend(uuid, uuid) to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.place_ranking(integer) to anon, authenticated;
grant execute on function public.my_group_ids() to authenticated;
grant execute on function public.create_group(text, uuid[]) to authenticated;
grant execute on function public.invite_to_group(uuid, uuid[]) to authenticated;
grant execute on function public.accept_group_invite(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.cancel_group_invite(uuid, uuid) to authenticated;
grant execute on function public.list_groups() to authenticated;
grant execute on function public.group_map(uuid) to authenticated;
grant execute on function public.friend_titles() to authenticated;

-- 10) 영상·썸네일 저장소: 비공개 버킷, 파일당 50MB(무료 요금제 한도)
insert into storage.buckets (id, name, public, file_size_limit)
values ('capsules', 'capsules', false, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "capsules: 익명 계정 차단" on storage.objects;
create policy "capsules: 익명 계정 차단" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'capsules' or (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) = false)
  with check (bucket_id <> 'capsules' or (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) = false);

drop policy if exists "capsules: 본인 폴더 업로드" on storage.objects;
create policy "capsules: 본인 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 본인 폴더는 항상 조회 (업로드 실패 시 정리용), 다른 사람 파일은 볼 수 있는 기록에 연결된 것만.
-- 주의: 서명 URL은 만들 때만 검사하므로 친구를 끊어도 이미 받은 URL은 만료(앱은 10분)까지 쓸 수 있다
drop policy if exists "capsules: 본인 폴더 조회" on storage.objects;
create policy "capsules: 본인 폴더 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "capsules: 볼 수 있는 기록의 파일 조회" on storage.objects;
create policy "capsules: 볼 수 있는 기록의 파일 조회" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'capsules'
    and exists (
      select 1 from public.capsules c
      where c.video_path = storage.objects.name or c.thumbnail_path = storage.objects.name
    )
  );

drop policy if exists "capsules: 본인 폴더 삭제" on storage.objects;
create policy "capsules: 본인 폴더 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 11) 실시간 알림: 새 조르기를 열려 있는 앱 화면에 바로 띄운다 (Supabase Realtime).
--     받는 사람에게만 간다 (Realtime도 위 "nudges: 당사자 조회" 정책을 따른다)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nudges'
    )
  then
    alter publication supabase_realtime add table public.nudges;
  end if;
end;
$$;
