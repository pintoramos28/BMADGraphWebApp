# Hosted Shell Release & Monitoring Plan

## Release Checklist
1. **Build** – Run `next build && next export` (or deployment pipeline) to produce versioned assets with immutable filenames. Capture build hash and embed into `service-worker.js` + manifest.
2. **Scan** – Execute automated checks (lint, unit tests, axe/Playwright smoke) plus bundle analyzer to ensure asset budgets remain under offline cache limits.
3. **Upload** – Push assets to the chosen static host/CDN bucket. Upload service worker and manifest last so clients never cache partial releases.
4. **Invalidate** – Issue CDN cache invalidation for the previous release’s HTML/JS/CSS while keeping older asset versions available for rollback.
5. **Telemetry toggle** – Update runtime config (feature flag JSON) with new release metadata, including shell version, build timestamp, and telemetry endpoint URL.
6. **Canary verify** – Load the new shell in a staging browser, confirm “Ready for offline use” banner, simulate offline mode, and ensure telemetry queue flushes on reconnect.
7. **Promote** – Flip DNS or environment flag to route production traffic to the new release; monitor for 15 minutes before announcing availability.
8. **Notify** – Post release notes (what changed, refresh instructions) in internal channel; include instructions for forcing a refresh if the service worker delays.
9. **Rollback plan** – Keep previous release assets and config ready; document the exact steps to revert (restore config pointer + CDN cache flush) within 10 minutes if needed.

## Telemetry & Monitoring Plan
- **Metrics captured:** shell load time, offline-ready time, cache hit rate, telemetry queue depth/age, service worker update success, error counts (by severity), and browser/environment compatibility failures.
- **Client behavior:** telemetry events are batched locally (IndexedDB) when offline with exponential backoff when retrying. Queue depth warning threshold = 100 events or 60 minutes age; beyond that, show a subtle banner requesting the user to reconnect.
- **Server pipeline:** CDN/collector forwards events to a queue (e.g., Kafka/SQS) processed by a lightweight worker that strips identifiers and writes aggregates to the monitoring store (Datadog/Grafana). No datasets/workspaces/formulas are sent.
- **Dashboards:**
  - Availability board: shell uptime %, CDN errors, service worker registration failures.
  - Performance board: median/95th percentile offline-ready time, bundle load time, telemetry flush latency.
  - Quality board: JS error rate, environment check failures (unsupported browser, blocked storage), telemetry queue backlog alerts.
- **Alerting:**
  - Pager alerts when uptime <99.5% over 1 hour, offline-ready median >5 s, or telemetry backlog age >30 minutes.
  - Slack notifications for increased JS error rate (>2x baseline) or environment failures >5% of sessions.
- **Ops runbooks:** Link these dashboards to runbooks detailing cache purge, telemetry endpoint restart, and user messaging (e.g., instructing users to refresh or clear site data) so on-call staff can resolve issues quickly.
