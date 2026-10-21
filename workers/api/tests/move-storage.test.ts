/** The cutover's storage step (scripts/move-storage.ts): what is copied to R2, and the addresses rewritten. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingObject, storagePlan } from '../scripts/move-storage.ts';

const SUPABASE = 'https://wtuujmeinzqfikvuofmh.supabase.co/storage/v1/object/public';
const API = 'https://api.copticvine.ca';

test('Supabase Storage addresses move to cv-api, their objects copied once; anything else is left', () => {
  const plan = storagePlan([
    { id: 'u1', image: `${SUPABASE}/profile-avatars/u1/avatar?v=1700000000000`, raw_user_meta_data: JSON.stringify({ full_name: 'A', chc_avatar_url: `${SUPABASE}/profile-avatars/u1/avatar?v=1700000000000` }) },
    { id: "u'2", image: 'https://lh3.googleusercontent.com/a/photo', raw_user_meta_data: JSON.stringify({ picture: 'https://lh3.googleusercontent.com/a/photo' }) },
    { id: 'u3', image: null, raw_user_meta_data: '{}' },
  ], [
    { id: 'c1', path: `${SUPABASE}/playlist-covers/u1/p1/cover` },
    { id: 'c2', path: 'https://cdn.example/elsewhere.jpg' },
  ], `${API}/`);
  assert.deepEqual(plan.copies, [
    { from: `${SUPABASE}/profile-avatars/u1/avatar`, key: 'profile-avatars/u1/avatar' },
    { from: `${SUPABASE}/playlist-covers/u1/p1/cover`, key: 'playlist-covers/u1/p1/cover' },
  ]);
  assert.deepEqual(plan.sql, [
    `UPDATE "auth.users" SET "image" = '${API}/storage/v1/object/public/profile-avatars/u1/avatar?v=1700000000000', "raw_user_meta_data" = json_set("raw_user_meta_data", '$.chc_avatar_url', '${API}/storage/v1/object/public/profile-avatars/u1/avatar?v=1700000000000') WHERE "id" = 'u1';`,
    `UPDATE "media.media_assets" SET "path" = '${API}/storage/v1/object/public/playlist-covers/u1/p1/cover' WHERE "id" = 'c1';`,
  ]);
});

test('an object already gone from Supabase is skipped, not a failure; anything else stops the copy', () => {
  // Supabase's answer for a missing object, as it gave it on 21 Oct 2026.
  assert.equal(missingObject(400, '{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}'), true);
  assert.equal(missingObject(404, ''), true);
  assert.equal(missingObject(400, '{"statusCode":"400","error":"InvalidKey","message":"Invalid key"}'), false);
  assert.equal(missingObject(400, 'not json'), false);
  assert.equal(missingObject(500, '{"statusCode":"404"}'), false);
});
