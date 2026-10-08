// Proves the access rules R1-R6 of supabase/schema.sql against an in-memory Postgres.
// Run with: npm run test:db
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDb, schemaSql, DENIED, RLS } from './helpers.mjs';

const hex8 = (id) => id.replace(/-/g, '').slice(0, 8);
const sorted = (xs) => [...xs].sort();
// anon has no table privileges at all (revoked), so its reads/writes fail with "permission denied"
const PATH_RULE = /row-level security|check constraint/i;

// ---------------------------------------------------------------------------
describe('schema loading', () => {
  test('schema.sql runs twice in a row without error', async () => {
    const h = await createDb({ runs: 2 });
    const policies = await h.q('admin', `select count(*)::int as n from pg_policies where schemaname in ('public', 'storage')`);
    // 22 table policies + 9 "block anonymous" restrictive policies + 5 storage policies
    assert.equal(policies[0].n, 36);
    await h.close();
  });

  test('re-running on a database with data keeps the data and the rules', async () => {
    const h = await createDb();
    const a = await h.signUp({ email: 'alice@example.com' });
    const b = await h.signUp({ email: 'bob@example.com' });
    const c = await h.signUp({ email: 'carol@example.com' });
    await h.befriend(a, b);
    const cap = await h.capsule(a);
    await h.q(a, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [cap.id, b]);

    await h.db.exec(schemaSql());

    assert.equal((await h.q('admin', 'select count(*)::int as n from public.capsules'))[0].n, 1);
    assert.equal((await h.q('admin', 'select count(*)::int as n from public.capsule_tags'))[0].n, 1);
    assert.deepEqual(await h.visibleCapsules(b), [cap.id]);
    assert.deepEqual(await h.visibleCapsules(c), []);
    // foreign key from capsules to profiles was re-created
    const fk = await h.q('admin', `select confrelid::regclass::text as t from pg_constraint where conname = 'capsules_user_id_fkey'`);
    assert.deepEqual(fk, [{ t: 'profiles' }]);
    await h.close();
  });

  test('nudges are added to the Supabase Realtime publication once (skipped when it does not exist)', async () => {
    const h = await createDb({ runs: 2, beforeSchema: (db) => db.exec('create publication supabase_realtime') });
    const rows = await h.q('admin', `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`);
    assert.deepEqual(rows, [{ tablename: 'nudges' }]);
    await h.close();
  });

  test('users that existed before the script get a backfilled profile', async () => {
    const legacy = randomUUID();
    const h = await createDb({
      beforeSchema: (db) => db.query('insert into auth.users (id, email) values ($1, null)', [legacy]),
    });
    const p = await h.profile(legacy);
    assert.equal(p.username, 'user_' + legacy.replace(/-/g, '').slice(0, 12));
    assert.equal(p.display_name, '친구');
    await h.close();
  });
});

// ---------------------------------------------------------------------------
describe('R1 profiles', () => {
  let h;
  before(async () => {
    h = await createDb();
  });
  after(() => h.close());

  test('new users get a temporary user_<8 hex of id> username; nothing is derived from the email', async () => {
    const id = await h.signUp({ email: 'Kim.Seong_Jun+tag@Gmail.com', username: null });
    const p = await h.profile(id);
    assert.equal(p.username, 'user_' + hex8(id));
    assert.equal(p.display_name, '친구'); // no name in metadata -> generic, never the email local part
    assert.equal(p.avatar_url, null);
  });

  test('sign-up never fails when the temporary username is already taken (someone renamed to it)', async () => {
    const id = 'abc12300-0000-4000-8000-000000000001';
    await h.signUp({ email: 'squatter@x.com', username: 'user_abc12300' });
    await h.signUp({ id, email: null, meta: { nickname: '늦게온사람' }, username: null });
    const p = await h.profile(id);
    assert.ok(p, 'profile row must exist');
    assert.match(p.username, /^user_[0-9a-f]{8}$/);
    assert.notEqual(p.username, 'user_abc12300');
  });

  test('users without email (Kakao without consent) still get a profile', async () => {
    const n = await h.signUp({ email: null, meta: { nickname: '카카오친구', picture: 'http://k/p.png' }, username: null });
    const pn = await h.profile(n);
    assert.equal(pn.username, 'user_' + hex8(n));
    assert.equal(pn.display_name, '카카오친구');
    assert.equal(pn.avatar_url, 'https://k/p.png'); // Kakao sends http:// avatars; stored as https

    const bare = await h.signUp({ email: null, meta: null, username: null });
    const pb = await h.profile(bare);
    assert.equal(pb.username, 'user_' + hex8(bare));
    assert.equal(pb.display_name, '친구');
    assert.equal(pb.avatar_url, null);
  });

  test('display_name priority full_name > name > nickname > user_name, empty strings skipped', async () => {
    const cases = [
      [{ full_name: 'F', name: 'N', nickname: 'K', user_name: 'U' }, 'F'],
      [{ full_name: '', name: 'N', nickname: 'K', user_name: 'U' }, 'N'],
      [{ nickname: 'K', user_name: 'U' }, 'K'],
      [{ user_name: 'U' }, 'U'],
      [{ full_name: '   ' }, '친구'],
    ];
    for (const [meta, expected] of cases) {
      const id = await h.signUp({ email: 'localpart@x.com', meta, username: null });
      assert.equal((await h.profile(id)).display_name, expected, JSON.stringify(meta));
    }
    const long = await h.signUp({ email: 'longname@x.com', meta: { full_name: '가'.repeat(40) } });
    assert.equal((await h.profile(long)).display_name, '가'.repeat(30));
  });

  test('avatar_url prefers avatar_url over picture', async () => {
    const id = await h.signUp({ email: 'pic@x.com', meta: { avatar_url: 'A', picture: 'P' } });
    assert.equal((await h.profile(id)).avatar_url, 'A');
    const id2 = await h.signUp({ email: 'pic2@x.com', meta: { avatar_url: '', picture: 'P' } });
    assert.equal((await h.profile(id2)).avatar_url, 'P');
  });

  test('the whole member list cannot be dumped: a fresh user sees only their own profile; anon is denied', async () => {
    const me = await h.signUp({ email: 'reader@x.com' });
    const all = (await h.q('admin', 'select count(*)::int as n from public.profiles'))[0].n;
    assert.ok(all > 5);
    assert.deepEqual((await h.q(me, 'select id from public.profiles')).map((r) => r.id), [me]);
    await assert.rejects(h.q('anon', 'select count(*)::int as n from public.profiles'), DENIED);
  });

  test('a user can update only their own username/display_name (avatar_url comes from the login provider)', async () => {
    const me = await h.signUp({ email: 'editor@x.com' });
    const other = await h.signUp({ email: 'victim@x.com' });
    assert.equal(await h.run(me, `update public.profiles set username = 'new.name', display_name = '새이름' where id = $1`, [me]), 1);
    const p = await h.profile(me);
    assert.deepEqual([p.username, p.display_name], ['new.name', '새이름']);
    // avatar_url is not user-writable (would let anyone make viewers load a tracking URL)
    await assert.rejects(h.q(me, `update public.profiles set avatar_url = 'https://evil.example/p.gif' where id = $1`, [me]), DENIED);

    assert.equal(await h.run(me, `update public.profiles set display_name = 'hacked' where id = $1`, [other]), 0);
    assert.equal((await h.profile(other)).display_name, '친구'); // unchanged
  });

  test('id and created_at are not updatable; invalid usernames are rejected', async () => {
    const me = await h.signUp({ email: 'cols@x.com' });
    await assert.rejects(h.q(me, 'update public.profiles set id = gen_random_uuid() where id = $1', [me]), DENIED);
    await assert.rejects(h.q(me, `update public.profiles set created_at = now() - interval '1 year' where id = $1`, [me]), DENIED);
    await assert.rejects(h.q(me, `update public.profiles set username = 'Bad Name!' where id = $1`, [me]), /check constraint/);
    const taken = (await h.q('admin', `select username from public.profiles where id <> $1 limit 1`, [me]))[0].username;
    await assert.rejects(h.q(me, 'update public.profiles set username = $2 where id = $1', [me, taken]), /unique/);
  });

  test('nobody can insert or delete profiles directly; anon cannot update', async () => {
    const me = await h.signUp({ email: 'ins@x.com' });
    await assert.rejects(
      h.q(me, `insert into public.profiles (id, username, display_name) values ($1, 'fake.user', 'fake')`, [randomUUID()]),
      DENIED,
    );
    await assert.rejects(h.q(me, 'delete from public.profiles where id = $1', [me]), DENIED);
    await assert.rejects(h.q('anon', `update public.profiles set display_name = 'x'`), DENIED);
    await assert.rejects(
      h.q('anon', `insert into public.profiles (id, username, display_name) values ($1, 'anon.user', 'a')`, [randomUUID()]),
      DENIED,
    );
  });
});

// ---------------------------------------------------------------------------
describe('R2 friendships', () => {
  let h, A, B, C;
  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'a@x.com' });
    B = await h.signUp({ email: 'b@x.com' });
    C = await h.signUp({ email: 'c@x.com' });
  });
  after(() => h.close());

  const row = async (x, y) =>
    (await h.q('admin', 'select status from public.friendships where requester_id = $1 and addressee_id = $2', [x, y]))[0];

  test('A can send a pending request to B', async () => {
    await h.q(A, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [A, B]);
    assert.deepEqual(await row(A, B), { status: 'pending' });
  });

  test('cannot insert a request as someone else', async () => {
    await assert.rejects(h.q(A, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [C, B]), RLS);
    await assert.rejects(h.q(A, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [C, A]), RLS);
  });

  test('cannot insert an already accepted row', async () => {
    await assert.rejects(
      h.q(C, `insert into public.friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [C, A]),
      RLS,
    );
  });

  test('cannot befriend yourself', async () => {
    await assert.rejects(h.q(C, 'insert into public.friendships (requester_id, addressee_id) values ($1, $1)', [C]), /check constraint/);
  });

  test('only one row per unordered pair', async () => {
    await assert.rejects(h.q(B, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [B, A]), /duplicate key|unique/);
  });

  test('cannot request a non-existent user', async () => {
    await assert.rejects(
      h.q(C, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [C, randomUUID()]),
      /foreign key/,
    );
  });

  test('third parties cannot see, change or delete the row', async () => {
    assert.deepEqual(await h.q(C, 'select * from public.friendships'), []);
    assert.equal(await h.run(C, `update public.friendships set status = 'accepted'`), 0);
    assert.equal(await h.run(C, 'delete from public.friendships'), 0);
    assert.deepEqual(await row(A, B), { status: 'pending' });
  });

  test('both parties can see the row', async () => {
    assert.equal((await h.q(A, 'select * from public.friendships')).length, 1);
    assert.equal((await h.q(B, 'select * from public.friendships')).length, 1);
  });

  test('requester cannot accept their own request', async () => {
    assert.equal(await h.run(A, `update public.friendships set status = 'accepted' where requester_id = $1`, [A]), 0);
    assert.deepEqual(await row(A, B), { status: 'pending' });
  });

  test('addressee cannot change other columns', async () => {
    await assert.rejects(h.q(B, 'update public.friendships set requester_id = $1', [C]), DENIED);
    await assert.rejects(h.q(B, 'update public.friendships set addressee_id = $1', [C]), DENIED);
  });

  test('addressee accepts; cannot downgrade back to pending', async () => {
    assert.equal(await h.run(B, `update public.friendships set status = 'accepted' where requester_id = $1`, [A]), 1);
    assert.deepEqual(await row(A, B), { status: 'accepted' });
    await assert.rejects(h.q(B, `update public.friendships set status = 'pending' where requester_id = $1`, [A]), RLS);
  });

  test('either party can delete the row (requester deletes accepted, addressee rejects pending)', async () => {
    assert.equal(await h.run(A, 'delete from public.friendships where addressee_id = $1', [B]), 1);
    assert.equal(await row(A, B), undefined);

    await h.q(C, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [C, A]);
    assert.equal(await h.run(A, 'delete from public.friendships where requester_id = $1', [C]), 1);
    assert.equal(await row(C, A), undefined);
  });

  test('anon can neither read nor insert nor delete', async () => {
    await h.q(A, 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [A, C]);
    await assert.rejects(h.q('anon', 'select * from public.friendships'), DENIED);
    await assert.rejects(h.q('anon', 'insert into public.friendships (requester_id, addressee_id) values ($1, $2)', [B, C]), DENIED);
    await assert.rejects(h.q('anon', 'delete from public.friendships'), DENIED);
    assert.equal((await h.q('admin', 'select count(*)::int as n from public.friendships'))[0].n, 1);
  });
});

// ---------------------------------------------------------------------------
// Shared cast for R3-R5:
//   A owner; B accepted friend of A; C stranger; D requested A (pending, incoming to A);
//   E was requested by A (pending, outgoing from A); T friend of A, tagged, then unfriended.
async function cast() {
  const h = await createDb();
  const ids = {};
  for (const n of ['A', 'B', 'C', 'D', 'E', 'T']) ids[n] = await h.signUp({ email: `${n.toLowerCase()}user@x.com` });
  await h.befriend(ids.A, ids.B);
  await h.befriend(ids.A, ids.T);
  await h.q(ids.D, 'select public.request_friend($1)', [ids.A]);
  await h.q(ids.A, 'select public.request_friend($1)', [ids.E]);
  return { h, ...ids };
}

describe('R3 capsules', () => {
  let h, A, B, C, D, E, cap, bcap;
  before(async () => {
    ({ h, A, B, C, D, E } = await cast());
    cap = await h.capsule(A);
    bcap = await h.capsule(B);
  });
  after(() => h.close());

  test('owner can insert with user_id defaulting to self', async () => {
    const owner = (await h.q('admin', 'select user_id from public.capsules where id = $1', [cap.id]))[0].user_id;
    assert.equal(owner, A);
  });

  test('cannot forge user_id', async () => {
    await assert.rejects(
      h.q(A, `insert into public.capsules (user_id, place_id, place_name, lat, lng, video_path, clip_duration)
              values ($1, 'p', 'x', 0, 0, $2, 5)`, [B, `${A}/v.webm`]),
      RLS,
    );
    await assert.rejects(
      h.q(A, `insert into public.capsules (user_id, place_id, place_name, lat, lng, video_path, clip_duration)
              values ($1, 'p', 'x', 0, 0, $2, 5)`, [B, `${B}/v.webm`]),
      RLS,
    );
  });

  test('video_path and thumbnail_path must be inside the own folder', async () => {
    const ins = (v, t) =>
      h.q(A, `insert into public.capsules (place_id, place_name, lat, lng, video_path, thumbnail_path, clip_duration)
              values ('p', 'x', 0, 0, $1, $2, 5)`, [v, t]);
    await assert.rejects(ins(`${B}/x.webm`, null), PATH_RULE);
    await assert.rejects(ins(`${A}/x.webm`, `${B}/x.jpg`), PATH_RULE);
    await assert.rejects(ins(bcap.video, null), PATH_RULE);
    await assert.rejects(ins(`x.webm`, null), PATH_RULE);
    await ins(`${A}/ok.webm`, null); // own folder, no thumbnail: allowed
    await h.q('admin', `delete from public.capsules where video_path = $1`, [`${A}/ok.webm`]);
  });

  test('visible to owner and accepted friends (both directions)', async () => {
    assert.deepEqual(sorted(await h.visibleCapsules(A)), sorted([cap.id, bcap.id]));
    assert.deepEqual(sorted(await h.visibleCapsules(B)), sorted([cap.id, bcap.id]));
  });

  test('not visible to strangers, pending requests (either direction) or anon', async () => {
    assert.deepEqual(await h.visibleCapsules(C), []);
    assert.deepEqual(await h.visibleCapsules(D), []);
    assert.deepEqual(await h.visibleCapsules(E), []);
    await assert.rejects(h.visibleCapsules('anon'), DENIED);
  });

  test('nobody can update a capsule, not even the owner (only the owner changes its visibility)', async () => {
    await assert.rejects(h.q(A, `update public.capsules set place_name = 'x' where id = $1`, [cap.id]), DENIED);
    await assert.rejects(h.q(B, `update public.capsules set place_name = 'x' where id = $1`, [cap.id]), DENIED);
    await assert.rejects(h.q(A, `update public.capsules set video_path = $2 where id = $1`, [cap.id, bcap.video]), DENIED);
    await assert.rejects(h.q(A, `update public.capsules set created_at = now() - interval '9 days' where id = $1`, [cap.id]), DENIED);
    // B는 A의 친구라 기록을 볼 수 있지만 공개 범위는 못 바꾼다
    assert.equal(await h.run(B, `update public.capsules set visibility = 'town' where id = $1`, [cap.id]), 0);
  });

  test('only the owner can delete', async () => {
    assert.equal(await h.run(B, 'delete from public.capsules where id = $1', [cap.id]), 0);
    assert.equal(await h.run(C, 'delete from public.capsules where id = $1', [cap.id]), 0);
    await assert.rejects(h.run('anon', 'delete from public.capsules'), DENIED);
    assert.equal(await h.run(A, 'delete from public.capsules where id = $1', [cap.id]), 1);
  });

  test('anon cannot insert', async () => {
    await assert.rejects(
      h.q('anon', `insert into public.capsules (user_id, place_id, place_name, lat, lng, video_path, clip_duration)
                   values ($1, 'p', 'x', 0, 0, $2, 5)`, [A, `${A}/anon.webm`]),
      DENIED,
    );
  });

  test('a row pointing at another user’s file is rejected for every role, even the database owner', async () => {
    await assert.rejects(
      h.q('admin', `insert into public.capsules (user_id, place_id, place_name, lat, lng, video_path, clip_duration)
                    values ($1, 'p', 'x', 0, 0, $2, 5)`, [A, bcap.video]),
      /check constraint/,
    );
  });
});

// ---------------------------------------------------------------------------
describe('R4 capsule_tags', () => {
  let h, A, B, C, D, E, T, cap1, cap2;
  const tag = (who, capsule, user) =>
    h.q(who, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [capsule, user]);
  const tagsOf = async (who, capsule) =>
    sorted((await h.q(who, 'select user_id from public.capsule_tags where capsule_id = $1', [capsule])).map((r) => r.user_id));

  before(async () => {
    ({ h, A, B, C, D, E, T } = await cast());
    cap1 = await h.capsule(A);
    cap2 = await h.capsule(A);
  });
  after(() => h.close());

  test('owner can tag accepted friends', async () => {
    await tag(A, cap1.id, B);
    await tag(A, cap1.id, T);
    assert.deepEqual(await tagsOf('admin', cap1.id), sorted([B, T]));
  });

  test('owner cannot tag strangers, pending users or themselves', async () => {
    await assert.rejects(tag(A, cap1.id, C), RLS);
    await assert.rejects(tag(A, cap1.id, D), RLS);
    await assert.rejects(tag(A, cap1.id, E), RLS);
    await assert.rejects(tag(A, cap1.id, A), RLS);
  });

  test("non-owners cannot tag on someone else's capsule", async () => {
    await assert.rejects(tag(B, cap2.id, A), RLS); // B is A's friend, still not the owner
    await assert.rejects(tag(B, cap2.id, B), RLS);
    await assert.rejects(tag(C, cap2.id, C), RLS);
    await assert.rejects(tag('anon', cap2.id, B), DENIED);
  });

  test('tags are visible to whoever can see the capsule, and nobody else', async () => {
    assert.deepEqual(await tagsOf(A, cap1.id), sorted([B, T]));
    assert.deepEqual(await tagsOf(B, cap1.id), sorted([B, T]));
    assert.deepEqual(await tagsOf(T, cap1.id), sorted([B, T]));
    assert.deepEqual(await tagsOf(C, cap1.id), []);
    assert.deepEqual(await tagsOf(D, cap1.id), []);
    await assert.rejects(tagsOf('anon', cap1.id), DENIED);
  });

  test('tags cannot be updated', async () => {
    await assert.rejects(h.q(A, 'update public.capsule_tags set user_id = $1 where capsule_id = $2', [C, cap1.id]), DENIED);
    await assert.rejects(h.q(A, 'update public.capsule_tags set capsule_id = $1 where capsule_id = $2', [cap2.id, cap1.id]), DENIED);
  });

  test('unfriended-but-tagged user still sees that one capsule, but no other capsule of the owner', async () => {
    await h.q(A, 'select public.remove_friend($1)', [T]);
    assert.deepEqual(await h.visibleCapsules(T), [cap1.id]);
    assert.deepEqual(await tagsOf(T, cap1.id), sorted([B, T]));
    // and the owner can no longer tag them on another capsule
    await assert.rejects(tag(A, cap2.id, T), RLS);
  });

  test('tagged user can delete only their own tag', async () => {
    assert.equal(await h.run(T, 'delete from public.capsule_tags where capsule_id = $1 and user_id = $2', [cap1.id, B]), 0);
    assert.equal(await h.run(C, 'delete from public.capsule_tags where capsule_id = $1', [cap1.id]), 0);
    assert.equal(await h.run(T, 'delete from public.capsule_tags where capsule_id = $1 and user_id = $2', [cap1.id, T]), 1);
    assert.deepEqual(await h.visibleCapsules(T), []);
  });

  test('owner can delete tags; capsule delete cascades', async () => {
    await tag(A, cap2.id, B);
    assert.equal(await h.run(A, 'delete from public.capsule_tags where capsule_id = $1 and user_id = $2', [cap1.id, B]), 1);
    assert.equal(await h.run(A, 'delete from public.capsules where id = $1', [cap2.id]), 1);
    assert.deepEqual(await tagsOf('admin', cap2.id), []);
  });
});

// ---------------------------------------------------------------------------
describe('R5 storage', () => {
  let h, A, B, C, D, E, T, cap1, cap2, orphan;
  before(async () => {
    ({ h, A, B, C, D, E, T } = await cast());
    cap1 = await h.capsule(A);
    cap2 = await h.capsule(A);
    orphan = `${A}/orphan.webm`;
    for (const name of [cap1.video, cap1.thumbnail, cap2.video, cap2.thumbnail, orphan]) await h.upload(A, name);
    await h.q(A, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [cap1.id, T]);
    await h.q(A, 'select public.remove_friend($1)', [T]); // T: tagged on cap1, no longer a friend
  });
  after(() => h.close());

  test('bucket "capsules" exists and is private', async () => {
    assert.deepEqual(await h.q('admin', `select public, file_size_limit::int as lim from storage.buckets where id = 'capsules'`), [
      { public: false, lim: 52428800 },
    ]);
  });

  test('upload only into the own folder of the capsules bucket', async () => {
    await assert.rejects(h.upload(B, `${A}/evil.webm`), RLS);
    await assert.rejects(h.upload(B, `evil.webm`), RLS);
    await assert.rejects(h.upload(B, `x/${B}/evil.webm`), RLS);
    await assert.rejects(h.upload('anon', `${A}/anon.webm`), RLS);
    await h.q('admin', `insert into storage.buckets (id, name, public) values ('other', 'other', false)`);
    await assert.rejects(h.upload(B, `${B}/x.webm`, 'other'), RLS);
    await h.upload(B, `${B}/mine.webm`);
  });

  test('owner reads everything in their own folder (including orphans)', async () => {
    assert.deepEqual(
      sorted(await h.visibleObjects(A)),
      sorted([cap1.video, cap1.thumbnail, cap2.video, cap2.thumbnail, orphan]),
    );
  });

  test('friend reads files referenced by visible capsules, not orphans', async () => {
    const seen = await h.visibleObjects(B);
    assert.deepEqual(sorted(seen), sorted([cap1.video, cap1.thumbnail, cap2.video, cap2.thumbnail, `${B}/mine.webm`]));
    assert.ok(!seen.includes(orphan));
  });

  test('strangers, pending users and anon read nothing of A', async () => {
    assert.deepEqual(await h.visibleObjects(C), []);
    assert.deepEqual(await h.visibleObjects(D), []);
    assert.deepEqual(await h.visibleObjects(E), []);
    assert.deepEqual(await h.visibleObjects('anon'), []);
  });

  test('unfriended-but-tagged user reads only the tagged capsule files', async () => {
    assert.deepEqual(sorted(await h.visibleObjects(T)), sorted([cap1.video, cap1.thumbnail]));
  });

  test('a capsule pointing at a path does not leak an object stored in another bucket', async () => {
    await h.q('admin', `insert into storage.objects (bucket_id, name) values ('other', $1)`, [cap1.video]);
    const rows = await h.q(B, `select bucket_id from storage.objects where name = $1`, [cap1.video]);
    assert.deepEqual(rows, [{ bucket_id: 'capsules' }]);
  });

  test('delete only in the own folder', async () => {
    assert.equal(await h.run(B, 'delete from storage.objects where name = $1', [cap1.video]), 0);
    assert.equal(await h.run(T, 'delete from storage.objects where name = $1', [cap1.video]), 0);
    assert.equal(await h.run(C, 'delete from storage.objects'), 0);
    assert.equal(await h.run('anon', 'delete from storage.objects'), 0);
    assert.equal(await h.run(A, 'delete from storage.objects where name = $1', [orphan]), 1);
  });

  test('others cannot rename/move objects', async () => {
    assert.equal(await h.run(B, `update storage.objects set name = $2 where name = $1`, [cap1.video, `${B}/stolen.webm`]), 0);
  });

  test('deleting the capsule revokes friends’ access to its files', async () => {
    await h.q(A, 'delete from public.capsules where id = $1', [cap2.id]);
    const seen = await h.visibleObjects(B);
    assert.ok(!seen.includes(cap2.video));
    assert.ok(!seen.includes(cap2.thumbnail));
  });
});

// ---------------------------------------------------------------------------
describe('R6 RPCs', () => {
  let h, me, kim, kim2, lee, park, pct, und, friend, out, inc;
  const search = async (who, q) => await h.q(who, 'select * from public.search_profiles($1)', [q]);
  const names = (rows) => rows.map((r) => r.username);

  before(async () => {
    h = await createDb();
    me = await h.signUp({ email: 'me.self@x.com', meta: { full_name: '나 자신' } });
    kim = await h.signUp({ email: 'kimseong@x.com', meta: { full_name: '김성준' } });
    kim2 = await h.signUp({ email: 'kimchi@x.com', meta: { full_name: 'Kimchi Lover' } });
    lee = await h.signUp({ email: 'leejin@x.com', meta: { full_name: '이진' } });
    park = await h.signUp({ email: 'abc@x.com', meta: { full_name: 'Park' } });
    pct = await h.signUp({ email: 'percent@x.com', meta: { full_name: '100% 진심' } });
    und = await h.signUp({ email: 'under@x.com', meta: { full_name: 'a_b' } });
    friend = await h.signUp({ email: 'friendly@x.com', meta: { full_name: 'F' } });
    out = await h.signUp({ email: 'outgoing@x.com', meta: { full_name: 'O' } });
    inc = await h.signUp({ email: 'incoming@x.com', meta: { full_name: 'I' } });
    await h.befriend(me, friend);
    await h.q(me, 'select public.request_friend($1)', [out]);
    await h.q(inc, 'select public.request_friend($1)', [me]);
  });
  after(() => h.close());

  test('anon cannot execute any RPC or helper', async () => {
    const id = randomUUID();
    await assert.rejects(h.q('anon', `select * from public.search_profiles('kim')`), DENIED);
    await assert.rejects(h.q('anon', 'select * from public.list_friendships()'), DENIED);
    await assert.rejects(h.q('anon', 'select public.request_friend($1)', [id]), DENIED);
    await assert.rejects(h.q('anon', 'select public.remove_friend($1)', [id]), DENIED);
    await assert.rejects(h.q('anon', 'select public.is_friend($1)', [id]), DENIED);
    await assert.rejects(h.q('anon', 'select public.can_see_profile($1)', [id]), DENIED);
    await assert.rejects(h.q('anon', 'select * from public.my_friend_ids()'), DENIED);
    await assert.rejects(h.q('anon', 'select * from public.my_tagged_capsule_ids()'), DENIED);
    await assert.rejects(h.q('anon', 'select public.nudge_friend($1, $2)', [id, id]), DENIED);
    await assert.rejects(h.q('anon', `select public.save_push_subscription('https://push.example/x', 'k', 'a')`), DENIED);
    // the old helper was removed
    assert.deepEqual(await h.q('admin', `select proname from pg_proc where proname = 'can_view_capsule'`), []);
  });

  test('authenticated can execute them', async () => {
    await h.q(me, 'select * from public.list_friendships()');
    await h.q(me, `select * from public.search_profiles('zz')`);
  });

  test('search: username prefix (case-insensitive) and display_name substring', async () => {
    assert.deepEqual(names(await search(me, 'kim')), ['kimchi', 'kimseong']);
    assert.deepEqual(names(await search(me, 'KIMS')), ['kimseong']);
    assert.deepEqual(names(await search(me, 'seong')), []); // not a username prefix, not in a display name
    assert.deepEqual(names(await search(me, '성준')), ['kimseong']);
    assert.deepEqual(names(await search(me, 'LOVER')), ['kimchi']);
    assert.deepEqual(names(await search(me, '  kimc  ')), ['kimchi']);
  });

  test('search: leading @ is stripped', async () => {
    assert.deepEqual(names(await search(me, '@kims')), ['kimseong']);
    assert.deepEqual(names(await search(me, '@leejin')), ['leejin']);
  });

  test('search: requires at least 2 chars after stripping @', async () => {
    assert.deepEqual(await search(me, 'k'), []);
    assert.deepEqual(await search(me, '@k'), []);
    assert.deepEqual(await search(me, '  k  '), []);
    assert.deepEqual(await search(me, '@'), []);
    assert.deepEqual(await search(me, ''), []);
    assert.deepEqual(await search(me, null), []);
  });

  test('search: excludes the caller', async () => {
    assert.deepEqual(names(await search(me, 'me.self')), []);
    assert.deepEqual(names(await search(me, '자신')), []);
    assert.deepEqual(names(await search(kim, 'me.s')), ['me.self']);
  });

  test('search: LIKE wildcards in q are literal', async () => {
    assert.deepEqual(await search(me, '%%'), []);
    assert.deepEqual(await search(me, '__'), []);
    assert.deepEqual(await search(me, '%'.repeat(5)), []);
    assert.deepEqual(names(await search(me, 'a_c')), []); // would match "abc" if _ were a wildcard
    assert.deepEqual(names(await search(me, 'k%')), []);
    assert.deepEqual(names(await search(me, '0%')), ['percent']); // literal % in display name
    assert.deepEqual(names(await search(me, 'a_')), ['under']); // literal _ in display name "a_b"
    assert.deepEqual(names(await search(me, '\\%')), []);
  });

  test('search: status relative to the caller', async () => {
    const st = async (who, q) => Object.fromEntries((await search(who, q)).map((r) => [r.username, r.status]));
    assert.deepEqual(await st(me, 'friendly'), { friendly: 'friend' });
    assert.deepEqual(await st(me, 'outgoing'), { outgoing: 'outgoing' });
    assert.deepEqual(await st(me, 'incoming'), { incoming: 'incoming' });
    assert.deepEqual(await st(me, 'leejin'), { leejin: 'none' });
    // from the other side
    assert.deepEqual(await st(out, 'me.self'), { 'me.self': 'incoming' });
    assert.deepEqual(await st(inc, 'me.self'), { 'me.self': 'outgoing' });
    // third party does not learn about others' relations
    assert.deepEqual(await st(lee, 'friendly'), { friendly: 'none' });
    assert.deepEqual(await st(lee, 'outgoing'), { outgoing: 'none' });
  });

  test('list_friendships shows my relations only', async () => {
    const rows = await h.q(me, 'select username, status from public.list_friendships()');
    assert.deepEqual(
      Object.fromEntries(rows.map((r) => [r.username, r.status])),
      { friendly: 'friend', outgoing: 'outgoing', incoming: 'incoming' },
    );
    assert.deepEqual(await h.q(lee, 'select * from public.list_friendships()'), []);
  });

  test('request_friend: new request, repeat, reverse accept, already friends, self', async () => {
    const x = await h.signUp({ email: 'xrequest@x.com' });
    const y = await h.signUp({ email: 'yrequest@x.com' });
    const call = async (who, target) => (await h.q(who, 'select public.request_friend($1) as s', [target]))[0].s;
    const rows = () =>
      h.q('admin', 'select requester_id, addressee_id, status from public.friendships where $1 in (requester_id, addressee_id)', [x]);

    assert.equal(await call(x, y), 'outgoing');
    assert.deepEqual(await rows(), [{ requester_id: x, addressee_id: y, status: 'pending' }]);
    assert.equal(await call(x, y), 'outgoing');
    assert.equal((await rows()).length, 1);
    assert.equal(await call(y, x), 'friend');
    assert.deepEqual(await rows(), [{ requester_id: x, addressee_id: y, status: 'accepted' }]);
    assert.equal(await call(x, y), 'friend');
    assert.equal(await call(y, x), 'friend');
    await assert.rejects(call(x, x), /cannot befriend yourself/);
    await assert.rejects(call(x, randomUUID()), /foreign key/);
  });

  test('remove_friend deletes the pair row in either direction, only for the caller', async () => {
    const x = await h.signUp({ email: 'xremove@x.com' });
    const y = await h.signUp({ email: 'yremove@x.com' });
    const z = await h.signUp({ email: 'zremove@x.com' });
    const count = async () =>
      (await h.q('admin', 'select count(*)::int as n from public.friendships where $1 in (requester_id, addressee_id)', [x]))[0].n;

    await h.befriend(x, y);
    await h.q(z, 'select public.remove_friend($1)', [y]); // third party: no effect
    await h.q(z, 'select public.remove_friend($1)', [x]);
    assert.equal(await count(), 1);
    await h.q(y, 'select public.remove_friend($1)', [x]); // addressee removes
    assert.equal(await count(), 0);

    await h.q(x, 'select public.request_friend($1)', [y]);
    await h.q(x, 'select public.remove_friend($1)', [y]); // requester cancels
    assert.equal(await count(), 0);

    await h.q(x, 'select public.request_friend($1)', [y]);
    await h.q(y, 'select public.remove_friend($1)', [x]); // addressee rejects
    assert.equal(await count(), 0);
  });
});

// ---------------------------------------------------------------------------
describe('R1b profile visibility', () => {
  let h, A, B, C, D, E, T, X, cap, bcap;
  const seen = async (who) => sorted((await h.q(who, 'select id from public.profiles')).map((r) => r.id));

  before(async () => {
    ({ h, A, B, C, D, E, T } = await cast());
    X = await h.signUp({ email: 'xfriendofb@x.com' }); // B's friend, a stranger to A
    await h.befriend(B, X);
    cap = await h.capsule(A);
    bcap = await h.capsule(B);
    await h.q(A, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [cap.id, T]);
    await h.q(B, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [bcap.id, X]);
  });
  after(() => h.close());

  test('a user sees themselves, friends and people with a pending request (either direction)', async () => {
    const mine = await seen(A);
    for (const id of [A, B, T, D, E]) assert.ok(mine.includes(id), `A should see ${id}`);
    assert.ok(!mine.includes(C), 'A must not see the stranger C');
  });

  test('people tagged on a capsule I can see are visible (X tagged on friend B’s capsule)', async () => {
    assert.ok((await seen(A)).includes(X));
    // ...and the embed used by the app returns author + tagged profiles
    const rows = await h.q(A, `select c.id, p.username as author,
                                 (select array_agg(tp.username order by tp.username) from public.capsule_tags t
                                    join public.profiles tp on tp.id = t.user_id where t.capsule_id = c.id) as tags
                               from public.capsules c join public.profiles p on p.id = c.user_id where c.id = $1`, [bcap.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].author, 'buser');
    assert.deepEqual(rows[0].tags, ['xfriendofb']);
  });

  test('strangers see nothing but themselves, yet can still find people by search', async () => {
    assert.deepEqual(await seen(C), [C]);
    const found = await h.q(C, `select username, status from public.search_profiles('auser')`);
    assert.deepEqual(found, [{ username: 'auser', status: 'none' }]);
  });

  test('after unfriending, the author who tagged me stays visible (so the tagged video still shows its author)', async () => {
    await h.q(A, 'select public.remove_friend($1)', [T]);
    const tSees = await seen(T);
    assert.ok(tSees.includes(A), 'T still sees A (A tagged T)');
    assert.ok(!tSees.includes(C));
  });

  test('search returns at most 20 rows', async () => {
    for (let i = 0; i < 25; i++) await h.signUp({ email: `many${String(i).padStart(2, '0')}@x.com` });
    assert.equal((await h.q(C, `select * from public.search_profiles('many')`)).length, 20);
  });
});

// ---------------------------------------------------------------------------
describe('hardening', () => {
  let h, A, B, anonUser, cap;
  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'hard.a@x.com' });
    B = await h.signUp({ email: 'hard.b@x.com' });
    await h.befriend(A, B);
    cap = await h.capsule(A);
    await h.upload(A, cap.video);
    // a Supabase anonymous sign-in: has a profile (trigger) and role "authenticated", plus is_anonymous=true
    anonUser = { id: await h.signUp({ email: null }), anonymous: true };
  });
  after(() => h.close());

  test('anonymous sign-ins cannot read anything, not even their own profile', async () => {
    assert.deepEqual(await h.q(anonUser, 'select * from public.profiles'), []);
    assert.deepEqual(await h.q(anonUser, 'select * from public.capsules'), []);
    assert.deepEqual(await h.q(anonUser, 'select * from public.friendships'), []);
    assert.deepEqual(await h.q(anonUser, 'select * from public.capsule_tags'), []);
    assert.deepEqual(await h.q(anonUser, 'select * from public.capsule_likes'), []);
    assert.deepEqual(await h.q(anonUser, 'select name from storage.objects'), []);
    assert.deepEqual(await h.q(anonUser, `select * from public.search_profiles('hard')`), []);
    assert.deepEqual(await h.q(anonUser, 'select * from public.nudges'), []);
    assert.deepEqual(await h.q(anonUser, 'select * from public.push_subscriptions'), []);
  });

  test('anonymous sign-ins cannot write: friend requests, capsules, uploads, profile edits', async () => {
    await assert.rejects(h.q(anonUser, 'select public.request_friend($1)', [A]), RLS);
    await assert.rejects(
      h.q(anonUser, `insert into public.capsules (place_id, place_name, lat, lng, video_path, clip_duration)
                     values ('p', 'x', 0, 0, $1, 5)`, [`${anonUser.id}/v.webm`]),
      RLS,
    );
    await assert.rejects(h.upload(anonUser, `${anonUser.id}/v.webm`), RLS);
    await assert.rejects(h.q(anonUser, 'insert into public.capsule_likes (capsule_id) values ($1)', [cap.id]), RLS);
    assert.equal(await h.run(anonUser, `update public.profiles set display_name = 'spam' where id = $1`, [anonUser.id]), 0);
    await assert.rejects(h.q(anonUser, 'select public.nudge_friend($1, $2)', [cap.id, A]), /not authenticated/);
    await assert.rejects(
      h.q(anonUser, `select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/x', 'k', 'a')`),
      /not authenticated/,
    );
  });

  test('a real account still works next to the restrictive policies', async () => {
    assert.deepEqual(await h.visibleCapsules(B), [cap.id]);
    assert.deepEqual(await h.visibleObjects(B), [cap.video]);
  });

  test('TRUNCATE and other bulk privileges are revoked from anon and authenticated', async () => {
    for (const t of ['profiles', 'friendships', 'capsules', 'capsule_tags', 'capsule_likes', 'nudges', 'push_subscriptions']) {
      await assert.rejects(h.q(A, `truncate public.${t} cascade`), DENIED, `authenticated truncate ${t}`);
      await assert.rejects(h.q('anon', `truncate public.${t} cascade`), DENIED, `anon truncate ${t}`);
    }
    assert.equal((await h.q('admin', 'select count(*)::int as n from public.capsules'))[0].n, 1);
  });

  test('two users whose ids share the first 8 hex chars both get a profile', async () => {
    const first = await h.signUp({ id: 'feedbeef-0000-4000-8000-000000000001', email: null, username: null });
    const second = await h.signUp({ id: 'feedbeef-0000-4000-8000-000000000002', email: null, username: null });
    assert.equal((await h.profile(first)).username, 'user_feedbeef');
    assert.match((await h.profile(second)).username, /^user_[0-9a-f]{8}$/);
    assert.notEqual((await h.profile(second)).username, 'user_feedbeef');
  });
});

// ---------------------------------------------------------------------------
// R7 nudges ("여기 또 가자"):
//   A left a capsule at p1 tagging B and C. A–B, A–C, A–D are friends; B and C are not friends.
//   D is A's friend but was not on the capsule. S is a stranger.
describe('R7 nudges', () => {
  let h, A, B, C, D, S, cap;
  const nudge = async (who, capsule, target) =>
    (await h.q(who, 'select public.nudge_friend($1, $2) as id', [capsule, target]))[0].id;
  const pairs = async (who) =>
    (await h.q(who, 'select sender_id, receiver_id from public.nudges order by created_at, sender_id')).map((r) => [r.sender_id, r.receiver_id]);

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'na.nudge@x.com' });
    B = await h.signUp({ email: 'nb.nudge@x.com' });
    C = await h.signUp({ email: 'nc.nudge@x.com' });
    D = await h.signUp({ email: 'nd.nudge@x.com' });
    S = await h.signUp({ email: 'ns.nudge@x.com' });
    await h.befriend(A, B);
    await h.befriend(A, C);
    await h.befriend(A, D);
    cap = await h.capsule(A);
    await h.q(A, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2), ($1, $3)', [cap.id, B, C]);
  });
  after(() => h.close());

  test('the author nudges a tagged friend; place comes from the capsule', async () => {
    const id = await nudge(A, cap.id, B);
    const row = (await h.q('admin', 'select * from public.nudges where id = $1', [id]))[0];
    assert.deepEqual(
      [row.sender_id, row.receiver_id, row.capsule_id, row.place_id, row.place_name, row.read_at, row.pushed_at],
      [A, B, cap.id, 'p1', '식당', null, null],
    );
  });

  test('a tagged friend nudges the author back', async () => {
    assert.ok(await nudge(B, cap.id, A));
  });

  test('only the sender and the receiver see a nudge', async () => {
    const both = [[A, B], [B, A]];
    assert.deepEqual(sorted((await pairs(A)).map(String)), sorted(both.map(String)));
    assert.deepEqual(sorted((await pairs(B)).map(String)), sorted(both.map(String)));
    assert.deepEqual(await pairs(C), []);
    assert.deepEqual(await pairs(S), []);
    await assert.rejects(h.q('anon', 'select * from public.nudges'), DENIED);
  });

  test('both people must be on the capsule and be friends now', async () => {
    await assert.rejects(nudge(A, cap.id, D), /cannot nudge/); // D was not there
    await assert.rejects(nudge(D, cap.id, A), /cannot nudge/); // D can see the capsule (A's friend) but was not there
    await assert.rejects(nudge(B, cap.id, C), /cannot nudge/); // both tagged, but not friends
    await assert.rejects(nudge(S, cap.id, A), /cannot nudge/);
    await assert.rejects(nudge(A, cap.id, A), /cannot nudge/);
    await assert.rejects(nudge(A, randomUUID(), B), /cannot nudge/);
  });

  test('same friend + same place only once per 10 minutes; another friend is separate', async () => {
    await assert.rejects(nudge(A, cap.id, B), /nudge cooldown/);
    assert.ok(await nudge(A, cap.id, C));
    await h.q('admin', `update public.nudges set created_at = now() - interval '11 minutes' where sender_id = $1 and receiver_id = $2`, [A, B]);
    assert.ok(await nudge(A, cap.id, B));
  });

  test('nobody can insert nudges directly (no forged sender or place)', async () => {
    await assert.rejects(
      h.q(A, `insert into public.nudges (sender_id, receiver_id, place_id, place_name) values ($1, $2, 'p9', '가짜')`, [A, B]),
      DENIED,
    );
    await assert.rejects(
      h.q(S, `insert into public.nudges (sender_id, receiver_id, place_id, place_name) values ($1, $2, 'p9', '가짜')`, [A, S]),
      DENIED,
    );
  });

  test('the receiver marks nudges read; the sender cannot; other columns stay fixed', async () => {
    assert.equal(await h.run(A, 'update public.nudges set read_at = now() where receiver_id = $1', [B]), 0);
    assert.equal(await h.run(B, 'update public.nudges set read_at = now() where receiver_id = $1 and read_at is null', [B]), 2);
    await assert.rejects(h.q(B, 'update public.nudges set pushed_at = null where receiver_id = $1', [B]), DENIED);
    await assert.rejects(h.q(B, `update public.nudges set place_name = 'x' where receiver_id = $1`, [B]), DENIED);
    await assert.rejects(h.q(B, 'update public.nudges set sender_id = $2 where receiver_id = $1', [B, C]), DENIED);
    await assert.rejects(h.q(B, 'delete from public.nudges'), DENIED);
  });

  test('after unfriending, nudging stops but old nudges stay', async () => {
    await h.q(C, 'select public.remove_friend($1)', [A]);
    await assert.rejects(nudge(A, cap.id, C), /cannot nudge/);
    await assert.rejects(nudge(C, cap.id, A), /cannot nudge/);
    assert.deepEqual(await pairs(C), [[A, C]]);
  });

  test('deleting the capsule keeps the nudge with its place name', async () => {
    await h.q(A, 'delete from public.capsules where id = $1', [cap.id]);
    const rows = await h.q(B, 'select capsule_id, place_name from public.nudges where receiver_id = $1', [B]);
    assert.equal(rows.length, 2);
    for (const r of rows) assert.deepEqual(r, { capsule_id: null, place_name: '식당' });
  });

  test('works on a friend’s capsule I am tagged on (tagged → author)', async () => {
    const bcap = await h.capsule(B);
    await h.q(B, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [bcap.id, A]);
    await h.q('admin', `update public.nudges set created_at = now() - interval '1 hour'`);
    assert.ok(await nudge(A, bcap.id, B));
  });
});

// ---------------------------------------------------------------------------
describe('R8 push subscriptions', () => {
  let h, A, B;
  const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/device-1';
  const save = (who, endpoint = ENDPOINT, key = 'p256') =>
    h.q(who, 'select public.save_push_subscription($1, $2, $3)', [endpoint, key, 'auth-secret']);
  const mine = async (who) =>
    (await h.q(who, 'select endpoint, user_id, p256dh from public.push_subscriptions')).map((r) => [r.endpoint, r.user_id, r.p256dh]);

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'push.a@x.com' });
    B = await h.signUp({ email: 'push.b@x.com' });
  });
  after(() => h.close());

  test('saving twice keeps one row per device and refreshes its keys', async () => {
    await save(A);
    await save(A, ENDPOINT, 'p256-new');
    assert.deepEqual(await mine(A), [[ENDPOINT, A, 'p256-new']]);
  });

  test('other users cannot read my subscriptions; anon is denied', async () => {
    assert.deepEqual(await mine(B), []);
    await assert.rejects(h.q('anon', 'select * from public.push_subscriptions'), DENIED);
  });

  test('another account turning on alerts on the same device takes the subscription over', async () => {
    await save(B);
    assert.deepEqual(await mine(A), []);
    assert.deepEqual(await mine(B), [[ENDPOINT, B, 'p256']]);
  });

  test('only the owner deletes; nobody inserts or updates directly', async () => {
    assert.equal(await h.run(A, 'delete from public.push_subscriptions where endpoint = $1', [ENDPOINT]), 0);
    await assert.rejects(
      h.q(A, `insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://x.example/1', $1, 'k', 'a')`, [A]),
      DENIED,
    );
    await assert.rejects(h.q(B, 'update public.push_subscriptions set user_id = $1', [A]), DENIED);
    assert.equal(await h.run(B, 'delete from public.push_subscriptions where endpoint = $1', [ENDPOINT]), 1);
    assert.deepEqual(await mine(B), []);
  });

  test('endpoints must be https', async () => {
    await assert.rejects(save(A, 'http://insecure.example/x'), /check constraint/);
  });
});

// ---------------------------------------------------------------------------
describe('R9 place ranking', () => {
  let h, A, B, C, S;
  const ranking = (who, days = null) =>
    h.q(who, 'select * from public.place_ranking($1)', [days]);
  const backdate = (id, days) =>
    h.q('admin', `update public.capsules set created_at = now() - make_interval(days => $2) where id = $1`, [id, days]);

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'ra.rank@x.com' });
    B = await h.signUp({ email: 'rb.rank@x.com' });
    C = await h.signUp({ email: 'rc.rank@x.com' });
    S = await h.signUp({ email: 'rs.rank@x.com' });
    await h.befriend(A, B);
    // p1: A가 오늘 3개(같은 날이라 방문 1번) + B를 태그(B도 방문 1번), A가 10일 전에 한 번 더 (단골)
    const today = await h.capsule(A, { place: 'p1' });
    await h.q(A, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [today.id, B]);
    await h.capsule(A, { place: 'p1' });
    await h.capsule(A, { place: 'p1' });
    await backdate((await h.capsule(A, { place: 'p1' })).id, 10);
    // p2: C가 오늘 한 번, 40일 전에 한 번
    await h.capsule(C, { place: 'p2' });
    await backdate((await h.capsule(C, { place: 'p2' })).id, 40);
  });
  after(() => h.close());

  test('counts visits per person per day; tagged friends count; same-day videos count once', async () => {
    const rows = await ranking(S);
    assert.deepEqual(rows, [
      { place_id: 'p1', visits: 3, people: 2, regulars: 1, videos: 4, verified_visits: 0 },
      { place_id: 'p2', visits: 2, people: 1, regulars: 1, videos: 2, verified_visits: 0 },
    ]);
  });

  test('days limits the window to the last N days (Korean date)', async () => {
    assert.deepEqual(await ranking(S, 30), [
      { place_id: 'p1', visits: 3, people: 2, regulars: 1, videos: 4, verified_visits: 0 },
      { place_id: 'p2', visits: 1, people: 1, regulars: 0, videos: 1, verified_visits: 0 },
    ]);
    assert.deepEqual((await ranking(S, 1)).map((r) => [r.place_id, r.visits]), [['p1', 2], ['p2', 1]]);
  });

  test('anyone (strangers, anon) sees the same numbers, but no people, names or times', async () => {
    const all = await ranking(A);
    assert.deepEqual(await ranking('anon'), all);
    assert.deepEqual(await ranking({ id: S, anonymous: true }), all);
    assert.deepEqual(Object.keys(all[0]).sort(), ['people', 'place_id', 'regulars', 'verified_visits', 'videos', 'visits']);
  });

  test('verified capsules count as on-site visits; the flag is set only when inserting', async () => {
    const id = randomUUID();
    await h.q(A, `insert into public.capsules (id, place_id, place_name, lat, lng, video_path, clip_duration, verified)
                  values ($1, 'p4', 'x', 0, 0, $2, 5, true)`, [id, `${A}/${id}.webm`]);
    await h.capsule(A, { place: 'p4' }); // 같은 날 인증 안 된 영상이 더 있어도 방문은 한 번
    const p4 = (await ranking(S)).find((r) => r.place_id === 'p4');
    assert.deepEqual([p4.visits, p4.verified_visits], [1, 1]);
    await assert.rejects(h.q(A, 'update public.capsules set verified = true where id = $1', [id]), DENIED);
  });

  test('clients cannot backdate a capsule to inflate visits', async () => {
    await assert.rejects(
      h.q(A, `insert into public.capsules (place_id, place_name, lat, lng, video_path, clip_duration, created_at)
              values ('p1', 'x', 0, 0, $1, 5, now() - interval '5 days')`, [`${A}/old.webm`]),
      DENIED,
    );
    // 작성 시각을 빼면 그대로 저장된다
    assert.ok(await h.capsule(A, { place: 'p3' }));
  });
});

// ---------------------------------------------------------------------------
describe('R10 town visibility', () => {
  let h, A, B, S, pub, priv;
  const setVisibility = (who, id, v) => h.run(who, 'update public.capsules set visibility = $2 where id = $1', [id, v]);

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'va.town@x.com' });
    B = await h.signUp({ email: 'vb.town@x.com' });
    S = await h.signUp({ email: 'vs.town@x.com' }); // A와 모르는 사이
    await h.befriend(A, B);
    pub = await h.capsule(A, { place: 'p1' });
    priv = await h.capsule(A, { place: 'p2' });
    await h.q(A, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [pub.id, B]);
    for (const c of [pub, priv]) {
      await h.upload(A, c.video);
      await h.upload(A, c.thumbnail);
    }
  });
  after(() => h.close());

  test('new capsules are friends-only; only the owner switches them to town', async () => {
    const rows = await h.q(A, 'select visibility from public.capsules where id = $1', [pub.id]);
    assert.deepEqual(rows, [{ visibility: 'friends' }]);
    assert.deepEqual(await h.visibleCapsules(S), []);
    assert.equal(await setVisibility(S, pub.id, 'town'), 0);
    assert.equal(await setVisibility(A, pub.id, 'town'), 1);
    await assert.rejects(setVisibility(A, pub.id, 'everyone'), /check constraint/);
  });

  test('a stranger sees the town capsule, its files and its author, but not the tagged friend', async () => {
    assert.deepEqual(await h.visibleCapsules(S), [pub.id]);
    const files = (await h.q(S, `select name from storage.objects where bucket_id = 'capsules'`)).map((r) => r.name);
    assert.deepEqual(sorted(files), sorted([pub.video, pub.thumbnail]));
    assert.deepEqual((await h.q(S, 'select id from public.profiles where id = $1', [A])).length, 1);
    assert.deepEqual(await h.q(S, 'select * from public.capsule_tags'), []);
    assert.deepEqual(await h.q(S, 'select id from public.profiles where id = $1', [B]), []);
    // 친구는 태그까지 그대로 본다
    assert.equal((await h.q(B, 'select * from public.capsule_tags where capsule_id = $1', [pub.id])).length, 1);
  });

  test('anon still sees nothing', async () => {
    await assert.rejects(h.q('anon', 'select id from public.capsules'), DENIED);
  });

  test('switching back to friends hides it again', async () => {
    assert.equal(await setVisibility(A, pub.id, 'friends'), 1);
    assert.deepEqual(await h.visibleCapsules(S), []);
    assert.deepEqual(await h.q(S, 'select id from public.profiles where id = $1', [A]), []);
  });

  test('visibility can be chosen when inserting', async () => {
    await h.q(A, `insert into public.capsules (place_id, place_name, lat, lng, video_path, clip_duration, visibility)
                  values ('p3', 'x', 0, 0, $1, 5, 'town')`, [`${A}/town.webm`]);
    assert.equal((await h.visibleCapsules(S)).length, 1);
  });
});

// ---------------------------------------------------------------------------
describe('R11 notification server (service_role)', () => {
  // 최근 Supabase 프로젝트처럼 새 테이블에 service_role 기본 권한이 없는 상태에서도 schema.sql만으로 동작해야 한다
  let h, A, B, cap, nudgeId;
  before(async () => {
    h = await createDb({
      beforeSchema: (db) => db.exec('alter default privileges in schema public revoke all on tables from service_role'),
    });
    await h.q('admin', 'alter role service_role bypassrls');
    A = await h.signUp({ email: 'sa.svc@x.com' });
    B = await h.signUp({ email: 'sb.svc@x.com' });
    await h.befriend(A, B);
    cap = await h.capsule(A);
    await h.q(A, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [cap.id, B]);
    nudgeId = (await h.q(A, 'select public.nudge_friend($1, $2) as id', [cap.id, B]))[0].id;
    await h.q(B, `select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/b', 'k', 'a')`);
  });
  after(() => h.close());

  test('api/recall.ts: reads capsules with author and tags', async () => {
    const rows = await h.q(
      'service',
      `select c.id, p.display_name, array(select t.user_id from public.capsule_tags t where t.capsule_id = c.id) as tags
       from public.capsules c join public.profiles p on p.id = c.user_id`,
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].tags, [B]);
  });

  test('api/push.ts: marks a nudge pushed, reads subscriptions and removes dead ones', async () => {
    assert.equal(await h.run('service', 'update public.nudges set pushed_at = now() where id = $1 and pushed_at is null', [nudgeId]), 1);
    assert.equal((await h.q('service', 'select endpoint from public.push_subscriptions where user_id = $1', [B])).length, 1);
    assert.equal(await h.run('service', 'delete from public.push_subscriptions where user_id = $1', [B]), 1);
  });
});

// ---------------------------------------------------------------------------
// R12 likes (하트):
//   A–B are friends. A left a friends-only capsule (priv) and a town capsule (pub). S is a stranger.
describe('R12 likes', () => {
  let h, A, B, S, priv, pub;
  const like = (who, capsule) => h.q(who, 'insert into public.capsule_likes (capsule_id) values ($1)', [capsule]);
  const unlike = (who, capsule) => h.run(who, 'delete from public.capsule_likes where capsule_id = $1', [capsule]);
  const count = async (who, capsule) =>
    (await h.q(who, 'select like_count from public.capsules where id = $1', [capsule]))[0]?.like_count;

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'la.like@x.com' });
    B = await h.signUp({ email: 'lb.like@x.com' });
    S = await h.signUp({ email: 'ls.like@x.com' });
    await h.befriend(A, B);
    priv = await h.capsule(A, { place: 'p1' });
    pub = await h.capsule(A, { place: 'p2' });
    await h.run(A, `update public.capsules set visibility = 'town' where id = $1`, [pub.id]);
  });
  after(() => h.close());

  test('new capsules start at 0; a friend likes once and everyone who sees the capsule sees the count', async () => {
    assert.equal(await count(A, priv.id), 0);
    await like(B, priv.id);
    assert.equal(await count(A, priv.id), 1);
    assert.equal(await count(B, priv.id), 1);
    await assert.rejects(like(B, priv.id), /duplicate key/);
    assert.equal(await count(A, priv.id), 1);
  });

  test('the owner can like their own capsule', async () => {
    await like(A, priv.id);
    assert.equal(await count(A, priv.id), 2);
  });

  test('only my own likes are visible, not who else liked (not even to the author)', async () => {
    const mine = async (who) => (await h.q(who, 'select capsule_id, user_id from public.capsule_likes')).map((r) => [r.capsule_id, r.user_id]);
    assert.deepEqual(await mine(A), [[priv.id, A]]);
    assert.deepEqual(await mine(B), [[priv.id, B]]);
    assert.deepEqual(await mine(S), []);
    await assert.rejects(h.q('anon', 'select * from public.capsule_likes'), DENIED);
  });

  test('strangers cannot like a capsule they cannot see, but can like a town capsule', async () => {
    await assert.rejects(like(S, priv.id), RLS);
    await assert.rejects(like(S, randomUUID()), RLS);
    await like(S, pub.id);
    assert.equal(await count(S, pub.id), 1);
    await assert.rejects(like('anon', pub.id), DENIED);
  });

  test('nobody likes in someone else’s name or sets the count directly', async () => {
    await assert.rejects(h.q(S, 'insert into public.capsule_likes (capsule_id, user_id) values ($1, $2)', [pub.id, B]), DENIED);
    await assert.rejects(h.q(A, 'update public.capsules set like_count = 100 where id = $1', [priv.id]), DENIED);
    await assert.rejects(h.q(B, 'update public.capsule_likes set capsule_id = $1', [pub.id]), DENIED);
    await assert.rejects(
      h.q(A, `insert into public.capsules (place_id, place_name, lat, lng, video_path, clip_duration, like_count)
              values ('p3', 'x', 0, 0, $1, 5, 100)`, [`${A}/forged.webm`]),
      DENIED,
    );
    await assert.rejects(h.q(A, 'select public.count_capsule_like()'), DENIED);
    assert.equal(await count(A, priv.id), 2);
  });

  test('unliking removes only my own like and lowers the count', async () => {
    assert.equal(await h.run(A, 'delete from public.capsule_likes where user_id = $1', [B]), 0);
    assert.equal(await unlike(B, priv.id), 1);
    assert.equal(await count(A, priv.id), 1);
    assert.equal(await unlike(B, priv.id), 0);
    assert.equal(await count(A, priv.id), 1);
  });

  test('after unfriending, the old like still counts and can still be taken back', async () => {
    await like(B, priv.id);
    await h.q(B, 'select public.remove_friend($1)', [A]);
    assert.equal(await count(A, priv.id), 2);
    assert.equal(await unlike(B, priv.id), 1);
    assert.equal(await count(A, priv.id), 1);
  });

  test('a deleted account’s likes disappear from the count', async () => {
    assert.equal(await count(A, pub.id), 1);
    await h.q('admin', 'delete from auth.users where id = $1', [S]);
    assert.equal(await count(A, pub.id), 0);
  });

  test('deleting a liked capsule removes its likes', async () => {
    assert.equal(await h.run(A, 'delete from public.capsules where id = $1', [priv.id]), 1);
    assert.deepEqual(await h.q('admin', 'select * from public.capsule_likes where capsule_id = $1', [priv.id]), []);
  });

  test('re-running the schema keeps likes and counts', async () => {
    await like(A, pub.id);
    await h.db.exec(schemaSql());
    assert.equal(await count(A, pub.id), 1);
    assert.equal(await unlike(A, pub.id), 1);
    assert.equal(await count(A, pub.id), 0);
  });
});

// ---------------------------------------------------------------------------
// R13 groups (그룹):
//   A–B, A–C, B–D are friends (B and C are not). A makes a group and invites B, C and D (D is not A's friend).
//   S is a stranger. Visits are counted per person per Korean day, like place_ranking.
describe('R13 groups', () => {
  let h, A, B, C, D, S, G;
  const F = [];
  const listGroups = (who) => h.q(who, 'select * from public.list_groups()');
  const map = async (who, group = G) =>
    (await h.q(who, 'select * from public.group_map($1)', [group])).map((r) => [r.place_id, r.user_id, r.visits, r.owner]);
  const invite = (who, targets, group = G) => h.q(who, 'select public.invite_to_group($1, $2) as n', [group, targets]);
  const members = async (group = G) =>
    (await h.q('admin', 'select user_id, status, color from public.group_members where group_id = $1 order by color', [group])).map(
      (r) => [r.user_id, r.status, r.color],
    );
  const backdate = (id, days) =>
    h.q('admin', `update public.capsules set created_at = now() - make_interval(days => $2) where id = $1`, [id, days]);
  const tag = (who, capsule, target) => h.q(who, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [capsule, target]);

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'ga.group@x.com' });
    B = await h.signUp({ email: 'gb.group@x.com' });
    C = await h.signUp({ email: 'gc.group@x.com' });
    D = await h.signUp({ email: 'gd.group@x.com' });
    S = await h.signUp({ email: 'gs.group@x.com' });
    await h.befriend(A, B);
    await h.befriend(A, C);
    await h.befriend(B, D);
    for (let i = 0; i < 6; i++) {
      F.push(await h.signUp({ email: `gf${i}.group@x.com` }));
      await h.befriend(A, F[i]);
    }

    // p1: A는 3일 전·오늘(2번), B는 5일 전·어제(2번) → 같은 2번이지만 B가 먼저 2번에 닿아서 B의 땅
    await backdate((await h.capsule(A, { place: 'p1' })).id, 3);
    await h.capsule(A, { place: 'p1' });
    await backdate((await h.capsule(B, { place: 'p1' })).id, 5);
    await backdate((await h.capsule(B, { place: 'p1' })).id, 1);
    // p2: A가 B를 태그한 영상 하나 → 둘 다 1번, 찍은 A의 땅. 같은 날 하나 더 남겨도 방문은 1번
    const together = await h.capsule(A, { place: 'p2' });
    await tag(A, together.id, B);
    await h.capsule(A, { place: 'p2' });
    // p3: C의 친구 공개 영상 (B와 C는 친구가 아니어도 그룹 지도에서는 숫자가 보인다)
    await h.capsule(C, { place: 'p3' });
    // p4: 그룹 밖 사람(S)의 방문은 세지 않는다
    await h.capsule(S, { place: 'p4' });
    // p5: 그룹 밖 D가 B를 태그 → B의 방문
    const fromD = await h.capsule(D, { place: 'p5' });
    await tag(D, fromD.id, B);

    G = (await h.q(A, 'select public.create_group($1, $2) as id', ['  월계 맛집 탐험대 ', [B, C, D, A, S]]))[0].id;
  });
  after(() => h.close());

  test('the creator is the first member; only their friends are invited, each with their own color', async () => {
    assert.deepEqual(await members(), [
      [A, 'member', 0],
      [B, 'invited', 1],
      [C, 'invited', 2],
    ]);
    assert.deepEqual(await h.q('admin', 'select name, created_by from public.groups where id = $1', [G]), [{ name: '월계 맛집 탐험대', created_by: A }]);
  });

  test('group names are 1–20 characters', async () => {
    await assert.rejects(h.q(A, 'select public.create_group($1)', ['   ']), /check constraint/);
    await assert.rejects(h.q(A, 'select public.create_group($1)', ['가'.repeat(21)]), /check constraint/);
  });

  test('anon and anonymous sign-ins cannot make or read groups', async () => {
    await assert.rejects(h.q('anon', `select public.create_group('x')`), DENIED);
    await assert.rejects(h.q('anon', 'select * from public.group_members'), DENIED);
    await assert.rejects(h.q({ id: S, anonymous: true }, `select public.create_group('x')`), /not authenticated/);
    assert.deepEqual(await map({ id: A, anonymous: true }), []);
  });

  test('members and invitees see the group and each other; strangers see nothing', async () => {
    const rows = await listGroups(B);
    assert.deepEqual(
      rows.map((r) => [r.group_id, r.name, r.user_id, r.status, r.color, r.invited_by]),
      [
        [G, '월계 맛집 탐험대', A, 'member', 0, null],
        [G, '월계 맛집 탐험대', B, 'invited', 1, A],
        [G, '월계 맛집 탐험대', C, 'invited', 2, A],
      ],
    );
    // B와 C는 친구가 아니어도 같은 그룹이라 서로의 프로필이 보인다
    assert.equal(rows.find((r) => r.user_id === C).username, 'gc.group');
    assert.equal((await h.q(B, 'select id from public.profiles where id = $1', [C])).length, 1);
    assert.deepEqual(await listGroups(S), []);
    assert.deepEqual(await listGroups(D), []);
    assert.deepEqual(await h.q(S, 'select * from public.groups'), []);
    assert.deepEqual(await h.q(D, 'select id from public.profiles where id = $1', [C]), []);
  });

  test('the map is only for members: invitees see it after accepting', async () => {
    assert.deepEqual(await map(B), []);
    assert.deepEqual(await map(S), []);
    // 아직 A 혼자라 A의 방문만
    assert.deepEqual(await map(A), [
      ['p1', A, 2, true],
      ['p2', A, 1, true],
    ]);
    await h.q(B, 'select public.accept_group_invite($1)', [G]);
    await h.q(C, 'select public.accept_group_invite($1)', [G]);
    await h.q(C, 'select public.accept_group_invite($1)', [G]); // 이미 그룹원이면 그대로
    await assert.rejects(h.q(S, 'select public.accept_group_invite($1)', [G]), /no invitation/);
  });

  test('each place goes to the member with the most visit days; ties go to whoever got there first, then to who filmed', async () => {
    const expected = [
      ['p1', B, 2, true],
      ['p1', A, 2, false],
      ['p2', A, 1, true],
      ['p2', B, 1, false],
      ['p3', C, 1, true],
      ['p5', B, 1, true],
    ];
    assert.deepEqual(await map(A), expected);
    assert.deepEqual(await map(B), expected);
    assert.deepEqual(await map(C), expected);
  });

  test('a new visit day takes the place over; the same day again does not', async () => {
    await h.capsule(A, { place: 'p3' });
    await h.capsule(A, { place: 'p3' });
    // A 1번 = C 1번이면 먼저 닿은 C가 지킨다
    assert.deepEqual((await map(B)).filter((r) => r[0] === 'p3'), [
      ['p3', C, 1, true],
      ['p3', A, 1, false],
    ]);
    await backdate((await h.capsule(A, { place: 'p3' })).id, 2);
    assert.deepEqual((await map(B)).filter((r) => r[0] === 'p3'), [
      ['p3', A, 2, true],
      ['p3', C, 1, false],
    ]);
  });

  test('only members invite, only their own friends, and at most 8 people with distinct colors', async () => {
    await assert.rejects(invite(S, [F[0]]), /not a group member/);
    await assert.rejects(invite({ id: A, anonymous: true }, [F[0]]), /not a group member/);
    // B는 F들과 친구가 아니라 아무도 초대되지 않는다. D는 B의 친구라 B가 초대할 수 있다
    assert.deepEqual(await invite(B, [F[0], F[1]]), [{ n: 0 }]);
    assert.deepEqual(await invite(B, [D]), [{ n: 1 }]);
    assert.deepEqual(await invite(A, [F[0], F[1], F[2], F[3]]), [{ n: 4 }]);
    assert.equal((await members()).length, 8);
    // 가득 차면 한 명도 초대되지 않는다 (일부만 들어가지 않음)
    await assert.rejects(invite(A, [F[4], F[5]]), /group is full/);
    assert.equal((await members()).length, 8);
    assert.deepEqual(new Set((await members()).map((m) => m[2])).size, 8);
  });

  test('a member cancels a pending invite; the freed color goes to the next invitee', async () => {
    const colorOf = async (id) => (await members()).find((m) => m[0] === id)?.[2];
    const freed = await colorOf(F[3]);
    await assert.rejects(h.q(S, 'select public.cancel_group_invite($1, $2)', [G, F[3]]), /not a group member/);
    await h.q(C, 'select public.cancel_group_invite($1, $2)', [G, F[3]]);
    // 그룹원은 초대 취소로 내보낼 수 없다
    await h.q(C, 'select public.cancel_group_invite($1, $2)', [G, A]);
    assert.equal(await colorOf(F[3]), undefined);
    assert.equal(await colorOf(A), 0);
    assert.deepEqual(await invite(A, [F[4]]), [{ n: 1 }]);
    assert.equal(await colorOf(F[4]), freed);
  });

  test('nobody writes the tables directly or calls the internal invite helper', async () => {
    await assert.rejects(h.q(S, 'insert into public.group_members (group_id, user_id, color) values ($1, $2, 7)', [G, S]), DENIED);
    await assert.rejects(h.q(F[0], `update public.group_members set status = 'member' where user_id = $1`, [F[0]]), DENIED);
    await assert.rejects(h.q(A, `update public.groups set name = 'x' where id = $1`, [G]), DENIED);
    await assert.rejects(h.q(A, 'delete from public.groups where id = $1', [G]), DENIED);
    await assert.rejects(h.q(A, 'select public.add_group_invites($1, $2)', [G, [F[5]]]), DENIED);
  });

  test('declining removes the invite; leaving removes my visits from the map', async () => {
    await h.q(F[0], 'select public.leave_group($1)', [G]);
    assert.equal((await members()).some((m) => m[0] === F[0]), false);
    await h.q(C, 'select public.leave_group($1)', [G]);
    assert.deepEqual(await map(C), []);
    assert.deepEqual((await map(A)).filter((r) => r[1] === C), []);
    assert.deepEqual(await listGroups(C), []);
    // 그룹 밖 사람이 불러도 아무 일 없다
    await h.q(S, 'select public.leave_group($1)', [G]);
    assert.ok((await members()).length > 0);
  });

  test('re-running the schema keeps groups', async () => {
    await h.db.exec(schemaSql());
    assert.equal((await listGroups(A)).length, (await members()).length);
  });

  test('when the last member leaves, the group and its pending invites are deleted', async () => {
    const pending = (await members()).filter((m) => m[1] === 'invited').map((m) => m[0]);
    assert.ok(pending.length > 0);
    await h.q(A, 'select public.leave_group($1)', [G]);
    assert.ok((await members()).length > 0);
    await h.q(B, 'select public.leave_group($1)', [G]);
    assert.deepEqual(await members(), []);
    assert.deepEqual(await h.q('admin', 'select id from public.groups where id = $1', [G]), []);
    assert.deepEqual(await listGroups(pending[0]), []);
  });
});

// ---------------------------------------------------------------------------
// R14 titles (칭호):
//   A–B and A–C are friends (B and C are not). D sent A a request that is still pending. S is a stranger.
//   Visits are counted per person per Korean day, like place_ranking and group_map; only places with 5+ visits are titles.
describe('R14 titles', () => {
  let h, A, B, C, D, S;
  const titles = async (who) =>
    (await h.q(who, 'select * from public.friend_titles()')).map((r) => [r.user_id, r.place_id, r.visits, r.pos]);
  const backdate = (id, days) =>
    h.q('admin', `update public.capsules set created_at = now() - make_interval(days => $2) where id = $1`, [id, days]);
  const visit = async (who, place, daysAgo, tagged = []) => {
    const c = await h.capsule(who, { place });
    for (const t of tagged) await h.q(who, 'insert into public.capsule_tags (capsule_id, user_id) values ($1, $2)', [c.id, t]);
    if (daysAgo) await backdate(c.id, daysAgo);
    return c;
  };

  before(async () => {
    h = await createDb();
    A = await h.signUp({ email: 'ta.title@x.com' });
    B = await h.signUp({ email: 'tb.title@x.com' });
    C = await h.signUp({ email: 'tc.title@x.com' });
    D = await h.signUp({ email: 'td.title@x.com' });
    S = await h.signUp({ email: 'ts.title@x.com' });
    await h.befriend(A, B);
    await h.befriend(A, C);
    await h.q(D, 'select public.request_friend($1)', [A]);

    // p1: A가 4일 전부터 오늘까지 5번. 오늘 하나 더 남겨도 방문은 5번
    for (const d of [4, 3, 2, 1, 0]) await visit(A, 'p1', d);
    await visit(A, 'p1', 0);
    // p2: B가 A를 태그해서 5일 전부터 어제까지 5번 → A·B 모두 5번. A는 p1보다 먼저 5번에 닿았다
    for (const d of [5, 4, 3, 2, 1]) await visit(B, 'p2', d, [A]);
    // p3: A가 4번 → 아직 칭호가 아니다
    for (const d of [3, 2, 1, 0]) await visit(A, 'p3', d);
    // p4: C가 5번, p5: 모르는 사람 S가 5번
    for (const d of [4, 3, 2, 1, 0]) await visit(C, 'p4', d);
    for (const d of [4, 3, 2, 1, 0]) await visit(S, 'p5', d);
  });
  after(() => h.close());

  test('I see the titles of myself and my friends only; ties go to the place reached first', async () => {
    // 사람 순서는 id 순이라 사람마다 묶어서 비교한다
    const of = async (who, person) => (await titles(who)).filter((r) => r[0] === person);
    const people = async (who) => [...new Set((await titles(who)).map((r) => r[0]))].sort();
    assert.deepEqual(await of(A, A), [
      [A, 'p2', 5, 1],
      [A, 'p1', 5, 2],
    ]);
    assert.deepEqual(await of(A, B), [[B, 'p2', 5, 1]]);
    assert.deepEqual(await of(A, C), [[C, 'p4', 5, 1]]);
    assert.deepEqual(await people(A), sorted([A, B, C]));
    // B와 C는 친구가 아니라서 서로의 칭호가 보이지 않는다
    assert.deepEqual(await people(B), sorted([A, B]));
    assert.deepEqual(await people(C), sorted([A, C]));
    assert.deepEqual(await of(B, A), await of(A, A));
  });

  test('pending requests and strangers do not see titles', async () => {
    assert.deepEqual(await titles(D), []);
    assert.deepEqual(await titles(S), [[S, 'p5', 5, 1]]);
  });

  test('anon cannot call it; anonymous sign-ins get nothing', async () => {
    await assert.rejects(h.q('anon', 'select * from public.friend_titles()'), DENIED);
    assert.deepEqual(await titles({ id: A, anonymous: true }), []);
  });

  test('a new visit day moves the title up; the same day again does not', async () => {
    await visit(A, 'p3', 0);
    assert.deepEqual((await titles(A)).filter((r) => r[0] === A && r[1] === 'p3'), []);
    await visit(A, 'p3', 6);
    assert.deepEqual((await titles(A)).filter((r) => r[0] === A && r[1] === 'p3'), [[A, 'p3', 5, 3]]);
    await visit(A, 'p1', 7);
    assert.deepEqual((await titles(A)).filter((r) => r[0] === A), [
      [A, 'p1', 6, 1],
      [A, 'p2', 5, 2],
      [A, 'p3', 5, 3],
    ]);
  });

  test('after unfriending, the titles disappear', async () => {
    await h.q(A, 'select public.remove_friend($1)', [C]);
    assert.deepEqual((await titles(A)).filter((r) => r[0] === C), []);
    assert.deepEqual((await titles(C)).filter((r) => r[0] === A), []);
  });
});
