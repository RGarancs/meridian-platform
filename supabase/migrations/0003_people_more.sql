-- People v2: documents with signed versions, goals tree with check-ins, feedback, skills and training,
-- pay bands, salaries, offboarding, anonymous pulse. Same tenant rules as 0002.

alter table people add column if not exists salary numeric(10, 2);          -- gross a month; HR and line manager only
alter table people add column if not exists bonus_target numeric(4, 3);     -- share of annual salary at 100%
alter table people add column if not exists last_day date;

alter table onboarding_tasks add column if not exists list text not null default 'onboarding' check (list in ('onboarding', 'offboarding'));

create table if not exists hr_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null, kind text not null check (kind in ('policy', 'contract', 'certificate', 'form')),
  person_id uuid references people(id) on delete cascade,          -- null = everyone
  version int not null default 1, updated_at date not null default current_date,
  requires_ack boolean not null default false, expires date, body text, file_path text
);
create table if not exists document_acks (
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references hr_documents(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  version int not null, at timestamptz not null default now(),
  primary key (document_id, person_id, version)
);
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null, level text not null check (level in ('company', 'team', 'person')),
  owner_id uuid references people(id) on delete set null, team text,
  parent_id uuid references goals(id) on delete set null, period text not null,
  progress int not null default 0 check (progress between 0 and 100),
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'off_track', 'done'))
);
create table if not exists goal_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  at date not null default current_date, by_name text not null, progress int not null, note text
);
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  about_id uuid not null references people(id) on delete cascade,
  from_name text not null, kind text not null check (kind in ('praise', 'growth')),
  text text not null, at date not null default current_date, private boolean not null default false
);
create table if not exists skills (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, name text not null, area text not null);
create table if not exists skill_levels (tenant_id uuid not null references tenants(id) on delete cascade, person_id uuid not null references people(id) on delete cascade, skill_id uuid not null references skills(id) on delete cascade, level int not null check (level between 0 and 4), primary key (person_id, skill_id));
create table if not exists role_skills (tenant_id uuid not null references tenants(id) on delete cascade, title text not null, skill_id uuid not null references skills(id) on delete cascade, level int not null check (level between 1 and 4), primary key (tenant_id, title, skill_id));
create table if not exists training (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, person_id uuid not null references people(id) on delete cascade, course text not null, done date not null, expires date);
create table if not exists pay_bands (tenant_id uuid not null references tenants(id) on delete cascade, title text not null, min numeric(10, 2) not null, max numeric(10, 2) not null check (max >= min), primary key (tenant_id, title));
-- Pulse answers carry no person id: anonymous by design. Results are shown only from 5 answers.
create table if not exists pulse_answers (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade, period text not null, score int not null check (score between 0 and 10), comment text);

do $$
declare t text;
begin
  foreach t in array array['hr_documents', 'document_acks', 'goals', 'goal_checkins', 'feedback', 'skills', 'skill_levels', 'role_skills', 'training', 'pay_bands', 'pulse_answers'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(tenant_id))', t || '_read', t);
    execute format('create policy %I on %I for all using (can_write(tenant_id)) with check (can_write(tenant_id))', t || '_write', t);
  end loop;
end $$;
-- To do before real use: salary, pay_bands, private feedback and reviews readable by HR and the line manager only.
