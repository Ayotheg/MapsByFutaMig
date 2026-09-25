import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Camera,
  Info,
  Link2,
  Map,
  MapPin,
  MessageCircle,
  Navigation,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useSeo } from "../../lib/useSeo";
import styles from "./PromotePage.module.css";

// ── Promote Your Business ───────────────────────────────────────────────
//
// Build-only pass from Figma (MAPSBYFUTA file, node 127:2, "PROMOTE") —
// visual structure + light in-page interaction (type toggle, duration
// slider, photo preview chips, location-mode highlight) only. Nothing
// here talks to Supabase yet: no submission, no GPS read, no map-picker,
// no photo upload, no checkout. That's the next pass, once this screen
// is signed off.
//
// Route: /promote. Standalone full page (not a modal/sheet like
// SuggestWaypointModal), so it gets its own sticky header with a back
// button instead of a shell-provided close affordance.

const MIN_DAYS = 1;
const MAX_DAYS = 30;
const DEFAULT_DAYS = 7;
const NAIRA_PER_DAY = 500;
const MAX_PHOTOS = 5;

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

function formatNaira(amount) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default function PromotePage() {
  useSeo({
    title: "Promote Your Business – Maps By FUTA",
    robots: "noindex, nofollow",
  });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  // Neither pill is pre-selected — the Location / Contact sections below
  // only drop down once the person actually picks a type.
  const [listingType, setListingType] = useState(null); // null | 'physical' | 'online'
  const [locationMode, setLocationMode] = useState(null); // 'gps' | 'map' | null
  const [photos, setPhotos] = useState([]); // { id, file, previewUrl }[]
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [contactPlatform, setContactPlatform] = useState("whatsapp");
  const [contactValue, setContactValue] = useState("");

  const activePlatform = useMemo(
    () => CONTACT_PLATFORMS.find((p) => p.id === contactPlatform) ?? CONTACT_PLATFORMS[0],
    [contactPlatform],
  );

  const totalPrice = useMemo(() => days * NAIRA_PER_DAY, [days]);
  const sliderPct = useMemo(
    () => ((days - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * 100,
    [days],
  );

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
                    className={`${styles.locBtn} ${locationMode === "gps" ? styles.locBtnActive : ""}`}
                    onClick={() => setLocationMode("gps")}
                  >
                    <Navigation size={18} strokeWidth={2} />
                    <span>Use Current GPS</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.locBtn} ${locationMode === "map" ? styles.locBtnActive : ""}`}
                    onClick={() => setLocationMode("map")}
                  >
                    <Map size={18} strokeWidth={2} />
                    <span>Pick on Map</span>
                  </button>
                </div>
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
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </button>
                <button type="button" className={styles.checkoutBtn}>
                  <span>Proceed to checkout</span>
                  <ArrowRight size={14} strokeWidth={2.5} />
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
    </div>
  );
}
