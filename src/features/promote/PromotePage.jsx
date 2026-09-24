import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Info,
  Map,
  MapPin,
  Navigation,
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
  const [listingType, setListingType] = useState("physical"); // 'physical' | 'online'
  const [locationMode, setLocationMode] = useState(null); // 'gps' | 'map' | null
  const [photos, setPhotos] = useState([]); // { id, file, previewUrl }[]
  const [days, setDays] = useState(DEFAULT_DAYS);

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

            {/* Location (physical shop only) */}
            {listingType === "physical" && (
              <div className={styles.section}>
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
