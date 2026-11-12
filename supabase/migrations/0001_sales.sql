-- Meridian Sales (CRM) on Supabase, EU region (Frankfurt).
-- Multi-tenant: every row carries tenant_id and row-level security limits a
-- person to the tenants they are a member of. A partner (white label) owns
-- several tenants; partner staff see only tenants they are added to.

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand jsonb not null default '{}'::jsonb,       -- name, accent, logo, domain (white label)
  created_at timestamptz not null default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id),
  name text not null,
  brand jsonb not null default '{}'::jsonb,       -- optional client brand on top of the partner's
  modules text[] not null default array['sales'], -- modules this tenant has bought
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  primary key (tenant_id, user_id)
);

create or replace function is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.tenant_id = t and m.user_id = auth.uid());
$$;

create or replace function can_write(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.tenant_id = t and m.user_id = auth.uid() and m.role <> 'viewer');
$$;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  domain text, industry text,
  size text check (size in ('1-9', '10-49', '50-249', '250+')),
  country text,
  owner_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  first_name text not null, last_name text not null,
  email text, phone text, role text,
  company_id uuid references companies(id) on delete set null,
  owner_id uuid references auth.users(id),
  source text not null,
  lawful_basis text not null check (lawful_basis in ('consent', 'contract', 'legitimate_interest', 'legal_obligation')),
  consent_date date,
  created_at timestamptz not null default now(),
  constraint consent_needs_date check (lawful_basis <> 'consent' or consent_date is not null)
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  owner_id uuid references auth.users(id),
  stage text not null check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  value numeric(12, 2) not null default 0 check (value >= 0),
  currency text not null default 'EUR',
  expected_close date, next_step text, next_step_due date,
  lost_reason text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint lost_needs_reason check (stage <> 'lost' or coalesce(lost_reason, '') <> '')
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('note', 'call', 'email', 'meeting', 'stage_change', 'created')),
  text text not null,
  at timestamptz not null default now(),
  by_name text not null,                     -- a person or a named agent
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  deal_id uuid references deals(id) on delete set null
);

-- Append-only audit log. Never stores personal data, only ids.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid references auth.users(id),
  action text not null,
  object_type text not null,
  object_id uuid
);

create index if not exists contacts_tenant on contacts(tenant_id);
create index if not exists companies_tenant on companies(tenant_id);
create index if not exists deals_tenant_stage on deals(tenant_id, stage);
create index if not exists activities_deal on activities(deal_id, at desc);

do $$
declare t text;
begin
  foreach t in array array['companies', 'contacts', 'deals', 'activities'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(tenant_id))', t || '_read', t);
    execute format('create policy %I on %I for insert with check (can_write(tenant_id))', t || '_insert', t);
    execute format('create policy %I on %I for update using (can_write(tenant_id)) with check (can_write(tenant_id))', t || '_update', t);
    execute format('create policy %I on %I for delete using (can_write(tenant_id))', t || '_delete', t);
  end loop;
end $$;

alter table audit_log enable row level security;
create policy audit_read on audit_log for select using (is_member(tenant_id));
create policy audit_insert on audit_log for insert with check (can_write(tenant_id) and actor = auth.uid());
-- no update or delete policy: the log is append-only for every signed-in person

alter table tenants enable row level security;
create policy tenants_read on tenants for select using (is_member(id));
alter table memberships enable row level security;
create policy memberships_read on memberships for select using (user_id = auth.uid() or is_member(tenant_id));
