-- 모아보라 초기 스키마: 공고 카드 + 단일 사용자 프로필 + 추천 캐시 + 원본 파일 버킷
-- 서버(API 라우트)에서 service_role 키로만 접근한다. RLS는 켜두되 정책을 만들지
-- 않아 anon 키로는 아무것도 읽을 수 없다.

-- ---------------------------------------------------------------------------
-- 공고 (Announcement)
-- ---------------------------------------------------------------------------
create table public.announcements (
  id text primary key,
  category text not null default 'others',
  title text not null,
  organizer text,
  field text,
  apply_start text,
  apply_end text,
  result_date text,
  benefits text,
  contact text,
  apply_url text,
  summary jsonb not null default '[]'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  todo_checklist jsonb not null default '[]'::jsonb,
  source_file jsonb,
  source_url text,
  created_at timestamptz not null default now()
);

create index announcements_created_at_idx
  on public.announcements (created_at desc);

-- 크롤링 중복 수집 방지용 (sourceUrl 조회)
create index announcements_source_url_idx
  on public.announcements (source_url)
  where source_url is not null;

alter table public.announcements enable row level security;

-- ---------------------------------------------------------------------------
-- 사용자 프로필 (단일 사용자 데모 — 항상 id = 1 한 행)
-- 병합 로직(lib/store.ts mergeProfile)이 앱 계층에 있으므로 jsonb 통짜 저장.
-- ---------------------------------------------------------------------------
create table public.profile (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profile enable row level security;

-- ---------------------------------------------------------------------------
-- Solar 추천 캐시 (프로필+공고 해시가 같으면 재사용 — 항상 id = 1 한 행)
-- ---------------------------------------------------------------------------
create table public.recommendation_cache (
  id smallint primary key default 1 check (id = 1),
  hash text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.recommendation_cache enable row level security;

-- ---------------------------------------------------------------------------
-- 공고 원본 파일 버킷 (PDF/HWP/이미지) — 파일명 = 공고 id
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;
