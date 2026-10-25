create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  first_name         text not null,
  middle_name        text,
  last_name          text not null,
  suffix             text,
  birth_date         date,
  gender             text,
  contact_number     text,
  purok              text,
  address            text,
  patient_type       text,
  is_household_head  boolean not null default false,
  household_members  int,
  role               text not null default 'resident'
                     check (role in ('resident','bhw','midwife','admin')),
  created_at         timestamptz not null default now()
);

create table public.patients (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references public.profiles(id) on delete set null,
  first_name         text not null,
  middle_name        text,
  last_name          text not null,
  suffix             text,
  birth_date         date,
  gender             text,
  contact_number     text,
  email              text,
  purok              text,
  address            text,
  patient_type       text,
  is_household_head  boolean not null default false,
  household_members  int,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);
create index patients_name_idx on public.patients (lower(last_name), lower(first_name));

create table public.queue (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  status      text not null default 'waiting'
              check (status in ('waiting','in_consultation','done','cancelled')),
  reason      text,
  queued_by   uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.vitals (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients(id) on delete cascade,
  bp_systolic    int  check (bp_systolic  between 40 and 300),
  bp_diastolic   int  check (bp_diastolic between 20 and 200),
  weight_kg      numeric(5,2) check (weight_kg > 0),
  temperature_c  numeric(4,1),
  pulse_rate     int,
  recorded_by    uuid references public.profiles(id),
  recorded_at    timestamptz not null default now()
);

create table public.vaccinations (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients(id) on delete cascade,
  vaccine_name       text not null,
  dose_label         text,
  scheduled_date     date not null,
  administered_date  date,
  status             text not null default 'scheduled'
                     check (status in ('scheduled','administered','missed')),
  reminder_sent_at   timestamptz,
  recorded_by        uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);
create index vaccinations_due_idx on public.vaccinations (scheduled_date) where status = 'scheduled';

create table public.consultations (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  complaint     text,
  diagnosis     text,
  notes         text,
  consulted_by  uuid references public.profiles(id),
  consulted_at  timestamptz not null default now()
);

create table public.medicines (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  unit           text not null default 'pcs',
  reorder_level  int  not null default 20 check (reorder_level >= 0),
  created_at     timestamptz not null default now()
);

create table public.medicine_batches (
  id               uuid primary key default gen_random_uuid(),
  medicine_id      uuid not null references public.medicines(id) on delete cascade,
  batch_no         text,
  quantity         int  not null check (quantity >= 0),
  expiration_date  date not null,
  received_at      timestamptz not null default now(),
  received_by      uuid references public.profiles(id)
);
create index batches_fefo_idx on public.medicine_batches (medicine_id, expiration_date);

create table public.prescriptions (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id) on delete cascade,
  consultation_id  uuid references public.consultations(id) on delete set null,
  medicine_id      uuid not null references public.medicines(id),
  quantity         int  not null check (quantity > 0),
  instructions     text,
  prescribed_by    uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

create table public.dispense_allocations (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references public.prescriptions(id) on delete cascade,
  batch_id         uuid not null references public.medicine_batches(id),
  quantity         int  not null check (quantity > 0)
);

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('bhw','midwife','admin'), false)
$$;

create or replace function public.is_clinical() returns boolean   -- midwife or admin
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('midwife','admin'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, email, first_name, middle_name, last_name, suffix, birth_date, gender,
    contact_number, purok, address, patient_type, is_household_head, household_members, role
  ) values (
    new.id, new.email,
    coalesce(nullif(m->>'first_name',''), 'Resident'),
    nullif(m->>'middle_name',''),
    coalesce(nullif(m->>'last_name',''), '-'),
    nullif(m->>'suffix',''),
    nullif(m->>'birth_date','')::date,
    nullif(m->>'gender',''),
    nullif(m->>'contact_number',''),
    nullif(m->>'purok',''),
    nullif(m->>'address',''),
    nullif(m->>'patient_type',''),
    coalesce(nullif(m->>'is_household_head','')::boolean, false),
    nullif(m->>'household_members','')::int,
    'resident'
  );

  insert into public.patients (
    profile_id, first_name, middle_name, last_name, suffix, birth_date, gender,
    contact_number, email, purok, address, patient_type, is_household_head, household_members
  )
  select id, first_name, middle_name, last_name, suffix, birth_date, gender,
         contact_number, email, purok, address, patient_type, is_household_head, household_members
  from public.profiles where id = new.id;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(public.app_role(), '') <> 'admin' then
    raise exception 'Only an admin can change roles';
  end if;
  new.id := old.id;
  return new;
end $$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles             enable row level security;
alter table public.patients             enable row level security;
alter table public.queue                enable row level security;
alter table public.vitals               enable row level security;
alter table public.vaccinations         enable row level security;
alter table public.consultations        enable row level security;
alter table public.medicines            enable row level security;
alter table public.medicine_batches     enable row level security;
alter table public.prescriptions        enable row level security;
alter table public.dispense_allocations enable row level security;

-- profiles: you see/edit yourself; admin sees/edits everyone (role assignment).
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- no INSERT policy: profiles are only created by the sign-up trigger.

-- patients: a resident sees their own record; staff see all and can register/update.
create policy patients_select on public.patients for select
  using (profile_id = auth.uid() or public.is_staff());
create policy patients_insert on public.patients for insert
  with check (public.is_staff());
create policy patients_update on public.patients for update
  using (public.is_staff()) with check (public.is_staff());

-- queue: staff only.
create policy queue_select on public.queue for select using (public.is_staff());
create policy queue_insert on public.queue for insert with check (public.is_staff());
create policy queue_update on public.queue for update
  using (public.is_staff()) with check (public.is_staff());

-- vitals: staff write; residents read their own.
create policy vitals_select on public.vitals for select
  using (public.is_staff() or exists (
    select 1 from public.patients p where p.id = vitals.patient_id and p.profile_id = auth.uid()));
create policy vitals_insert on public.vitals for insert with check (public.is_staff());

-- vaccinations: staff write; residents read their own.
create policy vacc_select on public.vaccinations for select
  using (public.is_staff() or exists (
    select 1 from public.patients p where p.id = vaccinations.patient_id and p.profile_id = auth.uid()));
create policy vacc_insert on public.vaccinations for insert with check (public.is_staff());
create policy vacc_update on public.vaccinations for update
  using (public.is_staff()) with check (public.is_staff());

-- consultations: midwife/admin write; staff + the patient read.
create policy consult_select on public.consultations for select
  using (public.is_staff() or exists (
    select 1 from public.patients p where p.id = consultations.patient_id and p.profile_id = auth.uid()));
create policy consult_insert on public.consultations for insert with check (public.is_clinical());

-- medicines + batches: staff read; midwife/admin write. (Public sees only the view below.)
create policy medicines_select on public.medicines for select using (public.is_staff());
create policy medicines_insert on public.medicines for insert with check (public.is_clinical());
create policy medicines_update on public.medicines for update
  using (public.is_clinical()) with check (public.is_clinical());

create policy batches_select on public.medicine_batches for select using (public.is_staff());
create policy batches_insert on public.medicine_batches for insert with check (public.is_clinical());
create policy batches_update on public.medicine_batches for update
  using (public.is_clinical()) with check (public.is_clinical());

-- prescriptions: read-only from the client (staff + the patient). Rows are created by
-- dispense_medicine() below, so stock can never be deducted without a prescription.
create policy rx_select on public.prescriptions for select
  using (public.is_staff() or exists (
    select 1 from public.patients p where p.id = prescriptions.patient_id and p.profile_id = auth.uid()));

create policy alloc_select on public.dispense_allocations for select using (public.is_staff());
create or replace view public.public_medicine_stock as
select s.id, s.name, s.unit, s.qty as available_quantity,
       case when s.qty = 0 then 'Out of stock'
            when s.qty <= s.reorder_level then 'Low stock'
            else 'Available' end as status
from (
  select m.id, m.name, m.unit, m.reorder_level,
         coalesce(sum(b.quantity) filter (where b.expiration_date >= current_date), 0)::int as qty
  from public.medicines m
  left join public.medicine_batches b on b.medicine_id = m.id
  group by m.id
) s;

grant select on public.public_medicine_stock to anon, authenticated;

create or replace function public.dispense_medicine(
  p_patient_id      uuid,
  p_medicine_id     uuid,
  p_quantity        int,
  p_consultation_id uuid default null,
  p_instructions    text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_available int;
  v_remaining int := p_quantity;
  v_take      int;
  v_rx        uuid;
  b           record;
begin
  if not public.is_clinical() then
    raise exception 'Not authorized to dispense medicine';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select coalesce(sum(quantity), 0) into v_available
  from public.medicine_batches
  where medicine_id = p_medicine_id and expiration_date >= current_date and quantity > 0;

  if v_available < p_quantity then
    raise exception 'Insufficient stock: only % unexpired unit(s) available', v_available;
  end if;

  insert into public.prescriptions (patient_id, consultation_id, medicine_id, quantity, instructions, prescribed_by)
  values (p_patient_id, p_consultation_id, p_medicine_id, p_quantity, p_instructions, auth.uid())
  returning id into v_rx;

  for b in
    select id, quantity from public.medicine_batches
    where medicine_id = p_medicine_id and expiration_date >= current_date and quantity > 0
    order by expiration_date asc, received_at asc          -- FEFO rule
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(b.quantity, v_remaining);
    update public.medicine_batches set quantity = quantity - v_take where id = b.id;
    insert into public.dispense_allocations (prescription_id, batch_id, quantity) values (v_rx, b.id, v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then   
    raise exception 'Stock changed while dispensing; please try again';
  end if;

  return v_rx;
end $$;

revoke all on function public.dispense_medicine(uuid, uuid, int, uuid, text) from public, anon;
grant execute on function public.dispense_medicine(uuid, uuid, int, uuid, text) to authenticated;

alter publication supabase_realtime add table public.queue;
