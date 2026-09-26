import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Camera,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useSeo } from "../../lib/useSeo";
import { useAuth, friendlyError } from "../auth/useAuth";
import WaypointSearchPanel from "./WaypointSearchPanel";
import { submitPromotion } from "./submitPromotion";
import { MIN_DAYS, MAX_DAYS, DEFAULT_DAYS, NAIRA_PER_DAY, MAX_PHOTOS, formatNaira } from "./pricing";
import styles from "./PromotePage.module.css";

// AuthModal is a full sign-in/sign-up surface, not needed for this page's
// first paint — lazy-loaded per CLAUDE.md's bundle-size policy (a modal
// that only mounts once the person tries to check out signed-out), the
// exact pattern the policy's own header comment prescribes. **Real,
// build-confirmed limitation, not silently ignored:** `npm run build`
// reports `[INEFFECTIVE_DYNAMIC_IMPORT]` here — MapPage.jsx already
// imports AuthModal statically (Slice 10 never made it lazy, despite
// CLAUDE.md listing it as a candidate), so it's already sitting in the
// main/shared chunk and this `lazy()` currently buys nothing on a visit
// that also loads /map. It's the correct code for THIS page in
// isolation (someone landing straight on /promote without ever visiting
// /map would still get the split), and it costs nothing to leave in —
// but the real fix is making MapPage.jsx's own AuthModal import lazy
// too, which is out of this slice's scope (touches a different page).
const AuthModal = lazy(() => import("../auth/AuthModal"));

// ── Promote Your Business ───────────────────────────────────────────────
//
// Build pass from Figma (MAPSBYFUTA file, node 127:2, "PROMOTE"). Location
// (GPS read + waypoint search-pick) was wired first; this pass wires the
// rest: photo upload, the duration slider actually driving the charged
// amount (pricing.js), and "Proceed to checkout" submitting through
// submitPromotion.js → the create-promotion-checkout Edge Function →
// a real BACHS hosted-checkout redirect. See PROMOTE_PAYMENT_INTEGRATION.md
// for the full payment architecture (Edge Functions, webhook, schema).
//
// Deliberately NOT this pass's job: what happens to a *paid* promotion —
// the admin review/approve queue, and pushing an approved Physical Shop
// into `waypoints`/onto the map vs. an approved Online Store rendering as
// a link-out card on Explore. That's a separate, not-yet-written doc and
// slice (the "admin issue"), same "payment first, admin after" split the
// person asked for — `promotions.status` stays at 'awaiting_payment' →
// 'pending_review' (set by the webhook) and goes no further from this
// page's own code.
//
// Route: /promote. Standalone full page (not a modal/sheet like
// SuggestWaypointModal), so it gets its own sticky header with a back
// button instead of a shell-provided close affordance.
//
//   - "Use Current GPS" is the exact same one-shot
//     `navigator.geolocation.getCurrentPosition` call Suggest uses (not
//     `useGpsTracking.js`'s continuous tracker — that's bound to the
//     Leaflet map ref, not a reusable single-shot getter).
//   - "Search on Map" opens `WaypointSearchPanel` (same file's folder),
//     which searches the existing `useWaypoints()` database in-place and
//     lets the person pick one of their own already-pinned waypoints —
//     no map instance needed here at all. This replaced an earlier
//     cross-route "Pick on Map" (navigate to `/map`, wait for a click,
//     navigate back — see MapPage.jsx history/git blame for the removed
//     `externalPick` plumbing) now that promoting a listing is expected
//     to almost always be for a place that's already on the map.

// Online Store's contact picker — these are businesses giving customers a
// way to reach them, not a "join our channel" link. WhatsApp/Telegram/
// Instagram each get their real-world short prefix (wa.me/, t.me/,
// instagram.com/) so the business only has to type the number or handle;
// "Other" stays a plain free-text field for anything else (a Facebook
// page, a phone number, a different app). No brand glyphs for these in
// lucide-react, so this reuses the app's existing fallback-icon approach
// (MessageCircle for WhatsApp — same call already made for the WhatsApp
// footer/Explore links; Send for Telegram's paper-plane mark; AtSign for
// Instagram's @handle).
const CONTACT_PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    Icon: MessageCircle,
    prefix: "wa.me/",
    fieldLabel: "WhatsApp Number",
    placeholder: "2348012345678",
  },
  {
    id: "telegram",
    label: "Telegram",
    Icon: Send,
    prefix: "t.me/",
    fieldLabel: "Telegram Username",
    placeholder: "yourusername",
  },
  {
    id: "instagram",
    label: "Instagram",
    Icon: AtSign,
    prefix: "instagram.com/",
    fieldLabel: "Instagram Handle",
    placeholder: "yourhandle",
  },
  {
    id: "other",
    label: "Other",
    Icon: Link2,
    prefix: null,
    fieldLabel: "Link or Phone Number",
    placeholder: "Paste a link, or drop a phone number",
  },
];

export default function PromotePage() {
  useSeo({
    title: "Promote Your Business – Maps By FUTA",
    robots: "noindex, nofollow",
  });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  // BACHS's cancel_url (create-promotion-checkout Edge Function) points
  // back here with `?cancelled=1` — the person's draft promotion row is
  // left sitting at status:'awaiting_payment'/payment_status:'unpaid';
  // nothing to clean up client-side, just let them know and retry.
  const showCancelledNotice = searchParams.get("cancelled") === "1";

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  // Neither pill is pre-selected — the Location / Contact sections below
  // only drop down once the person actually picks a type.
  const [listingType, setListingType] = useState(null); // null | 'physical' | 'online'
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locStatus, setLocStatus] = useState(null); // { text, error } | null
  const [mapSearchOpen, setMapSearchOpen] = useState(false);
  const [photos, setPhotos] = useState([]); // { id, file, previewUrl }[]
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [contactPlatform, setContactPlatform] = useState("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const activePlatform = useMemo(
    () => CONTACT_PLATFORMS.find((p) => p.id === contactPlatform) ?? CONTACT_PLATFORMS[0],
    [contactPlatform],
  );

  const totalPrice = useMemo(() => days * NAIRA_PER_DAY, [days]);
  const sliderPct = useMemo(
    () => ((days - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * 100,
    [days],
  );

  function handleUseGps() {
    if (!navigator.geolocation) {
      setLocStatus({ text: "GPS is not available on this device.", error: true });
      return;
    }
    setLocStatus({ text: "Getting your location…", error: false });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocStatus(null);
      },
      (err) => {
        setLocStatus({ text: `Couldn't get your location: ${err.message}`, error: true });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Selecting a result in WaypointSearchPanel — same "coordinates already
  // exist ⇒ show the banner" endpoint the old cross-route pick reached,
  // just fed directly instead of via router state.
  function handleWaypointPicked(entry) {
    setLat(entry.lat.toFixed(6));
    setLng(entry.lng.toFixed(6));
    setLocStatus(null);
    setMapSearchOpen(false);
  }

  function handleFilesSelected(e) {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;
    setPhotos((prev) => {
      const room = Math.max(0, MAX_PHOTOS - prev.length);
      const accepted = incoming.slice(0, room).map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...accepted];
    });
    // allow re-selecting the same file after removal
    e.target.value = "";
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // "Proceed to checkout" — the payment half of this screen. Everything
  // upstream of this point (name/description/type/location/contact/
  // photos/duration) was already visual-only real state; this is the one
  // new wire: package it, hand off to submitPromotion.js (validates,
  // uploads photos, inserts the `promotions` row, calls the
  // create-promotion-checkout Edge Function), then do a full-page
  // redirect to whatever BACHS hosted-checkout URL comes back — same
  // "hosted redirect, no card data touches this app" shape the
  // `Secured by BACHS` badge below already promises.
  async function handleCheckout() {
    if (submitting) return;

    if (!auth.user) {
      // Same "open AuthModal with an explanatory message" pattern
      // SuggestWaypointModal's entry points use for a signed-out click —
      // a promotion has to be tied to an account (submitted_by, RLS-
      // enforced) both so the person can see its status later and so
      // BACHS's webhook has someone to notify.
      setAuthModalOpen(true);
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      const { checkoutUrl } = await submitPromotion({
        userId: auth.user.id,
        businessName,
        description,
        listingType,
        lat,
        lng,
        contactPlatform,
        contactValue,
        days,
        photos,
      });
      window.location.href = checkoutUrl; // full redirect — BACHS's hosted checkout, not an in-app modal
    } catch (e) {
      setSubmitError(e.message || "Could not start checkout. Please try again.");
      setSubmitting(false);
    }
    // No `finally { setSubmitting(false) }` on the success path on purpose
    // — the browser is about to navigate away to BACHS, so leaving the
    // button disabled/spinning until that navigation actually happens
    // is correct, not a bug.
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={16} strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Promote Your Business</h1>
            <p className={styles.subtitle}>
              Reach thousands of FUTA students and campus explorers daily.
            </p>
          </div>

          {showCancelledNotice && (
            <div className={`${styles.locStatus} ${styles.locStatusError}`} style={{ marginBottom: 16 }}>
              <AlertCircle size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "-2px" }} />
              Checkout was cancelled — nothing was charged. Your details below are still filled in,
              so you can just try again.
            </div>
          )}

          <form
            className={styles.form}
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Business name */}
            <div className={styles.fieldCard}>
              <label htmlFor="promote-name" className={styles.fieldLabel}>
                Business Name
              </label>
              <input
                id="promote-name"
                type="text"
                className={styles.fieldInput}
                placeholder="e.g. Debby’s Fragrances"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className={styles.fieldCard}>
              <label htmlFor="promote-desc" className={styles.fieldLabel}>
                Description (optional)
              </label>
              <textarea
                id="promote-desc"
                className={styles.fieldTextarea}
                placeholder="Brief details about your product"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Type selector */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Type</span>
              <div className={styles.typeSwitch} role="tablist" aria-label="Listing type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={listingType === "physical"}
                  className={`${styles.typeBtn} ${listingType === "physical" ? styles.typeBtnActive : ""}`}
                  onClick={() => setListingType("physical")}
                >
                  Physical Shop
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={listingType === "online"}
                  className={`${styles.typeBtn} ${listingType === "online" ? styles.typeBtnActive : ""}`}
                  onClick={() => setListingType("online")}
                >
                  Online Store
                </button>
              </div>
            </div>

            {/* Location — Physical Shop only, hidden until that pill is
                actually clicked (not just the default). */}
            {listingType === "physical" && (
              <div className={`${styles.section} ${styles.reveal}`}>
                <div className={styles.noticeBanner}>
                  <Info size={15} strokeWidth={2} className={styles.noticeIcon} />
                  <p className={styles.noticeText}>
                    You must be physically present at your shop location
                    right now to map your student pin.
                  </p>
                </div>

                <div className={styles.locationHeadingRow}>
                  <span className={styles.sectionLabel}>Location</span>
                  <MapPin size={15} strokeWidth={2} className={styles.locationHeadingIcon} />
                </div>

                <div className={styles.locationRow}>
                  <button
                    type="button"
                    className={styles.locBtn}
                    onClick={handleUseGps}
                  >
                    <Navigation size={18} strokeWidth={2} />
                    <span>Use Current GPS</span>
                  </button>
                  <button
                    type="button"
                    className={styles.locBtn}
                    onClick={() => setMapSearchOpen((v) => !v)}
                    aria-expanded={mapSearchOpen}
                  >
                    <Search size={18} strokeWidth={2} />
                    <span>Search on Map</span>
                  </button>
                </div>

                {mapSearchOpen && (
                  <WaypointSearchPanel
                    onSelect={handleWaypointPicked}
                    onClose={() => setMapSearchOpen(false)}
                  />
                )}

                {lat !== "" && lng !== "" && (
                  <div className={styles.coordBanner}>
                    <CheckCircle2 size={16} strokeWidth={2} />
                    <span>
                      Coordinates selected ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})
                    </span>
                  </div>
                )}

                {locStatus && (
                  <div className={`${styles.locStatus} ${locStatus.error ? styles.locStatusError : ""}`}>
                    {locStatus.text}
                  </div>
                )}
              </div>
            )}

            {/* Contact — Online Store only. Same drop-down-on-click
                behavior as Location above. A prefixed field (wa.me/,
                t.me/, instagram.com/) for the three named platforms, and
                a plain free-text field for anything else. */}
            {listingType === "online" && (
              <div className={`${styles.section} ${styles.reveal}`}>
                <div className={styles.rowHeadingWithHint}>
                  <span className={styles.sectionLabel}>Platform</span>
                  <span className={styles.hintText}>Sets the prefix &amp; icon</span>
                </div>

                <div className={styles.platformRow} role="tablist" aria-label="Contact platform">
                  {CONTACT_PLATFORMS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={contactPlatform === id}
                      className={`${styles.platformBtn} ${contactPlatform === id ? styles.platformBtnActive : ""}`}
                      onClick={() => setContactPlatform(id)}
                    >
                      <Icon size={15} strokeWidth={2} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.rowHeadingWithHint}>
                  <label htmlFor="promote-contact" className={styles.sectionLabel}>
                    {activePlatform.fieldLabel} <span className={styles.required}>*</span>
                  </label>
                  <span className={styles.hintText}>How customers reach you</span>
                </div>

                <div className={styles.linkInputWrap}>
                  {activePlatform.prefix ? (
                    <span className={styles.linkPrefix}>{activePlatform.prefix}</span>
                  ) : (
                    <Link2 size={15} strokeWidth={2} className={styles.linkInputIcon} />
                  )}
                  <input
                    id="promote-contact"
                    type="text"
                    inputMode={activePlatform.id === "whatsapp" ? "tel" : "text"}
                    className={styles.linkInput}
                    placeholder={activePlatform.placeholder}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Photos */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Photos</span>

              <button
                type="button"
                className={styles.dropzone}
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
              >
                <span className={styles.dropzoneIconBadge}>
                  <Camera size={20} strokeWidth={2} />
                </span>
                <span className={styles.dropzoneTextWrap}>
                  <span className={styles.dropzoneTitle}>
                    Tap to upload a photo
                  </span>
                  <span className={styles.dropzoneHint}>
                    JPG, PNG — up to {MAX_PHOTOS} photos
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                multiple
                className={styles.hiddenFileInput}
                onChange={handleFilesSelected}
              />

              {photos.length > 0 && (
                <div className={styles.photoChipRow}>
                  {photos.map((p) => (
                    <div key={p.id} className={styles.photoChip}>
                      <img src={p.previewUrl} alt="" className={styles.photoChipImg} />
                      <button
                        type="button"
                        className={styles.photoChipRemove}
                        onClick={() => removePhoto(p.id)}
                        aria-label="Remove photo"
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Campaign duration */}
            <div className={styles.durationCard}>
              <div className={styles.durationHeader}>
                <span className={styles.durationTitle}>Campaign Duration</span>
                <span className={styles.durationReach}>Daily Student Reach</span>
              </div>

              <div className={styles.durationValueRow}>
                <span className={styles.durationDays}>{days} Day{days === 1 ? "" : "s"}</span>
                <span className={styles.durationPrice}>
                  {formatNaira(totalPrice)}{" "}
                  <span className={styles.durationPerDay}>
                    • ~{formatNaira(NAIRA_PER_DAY)}/day
                  </span>
                </span>
              </div>

              <input
                type="range"
                min={MIN_DAYS}
                max={MAX_DAYS}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className={styles.durationSlider}
                style={{ "--pct": `${sliderPct}%` }}
                aria-label="Campaign duration in days"
              />

              <div className={styles.durationTicks}>
                <span>1 Day</span>
                <span>15 Days</span>
                <span>30 Days</span>
              </div>
            </div>

            {/* Bottom actions */}
            <div className={styles.actions}>
              {submitError && (
                <div className={`${styles.locStatus} ${styles.locStatusError}`}>
                  <AlertCircle size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                  {submitError}
                </div>
              )}

              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.checkoutBtn}
                  onClick={handleCheckout}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  <span>{submitting ? "Starting checkout…" : "Proceed to checkout"}</span>
                  {submitting ? (
                    <Loader2 size={14} strokeWidth={2.5} className={styles.spinner} />
                  ) : (
                    <ArrowRight size={14} strokeWidth={2.5} />
                  )}
                </button>
              </div>

              <div className={styles.securedRow}>
                <ShieldCheck size={14} strokeWidth={2} />
                <span>
                  Secured by <strong>BACHS</strong>
                </span>
              </div>
            </div>
          </form>
        </div>
      </main>

      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            initialTab="signin"
            user={auth.user}
            onClose={() => setAuthModalOpen(false)}
            signInWithGoogle={auth.signInWithGoogle}
            signInWithEmail={auth.signInWithEmail}
            signUpWithEmail={auth.signUpWithEmail}
            resetPassword={auth.resetPassword}
            signOut={auth.signOut}
            friendlyError={friendlyError}
            message="Sign in to promote your business — this ties your payment and listing to your account so you can track its status."
          />
        </Suspense>
      )}
    </div>
  );
}
