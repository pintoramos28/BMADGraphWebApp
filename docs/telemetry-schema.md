# Telemetry Schema Baseline

This document summarizes the hosted-shell telemetry and operational API contracts introduced by Story 1.1. Shared telemetry and release schemas live under `src/schemas/api/`, while worker message envelopes live under `src/schemas/worker/`.

## Shared API Contracts

- `telemetry-batch.ts`: redacted telemetry batch envelope with batch metadata, environment details, privacy flags, and event arrays.
- `release-manifest.ts`: compatibility-aware release manifest with support-matrix metadata, workspace compatibility rules, service-worker metadata, release notes, and integrity hash.
- `error-envelope.ts`: shared error envelope for operational APIs and worker-style error responses.
- `message-envelope.ts`: worker message envelope with explicit schema versioning, message identity, correlation ID, workspace version, type, and payload.

## Locked Invariants

- Telemetry privacy flags are hard-locked to `false` for dataset rows, formulas, workspace blobs, and evidence text.
- Telemetry events remain metric- and dimension-based. They do not carry raw analytical content.
- Release manifests must carry a workspace compatibility envelope with `minReadableFormat`, `maxReadableFormat`, and `migrationPolicy`.
- Worker messages must carry `schemaVersion`, `correlationId`, and `workspaceVersion` so stale replies can be rejected by later stories.
- Error envelopes use a single shape: `code`, `title`, `detail`, `severity`, `retryable`, and optional `contextRef`.

## Example Coverage

The locked example fixtures live under:

- `src/test/fixtures/api/telemetry-batch.fixture.ts`
- `src/test/fixtures/api/release-manifest.fixture.ts`
- `src/test/fixtures/api/error-envelope.fixture.ts`
- `src/test/fixtures/worker/message-envelope.fixture.ts`

Vitest contract coverage proves the examples parse successfully and rejects:

- telemetry payloads that break the redaction boundary
- release manifests with invalid compatibility fields
- worker envelopes missing valid correlation or workspace-version metadata

## Deliberate Deferrals

This story does not define route-based telemetry policies.
This story does not move telemetry queue ownership into the service worker.
This story does not benchmark event volume, flush cadence, or renderer telemetry thresholds; those remain later Epic 1 concerns.
