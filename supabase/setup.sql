create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  type text not null,
  description text,
  due date not null,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed')),
  created_at timestamptz not null default now()
);

alter table public.tasks drop constraint if exists tasks_status_check;
update public.tasks
set status = 'Pending'
where status = 'Not Started';
alter table public.tasks alter column status set default 'Pending';
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('Pending', 'In Progress', 'Completed'));

alter table public.tasks drop constraint if exists tasks_type_check;
update public.tasks set type = 'Examination' where type = 'Exam';
alter table public.tasks
  add constraint tasks_type_check
  check (type in ('Assignment', 'Project', 'Examination', 'Quiz'));

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  subject text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 320),
  type text not null check (type in ('General Inquiry', 'Technical Issue', 'Bug Report', 'Feature Suggestion', 'Other')),
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 10000),
  status text not null default 'New' check (status in ('New', 'In Review', 'Resolved')),
  created_at timestamptz not null default now()
);

alter table public.feedback
  add column if not exists status text not null default 'New';
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback
  add constraint feedback_status_check
  check (status in ('New', 'In Review', 'Resolved'));

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  description text not null,
  result text not null default 'Success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_due_idx on public.tasks (user_id, due);
create index if not exists sessions_user_date_idx on public.sessions (user_id, date, start_time);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);

alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.feedback enable row level security;
alter table public.activity_logs enable row level security;

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant insert on public.feedback to anon, authenticated;
grant select, update on public.feedback to authenticated;
grant select on public.activity_logs to authenticated;

drop policy if exists "Users manage their own tasks" on public.tasks;
create policy "Users manage their own tasks" on public.tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all tasks" on public.tasks;
create policy "Admins read all tasks" on public.tasks
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Users manage their own sessions" on public.sessions;
create policy "Users manage their own sessions" on public.sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read all sessions" on public.sessions;
create policy "Admins read all sessions" on public.sessions
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Visitors submit feedback" on public.feedback;
create policy "Visitors submit feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins read all feedback" on public.feedback;
create policy "Admins read all feedback" on public.feedback
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins update feedback" on public.feedback;
create policy "Admins update feedback" on public.feedback
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins read activity logs" on public.activity_logs;
create policy "Admins read activity logs" on public.activity_logs
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.admin_list_students()
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    users.id,
    users.email::text,
    coalesce(users.raw_user_meta_data ->> 'full_name', split_part(users.email::text, '@', 1)),
    users.created_at,
    users.last_sign_in_at
  from auth.users as users
  where coalesce(users.raw_app_meta_data ->> 'role', '') <> 'admin'
  order by users.created_at desc;
end;
$$;

revoke all on function public.admin_list_students() from public, anon;
grant execute on function public.admin_list_students() to authenticated;

create or replace function public.log_studynest_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  new_data jsonb;
  event_name text;
  actor_id uuid;
  target_title text;
begin
  if tg_op <> 'INSERT' then
    old_data := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_data := to_jsonb(new);
  end if;

  actor_id := coalesce(
    auth.uid(),
    nullif(coalesce(new_data, old_data) ->> 'user_id', '')::uuid
  );
  target_title := coalesce(
    new_data ->> 'title',
    old_data ->> 'title',
    'Untitled'
  );

  if tg_table_name = 'tasks' then
    if tg_op = 'INSERT' then
      event_name := 'task_created';
    elsif tg_op = 'DELETE' then
      event_name := 'task_deleted';
    elsif old_data ->> 'status' is distinct from new_data ->> 'status'
      and new_data ->> 'status' = 'Completed' then
      event_name := 'task_completed';
    else
      event_name := 'task_updated';
    end if;
  else
    event_name := 'session_' || lower(tg_op);
  end if;

  insert into public.activity_logs (user_id, event_type, description, metadata)
  values (
    actor_id,
    event_name,
    case event_name
      when 'task_created' then 'Created task: ' || target_title
      when 'task_completed' then 'Completed task: ' || target_title
      when 'task_updated' then 'Updated task: ' || target_title
      when 'task_deleted' then 'Deleted task: ' || target_title
      when 'session_insert' then 'Scheduled study session: ' || target_title
      when 'session_update' then 'Updated study session: ' || target_title
      else 'Deleted study session: ' || target_title
    end,
    jsonb_build_object('table', tg_table_name, 'record_id', coalesce(new_data ->> 'id', old_data ->> 'id'))
  );

  return null;
end;
$$;

revoke all on function public.log_studynest_activity() from public, anon, authenticated;

drop trigger if exists tasks_activity_log on public.tasks;
create trigger tasks_activity_log
  after insert or update or delete on public.tasks
  for each row execute function public.log_studynest_activity();

drop trigger if exists sessions_activity_log on public.sessions;
create trigger sessions_activity_log
  after insert or update or delete on public.sessions
  for each row execute function public.log_studynest_activity();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "Users upload their own avatars" on storage.objects;
create policy "Users upload their own avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own avatars" on storage.objects;
create policy "Users update their own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own avatars" on storage.objects;
create policy "Users delete their own avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


