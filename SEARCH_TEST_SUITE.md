# Intelligent Search Features - Complete Test Suite

## Setup
1. Open the app at `localhost:5173` 
2. Wait for the map to fully load
3. Enable GPS location if prompted (for distance-based tests)
4. Open browser DevTools Console (F12) to monitor for errors

---

## PHASE 1: QUICK WINS TESTS

### Test 1.1: Type-Based Auto-Filtering (@cafe, @library, etc.)
**Expected Behavior**: Results filtered to only show that place type

**Test Steps**:
1. Click the search bar (desktop or mobile)
2. Type: `@cafe`
3. **✓ PASS** if only cafés appear in results (no libraries, labs, etc.)
4. Repeat with: `@library`, `@lab`, `@clinic`
5. **✓ PASS** if each returns only that specific place type

**Verification**:
- Check result badge/type icons match the filter
- No other place types should appear
- Search term should show `@cafe` without errors

---

### Test 1.2: Recent Search History (localStorage)
**Expected Behavior**: Searches are saved and persist across sessions

**Test Steps**:
1. Perform 5 different searches:
   - "library"
   - "cafe"
   - "lab"
   - "clinic"
   - "cafeteria"
2. Close browser tab/reload page
3. Open search bar again
4. **✓ PASS** if you can see recently searched items in localStorage
   - Open DevTools → Console
   - Run: `JSON.parse(localStorage.getItem('futa-recent-searches'))`
   - Should show array: `["cafeteria", "clinic", "lab", "cafe", "library"]`

**Verification**:
- localStorage key: `futa-recent-searches`
- Max 10 items stored
- Most recent query first
- Duplicates removed (if you search "cafe" twice, only one entry)

---

### Test 1.3: Distance-Based Ranking (Near Me / GPS)
**Expected Behavior**: Results ranked by proximity to user location

**Prerequisite**: GPS must be enabled and active

**Test Steps**:
1. Click the GPS button in the sidebar (the GPS panel icon)
2. Allow location access
3. Wait for GPS lock (should show in the GPS panel)
4. Search: `waypoint` (or any generic term that matches multiple places)
5. **✓ PASS** if closest results appear first
   - Compare with map: closest pin should be top result
   - Results should reorder as you move location

**Verification**:
- Top result should be closest on map
- Distance decreases down the list (roughly)
- If you move physically (or change GPS), results reorder
- Check Console: no distance calculation errors

---

### Test 1.4: Rating-Based Ranking (High Ratings Boost)
**Expected Behavior**: Places with 4+ stars and 3+ reviews rank higher

**Test Steps**:
1. Search for a common place type: `@cafe`
2. Look at results order
3. **✓ PASS** if places with visible ratings appear higher in results
   - (Ratings visible in place card when you click a result)
4. Compare sorting: 5⭐ places should appear before 3⭐ places

**Verification**:
- Click top results to check their ratings
- High-rated items (4+⭐) should naturally appear earlier
- Places with <3 reviews shouldn't get rating boost
- Combine with distance test: distance + rating both affect order

---

### Test 1.5: Typo Tolerance (Fuzzy Matching)
**Expected Behavior**: Search works even with typos

**Test Steps**:
1. Search: `libary` (typo for "library")
2. **✓ PASS** if "Library" still appears in results
3. Repeat with typos:
   - `cafetaria` → should find "cafeteria"
   - `labrotory` → should find "laboratory"
   - `clnic` → should find "clinic"
4. **✓ PASS** if all typo searches return relevant results

**Verification**:
- Fuzzy matching enabled in fuse.js (40% threshold)
- Typos don't break search
- Exact matches still rank higher than fuzzy matches
- Check Console: no fuzzy matching errors

---

## PHASE 2: SMART PARSING TESTS

### Test 2.1: "Near Me" Query Processing
**Expected Behavior**: "near me" queries filter to 2km radius automatically

**Prerequisite**: GPS must be enabled and locked

**Test Steps**:
1. Enable GPS location (if not already)
2. Search: `near me`
3. **✓ PASS** if results are filtered to nearby locations only
   - Should see 0-10 results (not all 100+ places)
   - All results should be within ~2km of your location
4. Repeat with: `cafe near me`, `library near me`
5. **✓ PASS** if results are both filtered by type AND distance

**Verification**:
- Query parsing extracts "near me" intent
- Automatic 2km radius applied
- Results decrease when moving away
- Check Console for parsing output

---

### Test 2.2: Distance Radius Filter (#nearby)
**Expected Behavior**: #nearby:XXX syntax filters by distance radius

**Test Steps**:
1. Enable GPS
2. Search: `#nearby:500m cafe`
3. **✓ PASS** if results show only cafés within 500 meters
   - Should be very few results (or 0 if no cafés nearby)
4. Search: `#nearby:1km library`
5. **✓ PASS** if results show libraries within 1km
6. Search: `#nearby:2km` (no type)
7. **✓ PASS** if shows all places within 2km

**Verification**:
- Distance filter recognized: #nearby:500m, #nearby:1km, etc.
- Results count decreases as radius shrinks
- Works with or without type filter
- All results should be within stated radius

---

### Test 2.3: Rating Filter (#rating)
**Expected Behavior**: #rating:X syntax filters by minimum rating

**Test Steps**:
1. Search: `#rating:4+`
2. **✓ PASS** if only 4+ star places appear
   - (Places with 3.8⭐ should not appear)
3. Search: `#rating:4+cafe`
4. **✓ PASS** if combined: only 4+ star cafés
5. Try: `#rating:5` (exact 5-star filter)
6. **✓ PASS** if only 5⭐ places appear

**Verification**:
- Rating filter syntax: #rating:4+, #rating:5, etc.
- Works standalone or with type filter
- Results count drops significantly (fewer places are 4+⭐)
- Combines correctly with other filters

---

### Test 2.4: Combined Query Filters
**Expected Behavior**: Multiple filters work together in one query

**Test Steps**:
1. GPS enabled
2. Search: `@cafe #rating:4+ near me`
3. **✓ PASS** if results are: cafés (type) + 4+ stars (rating) + within 2km (distance)
   - Should be 0-3 results typically
4. Search: `#nearby:500m @library #rating:4+`
5. **✓ PASS** if results are: libraries + 4+ stars + within 500m
6. Search: `library #rating:4+ #nearby:1km`
7. **✓ PASS** if works even with different word order

**Verification**:
- All filters apply simultaneously
- Query parsing extracts all tokens correctly
- Result count shrinks as more filters added (intersection logic)
- Check Console: verify parsed filter object

---

### Test 2.5: Search Shortcuts Discovery
**Expected Behavior**: Shortcuts are available as suggestions

**Test Steps**:
1. Click search bar (empty query)
2. Start typing: `@`
3. **✓ PASS** if you see shortcut suggestions appear
4. Type: `#rating`
5. **✓ PASS** if `#rating:4+` suggestion appears
6. Type: `near`
7. **✓ PASS** if `near me` suggestion appears

**Verification**:
- Shortcuts available: @cafe, @library, @lab, @clinic, #rating:4+, #nearby:500m, near me
- Suggestions appear as you type
- Clicking suggestion fills input
- No console errors on shortcut selection

---

### Test 2.6: Natural Language Intent Detection
**Expected Behavior**: System recognizes user intent from query structure

**Test Steps**:
1. Search: `cafe near me` (spaces between tokens)
2. **✓ PASS** if recognized as: search "cafe" + distance filter (near me)
3. Search: `near me cafe` (different word order)
4. **✓ PASS** if same result (order doesn't matter)
5. Search: `@cafe #rating:4+` 
6. **✓ PASS** if recognized as type filter + rating filter
7. Search: `libary near me #nearby:500m` (typo + multiple filters)
8. **✓ PASS** if fuzzy matching + all filters apply

**Verification**:
- Intent parsed correctly regardless of word order
- Typos don't break filter detection
- Check Console: `parseSearchQuery()` output shows correct filters
- Multiple intents compound (all apply)

---

## ADVANCED TESTS

### Test A1: Distance Ranking Verification
**Expected Behavior**: Distance significantly affects result order

**Test Steps**:
1. GPS enabled
2. Stand/move to one location
3. Search: `waypoint` (generic term)
4. Note top 3 results and their order
5. Move to a different location (or simulate by refreshing at different coords)
6. Search same term again
7. **✓ PASS** if top results changed based on new location
   - Results reordered by proximity
   - Previously-far items now appear higher

**Verification**:
- Distance boost (+0-50 points) measurably affects ranking
- Closest item almost always top result
- Use map to visually verify: pin at top-result location should be closest

---

### Test A2: Scoring Algorithm Verification
**Expected Behavior**: Legacy score + distance + rating = final score

**Test Steps**:
1. GPS enabled
2. In Console, run:
   ```javascript
   // Check if enhanced scoring is active
   const results = searchIndex.query('cafe', 10);
   console.table(results.map(r => ({
     name: r.name,
     score: r._score,
     rating: r.avgRating,
     reviewCount: r.reviewCount,
     lat: r.lat,
     lng: r.lng
   })));
   ```
3. **✓ PASS** if:
   - `_score` values > 100 (legacy max was 100, now can exceed 180)
   - High-rated items have higher scores than similar matches
   - Closer items have higher scores than far ones
   - Scoring is consistent across searches

---

### Test A3: Recent Search Persistence
**Expected Behavior**: Recent searches survive app reload and browser refresh

**Test Steps**:
1. Perform searches: "library", "cafe", "lab"
2. Hard refresh browser (Ctrl+Shift+R)
3. Open search bar
4. Run in Console:
   ```javascript
   console.log(JSON.parse(localStorage.getItem('futa-recent-searches')));
   ```
5. **✓ PASS** if searches are still in localStorage after refresh
6. Close browser tab completely, reopen, navigate to app
7. **✓ PASS** if recent searches still available (cross-session)

**Verification**:
- localStorage key persists: `futa-recent-searches`
- Survives page reload, tab close, browser close
- Max 10 entries maintained
- No console errors on localStorage access

---

### Test A4: Query Parsing Edge Cases
**Expected Behavior**: Parser handles unusual inputs gracefully

**Test Steps**:
1. Search: `   cafe   ` (extra spaces)
   - **✓ PASS** if trimmed and works
2. Search: `@CAFE` (uppercase)
   - **✓ PASS** if recognized as @cafe
3. Search: `##rating:4+` (double hash)
   - **✓ PASS** if ignored/handled gracefully
4. Search: `@unknown_type`
   - **✓ PASS** if safely handled (no results or fallback)
5. Search: `#nearby:notanumber`
   - **✓ PASS** if rejected gracefully

**Verification**:
- No console errors on edge cases
- Parser is case-insensitive
- Extra whitespace handled
- Invalid filters don't crash app

---

### Test A5: GPS Location Updates Impact
**Expected Behavior**: Search results reorder as GPS location updates

**Test Steps**:
1. GPS enabled and locked
2. Search: `waypoint`
3. Note top 3 results
4. Move physically to a different location (>100m away)
5. GPS should update (watch GPS panel for new coords)
6. Search again (same query)
7. **✓ PASS** if top results changed based on new location
   - Previously-top result may move down
   - New closer results appear at top

**Verification**:
- GPS coordinates updating in real-time
- Search results re-ranking on location change
- Distance boost actively affecting live search
- Check Console: `gps.lastKnownPosRef.current` shows updated coords

---

## PERFORMANCE TESTS

### Test P1: Search Responsiveness
**Expected Behavior**: Search feels instant, no lag

**Test Steps**:
1. Open search bar
2. Type quickly: `cafeteria cafe libr librar library`
3. **✓ PASS** if:
   - Each keystroke shows results immediately
   - No noticeable delay (< 100ms)
   - UI remains responsive
4. Type gibberish: `xyzqweasdz`
5. **✓ PASS** if returns no results without lag

**Verification**:
- Open DevTools Performance tab
- Measure keyboard input → results display
- Should be < 50ms for local search
- No dropped frames during typing

---

### Test P2: Large Result Set Handling
**Expected Behavior**: Many results load smoothly

**Test Steps**:
1. Search: `@waypoint` (generic, matches many items)
2. **✓ PASS** if:
   - Results display instantly
   - No freezing/lag
   - Can scroll through results smoothly
   - Shows limited results (not all 200+)
3. Apply distance filter: `#nearby:5km`
4. **✓ PASS** if still responsive

**Verification**:
- No console errors on large datasets
- Rendering remains smooth
- Memory usage reasonable (check DevTools Memory)

---

## VISUAL/UX TESTS

### Test U1: Search UI Unchanged
**Expected Behavior**: UI looks identical to before (no UI changes added)

**Test Steps**:
1. Open desktop search bar
2. **✓ PASS** if:
   - Same floating pill shape
   - Same button layout
   - Same result dropdown appearance
3. Open mobile search overlay
4. **✓ PASS** if:
   - Same overlay appearance
   - Same result row styling
   - Same input styling

**Verification**:
- No new UI components added
- No visual regressions
- Results display identical to before (just ranked better)

---

### Test U2: Error Handling UI
**Expected Behavior**: Errors handled gracefully without breaking search

**Test Steps**:
1. Disconnect internet
2. Search for OSM result (requires network)
3. **✓ PASS** if:
   - Local results still work
   - OSM search fails gracefully (no crash)
   - Error doesn't freeze search bar
4. Reconnect internet
5. Search again
6. **✓ PASS** if OSM results resume working

**Verification**:
- No console errors breaking app
- Graceful fallbacks for network failures
- Search still functional offline (local results)

---

## SUMMARY CHECKLIST

### Phase 1 Features ✓
- [ ] Test 1.1: Type-based filtering (@cafe, @library, etc.)
- [ ] Test 1.2: Recent search history (localStorage)
- [ ] Test 1.3: Distance-based ranking (GPS proximity)
- [ ] Test 1.4: Rating-based ranking (high ratings boost)
- [ ] Test 1.5: Typo tolerance (fuzzy matching)

### Phase 2 Features ✓
- [ ] Test 2.1: "Near me" query processing
- [ ] Test 2.2: Distance radius filter (#nearby:XXX)
- [ ] Test 2.3: Rating filter (#rating:X+)
- [ ] Test 2.4: Combined query filters
- [ ] Test 2.5: Search shortcuts discovery
- [ ] Test 2.6: Natural language intent detection

### Advanced Tests ✓
- [ ] Test A1: Distance ranking verification
- [ ] Test A2: Scoring algorithm verification
- [ ] Test A3: Recent search persistence
- [ ] Test A4: Query parsing edge cases
- [ ] Test A5: GPS location updates impact

### Performance Tests ✓
- [ ] Test P1: Search responsiveness
- [ ] Test P2: Large result set handling

### Visual/UX Tests ✓
- [ ] Test U1: Search UI unchanged
- [ ] Test U2: Error handling UI

---

## Console Debugging Commands

Run these in DevTools Console to verify features programmatically:

```javascript
// Test 1: Check recent searches
JSON.parse(localStorage.getItem('futa-recent-searches'))

// Test 2: Verify GPS location
gps.lastKnownPosRef.current

// Test 3: Check search index
searchIndex.indexRef.current.length // total items in index

// Test 4: Test query parsing
import { parseSearchQuery } from './features/search/searchEnhancements.js'
parseSearchQuery('cafe #rating:4+ near me')

// Test 5: Check enhanced scoring
const results = searchIndex.query('library', 10);
console.table(results.map(r => ({ name: r.name, score: r._score })))

// Test 6: Verify distance boost
import { getDistanceBoost } from './features/search/searchEnhancements.js'
getDistanceBoost(results[0], gps.lastKnownPosRef.current.lat, gps.lastKnownPosRef.current.lng)

// Test 7: Verify rating boost
import { getRatingBoost } from './features/search/searchEnhancements.js'
getRatingBoost(results[0])

// Test 8: Get recent searches
import { getRecentSearches } from './features/search/searchEnhancements.js'
getRecentSearches()
```

---

**Total Tests**: 20 manual tests + 8 console verification commands
**Estimated Time**: 30-45 minutes to run full suite
**Coverage**: 100% of Phase 1 & Phase 2 features
