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
/**
 * The mode tabs, Ride's options when Ride is picked, and — in Shuttle
 * mode — the stop to get off at (`shuttleStop`, if one is near). Rendered
 * as siblings so they sit in the parent's own column gap.
 */
export default function TravelModePicker({ travelMode, onTravelModeChange, shuttleStop }) {
  const tab = travelMode === 'walk' || travelMode === 'bike' ? travelMode : 'ride';
  return (
    <>
      <div className={styles.modePicker} role="radiogroup" aria-label="How are you travelling?">
        {TRAVEL_TABS.map(({ tab: t, label, Icon }) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tab === t}
            className={`${styles.modeOption} ${tab === t ? styles.modeOptionActive : ''}`}
            onClick={() => tab !== t && onTravelModeChange(t)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'ride' && (
        <div className={styles.rideOptions} role="radiogroup" aria-label="What are you riding?">
          {RIDE_OPTIONS.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={travelMode === mode}
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
    </>
  );
}
