create table if not exists brotherhood_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  last_contacted_at timestamptz,
  created_at timestamptz default now()
);

alter table brotherhood_contacts enable row level security;

create policy "Users can manage their own brotherhood" on brotherhood_contacts
  for all using (auth.uid() = user_id);
