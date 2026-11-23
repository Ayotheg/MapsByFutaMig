import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useSeo } from "../../lib/useSeo";
import { setTawkHidden } from "../../lib/tawk";
import { useAuth, friendlyError } from "../auth/useAuth";
import WaypointSearchPanel from "./WaypointSearchPanel";
import { submitPromotion } from "./submitPromotion";
import { fetchActivePromotion, activePromotionNotice } from "./activePromotion";
import {
  MIN_DAYS,
  MAX_DAYS,
  DEFAULT_DAYS,
  NAIRA_PER_DAY,
  MAX_PHOTOS,
  PROMO_DISCOUNT,
  computeAmount,
  formatNaira,
  isValidPromoCode,
  normalizePromoCode,
} from "./pricing";
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

// Desktop gets the two-column layout with the sticky summary card; below
// this width the page is a single column with a bottom checkout bar.
const DESKTOP_QUERY = "(min-width: 960px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// True while the on-screen keyboard is up. Focus alone isn't a reliable
// signal: on Android, closing the keyboard with the back gesture leaves the
// field focused, so a focus-based check kept the checkout bar hidden until
// focus happened to move (e.g. tapping the promo "Apply" button). The
// keyboard shrinks the visual viewport, so compare against the tallest
// height seen (reset on rotation). Returns null where visualViewport isn't
// supported, so the caller can fall back to focus.
function useKeyboardOpen() {
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" && window.visualViewport ? false : null,
  );
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    let tallest = vv.height;
    const update = () => {
      tallest = Math.max(tallest, vv.height);
      setOpen(vv.height < tallest * 0.75);
    };
    const onRotate = () => {
      tallest = vv.height;
      update();
    };
    vv.addEventListener("resize", update);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      vv.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", onRotate);
    };
  }, []);
  return open;
}

// Text-entry fields only — focusing the slider or a button doesn't open a keyboard.
function isTextField(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !["range", "file", "checkbox", "radio"].includes(el.type);
}

// ── Promote Your Business ───────────────────────────────────────────────
//
// Build pass from Figma (MAPSBYFUTA file, node 127:2, "PROMOTE"). Location
// (GPS read + waypoint search-pick) was wired first; this pass wires the
// rest: photo upload, the duration slider actually driving the charged
// amount (pricing.js), and "Proceed to checkout" submitting through
// submitPromotion.js → the create-promotion-checkout Edge Function →
// a real BACHS hosted-checkout redirect. See docs/payments.md
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
  const [detailsType, setDetailsType] = useState(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  // Set only while the coordinates came from picking an existing place in
  // WaypointSearchPanel. Approving then promotes THAT pin instead of adding
  // a duplicate one at the same spot (supabase/promotions_dedupe_ranking.sql).
  const [pickedWaypointId, setPickedWaypointId] = useState(null);
  const [locStatus, setLocStatus] = useState(null); // { text, error } | null
  const [mapSearchOpen, setMapSearchOpen] = useState(false);
  const [photos, setPhotos] = useState([]); // { id, file, previewUrl }[]
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [contactPlatform, setContactPlatform] = useState("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const isDesktop = useIsDesktop();
  // True while a text field has focus. Only used to hide the mobile
  // checkout bar where the keyboard itself can't be detected.
  const [typing, setTyping] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const hideMobileBar = keyboardOpen ?? typing;
  // Optional promo code. `promoInput` is what's typed; `appliedPromo` is only
  // set once Apply accepts a valid code, and is what checkout actually sends.
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState(null);
  // One ad per account at a time (activePromotion.js). While one is live or
  // waiting for approval, checkout is blocked and a notice explains why.
  const [activePromo, setActivePromo] = useState(null);
  const userId = auth.user?.id;

  useEffect(() => {
    if (!userId) {
      setActivePromo(null);
      return undefined;
    }
    let cancelled = false;
    fetchActivePromotion(userId).then((result) => {
      if (!cancelled) setActivePromo(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activePromoNotice = activePromotionNotice(activePromo);

  // Returning from the payment provider with the browser's Back button.
  //
  // handleCheckout() leaves `submitting` true on purpose when it succeeds
  // (the page is about to be replaced by BACHS's hosted checkout). But
  // browsers keep this page in the back/forward cache (bfcache) when it's
  // navigated away from, so pressing Back restores the page *frozen exactly
  // as it was* — React state included — with no remount and no re-run of
  // any effect. `submitting` is still true, so the button keeps showing
  // "Starting checkout…" and spinning forever, whether the payment went
  // through or was abandoned. `pageshow` with `event.persisted === true`
  // is the one signal that fires in that case, so reset the in-flight
  // state there. (A normal, non-cached load starts from fresh state and
  // never hits this.)
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        setSubmitting(false);
        setSubmitError(null);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const activePlatform = useMemo(
    () => CONTACT_PLATFORMS.find((p) => p.id === contactPlatform) ?? CONTACT_PLATFORMS[0],
    [contactPlatform],
  );

  const fullPrice = useMemo(() => computeAmount(days), [days]);
  const totalPrice = useMemo(() => computeAmount(days, appliedPromo), [days, appliedPromo]);
  const sliderPct = useMemo(
    () => ((days - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * 100,
    [days],
  );

  function handleFieldFocus(e) {
    if (isTextField(e.target)) setTyping(true);
  }

  function handleFieldBlur(e) {
    // Moving focus straight from one text field to another keeps it true.
    if (isTextField(e.target) && !isTextField(e.relatedTarget)) setTyping(false);
  }

  function handleApplyPromo() {
    const code = normalizePromoCode(promoInput);
    if (!code) {
      setPromoError(null);
      return;
    }
    if (isValidPromoCode(code)) {
      setAppliedPromo(code);
      setPromoError(null);
    } else {
      setAppliedPromo(null);
      setPromoError("That promo code isn't valid.");
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  }

  function handleListingTypeChange(type) {
    if (listingType === type) {
      setListingType(null);
      if (type === "physical") setMapSearchOpen(false);
      return;
    }
    setListingType(type);
    setDetailsType(type);
    if (type !== "physical") setMapSearchOpen(false);
  }

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
        setPickedWaypointId(null);
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
    setPickedWaypointId(entry.id);
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

    // Re-check right before paying: another tab or device may have started
    // an ad since this page loaded.
    const latest = await fetchActivePromotion(auth.user.id);
    setActivePromo(latest);
    if (activePromotionNotice(latest)) {
      setSubmitting(false);
      return;
    }

    try {
      const { checkoutUrl } = await submitPromotion({
        userId: auth.user.id,
        businessName,
        description,
        listingType,
        lat,
        lng,
        existingWaypointId: pickedWaypointId,
        contactPlatform,
        contactValue,
        days,
        photos,
        promoCode: appliedPromo,
      });
      window.location.href = checkoutUrl; // full redirect — BACHS's hosted checkout, not an in-app modal
    } catch (e) {
      setSubmitError(e.message || "Could not start checkout. Please try again.");
      setSubmitting(false);
    }
    // No `finally { setSubmitting(false) }` on the success path on purpose
    // — the browser is about to navigate away to BACHS, so leaving the
    // button disabled/spinning until that navigation actually happens
    // is correct, not a bug. If the person comes back via the browser's
    // Back button (bfcache restore), the `pageshow` listener above resets
    // `submitting` so the button doesn't stay stuck.
  }

  // Promo field + checkout button render in the desktop summary card or in
  // the mobile campaign card / bottom bar — one copy at a time (never both),
  // so there's only ever one #promote-promo input in the DOM.
  const promoBlock = (
    <div className={styles.promoBlock}>
      {appliedPromo ? (
        <div className={styles.promoApplied}>
          <CheckCircle2 size={16} strokeWidth={2} />
          <span className={styles.promoAppliedText}>
            <strong>{appliedPromo}</strong> applied · {Math.round(PROMO_DISCOUNT * 100)}% off
          </span>
          <button
            type="button"
            className={styles.promoRemoveBtn}
            onClick={handleRemovePromo}
            aria-label="Remove promo code"
          >
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
      ) : (
        <div className={styles.promoRow}>
          <label htmlFor="promote-promo" className={styles.srOnly}>
            Promo code (optional)
          </label>
          <input
            id="promote-promo"
            type="text"
            className={styles.promoInput}
            placeholder="Promo code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={promoInput}
            onChange={(e) => {
              setPromoInput(e.target.value);
              if (promoError) setPromoError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyPromo();
              }
            }}
          />
          <button
            type="button"
            className={styles.promoApplyBtn}
            onClick={handleApplyPromo}
            disabled={!promoInput.trim()}
          >
            Apply
          </button>
        </div>
      )}
      {promoError && (
        <div className={`${styles.locStatus} ${styles.locStatusError}`}>{promoError}</div>
      )}
    </div>
  );

  // Shown next to the checkout button too, so a blocked tap never looks like
  // it did nothing.
  const submitErrorBanner = (submitError || activePromoNotice) && (
    <div className={`${styles.locStatus} ${styles.locStatusError}`} role="alert">
      <AlertCircle size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "-2px" }} />
      {submitError || activePromoNotice}
    </div>
  );

  const checkoutButton = (
    <button
      type="button"
      className={styles.checkoutBtn}
      onClick={handleCheckout}
      disabled={submitting || !!activePromoNotice}
      aria-busy={submitting}
    >
      <span>{submitting ? "Starting checkout…" : "Continue to checkout"}</span>
      {submitting ? (
        <Loader2 size={16} strokeWidth={2.5} className={styles.spinner} />
      ) : (
        <ArrowRight size={16} strokeWidth={2.5} />
      )}
    </button>
  );

  // "Secured by BACHS" stands on its own as a trust signal, and Cancel is
  // a quiet text option set apart from it. Anyone on this page is here to
  // pay, so leaving shouldn't compete with the checkout button.
  const footerRow = (
    <div className={styles.footerRow}>
      <span className={styles.securedRow}>
        <ShieldCheck size={14} strokeWidth={2} />
        <span>
          Secured by <strong>BACHS</strong>
        </span>
      </span>
      <button
        type="button"
        className={styles.cancelLink}
        onClick={() => navigate(-1)}
        disabled={submitting}
      >
        Cancel and go back
      </button>
    </div>
  );

  // Photo grid: the "Add photo" tile, each chosen photo, then empty
  // placeholder tiles so the row reads as "room for more". Desktop fills
  // to 3 trailing tiles, mobile to 2 (the 3rd placeholder is desktop-only).
  const placeholderCount = Math.max(0, 3 - photos.length);

  // Live-chat bubble (lib/tawk.js) sits just above the mobile checkout bar.
  // It steps aside while the person is filling in the form (keyboard up) or
  // has the map search / sign-in open, so it never covers a field or
  // competes with the Checkout button for attention.
  // Between 960px and ~1210px wide the sticky summary card (with the desktop
  // Checkout button) reaches into the bubble's corner, so it's hidden there.
  const narrowDesktop = useMediaQuery("(min-width: 960px) and (max-width: 1219px)");
  const hideChat = authModalOpen || mapSearchOpen || narrowDesktop || (!isDesktop && hideMobileBar);
  useEffect(() => {
    setTawkHidden("promote-busy", hideChat);
    return () => setTawkHidden("promote-busy", false);
  }, [hideChat]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <span className={styles.backCircle}>
              <ArrowLeft size={18} strokeWidth={2} />
            </span>
            <span className={styles.backLabel}>Back</span>
          </button>
          {/* Business | Event switch to /event — desktop only. */}
          {isDesktop && (
            <nav className={styles.listingToggle} aria-label="What are you listing?">
              <span className={`${styles.listingToggleBtn} ${styles.listingToggleBtnActive}`} aria-current="page">
                Business
              </span>
              <Link to="/event" replace className={styles.listingToggleBtn}>
                Event
              </Link>
            </nav>
          )}
          <span className={styles.stepLabel}>Step 1 of 2</span>
        </header>

        <div className={styles.layout}>
          <main className={styles.formCol}>
            <div className={styles.titleBlock}>
              <span className={styles.eyebrow}>Promote</span>
              <h1 className={styles.title}>Put your business in front of FUTA.</h1>
              <p className={styles.subtitle}>
                Thousands of students and campus explorers, every day.
              </p>
            </div>

            {activePromoNotice && (
              <div className={`${styles.locStatus} ${styles.locStatusError}`} role="status">
                <AlertCircle size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                {activePromoNotice}
              </div>
            )}

            {showCancelledNotice && (
              <div className={`${styles.locStatus} ${styles.locStatusError}`}>
                <AlertCircle size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                Checkout was cancelled — nothing was charged. Your details below are still filled in,
                so you can just try again.
              </div>
            )}

            <form
              className={styles.form}
              onSubmit={(e) => e.preventDefault()}
              onFocus={handleFieldFocus}
              onBlur={handleFieldBlur}
            >
              {/* Business name */}
              <div className={styles.field}>
                <label htmlFor="promote-name" className={styles.fieldLabel}>
                  Business name
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
              <div className={styles.field}>
                <label htmlFor="promote-desc" className={styles.fieldLabel}>
                  Description <span className={styles.fieldLabelHint}>· optional</span>
                </label>
                <textarea
                  id="promote-desc"
                  className={styles.fieldTextarea}
                  placeholder="A line or two about what you offer"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Type selector */}
              <div className={styles.section}>
                <span className={styles.fieldLabel}>Type</span>
                <div className={styles.typeSwitch} role="tablist" aria-label="Listing type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listingType === "physical"}
                    className={`${styles.typeBtn} ${listingType === "physical" ? styles.typeBtnActive : ""}`}
                    onClick={() => handleListingTypeChange("physical")}
                  >
                    Physical shop
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listingType === "online"}
                    className={`${styles.typeBtn} ${listingType === "online" ? styles.typeBtnActive : ""}`}
                    onClick={() => handleListingTypeChange("online")}
                  >
                    Online store
                  </button>
                </div>

                <div
                  className={`${styles.typeDetailsRegion} ${listingType ? styles.typeDetailsRegionOpen : ""}`}
                  aria-hidden={listingType === null}
                  inert={listingType === null}
                  onTransitionEnd={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      event.propertyName === "grid-template-rows" &&
                      listingType === null
                    ) {
                      setDetailsType(null);
                    }
                  }}
                >
                  <div className={styles.typeDetailsInner}>
                    {/* Location — Physical Shop only. */}
                    {detailsType === "physical" && (
                      <div className={styles.detailsSection}>
                        <div className={styles.noticeBanner}>
                          <Info size={15} strokeWidth={2} className={styles.noticeIcon} />
                          <p className={styles.noticeText}>
                            You must be physically present at your shop location
                            right now to map your student pin.
                          </p>
                        </div>

                        <div className={styles.locationHeadingRow}>
                          <span className={styles.fieldLabel}>Location</span>
                          <MapPin size={14} strokeWidth={2} className={styles.locationHeadingIcon} />
                        </div>

                        <div className={styles.locationRow}>
                          <button
                            type="button"
                            className={styles.locBtn}
                            onClick={handleUseGps}
                          >
                            <Navigation size={17} strokeWidth={2} />
                            <span>Use current GPS</span>
                          </button>
                          <button
                            type="button"
                            className={styles.locBtn}
                            onClick={() => setMapSearchOpen((v) => !v)}
                            aria-expanded={mapSearchOpen}
                          >
                            <Search size={17} strokeWidth={2} />
                            <span>Search on map</span>
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

                    {/* Contact — Online Store only. */}
                    {detailsType === "online" && (
                      <div className={styles.detailsSection}>
                        <div className={styles.rowHeadingWithHint}>
                          <span className={styles.fieldLabel}>Platform</span>
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
                          <label htmlFor="promote-contact" className={styles.fieldLabel}>
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
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className={styles.section}>
                <div className={styles.rowHeadingWithHint}>
                  <span className={styles.fieldLabel}>Photos</span>
                  <span className={styles.hintText}>JPG or PNG · up to {MAX_PHOTOS}</span>
                </div>

                <div className={styles.photoGrid}>
                  <button
                    type="button"
                    className={styles.addPhotoTile}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photos.length >= MAX_PHOTOS}
                  >
                    {photos.length >= MAX_PHOTOS ? (
                      <span>{MAX_PHOTOS} of {MAX_PHOTOS} added</span>
                    ) : (
                      <>
                        <Plus size={22} strokeWidth={1.75} />
                        <span>Add photo</span>
                      </>
                    )}
                  </button>
                  {photos.map((p) => (
                    <div key={p.id} className={styles.photoTile}>
                      <img src={p.previewUrl} alt="" className={styles.photoTileImg} />
                      <button
                        type="button"
                        className={styles.photoRemove}
                        onClick={() => removePhoto(p.id)}
                        aria-label="Remove photo"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: placeholderCount }, (_, i) => (
                    <div
                      key={`empty-${i}`}
                      className={`${styles.photoTileEmpty} ${photos.length + i === 2 ? styles.desktopOnly : ""}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className={styles.hiddenFileInput}
                  onChange={handleFilesSelected}
                />
              </div>

              {/* Campaign length — a plain section on desktop (the summary
                  card carries price + promo), a card with price + promo on
                  mobile. */}
              <div className={styles.campaignCard}>
                <div className={styles.campaignHeader}>
                  <span className={styles.fieldLabel}>Campaign length</span>
                  {!isDesktop && <span className={styles.reachLabel}>Daily student reach</span>}
                  {isDesktop && (
                    <span className={styles.daysValue}>
                      <span className={styles.daysNumber}>{days}</span>{" "}
                      {days === 1 ? "day" : "days"}
                    </span>
                  )}
                </div>

                {!isDesktop && (
                  <div className={styles.campaignValueRow}>
                    <span className={styles.daysValue}>
                      <span className={styles.daysNumber}>{days}</span>{" "}
                      {days === 1 ? "day" : "days"}
                    </span>
                    <span className={styles.campaignPrice}>
                      <span className={styles.campaignTotal}>
                        {appliedPromo && (
                          <s className={styles.priceOld}>{formatNaira(fullPrice)}</s>
                        )}
                        {formatNaira(totalPrice)}
                      </span>
                      <span className={styles.campaignRate}>{formatNaira(NAIRA_PER_DAY)} per day</span>
                    </span>
                  </div>
                )}

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
                  <span>1 day</span>
                  <span>15</span>
                  <span>30 days</span>
                </div>

                {!isDesktop && (
                  <>
                    <hr className={styles.divider} />
                    {promoBlock}
                  </>
                )}
              </div>

              {!isDesktop && (
                <>
                  {submitErrorBanner}
                  {footerRow}
                </>
              )}
            </form>
          </main>

          {isDesktop && (
            <aside className={styles.summaryCol}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryHeader}>
                  <span className={styles.fieldLabel}>Summary</span>
                  <span className={styles.reachLabel}>Daily student reach</span>
                </div>

                <dl className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <dt>Campaign length</dt>
                    <dd>{days} {days === 1 ? "day" : "days"}</dd>
                  </div>
                  <div className={styles.summaryRow}>
                    <dt>Rate</dt>
                    <dd>{formatNaira(NAIRA_PER_DAY)} / day</dd>
                  </div>
                  {appliedPromo && (
                    <div className={`${styles.summaryRow} ${styles.summaryRowDiscount}`}>
                      <dt>Promo ({Math.round(PROMO_DISCOUNT * 100)}% off)</dt>
                      <dd>−{formatNaira(fullPrice - totalPrice)}</dd>
                    </div>
                  )}
                </dl>

                <hr className={styles.divider} />

                {promoBlock}

                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalValue}>
                    {appliedPromo && <s className={styles.priceOld}>{formatNaira(fullPrice)}</s>}
                    {formatNaira(totalPrice)}
                  </span>
                </div>

                {submitErrorBanner}
                {checkoutButton}
                {footerRow}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile checkout bar. Hidden while the on-screen keyboard is up so
          it doesn't cover the field being typed in. Fixed to the bottom and
          hidden by sliding away, never removed from the layout, so showing
          or hiding it doesn't make the page jump. */}
      {!isDesktop && (
        <div
          className={`${styles.mobileBar} ${hideMobileBar ? styles.mobileBarHidden : ""}`}
          aria-hidden={hideMobileBar || undefined}
        >
          <div className={styles.mobileBarTotal}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.mobileBarValue}>{formatNaira(totalPrice)}</span>
          </div>
          {checkoutButton}
        </div>
      )}

      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            initialTab="signin"
            user={auth.user}
            onClose={() => setAuthModalOpen(false)}
            signInWithGoogle={auth.signInWithGoogle}
            signInWithEmail={auth.signInWithEmail}
            signUpWithEmail={auth.signUpWithEmail}
            checkEmailStatus={auth.checkEmailStatus}
            resetPassword={auth.resetPassword}
            verifyRecoveryCode={auth.verifyRecoveryCode}
            setNewPassword={auth.setNewPassword}
            signOut={auth.signOut}
            friendlyError={friendlyError}
            message="Sign in to promote your business — this ties your payment and listing to your account so you can track its status."
          />
        </Suspense>
      )}
    </div>
  );
}
