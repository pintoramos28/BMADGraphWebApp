import { workspaceLedgerEntrySchema } from '../../schemas/workspace';
import { selectReadinessSummary } from '../../domain/readiness';
import type { WorkspaceKernelData, KernelMutationMeta } from './types';
import type { WorkspaceLedgerEntry, WorkspaceSnapshot } from '../../schemas/workspace';

interface CreateLedgerEntryInput {
  data: WorkspaceKernelData;
  nextSnapshot: WorkspaceSnapshot;
  nextWorkspaceVersion: number;
  type: string;
  meta: KernelMutationMeta;
  entityRefs: Record<string, string>;
  payload: Record<string, unknown>;
  includeTrustImpact?: boolean;
}

export function initializeWorkspaceVersion(ledger: WorkspaceLedgerEntry[]) {
  return ledger.reduce((highestVersion, entry) => Math.max(highestVersion, entry.workspaceVersion), 1);
}

export function validateLedgerOrdering(ledger: WorkspaceLedgerEntry[]) {
  let previousSequence = 0;
  let previousWorkspaceVersion = 0;

  for (const entry of ledger) {
    workspaceLedgerEntrySchema.parse(entry);

    if (entry.sequence <= previousSequence) {
      throw new Error('Workspace ledger entries must remain append-only and sequence ordered.');
    }

    if (entry.workspaceVersion <= previousWorkspaceVersion) {
      throw new Error('Workspace ledger entries must remain append-only with strictly increasing workspace versions.');
    }

    previousSequence = entry.sequence;
    previousWorkspaceVersion = entry.workspaceVersion;
  }
}

export function createDefaultMutationMeta(type: string, workspaceVersion: number): KernelMutationMeta {
  return {
    actorId: 'system',
    actorKind: 'system',
    correlationId: `${type}.${workspaceVersion + 1}`,
    occurredAt: new Date().toISOString(),
  };
}

export function createLedgerEntry({
  data,
  nextSnapshot,
  nextWorkspaceVersion,
  type,
  meta,
  entityRefs,
  payload,
  includeTrustImpact = false,
}: CreateLedgerEntryInput) {
  const previousReadiness = selectReadinessSummary(data.snapshot);
  const nextReadiness = selectReadinessSummary(nextSnapshot);
  const trustImpact =
    includeTrustImpact || previousReadiness.status !== nextReadiness.status
      ? {
          readinessBefore: previousReadiness.status,
          readinessAfter: nextReadiness.status,
        }
      : undefined;

  return workspaceLedgerEntrySchema.parse({
    ledgerEntryId: `${type}.${nextWorkspaceVersion}`,
    sequence: (data.ledger.at(-1)?.sequence ?? 0) + 1,
    occurredAt: meta.occurredAt,
    type,
    actor: {
      kind: meta.actorKind ?? 'system',
      id: meta.actorId,
    },
    workspaceVersion: nextWorkspaceVersion,
    entityRefs,
    payload,
    ...(trustImpact ? { trustImpact } : {}),
    correlationId: meta.correlationId,
  });
}
