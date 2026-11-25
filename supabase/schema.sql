-- Esquema para Jardín Huella Viva · Siembra su recuerdo (DueloAnimal.co)
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase.

create table if not exists public.memorials (
  id text primary key,
  owner_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_books (
  id text primary key,
  owner_id text not null,
  memorial_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id text primary key,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.memorials enable row level security;
alter table public.memory_books enable row level security;
alter table public.suggestions enable row level security;

create policy "Lectura publica de memoriales"
  on public.memorials for select
  using (true);

create policy "Crear memoriales"
  on public.memorials for insert
  with check (true);

create policy "Actualizar memoriales"
  on public.memorials for update
  using (true);

create policy "Eliminar memoriales"
  on public.memorials for delete
  using (true);

create policy "Lectura publica de libros"
  on public.memory_books for select
  using (true);

create policy "Crear libros"
  on public.memory_books for insert
  with check (true);

create policy "Actualizar libros"
  on public.memory_books for update
  using (true);

create policy "Eliminar libros"
  on public.memory_books for delete
  using (true);

create policy "Enviar sugerencias"
  on public.suggestions for insert
  with check (true);
