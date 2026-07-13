# Firebase → Supabase migration guide
### Maps By FUTA — Firestore data, Storage, and Auth

This is grounded in your actual legacy `app.js` (not guessed), and your
actual Firestore data from the screenshot. Read the "Important finding"
section before doing anything else — it changes the Storage step.

---

## Important finding: there is no Firebase Storage to migrate

I checked `app.js` for `firebase.storage`, `getStorage`, `storageRef`,
`uploadBytes` — **zero matches.** Every `imageUrls` entry (on both
`segments` and `waypoints`) is a **base64 data URI stored directly in
the Firestore document**, produced by `FileReader.readAsDataURL()` and
re-compressed client-side to stay under ~900KB
(`app.js` lines 2071–2116, 3874–3900).

This matters because:

- The official ["Firebase Storage → Supabase Storage"](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-storage)
  guide **doesn't apply** — there's no Storage bucket to download from.
- Instead, migrating images means: pull the base64 strings out of the
  exported Firestore JSON, decode them, upload each as a real file to
  a **Supabase Storage** bucket, and replace the field with the
  resulting URL. Code for this is in Step 4 below.
- This is also your chance to fix the anti-pattern itself — base64 in
  a document blows up document size and query cost. After migration,
  the app should store an actual uploaded file + URL, not a data URI.
  Slice 2 and Slice 4's frontend work should upload files directly to
  Supabase Storage going forward, never re-introduce base64-in-row.

---

## What your Firestore data actually looks like

Confirmed by reading the save logic in `app.js`, not just the
screenshot:

**`segments` collection** (`app.js` lines 2233–2260):
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `description` | string | |
| `category` | string | e.g. `"road"` |
| `points` | array | `{ lat, lng, accuracy, speed, timestamp }` — `timestamp` is `Date.now()`, ms epoch |
| `waypoints` | array | embedded copy of waypoints recorded during this route |
| `imageUrls` | array of strings | **base64 data URIs**, see above |
| `distance` | number | metres (`totalDistance`, a running sum — same units as `route.distance` at line 4536, commented `// metres`) |
| `duration` | number | **milliseconds** (`Date.now() - recStartTime`, confirmed at line 2249) |
| `recordedAt` | Firestore server timestamp | |

**`waypoints` collection** (`app.js` lines 2256, 3435, 4034):
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `desc` | string | ⚠️ inconsistent naming vs. segments' `description` — see decision below |
| `type` | string | place category (church, mosque, shop, etc. — your Slice 3 legend categories) |
| `lat`, `lng` | number | |
| `imageUrls` | array of strings | base64, same as above |
| `sourceType` | string | `'gps_annotation'` \| `'osm_import'` — some older docs (route-recorded ones, line 2256) have **no `sourceType` at all** |
| `segmentId` | string, optional | present when this waypoint was auto-saved from a route recording |
| `segmentName` | string, optional | denormalized copy of the segment's name |
| `savedAt` | Firestore server timestamp | |

**Decision to confirm before you migrate:** I'd rename `desc` →
`description` for consistency across tables, and drop the denormalized
`segmentName` (just join to `segments.name` via `segment_id` instead —
that's the whole point of a relational database). Neither of these
touches app *behavior*, just internal field naming in a schema you're
rebuilding anyway, so nothing in the legacy frontend logic depends on
it surviving. Flag if you'd rather keep the original names.

---

## Step 0 — Design the Postgres schema first

Do this *before* running any import tool. Firestore is a document
store; Postgres is relational — a straight 1:1 dump gives you `jsonb`
soup, not a usable schema. Run this in the Supabase SQL Editor
(Dashboard → SQL Editor) to create the target tables. This matches the
`waypoints`/`waypoint_images` and `segments`/`segment_images` naming
your `MIGRATION_PLAN.md` already commits to for Slices 2 and 4.

```sql
-- Preserve original Firestore doc IDs as primary keys (text, not uuid).
-- This keeps existing FK references (segmentId on waypoints) valid
-- across the migration without a remapping pass.

create table segments (
  id            text primary key,           -- Firestore doc id
  name          text not null,
  description   text,
  category      text,
  distance_m    double precision,           -- metres
  duration_ms   bigint,                     -- milliseconds
  recorded_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table segment_points (
  id          bigserial primary key,
  segment_id  text not null references segments(id) on delete cascade,
  seq         int not null,                  -- point order within the route
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  speed       double precision,
  recorded_at timestamptz                    -- from the point's `timestamp` (ms epoch)
);

create table segment_images (
  id          bigserial primary key,
  segment_id  text not null references segments(id) on delete cascade,
  storage_path text not null,                -- path within the Supabase bucket
  position    int default 0
);

create table waypoints (
  id            text primary key,            -- Firestore doc id
  name          text not null,
  description   text,                        -- was `desc` in Firestore
  type          text,                        -- place category
  lat           double precision not null,
  lng           double precision not null,
  source_type   text,                        -- 'gps_annotation' | 'osm_import' | null
  segment_id    text references segments(id) on delete set null,
  saved_at      timestamptz,
  created_at    timestamptz not null default now()
);

create table waypoint_images (
  id            bigserial primary key,
  waypoint_id   text not null references waypoints(id) on delete cascade,
  storage_path  text not null,
  position      int default 0
);

-- RLS: enable now, add real policies when Slice 2/10 need them.
-- Service-role (used by the import scripts below) bypasses RLS entirely,
-- so this doesn't block the migration itself.
alter table segments enable row level security;
alter table segment_points enable row level security;
alter table segment_images enable row level security;
alter table waypoints enable row level security;
alter table waypoint_images enable row level security;
```

Then create a Storage bucket for the images: Dashboard → Storage →
New bucket. Name it e.g. `place-images`. Leave it non-public for now
unless you know you want direct public URLs (you can flip this later).

---

## Step 1 — Get what you need from Firebase

1. Log in to the [Firebase Console](https://console.firebase.google.com/project) → open the project.
2. Gear icon (next to Project Overview) → **Project Settings** → **Service Accounts** tab → **Firebase Admin SDK**.
3. Click **Generate new private key** → downloads a JSON file. Rename it to `firebase-service.json`. Treat this like a password — it's full admin access to your Firebase project.

That one file is all you need from Firebase for the data + auth migration steps below.

---

## Step 2 — Get what you need from Supabase

You need two different sets of credentials for two different tools:

**A. Direct Postgres connection** (for the data-migration tool):
1. Supabase Dashboard → your project → **Connect** button (top of dashboard).
2. Under **Session pooler**, click **View parameters**.
3. Note the `Host` and `User` values.
4. You'll also need your database password — the one you set when creating the project (Dashboard → Project Settings → Database → you can reset it there if you don't have it).

**B. API URL + service_role key** (for the image-upload script):
1. Dashboard → **Project Settings** → **API**.
2. Copy the **Project URL**.
3. Copy the **service_role** (secret) key — not the `anon` key. This bypasses RLS, which is what you want for a bulk import script. Never ship this key to a browser/frontend.

---

## Step 3 — Export + import the relational data

Supabase maintains an official tool for exactly this:
[`supabase-community/firebase-to-supabase`](https://github.com/supabase-community/firebase-to-supabase).

```bash
git clone https://github.com/supabase-community/firebase-to-supabase.git
cd firebase-to-supabase/firestore
npm install
```

Drop your `firebase-service.json` (from Step 1) into this `firestore/` folder.

Create `supabase-service.json` in the same folder, using the Step 2A values:

```json
{
  "host": "aws-0-xx-xxxx-1.pooler.supabase.com",
  "password": "your-db-password",
  "user": "postgres.xxxxxxxxxxxx",
  "database": "postgres",
  "port": 5432
}
```

Dump each collection to JSON:

```bash
node collections.js              # sanity check: lists all collections
node firestore2json.js segments
node firestore2json.js waypoints
```

This gives you `segments.json` and `waypoints.json`, each a flat array
of documents (nested arrays like `points`/`imageUrls` still nested
inside, untouched).

### Flattening — this is the part that needs custom hooks

The generic tool imports one collection → one table, flattened. Your
`points` and `imageUrls` arrays need to become rows in
`segment_points`/`segment_images` instead. Supabase's tool supports
this via a **hook file** — create `segments.js` right there in the
`firestore/` folder:

```js
// firestore/segments.js
module.exports = (collectionName, doc, recordCounters, writeRecord) => {
  // Split `points` into segment_points rows
  (doc.points || []).forEach((p, i) => {
    writeRecord('segment_points', {
      segment_id: doc.id,
      seq: i,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      speed: p.speed,
      recorded_at: p.timestamp ? new Date(p.timestamp).toISOString() : null,
    }, recordCounters);
  });

  // imageUrls (base64) get pulled out and handled by the separate
  // image-upload script in Step 4 — just tag them here for now so
  // that script knows which segment they belong to.
  (doc.imageUrls || []).forEach((dataUri, i) => {
    writeRecord('segment_images_pending', {
      segment_id: doc.id,
      position: i,
      data_uri: dataUri,
    }, recordCounters);
  });

  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    category: doc.category,
    distance_m: doc.distance,
    duration_ms: doc.duration,
    recorded_at: doc.recordedAt?._seconds
      ? new Date(doc.recordedAt._seconds * 1000).toISOString()
      : null,
  };
};
```

Same idea for `waypoints.js` (rename `desc` → `description`, drop
`segmentName`, tag images into `waypoint_images_pending`):

```js
// firestore/waypoints.js
module.exports = (collectionName, doc, recordCounters, writeRecord) => {
  (doc.imageUrls || []).forEach((dataUri, i) => {
    writeRecord('waypoint_images_pending', {
      waypoint_id: doc.id,
      position: i,
      data_uri: dataUri,
    }, recordCounters);
  });

  return {
    id: doc.id,
    name: doc.name,
    description: doc.desc,
    type: doc.type,
    lat: doc.lat,
    lng: doc.lng,
    source_type: doc.sourceType || null,
    segment_id: doc.segmentId || null,
    saved_at: doc.savedAt?._seconds
      ? new Date(doc.savedAt._seconds * 1000).toISOString()
      : null,
  };
};
```

Re-run the dump so the hooks apply:

```bash
node firestore2json.js segments
node firestore2json.js waypoints
```

You'll now have: `segments.json`, `waypoints.json`,
`segment_points.json`, `segment_images_pending.json`,
`waypoint_images_pending.json`.

### Importing into your already-created schema

One caveat worth knowing: the tool's own `json2supabase.js` will try
to **create** the target table from the JSON shape if it doesn't
recognize it — since you already created proper typed tables with
foreign keys in Step 0, let it insert into what exists rather than
risk it fighting your schema. The safest path:

```bash
node json2supabase.js ./segments.json
node json2supabase.js ./waypoints.json
node json2supabase.js ./segment_points.json
```

Check the rows it inserted against what you created in Step 0
(`\d segments` in `psql`, or the Table Editor in the Dashboard) — if
column types don't line up cleanly, it's usually simpler to write a
short custom Node script using `@supabase/supabase-js` and `.insert()`
in batches instead of fighting the generic tool. Given you already
know your exact target schema, that's honestly the more predictable
option — the generic tool is optimized for "I don't know my schema
yet," which isn't your situation.

---

## Step 4 — Images: decode base64 → real files in Supabase Storage

This is the step none of the generic guides cover, because it's
specific to how your app stores images. Run this after Step 3, using
the `*_images_pending.json` files:

```js
// upload-images.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'YOUR_SUPABASE_PROJECT_URL',      // Step 2B
  'YOUR_SERVICE_ROLE_KEY'           // Step 2B — never expose this client-side
);

async function uploadPending(jsonFile, table, fkColumn, imagesTable) {
  const pending = JSON.parse(fs.readFileSync(jsonFile));

  for (const row of pending) {
    const [, meta, base64] = row.data_uri.match(/^data:(.+);base64,(.+)$/);
    const ext = meta.split('/')[1] || 'jpg';
    const buffer = Buffer.from(base64, 'base64');
    const path = `${table}/${row[fkColumn]}/${row.position}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('place-images')
      .upload(path, buffer, { contentType: meta, upsert: true });

    if (uploadError) {
      console.error(`Failed: ${path}`, uploadError.message);
      continue;
    }

    const { error: insertError } = await supabase
      .from(imagesTable)
      .insert({ [fkColumn]: row[fkColumn], storage_path: path, position: row.position });

    if (insertError) console.error(`DB insert failed: ${path}`, insertError.message);
  }
}

(async () => {
  await uploadPending('./segment_images_pending.json', 'segments', 'segment_id', 'segment_images');
  await uploadPending('./waypoint_images_pending.json', 'waypoints', 'waypoint_id', 'waypoint_images');
  console.log('Done.');
})();
```

```bash
npm install @supabase/supabase-js
node upload-images.js
```

Run this from wherever you saved the `*_images_pending.json` files —
same folder as Step 3's output is simplest.

---

## Step 5 — Auth (only needed once you actually start Slice 10)

Not urgent yet, but here's what it needs so you're not blocked later.
Same official tool, `auth/` folder this time:

```bash
cd ../auth
npm install
```

Same `firebase-service.json` and `supabase-service.json` as before,
copied into this folder.

One extra thing Auth needs that data migration didn't: Firebase's
password hash parameters, so existing users can log in with their
current password instead of everyone getting a forced reset.

1. Firebase Console → **Authentication** → **Users** tab.
2. Top-right, 3-dot menu → **Password hash parameters**.
3. Save `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`.

```bash
node firestoreusers2json.js
node import_users.js ./users.json
```

Google OAuth users don't have a password hash to migrate — they'll
just need the Google OAuth client re-registered under Supabase Auth
(already noted in `CLAUDE.md`'s Slice 10 entry).

---

## Verification checklist

- [ ] Row counts match: Firestore collection doc count == Postgres table row count (`select count(*) from segments;` vs. Firestore console's collection count)
- [ ] Spot-check 2–3 segments: `distance_m`/`duration_ms` values match what the legacy app displayed for that same segment
- [ ] `segment_points` rows for one segment, ordered by `seq`, redraw the same route shape
- [ ] A handful of `segment_images`/`waypoint_images` open correctly from their Storage URL
- [ ] `waypoints.segment_id` correctly links back for the ones that came from a route recording; the rest are `null`
- [ ] RLS is enabled on all five tables (queries from the anon/authenticated key should currently return nothing until Slice 2/10 add real policies — that's expected, not a bug)

## Reference links

- [Migrate Firestore Data (official)](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data)
- [Migrate Firebase Auth (official)](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth)
- [Migrate Firebase Storage (official — not applicable here, see note at top)](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-storage)
- [`firebase-to-supabase` tool source](https://github.com/supabase-community/firebase-to-supabase)
