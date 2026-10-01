// Proves the access rules R1-R6 of supabase/schema.sql against an in-memory Postgres.
// Run with: npm run test:db
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDb, schemaSql, DENIED, RLS } from './helpers.mjs';

const hex6 = (id) => id.replace(/-/g, '').slice(0, 6);
const sorted = (xs) => [...xs].sort();
// anon has no table privileges at all (revoked), so its reads/writes fail with "permission denied"
const PATH_RULE = /row-level security|check constraint/i;

// ---------------------------------------------------------------------------
describe('schema loading', () => {
  test('schema.sql runs twice in a row without error', async () => {
    const h = await createDb({ runs: 2 });
    const policies = await h.q('admin', `select count(*)::int as n from pg_policies where schemaname in ('public', 'storage')`);
    // 12 table policies + 4 "block anonymous" restrictive policies + 5 storage policies
    assert.equal(policies[0].n, 21);
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

  test('profile is created on sign-up from the email local part (lowercase, [a-z0-9._], max 13)', async () => {
    const id = await h.signUp({ email: 'Kim.Seong_Jun+tag@Gmail.com' });
    const p = await h.profile(id);
    assert.equal(p.username, 'kim.seong_jun');
    assert.equal(p.display_name, 'Kim.Seong_Jun+tag');
    assert.equal(p.avatar_url, null);
  });

  test('username collision appends _ + first 6 hex chars of the user id', async () => {
    const id = await h.signUp({ email: 'kim.seong_jun@naver.com' });
    const p = await h.profile(id);
    assert.equal(p.username, 'kim.seong_jun_' + hex6(id));
  });

  test('collision on a 13-char truncated base still fits the username rule', async () => {
    const a = await h.signUp({ email: 'abcdefghijklmnopqrstuvwxyz@x.com' });
    const b = await h.signUp({ email: 'ABCDEFGHIJKLMzzz@y.com' });
    assert.equal((await h.profile(a)).username, 'abcdefghijklm');
    assert.equal((await h.profile(b)).username, 'abcdefghijklm_' + hex6(b));
  });

  test('Korean / too-short local parts fall back to "user"', async () => {
    const k = await h.signUp({ email: '김철수@kakao.com', meta: { nickname: '철수' } });
    const pk = await h.profile(k);
    assert.equal(pk.username, 'user');
    assert.equal(pk.display_name, '철수');

    const s = await h.signUp({ email: 'ab@x.com' });
    const ps = await h.profile(s);
    assert.equal(ps.username, 'user_' + hex6(s));
    assert.equal(ps.display_name, 'ab');
  });

  test('sign-up never fails when the "_<6 hex>" fallback username is itself taken', async () => {
    // "user" is taken (by the Korean-email user above); someone already owns "user_abc123"
    // (an email local part, or a rename). A new user without usable email whose id starts
    // with abc123 must still get a profile, otherwise the auth.users insert (= login) fails.
    const squatter = await h.signUp({ email: 'user_abc123@x.com' });
    assert.equal((await h.profile(squatter)).username, 'user_abc123');
    const id = 'abc12300-0000-4000-8000-000000000001';
    await h.signUp({ id, email: null, meta: { nickname: '늦게온사람' } });
    const p = await h.profile(id);
    assert.ok(p, 'profile row must exist');
    assert.match(p.username, /^[a-z0-9._]{3,20}$/);
    assert.notEqual(p.username, 'user_abc123');
  });

  test('users without email (Kakao without consent) still get a profile', async () => {
    const n = await h.signUp({ email: null, meta: { nickname: '카카오친구', picture: 'http://k/p.png' } });
    const pn = await h.profile(n);
    assert.equal(pn.username, 'user_' + hex6(n));
    assert.equal(pn.display_name, '카카오친구');
    assert.equal(pn.avatar_url, 'https://k/p.png'); // Kakao sends http:// avatars; stored as https

    const bare = await h.signUp({ email: null, meta: null });
    const pb = await h.profile(bare);
    assert.match(pb.username, /^user_[0-9a-f]{6}$/);
    assert.equal(pb.display_name, '친구');
    assert.equal(pb.avatar_url, null);
  });

  test('display_name priority full_name > name > nickname > user_name, empty strings skipped', async () => {
    const cases = [
      [{ full_name: 'F', name: 'N', nickname: 'K', user_name: 'U' }, 'F'],
      [{ full_name: '', name: 'N', nickname: 'K', user_name: 'U' }, 'N'],
      [{ nickname: 'K', user_name: 'U' }, 'K'],
      [{ user_name: 'U' }, 'U'],
      [{ full_name: '' }, 'localpart'],
    ];
    for (const [meta, expected] of cases) {
      const id = await h.signUp({ email: 'localpart@x.com', meta });
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
    assert.equal((await h.profile(other)).display_name, 'victim');
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

  test('nobody can update a capsule, not even the owner', async () => {
    await assert.rejects(h.q(A, `update public.capsules set place_name = 'x' where id = $1`, [cap.id]), DENIED);
    await assert.rejects(h.q(B, `update public.capsules set place_name = 'x' where id = $1`, [cap.id]), DENIED);
    await assert.rejects(h.q(A, `update public.capsules set video_path = $2 where id = $1`, [cap.id, bcap.video]), DENIED);
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
    assert.deepEqual(await h.q(anonUser, 'select name from storage.objects'), []);
    assert.deepEqual(await h.q(anonUser, `select * from public.search_profiles('hard')`), []);
  });

  test('anonymous sign-ins cannot write: friend requests, capsules, uploads, profile edits', async () => {
    await assert.rejects(h.q(anonUser, 'select public.request_friend($1)', [A]), RLS);
    await assert.rejects(
      h.q(anonUser, `insert into public.capsules (place_id, place_name, lat, lng, video_path, clip_duration)
                     values ('p', 'x', 0, 0, $1, 5)`, [`${anonUser.id}/v.webm`]),
      RLS,
    );
    await assert.rejects(h.upload(anonUser, `${anonUser.id}/v.webm`), RLS);
    assert.equal(await h.run(anonUser, `update public.profiles set display_name = 'spam' where id = $1`, [anonUser.id]), 0);
  });

  test('a real account still works next to the restrictive policies', async () => {
    assert.deepEqual(await h.visibleCapsules(B), [cap.id]);
    assert.deepEqual(await h.visibleObjects(B), [cap.video]);
  });

  test('TRUNCATE and other bulk privileges are revoked from anon and authenticated', async () => {
    for (const t of ['profiles', 'friendships', 'capsules', 'capsule_tags']) {
      await assert.rejects(h.q(A, `truncate public.${t} cascade`), DENIED, `authenticated truncate ${t}`);
      await assert.rejects(h.q('anon', `truncate public.${t} cascade`), DENIED, `anon truncate ${t}`);
    }
    assert.equal((await h.q('admin', 'select count(*)::int as n from public.capsules'))[0].n, 1);
  });

  test('handle_new_user absorbs a username race (row with the same username inserted first)', async () => {
    // simulate the loser of a race: "racer" is already taken by the time the trigger inserts
    await h.signUp({ email: 'racer@x.com' });
    const id = await h.signUp({ email: 'racer@y.com' });
    assert.equal((await h.profile(id)).username, 'racer_' + hex6(id));
  });
});
