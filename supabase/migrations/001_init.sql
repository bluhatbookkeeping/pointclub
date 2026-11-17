-- Point Club Cinema schema. Open access by design (no logins): anyone with a room link can play.
create table rooms (
  id text primary key,
  name text not null default 'Point Club',
  host_id text,
  active_sprint_id text,
  current_story_id text,
  revealed boolean not null default false,
  round int not null default 1,
  ado_pattern text not null default ''
);
create table members (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  name text not null,
  character text not null,
  status text not null default 'here' check (status in ('here','away')),
  last_seen bigint not null default 0
);
create table sprints (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  name text not null,
  title text not null default '',
  started_at bigint not null,
  closed_at bigint
);
create table stories (
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
create table votes (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  story_id text not null references stories(id) on delete cascade,
  member_id text not null,
  round int not null,
  value text not null
);
create index on members(room_id);
create index on sprints(room_id);
create index on stories(room_id);
create index on votes(room_id);

alter table rooms enable row level security;
alter table members enable row level security;
alter table sprints enable row level security;
alter table stories enable row level security;
alter table votes enable row level security;
create policy "open" on rooms for all using (true) with check (true);
create policy "open" on members for all using (true) with check (true);
create policy "open" on sprints for all using (true) with check (true);
create policy "open" on stories for all using (true) with check (true);
create policy "open" on votes for all using (true) with check (true);

alter publication supabase_realtime add table rooms, members, sprints, stories, votes;
