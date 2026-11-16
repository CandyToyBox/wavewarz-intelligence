-- ============================================================================
-- FORM SUBMISSIONS — the site's own forms, replacing the Tally form.
-- One table for every form: featured-battle applications, sponsorship
-- enquiries, feedback, support requests and Sunday battle reminders.
-- Additive only: nothing existing is changed.
--
-- Access model: the browser never touches this table. POST /api/public/forms
-- validates the fields and inserts with the service role; /admin/inbox reads
-- with the service role. RLS-enabled with NO policies = service-role only, so
-- the anon key can read and write nothing here (emails and phone numbers).
-- ============================================================================

create table if not exists public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('featured_application','sponsorship','feedback','support','notify')),
  name        text,
  email       text,
  phone       text,
  sms_consent boolean not null default false,
  fields      jsonb not null default '{}'::jsonb,
  source      text,
  ip_hash     text,
  status      text not null default 'new' check (status in ('new','read','done')),
  created_at  timestamptz not null default now()
);
create index if not exists form_submissions_kind_created_idx on public.form_submissions (kind, created_at desc);
create index if not exists form_submissions_ip_created_idx on public.form_submissions (ip_hash, created_at desc);
alter table public.form_submissions enable row level security;
