import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

test('claims atomically record history and reject stale, paused, and duplicate observations', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema.replace(/^create extension.*;$/gm, ''));
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/202610220001_reliable_evaluation.sql', import.meta.url),
        'utf8',
      ),
    );
    const user = '00000000-0000-4000-8000-000000000001';
    await db.query('insert into auth.users values ($1)', [user]);
    async function trigger(recurring = false) {
      return (
        await db.query(
          `insert into triggers (user_id, raw_prompt, domain, recurring)
        values ($1, 'test', 'crypto', $2) returning id`,
          [user, recurring],
        )
      ).rows[0].id;
    }
    const claim = (id, previous = null, payload = { body: 'match' }) =>
      db.query('select record_trigger_check($1, $2, $3, $4) as event_id', [
        id,
        previous,
        { value: 1 },
        payload,
      ]);
    const once = await trigger();
    assert.ok((await claim(once)).rows[0].event_id);
    assert.equal((await claim(once)).rows[0].event_id, null);
    assert.equal(
      (await db.query('select status from triggers where id=$1', [once])).rows[0].status,
      'fired',
    );
    const recurring = await trigger(true);
    const claims = await Promise.all([claim(recurring), claim(recurring)]);
    assert.equal(claims.filter((r) => r.rows[0].event_id).length, 1);
    const previous = (
      await db.query('select last_checked_at::text as stamp from triggers where id=$1', [recurring])
    ).rows[0].stamp;
    assert.ok((await claim(recurring, previous)).rows[0].event_id);
    await db.query("update triggers set status='paused' where id=$1", [recurring]);
    assert.equal((await claim(recurring, previous)).rows[0].event_id, null);
    const quiet = await trigger();
    assert.equal((await claim(quiet, null, null)).rows[0].event_id, null);
    assert.equal((await db.query('select count(*)::int as n from trigger_events')).rows[0].n, 3);
    const rollback = await trigger();
    await db.exec(
      "alter table trigger_events add constraint reject_test check (payload->>'body' <> 'reject');",
    );
    await assert.rejects(claim(rollback, null, { body: 'reject' }));
    const unchanged = (
      await db.query('select status,last_checked_at from triggers where id=$1', [rollback])
    ).rows[0];
    assert.deepEqual(unchanged, { status: 'active', last_checked_at: null });
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated', 'record_trigger_check(uuid,timestamptz,jsonb,jsonb)', 'execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
