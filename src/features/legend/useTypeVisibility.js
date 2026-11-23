import { useEffect, useMemo, useState, useCallback } from 'react';
import { ALL_TYPES, GROUP_META, PTF_GROUPS, groupOfType } from './placeTypeGroups';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';

/**
 * Owns place-type filter state (which waypoint types are currently visible)
 * plus the per-type/per-group counts shown in the legend badges.
 *
 * Mirrors legacy `initPlaceTypeFilter`'s `_typeVisible` map, `_updateCounts`,
 * `_setTypeVisible`, `_setGroupVisible` (dead in the UI — no group-level
 * checkbox exists in the DOM, see PlaceTypeFilter.jsx), and the RESET button
 * handler (app.js ~6154–6301). Unlike legacy, which reads counts off
 * `window._waypointLayers` (all markers ever loaded), this derives counts
 * from the `waypoints` array passed in — same numbers, React-owned source
 * of truth instead of a global.
 */
export function useTypeVisibility(waypoints) {
  // type -> boolean. Starts all-visible, same as legacy's initial `checked`
  // state on every .ptf-type-cb in the markup.
  const [typeVisible, setTypeVisibleState] = useState(() => {
    const initial = {};
    for (const t of ALL_TYPES) initial[t] = true;
    initial.__unknown__ = true;
    return { ...initial, ...readPersistentState('type-visibility', {}) };
  });

  useEffect(() => writePersistentState('type-visibility', typeVisible), [typeVisible]);

  const setTypeVisible = useCallback((type, visible) => {
    setTypeVisibleState((prev) => (prev[type] === visible ? prev : { ...prev, [type]: visible }));
  }, []);

  const resetAll = useCallback(() => {
    setTypeVisibleState((prev) => {
      const next = { ...prev };
      for (const t of Object.keys(next)) next[t] = true;
      return next;
    });
  }, []);

  const isVisible = useCallback((type) => typeVisible[type] !== false, [typeVisible]);

  // ── Per-type counts (legacy `_updateCounts`'s `counts` map) ──────────────
  const typeCounts = useMemo(() => {
    const counts = {};
    for (const wp of waypoints) {
      const t = wp.type || '__unknown__';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [waypoints]);

  // ── Per-group counts (legacy `_updateCounts`'s `groupCounts` map) ────────
  const groupCounts = useMemo(() => {
    const counts = {};
    for (const g of GROUP_META) counts[g.key] = 0;
    for (const wp of waypoints) {
      const g = groupOfType(wp.type);
      if (g) counts[g]++;
    }
    return counts;
  }, [waypoints]);

  // ── Whether every type in a group is currently on (drives the group
  // header's dimmed "ptf-group-off" state, legacy ~6285-6286) ─────────────
  const isGroupFullyVisible = useCallback(
    (group) => (PTF_GROUPS[group] || []).every((t) => typeVisible[t] !== false),
    [typeVisible]
  );

  return {
    typeVisible,
    setTypeVisible,
    resetAll,
    isVisible,
    typeCounts,
    groupCounts,
    isGroupFullyVisible,
  };
}
