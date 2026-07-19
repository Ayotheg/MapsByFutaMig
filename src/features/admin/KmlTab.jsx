import { useRef, useState } from 'react';
import styles from './AdminPanel.module.css';

/** Legacy: the KML-upload markup (index.html ~910–940) + `buildKmlAdminList`
 * (app.js ~3809–3850). `adminKml` is the `useAdminKml()` result, lifted to
 * `AdminPanel` so the loaded overlay layers persist across tab switches. */
export default function KmlTab({ adminKml, onEditKmlFeature }) {
  const [color, setColor] = useState('#e040fb');
  const [path, setPath] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [pathStatus, setPathStatus] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadStatus(null);
    try {
      await adminKml.loadFromFile(file, color);
      setUploadStatus({ text: `✓ Loaded ${file.name}`, error: false });
    } catch (err) {
      setUploadStatus({ text: `❌ ${err.message}`, error: true });
    }
  }

  async function handleLoadPath() {
    const p = path.trim();
    if (!p) return;
    setPathStatus(null);
    try {
      await adminKml.loadFromPath(p, color);
      setPathStatus({ text: `✓ Loaded ${p}`, error: false });
      setPath('');
    } catch (err) {
      setPathStatus({ text: `❌ ${err.message}`, error: true });
    }
  }

  const entries = Object.entries(adminKml.registry);

  return (
    <div className={styles.tabContent}>
      <div className={styles.kmlUploadArea}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--primary)', opacity: 0.7 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <div className={styles.kmlUploadLabel}>Upload a KML file</div>
        <div className={styles.kmlUploadSub}>Annotated points will appear on the map</div>
        <label className={styles.kmlFileBtn}>
          Choose KML File
          <input ref={fileInputRef} type="file" accept=".kml" hidden onChange={handleFile} />
        </label>
        <div className={styles.kmlColorRow}>
          <label>Marker colour</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className={styles.colorPick} title="Marker colour" />
        </div>
        {uploadStatus && (
          <div className={`${styles.saveStatus} ${uploadStatus.error ? styles.saveStatusError : styles.saveStatusSuccess}`}>
            {uploadStatus.text}
          </div>
        )}
      </div>

      <div className={styles.kmlDivider}>
        <span>— or load by path —</span>
      </div>

      <div className={styles.kmlPathRow}>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="kml/test13.kml"
          className={styles.searchInput}
        />
        <button type="button" className={`${styles.formSave} ${styles.kmlLoadBtn}`} onClick={handleLoadPath}>
          Load
        </button>
      </div>
      {pathStatus && (
        <div
          className={`${styles.saveStatus} ${pathStatus.error ? styles.saveStatusError : styles.saveStatusSuccess}`}
          style={{ margin: '0 14px' }}
        >
          {pathStatus.text}
        </div>
      )}

      <div className={styles.sectionLabel}>Loaded KML Files</div>
      <div className={styles.list}>
        {entries.length === 0 && <div className={styles.empty}>No KML loaded yet.</div>}
        {entries.map(([filePath, file]) => (
          <div key={filePath}>
            <div className={styles.item} style={{ cursor: 'default', borderBottom: `2px solid ${file.color}44`, paddingBottom: 4, marginBottom: 4 }}>
              <div className={styles.itemIcon}>📁</div>
              <div className={styles.itemBody}>
                <div className={styles.itemName} style={{ color: file.color }}>
                  {file.label}
                </div>
                <div className={styles.itemMeta}>
                  {filePath} · {file.features.length} feature{file.features.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            {file.features.map((f, idx) => {
              const isAuto = f.name && /@ \d+\.\d+/.test(f.name);
              const typeIcon = f.type === 'LineString' || f.type === 'MultiLineString' ? '〰️' : '📍';
              const photoCount = f.imageFiles?.length || 0;
              return (
                <div
                  key={idx}
                  className={styles.item}
                  style={{ paddingLeft: 20 }}
                  onClick={() => onEditKmlFeature({ path: filePath, idx, data: f })}
                >
                  <div className={styles.itemIcon}>{typeIcon}</div>
                  <div className={styles.itemBody}>
                    <div className={styles.itemName} style={isAuto ? { opacity: 0.65, fontStyle: 'italic' } : undefined}>
                      {f.name}
                    </div>
                    <div className={styles.itemMeta}>
                      {Number(f.lat).toFixed(5)}, {Number(f.lng).toFixed(5)}
                      {f.description ? ` · ${f.description.replace(/<[^>]+>/g, '').slice(0, 50)}` : ''}
                    </div>
                  </div>
                  {photoCount > 0 && <span className={styles.itemPhotoBadge}>📷 {photoCount}</span>}
                  <span className={styles.itemBadge} style={{ background: 'rgba(255,185,95,0.1)', color: 'var(--tertiary)', borderColor: 'rgba(255,185,95,0.22)' }}>
                    {f.type || 'feature'}
                  </span>
                  <span className={styles.itemChevron}>›</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
