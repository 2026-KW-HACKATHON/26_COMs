// Test helpers: an in-memory Postgres (PGlite) that imitates the parts of a
// Supabase project that supabase/schema.sql depends on.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// SCHEMA_SQL may point at a patched copy (used to check proposed fixes / mutation checks).
export const SCHEMA_PATH = process.env.SCHEMA_SQL || fileURLToPath(new URL('../schema.sql', import.meta.url));
export const schemaSql = () => readFileSync(SCHEMA_PATH, 'utf8');

// Minimal Supabase environment: roles, auth.users + auth.uid(), storage schema,
// and the default privileges a Supabase project grants on schema public.
export const SUPABASE_BOOTSTRAP = `
create role anon nologin noinherit nosuperuser nobypassrls;
create role authenticated nologin noinherit nosuperuser nobypassrls;
create role service_role nologin noinherit nosuperuser nobypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- Supabase grants table privileges on storage tables to anon as well; RLS decides.
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
`;

/** Fresh database with the Supabase emulation and schema.sql loaded `runs` times. */
export async function createDb({ runs = 1, beforeSchema } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  if (beforeSchema) await beforeSchema(db);
  const sql = schemaSql();
  for (let i = 0; i < runs; i++) await db.exec(sql);
  return new Harness(db);
}

export class Harness {
  constructor(db) {
    this.db = db;
  }

  async #become(who) {
    await this.db.query('reset role');
    if (who === 'admin') {
      await this.db.query(
        `select set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.sub', '', false)`,
      );
      return;
    }
    if (who === 'anon') {
      await this.db.query(
        `select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', '', false)`,
        [JSON.stringify({ role: 'anon' })],
      );
      await this.db.query('set role anon');
      return;
    }
    // { id, anonymous: true } = a Supabase anonymous sign-in (role authenticated + is_anonymous claim)
    const id = typeof who === 'object' ? who.id : who;
    const claims = { sub: id, role: 'authenticated', is_anonymous: typeof who === 'object' && !!who.anonymous };
    await this.db.query(
      `select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)`,
      [JSON.stringify(claims), id],
    );
    await this.db.query('set role authenticated');
  }

  /** Run one statement as `who` ('admin' | 'anon' | user id | { id, anonymous: true }). Returns rows. */
  async q(who, sql, params = []) {
    await this.#become(who);
    try {
      const res = await this.db.query(sql, params);
      return res.rows;
    } finally {
      await this.db.query('reset role');
    }
  }

  /** Same as q() but returns the affected row count (for update/delete/insert). */
  async run(who, sql, params = []) {
    await this.#become(who);
    try {
      const res = await this.db.query(sql, params);
      return res.affectedRows ?? 0;
    } finally {
      await this.db.query('reset role');
    }
  }

  /**
   * Insert a row into auth.users (as the auth server would) and return its id.
   * The trigger gives every new user a temporary "user_<hex>" id; to keep tests readable the
   * harness then sets the username the person would pick in the app: `username`, or by default
   * the email local part. Pass `username: null` to keep the trigger's temporary id.
   */
  async signUp({ id = randomUUID(), email = null, meta = null, username } = {}) {
    await this.q('admin', 'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
      id,
      email,
      meta === null ? null : JSON.stringify(meta),
    ]);
    const fromEmail = email?.split('@')[0].toLowerCase();
    const chosen = username === undefined ? (/^[a-z0-9._]{3,20}$/.test(fromEmail ?? '') ? fromEmail : null) : username;
    if (chosen) await this.q('admin', 'update public.profiles set username = $2 where id = $1', [id, chosen]);
    return id;
  }

  async profile(id) {
    const rows = await this.q('admin', 'select * from public.profiles where id = $1', [id]);
    return rows[0];
  }

  /** Make two users accepted friends (via the public RPC, as the users themselves). */
  async befriend(a, b) {
    await this.q(a, 'select public.request_friend($1)', [b]);
    await this.q(b, 'select public.request_friend($1)', [a]);
  }

  /** Create a capsule as `owner` with files inside the owner's folder. */
  async capsule(owner, { thumb = true, place = 'p1' } = {}) {
    const id = randomUUID();
    const video = `${owner}/${id}.webm`;
    const thumbnail = thumb ? `${owner}/${id}.jpg` : null;
    await this.q(
      owner,
      `insert into public.capsules (id, place_id, place_name, lat, lng, video_path, thumbnail_path, clip_duration)
       values ($1, $4, '식당', 37.5, 127.0, $2, $3, 5)`,
      [id, video, thumbnail, place],
    );
    return { id, video, thumbnail };
  }

  /** Upload a storage object as `who`. */
  async upload(who, name, bucket = 'capsules') {
    await this.q(who, `insert into storage.objects (bucket_id, name, owner) values ($1, $2, auth.uid())`, [
      bucket,
      name,
    ]);
  }

  async visibleCapsules(who) {
    return (await this.q(who, 'select id from public.capsules')).map((r) => r.id);
  }

  async visibleObjects(who) {
    return (await this.q(who, 'select name from storage.objects')).map((r) => r.name);
  }

  close() {
    return this.db.close();
  }
}

export const RLS = /row-level security/i;
export const DENIED = /permission denied/i;
