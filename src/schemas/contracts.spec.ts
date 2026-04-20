import { describe, expect, it } from 'vitest';

import { errorEnvelopeSchema, releaseManifestSchema, supportMatrixSchema, telemetryBatchSchema } from './api';
import { workerMessageEnvelopeSchema } from './worker';
import {
  graphDefinitionSchema,
  issueRecordSchema,
  workspaceLedgerEntrySchema,
  workspaceSnapshotSchema,
} from './workspace';
import { errorEnvelopeFixture } from '../test/fixtures/api/error-envelope.fixture';
import { releaseManifestFixture } from '../test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../test/fixtures/api/support-matrix.fixture';
import { telemetryBatchFixture } from '../test/fixtures/api/telemetry-batch.fixture';
import { workerMessageEnvelopeFixture } from '../test/fixtures/worker/message-envelope.fixture';
import { graphDefinitionFixture } from '../test/fixtures/workspace/graph-definition.fixture';
import { issueRecordFixture } from '../test/fixtures/workspace/issue-record.fixture';
import { workspaceLedgerFixture } from '../test/fixtures/workspace/workspace-ledger.fixture';
import { workspaceSnapshotFixture } from '../test/fixtures/workspace/workspace-snapshot.fixture';

describe('contract fixtures', () => {
  it('accepts the locked graph and workspace fixtures', () => {
    expect(graphDefinitionSchema.parse(graphDefinitionFixture)).toEqual(graphDefinitionFixture);
    expect(workspaceSnapshotSchema.parse(workspaceSnapshotFixture)).toEqual(workspaceSnapshotFixture);
  });

  it('accepts transform dependency and graph catalog metadata while keeping legacy snapshots readable', () => {
    const candidate = structuredClone(workspaceSnapshotFixture) as any;
    candidate.transformPipeline[0] = {
      ...candidate.transformPipeline[0],
      dependencyMetadata: {
        datasetId: 'ds_main',
        dependsOnColumnIds: ['capacityRetention'],
        producesColumnIds: [],
        upstreamTransformIds: [],
      },
    };
    candidate.graphDefinitions[0] = {
      ...candidate.graphDefinitions[0],
      family: 'scatter',
      templateId: 'tpl_scatter_regression',
      overlays: [
        {
          ...candidate.graphDefinitions[0].overlays[0],
          catalogOverlayId: 'regression_linear',
        },
      ],
    };

    expect(workspaceSnapshotSchema.parse(candidate)).toEqual(candidate);

    delete candidate.transformPipeline[0].dependencyMetadata;
    delete candidate.graphDefinitions[0].family;
    delete candidate.graphDefinitions[0].templateId;
    delete candidate.graphDefinitions[0].overlays[0].catalogOverlayId;

    expect(workspaceSnapshotSchema.parse(candidate)).toEqual(candidate);
  });

  it('accepts the locked ledger, issue, release, telemetry, error, and worker fixtures', () => {
    expect(workspaceLedgerFixture.map((entry) => workspaceLedgerEntrySchema.parse(entry))).toEqual(workspaceLedgerFixture);
    expect(issueRecordSchema.parse(issueRecordFixture)).toEqual(issueRecordFixture);
    expect(releaseManifestSchema.parse(releaseManifestFixture)).toEqual(releaseManifestFixture);
    expect(supportMatrixSchema.parse(supportMatrixFixture)).toEqual(supportMatrixFixture);
    expect(telemetryBatchSchema.parse(telemetryBatchFixture)).toEqual(telemetryBatchFixture);
    expect(errorEnvelopeSchema.parse(errorEnvelopeFixture)).toEqual(errorEnvelopeFixture);
    expect(workerMessageEnvelopeSchema.parse(workerMessageEnvelopeFixture)).toEqual(workerMessageEnvelopeFixture);
  });
});

describe('contract invariants', () => {
  it('rejects workspace snapshots that reintroduce renderer persistence fields', () => {
    const candidate = structuredClone(workspaceSnapshotFixture) as any;
    candidate.graphDefinitions[0] = {
      ...candidate.graphDefinitions[0],
      renderer: {
        family: 'vega-lite',
        mode: 'svg',
      },
    };

    expect(workspaceSnapshotSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects workspace snapshots with unresolved active graph references', () => {
    const candidate = structuredClone(workspaceSnapshotFixture) as any;
    candidate.activeGraphId = 'graph_missing';

    expect(workspaceSnapshotSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects ledger entries without causality metadata', () => {
    const candidate = structuredClone(workspaceLedgerFixture[0]) as any;
    delete candidate.correlationId;

    expect(workspaceLedgerEntrySchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects issue records with invalid severity values', () => {
    const candidate = structuredClone(issueRecordFixture) as any;
    candidate.severity = 'critical';

    expect(issueRecordSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects issue records with invalid status values', () => {
    const candidate = structuredClone(issueRecordFixture) as any;
    candidate.status = 'closed';

    expect(issueRecordSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects telemetry payloads that break the redaction boundary', () => {
    const candidate = structuredClone(telemetryBatchFixture) as any;
    candidate.privacy.containsDatasetRows = true;

    expect(telemetryBatchSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects release manifests without a valid compatibility envelope', () => {
    const candidate = structuredClone(releaseManifestFixture) as any;
    candidate.workspaceCompatibility.maxReadableFormat = '';

    expect(releaseManifestSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects release manifests without a valid SHA-256 integrity token', () => {
    const candidate = structuredClone(releaseManifestFixture) as any;
    candidate.integrity.manifestSha256 = 'sha256:release-manifest-001';

    expect(releaseManifestSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects worker envelopes without versioned correlation metadata', () => {
    const candidate = structuredClone(workerMessageEnvelopeFixture) as any;
    candidate.workspaceVersion = 0;

    expect(workerMessageEnvelopeSchema.safeParse(candidate).success).toBe(false);
  });
});
