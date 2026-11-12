-- Meridian People (HR). Same tenant model and row-level security as 0001.
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references auth.users(id),
  name text not null, email text not null, title text not null, team text not null,
  manager_id uuid references people(id) on delete set null,
  start_date date not null, location text,
  leave_allowance int not null default 20 check (leave_allowance >= 20) -- Latvian minimum: 4 calendar weeks
);
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('vacation', 'sick', 'unpaid', 'parental', 'study')),
  date_from date not null, date_to date not null check (date_to >= date_from),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  note text, decided_by uuid references auth.users(id), decided_at timestamptz
);
create table if not exists public_holidays (
  tenant_id uuid not null references tenants(id) on delete cascade,
  day date not null, name text not null, primary key (tenant_id, day)
);
create table if not exists onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  text text not null, owner text not null check (owner in ('hr', 'manager', 'it', 'newcomer')),
  due_day int not null, done_at timestamptz
);
create table if not exists openings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null, team text not null, hiring_manager_id uuid references people(id),
  is_open boolean not null default true, salary_from int, salary_to int
);
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  opening_id uuid not null references openings(id) on delete cascade,
  name text not null, email text, source text not null,
  stage text not null check (stage in ('applied', 'screen', 'interview', 'offer', 'hired', 'rejected')),
  applied_at date not null default current_date,
  scores int[] not null default '{}',
  reject_reason text,
  retain_until date not null default (current_date + 180), -- delete unhired candidates after this
  constraint reject_needs_reason check (stage <> 'rejected' or coalesce(reject_reason, '') <> '')
);
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  cycle text not null, goals jsonb not null default '[]'::jsonb,
  self_done boolean not null default false, manager_done boolean not null default false
);

do $$
declare t text;
begin
  foreach t in array array['people', 'leave_requests', 'public_holidays', 'onboarding_tasks', 'openings', 'candidates', 'reviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(tenant_id))', t || '_read', t);
    execute format('create policy %I on %I for all using (can_write(tenant_id)) with check (can_write(tenant_id))', t || '_write', t);
  end loop;
end $$;
-- To do before real use: narrow candidates and reviews to HR and the line manager (role-based policies).
