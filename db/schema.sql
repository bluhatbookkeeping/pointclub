-- Point Club schema (Postgres / Neon). Safe to run more than once.
create table if not exists rooms (
  id text primary key,
  name text not null default 'Point Club',
  host_id text,
  active_sprint_id text,
  current_story_id text,
  revealed boolean not null default false,
  round int not null default 1,
  ado_pattern text not null default '',
  version bigint not null default 1
);
create table if not exists members (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  name text not null,
  character text not null,
  status text not null default 'here' check (status in ('here','away')),
  last_seen bigint not null default 0
);
create table if not exists sprints (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  name text not null,
  title text not null default '',
  started_at bigint not null,
  closed_at bigint
);
create table if not exists stories (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  sprint_id text not null references sprints(id) on delete cascade,
  number text not null,
  title text not null,
  url text not null default '',
  points text,
  outcome text,
  rounds int not null default 1,
  "order" int not null default 0
);
create table if not exists votes (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  story_id text not null references stories(id) on delete cascade,
  member_id text not null,
  round int not null,
  value text not null
);
create table if not exists events (
  id bigserial primary key,
  room_id text not null references rooms(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists members_room on members(room_id);
create index if not exists sprints_room on sprints(room_id);
create index if not exists stories_room on stories(room_id);
create index if not exists votes_room on votes(room_id);
create index if not exists events_room on events(room_id, id);
