-- Sales AI layer: customer properties, support tickets, newsletters, dismissed suggestions,
-- plus the interface language per person. Same tenant rules as 0001: every row carries
-- tenant_id and row-level security limits it to members of that tenant.

-- Custom fields a team adds to companies and contacts. Values live in a props column on the record.
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity text not null check (entity in ('company', 'contact')),
  label text not null,
  type text not null check (type in ('text', 'number', 'select', 'date', 'yes_no')),
  options text[],                                  -- for type = select
  created_at timestamptz not null default now(),
  unique (tenant_id, entity, label)
);

alter table companies add column if not exists props jsonb not null default '{}'::jsonb;
alter table contacts add column if not exists props jsonb not null default '{}'::jsonb;
-- Unsubscribing is kept as a date, not deleted, so nobody is mailed again by mistake.
alter table contacts add column if not exists unsubscribed_at timestamptz;

-- Support inbox. Messages are kept in order on the ticket.
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text not null,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  channel text not null check (channel in ('email', 'chat', 'phone')),
  status text not null default 'open' check (status in ('open', 'waiting', 'solved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  topic text,                                      -- set by triage, editable by a person
  created_at timestamptz not null default now(),
  first_reply_at timestamptz,
  solved_at timestamptz
);

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  at timestamptz not null default now(),
  sender text not null check (sender in ('customer', 'us')),
  body text not null,
  by_user uuid references auth.users(id)           -- who approved and sent a reply
);

-- Newsletters go out only after a person approves them (approved_by), and each send is logged per contact.
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  segment text not null,                           -- 'customers', 'h:<band>' or a cluster id
  subject text not null check (char_length(subject) <= 70),
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'draft' or approved_by is not null)
);

create table if not exists campaign_recipients (
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (campaign_id, contact_id)
);

-- Autopilot suggestions a person dismissed, so they don't come back.
create table if not exists dismissed_suggestions (
  tenant_id uuid not null references tenants(id) on delete cascade,
  suggestion_id text not null,
  dismissed_by uuid references auth.users(id),
  dismissed_at timestamptz not null default now(),
  primary key (tenant_id, suggestion_id)
);

create index if not exists tickets_tenant_status on tickets(tenant_id, status, created_at desc);
create index if not exists ticket_messages_ticket on ticket_messages(ticket_id, at);
create index if not exists campaigns_tenant on campaigns(tenant_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['properties', 'tickets', 'ticket_messages', 'campaigns', 'campaign_recipients', 'dismissed_suggestions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(tenant_id))', t || '_read', t);
    execute format('create policy %I on %I for insert with check (can_write(tenant_id))', t || '_insert', t);
    execute format('create policy %I on %I for update using (can_write(tenant_id)) with check (can_write(tenant_id))', t || '_update', t);
    execute format('create policy %I on %I for delete using (can_write(tenant_id))', t || '_delete', t);
  end loop;
end $$;

-- Interface language per person (English or Latvian for now). A tenant can set the default.
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lang text not null default 'en' check (lang in ('en', 'lv')),
  updated_at timestamptz not null default now()
);
alter table user_settings enable row level security;
create policy user_settings_own on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table tenants add column if not exists default_lang text not null default 'en' check (default_lang in ('en', 'lv'));
