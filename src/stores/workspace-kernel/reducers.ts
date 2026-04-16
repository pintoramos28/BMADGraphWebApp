import { workspaceSnapshotSchema } from '../../schemas/workspace';
import { createDefaultMutationMeta, createLedgerEntry, initializeWorkspaceVersion, validateLedgerOrdering } from './events';
import type {
  ApplyWorkerEnvelopeResult,
  KernelMutationMeta,
  PromoteReferenceGraphInput,
  QueueWorkerRequestInput,
  ReplaceSnapshotInput,
  WorkerEnvelopeContext,
  WorkspaceKernelData,
  WorkspaceSnapshotPatch,
} from './types';
import type { IssueRecord, WorkspaceSnapshot } from '../../schemas/workspace';
import type { WorkerMessageEnvelope } from '../../schemas/worker';

function commitSnapshotMutation(
  data: WorkspaceKernelData,
  patch: WorkspaceSnapshotPatch,
  options: {
    type: string;
    meta?: KernelMutationMeta;
    entityRefs?: Record<string, string>;
    payload?: Record<string, unknown>;
    includeTrustImpact?: boolean;
  },
) {
  const nextWorkspaceVersion = data.workspaceVersion + 1;
  const meta = options.meta ?? createDefaultMutationMeta(options.type, data.workspaceVersion);
  const nextSnapshot = workspaceSnapshotSchema.parse({
    ...data.snapshot,
    ...patch,
    updatedAt: meta.occurredAt,
  } satisfies WorkspaceSnapshot);
  const ledgerEntryOptions = {
    data,
    nextSnapshot,
    nextWorkspaceVersion,
    type: options.type,
    meta,
    entityRefs: options.entityRefs ?? {
      workspaceId: nextSnapshot.workspaceId,
    },
    payload: options.payload ?? {},
  };

  return {
    snapshot: nextSnapshot,
    workspaceVersion: nextWorkspaceVersion,
    pendingWorkerRequests: data.pendingWorkerRequests,
    ledger: [
      ...data.ledger,
      createLedgerEntry({
        ...ledgerEntryOptions,
        ...(options.includeTrustImpact !== undefined
          ? {
              includeTrustImpact: options.includeTrustImpact,
            }
          : {}),
      }),
    ],
  } satisfies WorkspaceKernelData;
}

export function replaceSnapshotReducer(data: WorkspaceKernelData, input: ReplaceSnapshotInput) {
  const nextSnapshot = workspaceSnapshotSchema.parse(input.snapshot);
  const nextLedger = [...input.ledger];

  validateLedgerOrdering(nextLedger);

  return {
    ...data,
    snapshot: nextSnapshot,
    ledger: nextLedger,
    workspaceVersion: initializeWorkspaceVersion(nextLedger),
    pendingWorkerRequests: {},
  } satisfies WorkspaceKernelData;
}

export function promoteReferenceGraphReducer(data: WorkspaceKernelData, input: PromoteReferenceGraphInput) {
  const graphExists = data.snapshot.graphDefinitions.some((graph) => graph.graphId === input.graphId);

  if (!graphExists) {
    throw new Error(`Unknown graph "${input.graphId}" cannot be promoted.`);
  }

  const previousReferenceGraphId = data.snapshot.referenceGraphId;
  const graphDefinitions = data.snapshot.graphDefinitions.map((graph) => {
    if (graph.graphId === input.graphId) {
      return {
        ...graph,
        status: 'reference',
      } satisfies typeof graph;
    }

    if (graph.graphId === previousReferenceGraphId && graph.graphId !== input.graphId && graph.status === 'reference') {
      return {
        ...graph,
        status: 'candidate',
      } satisfies typeof graph;
    }

    return graph;
  });

  return commitSnapshotMutation(
    data,
    {
      graphDefinitions,
      referenceGraphId: input.graphId,
      exportSummary: {
        ...data.snapshot.exportSummary,
        includedReferenceGraphId: input.graphId,
      },
    },
    {
      type: 'graph.promoted',
      meta: input,
      entityRefs: {
        workspaceId: data.snapshot.workspaceId,
        graphId: input.graphId,
        previousReferenceGraphId,
      },
      payload: {
        reason: input.reason ?? 'Reference graph promoted.',
      },
      includeTrustImpact: true,
    },
  );
}

export function replaceIssuesReducer(data: WorkspaceKernelData, issues: IssueRecord[], meta?: KernelMutationMeta) {
  return commitSnapshotMutation(
    data,
    {
      issues,
    },
    {
      type: 'issues.updated',
      ...(meta ? { meta } : {}),
      payload: {
        total: issues.length,
      },
      includeTrustImpact: true,
    },
  );
}

export function updateTelemetrySnapshotReducer(
  data: WorkspaceKernelData,
  telemetrySnapshot: WorkspaceSnapshot['telemetrySnapshot'],
  meta: KernelMutationMeta,
) {
  return commitSnapshotMutation(
    data,
    {
      telemetrySnapshot,
    },
    {
      type: 'telemetry.snapshot.updated',
      meta,
      payload: {
        status: telemetrySnapshot.status,
        offlineQueueDepth: telemetrySnapshot.offlineQueueDepth,
        lastGraphRenderMs: telemetrySnapshot.lastGraphRenderMs,
      },
    },
  );
}

export function queueWorkerRequestReducer(data: WorkspaceKernelData, input: QueueWorkerRequestInput) {
  return {
    ...data,
    pendingWorkerRequests: {
      ...data.pendingWorkerRequests,
      [input.correlationId]: {
        correlationId: input.correlationId,
        type: input.type,
        workspaceVersion: data.workspaceVersion,
      },
    },
  } satisfies WorkspaceKernelData;
}

export function applyWorkerEnvelopeReducer<TPayload extends Record<string, unknown>>(
  data: WorkspaceKernelData,
  message: WorkerMessageEnvelope & { payload: TPayload },
  apply: (context: WorkerEnvelopeContext<TPayload>) => WorkspaceSnapshotPatch,
) {
  const request = data.pendingWorkerRequests[message.correlationId];

  if (!request) {
    return {
      nextData: data,
      result: {
        applied: false,
        reason: 'unknown-correlation',
      } satisfies ApplyWorkerEnvelopeResult,
    };
  }

  const pendingWorkerRequests = { ...data.pendingWorkerRequests };
  delete pendingWorkerRequests[message.correlationId];

  if (request.type !== message.type) {
    return {
      nextData: {
        ...data,
        pendingWorkerRequests,
      } satisfies WorkspaceKernelData,
      result: {
        applied: false,
        reason: 'type-mismatch',
      } satisfies ApplyWorkerEnvelopeResult,
    };
  }

  if (request.workspaceVersion !== message.workspaceVersion || data.workspaceVersion !== message.workspaceVersion) {
    return {
      nextData: {
        ...data,
        pendingWorkerRequests,
      } satisfies WorkspaceKernelData,
      result: {
        applied: false,
        reason: 'stale-workspace-version',
      } satisfies ApplyWorkerEnvelopeResult,
    };
  }

  const nextData = commitSnapshotMutation(
    {
      ...data,
      pendingWorkerRequests,
    },
    apply({
      message,
      snapshot: data.snapshot,
      workspaceVersion: data.workspaceVersion,
    }),
    {
      type: message.type,
      meta: {
        actorId: 'worker',
        actorKind: 'system',
        correlationId: message.correlationId,
        occurredAt: new Date().toISOString(),
      },
      payload: {
        messageId: message.messageId,
      },
    },
  );

  return {
    nextData,
    result: {
      applied: true,
    } satisfies ApplyWorkerEnvelopeResult,
  };
}
