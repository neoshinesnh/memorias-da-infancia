create table public.sessions (
  id text primary key,
  status text not null check (status in ('open', 'completed')),
  current_question integer not null check (current_question between 1 and 10),
  furthest_question integer not null check (furthest_question between 1 and 10),
  created_at text not null
);

create table public.answers (
  session_id text not null references public.sessions (id) on delete cascade,
  question_number integer not null check (question_number between 1 and 10),
  option_number integer not null check (option_number between 1 and 5),
  updated_at text not null,
  primary key (session_id, question_number)
);

alter table public.sessions enable row level security;
alter table public.sessions force row level security;
alter table public.answers enable row level security;
alter table public.answers force row level security;

create or replace function public.save_session_answer(
  p_session_id text,
  p_status text,
  p_current_question integer,
  p_furthest_question integer,
  p_question_number integer,
  p_option_number integer,
  p_updated_at text
) returns void
language plpgsql
set search_path = public
as $$
begin
  update public.sessions
  set
    status = p_status,
    current_question = p_current_question,
    furthest_question = p_furthest_question
  where id = p_session_id;

  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  insert into public.answers (
    session_id,
    question_number,
    option_number,
    updated_at
  ) values (
    p_session_id,
    p_question_number,
    p_option_number,
    p_updated_at
  )
  on conflict (session_id, question_number)
  do update set
    option_number = excluded.option_number,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_session_answer(
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.save_session_answer(
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  text
) to service_role;
