import { Bike, BusFront, Car, CarFront, CarTaxiFront, Footprints } from 'lucide-react';
import styles from './TravelModePicker.module.css';

// Walk / Bike / Ride, and Ride's options. NavigationController maps each
// mode to a routing server and remembers it (and the last Ride option).
const TRAVEL_TABS = [
  { tab: 'walk', label: 'Walk', Icon: Footprints },
  { tab: 'bike', label: 'Bike', Icon: Bike },
  { tab: 'ride', label: 'Ride', Icon: Car },
];
const RIDE_OPTIONS = [
  { mode: 'shuttle', label: 'Shuttle', Icon: BusFront },
  { mode: 'keke', label: 'Keke', Icon: CarFront },
  { mode: 'car', label: 'Car / Cab', Icon: CarTaxiFront },
];
// Radio groups move with the arrow keys (one tab stop per group).
function arrowKeys(e, values, current, choose) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const next = (values.indexOf(current) + step + values.length) % values.length;
  choose(values[next]);
  e.currentTarget.querySelectorAll('[role="radio"]')[next]?.focus();
}

/**
 * The mode tabs, Ride's options when Ride is picked, and — in Shuttle
 * mode — the stop to get off at (`shuttleStop`, if one is near).
 */
export default function TravelModePicker({ travelMode, onTravelModeChange, shuttleStop }) {
  const tab = travelMode === 'walk' || travelMode === 'bike' ? travelMode : 'ride';
  return (
    <div className={styles.picker}>
      <div
        className={styles.modePicker}
        role="radiogroup"
        aria-label="How are you travelling?"
        onKeyDown={(e) => arrowKeys(e, TRAVEL_TABS.map((t) => t.tab), tab, onTravelModeChange)}
      >
        {TRAVEL_TABS.map(({ tab: t, label, Icon }) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tab === t}
            tabIndex={tab === t ? 0 : -1}
            className={`${styles.modeOption} ${tab === t ? styles.modeOptionActive : ''}`}
            onClick={() => tab !== t && onTravelModeChange(t)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'ride' && (
        <div
          className={styles.rideOptions}
          role="radiogroup"
          aria-label="What are you riding?"
          onKeyDown={(e) => arrowKeys(e, RIDE_OPTIONS.map((o) => o.mode), travelMode, onTravelModeChange)}
        >
          {RIDE_OPTIONS.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={travelMode === mode}
              tabIndex={travelMode === mode ? 0 : -1}
              className={`${styles.rideOption} ${travelMode === mode ? styles.rideOptionActive : ''}`}
              onClick={() => onTravelModeChange(mode)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}

      {travelMode === 'shuttle' && shuttleStop && (
        <p className={styles.shuttleNote}>
          <BusFront size={14} />
          <span>
            Get off at <strong>{shuttleStop}</strong>
          </span>
        </p>
      )}
    </div>
  );
}
