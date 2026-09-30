-- 기억캡슐 서버 저장소 설정
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 Run. 여러 번 실행해도 된다.
-- 실행 뒤 Authentication > Sign In / Providers에서 "Allow anonymous sign-ins"를 켠다.

-- 1) 영상 기록 테이블: 본인(익명 계정 포함) 기록만 보고, 만들고, 지울 수 있다
create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
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

create index if not exists capsules_user_created_idx on public.capsules (user_id, created_at desc);

alter table public.capsules enable row level security;

drop policy if exists "capsules: 본인 기록 조회" on public.capsules;
create policy "capsules: 본인 기록 조회" on public.capsules
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "capsules: 본인 기록 생성" on public.capsules;
create policy "capsules: 본인 기록 생성" on public.capsules
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "capsules: 본인 기록 삭제" on public.capsules;
create policy "capsules: 본인 기록 삭제" on public.capsules
  for delete to authenticated using (user_id = (select auth.uid()));

-- 2) 영상·썸네일 저장소: 비공개 버킷, 파일당 50MB(무료 요금제 한도). 경로는 "<사용자 id>/<기록 id>.<확장자>"
insert into storage.buckets (id, name, public, file_size_limit)
values ('capsules', 'capsules', false, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "capsules: 본인 폴더 업로드" on storage.objects;
create policy "capsules: 본인 폴더 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "capsules: 본인 폴더 조회" on storage.objects;
create policy "capsules: 본인 폴더 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "capsules: 본인 폴더 삭제" on storage.objects;
create policy "capsules: 본인 폴더 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'capsules' and (storage.foldername(name))[1] = (select auth.uid())::text);
