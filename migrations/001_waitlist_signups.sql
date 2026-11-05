create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254 and email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;
