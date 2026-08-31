import { useRef, useState } from 'react';
import { useImportPipeline } from './useImportPipeline';
import SaveModal from './SaveModal';

/**
 * KmlImportPanel — the lazy-loaded half of the admin KML/GPX import flow
 * (see ImportTrigger.jsx). Mirrors legacy's `adminImportInput` change
 * handler (app.js ~1846-1910): pick a file, run it through
 * `processImportPipeline`, then open the save modal with the results.
 */
export default function KmlImportPanel({ waypoints, segments, onSaved, onClose }) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(null);

  const pipeline = useImportPipeline({ waypoints, segments });

  // Auto-open the file picker as soon as this panel mounts -- there's no
  // extra chrome around the trigger, so clicking "Import" should go
  // straight to the OS file dialog, same one-click feel as legacy's
  // `#adminImportBtn` -> `#adminImportInput.click()`.
  useState(() => {
    fileInputRef.current?.click();
  });

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      onClose();
      return;
    }
    try {
      await pipeline.importFile(file);
      setDraft(true);
    } catch (err) {
      // Simplest surface for a parse failure pre-modal: alert + close,
      // matching legacy's own `alert(...)` in this same failure path
      // (app.js ~1854, ~1863).
      alert(pipeline.error || err.message);
      onClose();
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".kml,.gpx"
        hidden
        onChange={handleFileChange}
      />
      {draft && (
        <SaveModal
          draft={{
            recordedPoints: pipeline.recordedPoints,
            recordedWaypoints: pipeline.recordedWaypoints,
            totalDistance: pipeline.totalDistance,
            recStartTime: pipeline.recStartTime,
            defaultName: pipeline.defaultName,
            defaultDesc: pipeline.defaultDesc,
          }}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
