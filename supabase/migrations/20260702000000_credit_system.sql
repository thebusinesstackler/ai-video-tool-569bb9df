-- ============================================================
-- VideoAIPro Credit System — production-grade, ledger-based
-- Run in Supabase SQL editor (or save as a migration).
-- Design: single append-only ledger = source of truth.
-- Reserve -> Settle pattern: credits are HELD when a job starts
-- and automatically REFUNDED if the job fails. Race-safe via
-- SECURITY DEFINER functions with advisory row locking.
-- ============================================================

-- ---------- 1. Plans ----------
create table if not exists public.plans (
  id text primary key,                      -- 'free' | 'creator' | 'pro' | 'studio'
  name text not null,
  monthly_credits integer not null,
  price_usd_month numeric(8,2) not null default 0,
  stripe_price_id text,                     -- fill after creating Stripe prices
  features jsonb not null default '{}',
  sort_order int not null default 0
);

insert into public.plans (id, name, monthly_credits, price_usd_month, sort_order, features) values
  ('free',    'Free',    100,   0,     0, '{"watermark": true,  "max_video_seconds": 30,  "twins": 0}'),
  ('creator', 'Creator', 1500,  29,    1, '{"watermark": false, "max_video_seconds": 120, "twins": 1}'),
  ('pro',     'Pro',     5000,  79,    2, '{"watermark": false, "max_video_seconds": 600, "twins": 3}'),
  ('studio',  'Studio',  15000, 199,   3, '{"watermark": false, "max_video_seconds": 1800,"twins": 10}')
on conflict (id) do update set
  monthly_credits = excluded.monthly_credits,
  price_usd_month = excluded.price_usd_month,
  features = excluded.features;

-- ---------- 2. Subscriptions ----------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id) default 'free',
  status text not null default 'active',    -- active | past_due | canceled
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. Tool costs (edit prices here, not in code) ----------
create table if not exists public.tool_costs (
  tool_key text primary key,
  display_name text not null,
  cost integer not null,
  category text not null default 'generation'
);

insert into public.tool_costs (tool_key, display_name, cost, category) values
  -- video generation (WaveSpeed) — your real cost driver
  ('scene_video',        'Cinematic scene video (per 5s clip)', 25, 'video'),
  ('reel_video',         'Reel / Story video (per scene)',      20, 'video'),
  ('spokesperson_video', 'Presenter video (per 30s segment)',   40, 'video'),
  ('podcast_segment',    'Podcast talking-head (per segment)',  40, 'video'),
  ('animate_static',     'Animate a static image',              15, 'video'),
  ('video_upscale',      'Upscale video',                       10, 'video'),
  -- images
  ('scene_image',        'Scene frame / storyboard image',       3, 'image'),
  ('twin_angles',        'AI Twin angle set',                   30, 'image'),
  ('character_image',    'Character image',                      3, 'image'),
  ('image_upscale',      'Upscale image',                        2, 'image'),
  -- audio
  ('tts_voiceover',      'Voiceover (per 60s)',                  4, 'audio'),
  ('voice_clone',        'Voice clone setup',                   50, 'audio'),
  ('music_track',        'AI music track',                       8, 'audio'),
  -- editing / clipping
  ('chatcut_render',     'ChatCut export render',               15, 'edit'),
  ('clip_pack',          'Long video → clips (per video)',      30, 'edit'),
  ('transcription',      'Transcription (per 10 min)',           2, 'edit'),
  -- text intelligence (cheap, but metered so scripts can't be farmed)
  ('script_generation',  'AI script / concept',                  1, 'text'),
  ('director_action',    'ChatCut AI director action',           1, 'text')
on conflict (tool_key) do update set cost = excluded.cost, display_name = excluded.display_name;

-- ---------- 4. Ledger (append-only source of truth) ----------
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,                  -- + grant/refund, - spend/reserve
  kind text not null check (kind in ('grant','reserve','settle','refund','adjustment')),
  tool_key text references public.tool_costs(tool_key),
  job_id text,                              -- your generation/task id, ties reserve->settle/refund
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_user_created on public.credit_ledger(user_id, created_at desc);
create index if not exists idx_ledger_job on public.credit_ledger(job_id) where job_id is not null;

-- Fast-read balance cache (maintained only by the functions below)
create table if not exists public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  reserved integer not null default 0,       -- held by in-flight jobs
  updated_at timestamptz not null default now()
);

-- ---------- 5. RLS ----------
alter table public.plans           enable row level security;
alter table public.tool_costs     enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.credit_ledger  enable row level security;
alter table public.credit_balances enable row level security;

create policy "plans are public"       on public.plans       for select using (true);
create policy "costs are public"       on public.tool_costs  for select using (true);
create policy "own subscription"       on public.subscriptions   for select using (auth.uid() = user_id);
create policy "own ledger"             on public.credit_ledger   for select using (auth.uid() = user_id);
create policy "own balance"            on public.credit_balances for select using (auth.uid() = user_id);
-- NOTE: no insert/update policies for users. Only the SECURITY DEFINER
-- functions below (called by edge functions with the service role) may write.

-- ---------- 6. Core functions (race-safe) ----------

-- Grant credits (signup, monthly renewal via Stripe webhook, manual top-up)
create or replace function public.grant_credits(p_user uuid, p_amount int, p_note text default 'grant')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into credit_ledger (user_id, amount, kind, note) values (p_user, p_amount, 'grant', p_note);
  insert into credit_balances (user_id, balance) values (p_user, p_amount)
  on conflict (user_id) do update
    set balance = credit_balances.balance + p_amount, updated_at = now();
end $$;

-- Reserve credits at job start. Returns true if affordable, false if not.
create or replace function public.reserve_credits(p_user uuid, p_tool text, p_job text, p_multiplier int default 1)
returns table (ok boolean, cost int, balance int) language plpgsql security definer set search_path = public as $$
declare v_cost int; v_bal record;
begin
  select tc.cost * greatest(p_multiplier,1) into v_cost from tool_costs tc where tc.tool_key = p_tool;
  if v_cost is null then raise exception 'Unknown tool_key %', p_tool; end if;

  -- lock the balance row to prevent double-spend races
  select * into v_bal from credit_balances where user_id = p_user for update;
  if v_bal is null then
    insert into credit_balances (user_id, balance) values (p_user, 0)
    on conflict (user_id) do nothing;
    select * into v_bal from credit_balances where user_id = p_user for update;
  end if;

  if v_bal.balance - v_bal.reserved < v_cost then
    return query select false, v_cost, v_bal.balance - v_bal.reserved; return;
  end if;

  update credit_balances set reserved = reserved + v_cost, updated_at = now() where user_id = p_user;
  insert into credit_ledger (user_id, amount, kind, tool_key, job_id) values (p_user, -v_cost, 'reserve', p_tool, p_job);
  return query select true, v_cost, v_bal.balance - v_bal.reserved - v_cost;
end $$;

-- Settle on success: convert the hold into a real spend.
create or replace function public.settle_credits(p_user uuid, p_job text)
returns void language plpgsql security definer set search_path = public as $$
declare v_amt int;
begin
  select -amount into v_amt from credit_ledger
   where user_id = p_user and job_id = p_job and kind = 'reserve'
   order by created_at desc limit 1;
  if v_amt is null then return; end if;
  update credit_balances
     set balance = balance - v_amt, reserved = greatest(reserved - v_amt, 0), updated_at = now()
   where user_id = p_user;
  insert into credit_ledger (user_id, amount, kind, job_id, note) values (p_user, 0, 'settle', p_job, format('settled %s', v_amt));
end $$;

-- Refund on failure: release the hold, user pays nothing.
create or replace function public.refund_credits(p_user uuid, p_job text, p_note text default 'generation failed')
returns void language plpgsql security definer set search_path = public as $$
declare v_amt int;
begin
  select -amount into v_amt from credit_ledger
   where user_id = p_user and job_id = p_job and kind = 'reserve'
   order by created_at desc limit 1;
  if v_amt is null then return; end if;
  update credit_balances
     set reserved = greatest(reserved - v_amt, 0), updated_at = now()
   where user_id = p_user;
  insert into credit_ledger (user_id, amount, kind, job_id, note) values (p_user, v_amt, 'refund', p_job, p_note);
end $$;

-- Monthly renewal (call from your Stripe invoice.paid webhook)
create or replace function public.grant_monthly_credits(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_credits int;
begin
  select p.monthly_credits into v_credits
    from subscriptions s join plans p on p.id = s.plan_id
   where s.user_id = p_user;
  perform grant_credits(p_user, coalesce(v_credits, 100), 'monthly plan credits');
  update subscriptions
     set current_period_start = now(), current_period_end = now() + interval '30 days', updated_at = now()
   where user_id = p_user;
end $$;

-- ---------- 7. New-user bootstrap ----------
create or replace function public.handle_new_user_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into subscriptions (user_id, plan_id) values (new.id, 'free') on conflict do nothing;
  perform grant_credits(new.id, (select monthly_credits from plans where id = 'free'), 'welcome credits');
  return new;
end $$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.handle_new_user_credits();

-- ---------- 8. Backfill existing users ----------
insert into public.subscriptions (user_id, plan_id)
select id, 'free' from auth.users
on conflict do nothing;

insert into public.credit_balances (user_id, balance)
select id, 100 from auth.users
on conflict do nothing;

insert into public.credit_ledger (user_id, amount, kind, note)
select id, 100, 'grant', 'backfill: launch grant' from auth.users u
where not exists (select 1 from credit_ledger l where l.user_id = u.id);

-- Link async video tasks to their credit reservation so the wavespeed-webhook
-- can refund on vendor-side failure (follow-up wiring in webhook handler).
alter table if exists public.video_tasks add column if not exists credit_job_id text;
