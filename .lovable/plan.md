
Goal: stop the AI Twin area from getting stuck/failing repeatedly and make it recover gracefully when the backend connection is unstable.

What I found
1. The failure pattern is backend connectivity/auth-refresh related, not a JSX/UI rendering bug:
   - Repeated `Failed to fetch` on token refresh and `ai_twins` reads.
   - Backend SQL inspection attempts also timed out (status 544), which points to backend saturation/connection instability.
2. The AI Twin page already has lightweight list queries (good), but current failure handling is still brittle:
   - User sees repeated load failures without enough guided recovery.
   - If requests hang, UX can feel like “just loading”.
3. Auth state resilience is incomplete:
   - Initial session bootstrap handles thrown exceptions, but not all returned auth errors from session fetch pathways.
   - This can leave the app in a confusing state where protected data calls keep failing but recovery signals are weak.
4. Data access rules look correct for AI twins:
   - `ai_twins` is user-scoped via row-level policies (`auth.uid() = user_id`), so no policy looseness is needed.
   - No database schema changes are required for this fix.

Implementation plan

Phase 1 — Harden auth/outage detection (foundation)
Files:
- `src/components/AuthProvider.tsx`
- (optional small helper in existing utility file if needed)

Changes:
1. Improve session bootstrap handling so both thrown errors and returned auth errors are treated as connectivity/service outages.
2. Ensure `authServiceDown` is set consistently when refresh/session retrieval fails.
3. Keep `clearLocalSession` as the primary emergency recovery path, but make sure downstream pages can trust `authServiceDown`.

Why first:
- Every data page depends on stable auth state. Fixing this first prevents cascading retries/confusion.

Phase 2 — Make AI Twin loading fail-safe and recoverable
File:
- `src/pages/AITwin.tsx`

Changes:
1. Add request timeout guard for the twins fetch (so spinner can’t run indefinitely on hung requests).
2. Add explicit connectivity-aware error classification:
   - Backend unavailable
   - Session/auth issue
   - Generic query failure
3. Show a dedicated recovery UI state with clear actions:
   - Retry
   - Clear Session & Retry (reuse existing auth context method)
4. Prevent repeated noisy toasts on repeated automatic failures (only toast on user-triggered retries or first failure).
5. Add a small local cache fallback for last successful twin list metadata:
   - If live fetch fails, render cached twins with a “stale data” indicator.
   - This ensures users can still see previously loaded twins during temporary outages.
6. Keep list fetch lightweight, but restore detail behavior by lazy-loading full twin details (including reference images) only when opening a twin detail panel.

Why this fixes your specific pain:
- The tab won’t feel stuck.
- Failures become actionable instead of opaque.
- Existing twins remain visible during transient backend issues.

Phase 3 — Remove avoidable auth pressure in twin-related selectors
Files:
- `src/components/testimonial/TwinSelector.tsx`
- `src/components/testimonial/CommercialStrategist.tsx`
- (optionally) `src/components/Dashboard.tsx` for consistency

Changes:
1. Replace direct `auth.getUser()` calls with the already-available auth context user where possible.
2. Avoid issuing twin queries when no authenticated user is present.
3. Add clearer empty/error states in selectors (“Sign in to load AI Twins” vs generic empty list).

Why:
- Reduces extra auth round-trips.
- Lowers chance of lock/contention patterns during unstable periods.
- Keeps lip-sync and testimonial twin pickers aligned with the resilient loading model.

Phase 4 — Verification checklist (end-to-end)
1. `/ai-twin` with healthy backend:
   - Twins list loads quickly.
   - Detail panel loads full images only on selection.
2. `/ai-twin` with simulated connectivity outage:
   - Spinner exits within timeout window.
   - Recovery state appears with Retry + Clear Session.
   - Cached twins (if available) are shown and labeled stale.
3. Lip-sync/twin selector flow:
   - Twin dropdown loads without hanging.
   - Clear messaging when not authenticated or backend unavailable.
4. Confirm no new security regressions:
   - User-scoped data only.
   - No RLS changes required.

Operational note (parallel to code fix)
- If backend timeouts continue after these resilience changes, instance sizing/health in Lovable Cloud should be adjusted. The code changes above will still improve UX and recovery, but persistent infrastructure timeouts can still block live reads.

Expected outcome
- AI Twin tab no longer “keeps failing” in a confusing way.
- Users get reliable recovery actions.
- Previously created twins remain visible via cache during temporary outages.
- Lip sync twin loading is more stable and consistent with AI Twin page behavior.
