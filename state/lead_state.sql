-- Extends the Supabase project from Project 1 — same project, new table.
-- Run in the Supabase SQL editor, or via `supabase migration new lead_state`.
--
create table if not exists lead_state (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references calls(id),
  qualification_status text not null default 'unqualified'
    check (qualification_status in ('unqualified','partially_qualified','qualified','dead')),
  conversation_history jsonb not null default '[]'::jsonb,
  objection_history jsonb not null default '[]'::jsonb,
  routing_trace jsonb not null default '[]'::jsonb,
  resolution text not null default 'in_progress'
    check (resolution in ('in_progress','booked','dead','escalated')),
  needs_human_review boolean not null default false,
  last_contact_at timestamptz not null default now(),
  next_follow_up_at timestamptz,
  turns_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_state_lead_id on lead_state(lead_id);
create index if not exists idx_lead_state_next_follow_up on lead_state(next_follow_up_at);

-- keep updated_at fresh on every write
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lead_state_updated_at on lead_state;
create trigger trg_lead_state_updated_at
before update on lead_state
for each row execute function set_updated_at();
