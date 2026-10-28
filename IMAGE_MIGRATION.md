# Moving place photos from Supabase Storage to Cloudflare R2

Only the **photos** move. The database, sign-in, Edge Functions and Resend email all stay on Supabase.
The `storage_path` values in your tables don't change, so no database rows are edited.

## Why the bandwidth keeps growing

- Uploads never set a cache lifetime, so Supabase applies its 1-hour default. Phones and the CDN keep re-fetching the same photo.
- Compress-on-upload only helps photos uploaded since it shipped. Older photos can still be several MB.
- `public/sw.js` refuses to cache any photo over 800 KB, so those big old photos are downloaded again on every visit.
- Free plan = 5 GB of cached egress per cycle. Every student opening a place card spends from it.

R2 has no egress fees (10 GB storage, 1M writes, 10M reads free per month), and its custom domain sits behind Cloudflare's CDN. Traffic can grow without any bandwidth bill or cap.

## Steps

### 0. Back up first (nothing in Supabase is changed)
```
npm i -D aws4fetch            # once, for the migration script
export SUPABASE_URL=https://vzjlarvtssybglwzfrhi.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...      # Dashboard → Project Settings → API. Don't commit it.
node scripts/backupPlaceImages.mjs --dry-run      # file count + total MB, downloads nothing
node scripts/backupPlaceImages.mjs                # → ./place-images-backup  (resumable)
```
Keep that folder. It is a complete copy of every photo, and it is also the source for step 3.

### 1. Cloudflare R2
1. Create a free Cloudflare account → **R2** → create bucket `mbf-place-images`.
2. **Settings → Custom Domains** → add `img.mapsbyfuta.xyz`. This needs `mapsbyfuta.xyz` on Cloudflare DNS (free plan). Re-create your existing Vercel records there first, then change the nameservers at your registrar.
   If you'd rather not move DNS, use Bunny.net Storage + CDN (about $1/month) instead; the scripts need small changes.
   Don't use the `r2.dev` URL in production: it is rate-limited and not CDN-cached.
3. **Settings → CORS policy**:
```json
[{
  "AllowedOrigins": ["https://mapsbyfuta.xyz", "https://www.mapsbyfuta.xyz", "https://localhost", "http://localhost:5173"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 86400
}]
```
   (`https://localhost` is the Android app's origin. The service worker fetches photos in CORS mode, so this is required.)
4. **R2 → Manage API tokens** → create a token with *Object Read & Write*, limited to this bucket. Note the Account ID, Access Key ID and Secret.

### 2. Copy the photos to R2
```
export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=mbf-place-images
node scripts/migrateImagesToR2.mjs --dry-run
node scripts/migrateImagesToR2.mjs
```
Photos over ~900 KB are shrunk to the app's upload budget (1600 px, under ~800 KB, EXIF rotation applied). Pass `--no-recompress` to copy byte-for-byte. The script ends by checking that every file is in R2. Open a few `https://img.mapsbyfuta.xyz/<storage_path>` URLs in a browser and check the response headers show `cf-cache-status` and `cache-control: …immutable`.

### 3. Upload function
```
supabase functions deploy image-upload
supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=mbf-place-images
```
It enforces the same rules as today's storage policies (signed-in users: `waypoint/`, `promotion/`, `event/`; admins: any folder, overwrite, delete) plus a 2 MB cap and an image-type check. SVG uploads are no longer accepted.

### 4. Switch the app over
- Vercel → Environment Variables → `VITE_IMAGE_CDN_URL=https://img.mapsbyfuta.xyz` → redeploy.
- Use a different domain? Change `PHOTO_CDN_HOST` in `public/sw.js` too.
- Android app: put the same variable in the env used by `npm run cap:sync`, then ship a new Play release.
- Test: add a place photo as a normal user, see it on the map, delete it as admin.

### 5. Retire the Supabase copy (not before ~4 weeks)
Old Android builds and cached pages still point at Supabase. Watch **Reports → Storage** in the dashboard. When cached egress is near zero, set the `place-images` bucket to private or delete its files. Photos uploaded after step 4 exist only in R2, so rolling back later means copying them back first.

## Not done here (worth doing next)
- A ~480 px thumbnail variant for place cards and lists. They currently load the 1600 px photo, which costs students mobile data even when hosting is free.
