-- People+ phase 1 (Onboard): journeys with owned steps, the IT desk (kit catalogue, role kits, requests with
-- history) and Ask HR (questions, the AI answer with its sources, and HR's reply). Same tenant rules as 0002.

create table if not exists journey_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  teams text[] not null default '{}',                                -- empty = any team
  steps jsonb not null default '[]'                                  -- [{text, owner, day, kind, minutes}]
);
create table if not exists journeys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  template_id uuid references journey_templates(id) on delete set null,
  start_date date not null,
  buddy_id uuid references people(id) on delete set null,
  built_from text[] not null default '{}'                            -- what the Journey builder used, shown to people
);
create table if not exists journey_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  journey_id uuid not null references journeys(id) on delete cascade,
  text text not null,
  owner text not null check (owner in ('hr', 'manager', 'it', 'buddy', 'newcomer')),
  day int not null,                                                  -- days from the start date; negative = before
  kind text not null check (kind in ('task', 'sign', 'training', 'meet', 'kit', 'goal')),
  minutes int,
  document_id uuid references hr_documents(id) on delete set null,   -- done when signed
  kit_request_id uuid,                                               -- done when ready (fk added below)
  done boolean not null default false, done_at date, done_by text
);
create table if not exists kit_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  category text not null check (category in ('laptop', 'screen', 'phone', 'access', 'other')),
  cost numeric(10, 2), lead_days int not null default 0
);
create table if not exists role_kits (
  tenant_id uuid not null references tenants(id) on delete cascade,
  team text not null,                                                -- '*' = everyone
  item_id uuid not null references kit_items(id) on delete cascade,
  primary key (tenant_id, team, item_id)
);
create table if not exists kit_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  item_id uuid not null references kit_items(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested', 'ordered', 'ready', 'delivered', 'returned')),
  needed_by date not null, serial text
);
create table if not exists kit_request_history (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  request_id uuid not null references kit_requests(id) on delete cascade,
  status text not null, at timestamptz not null default now(), by_name text not null
);
alter table journey_steps drop constraint if exists journey_steps_kit_fk;
alter table journey_steps add constraint journey_steps_kit_fk foreign key (kit_request_id) references kit_requests(id) on delete set null;

-- Ask HR. The answer is stored with its sources, so anyone can see what the AI said and where it came from (EU AI Act art. 50).
create table if not exists hr_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  q text not null, at timestamptz not null default now(),
  answer_kind text not null check (answer_kind in ('personal', 'policy', 'none')),
  answer_text text not null,
  sources jsonb not null default '[]',                               -- [{docId, title, version, quote}]
  status text not null default 'answered' check (status in ('answered', 'helpful', 'to_hr', 'closed')),
  hr_reply text, replied_by text
);

create index if not exists journey_steps_journey on journey_steps (journey_id);
create index if not exists kit_requests_person on kit_requests (person_id);
create index if not exists hr_questions_open on hr_questions (tenant_id) where status = 'to_hr';

do $$
declare t text;
begin
  foreach t in array array['journey_templates', 'journeys', 'journey_steps', 'kit_items', 'role_kits', 'kit_requests', 'kit_request_history', 'hr_questions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(tenant_id))', t || '_read', t);
    execute format('create policy %I on %I for all using (can_write(tenant_id)) with check (can_write(tenant_id))', t || '_write', t);
  end loop;
end $$;
-- To do before real use: an employee reads only their own journey, kit and questions; HR reads all.
