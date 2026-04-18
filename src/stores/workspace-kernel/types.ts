import type { StoreApi } from 'zustand/vanilla';

import type { ReadinessSummary } from '../../domain/readiness';
import type {
  CompatibilityState,
  IssueState,
  RepairEntryPointSummary,
  TelemetrySummary,
} from '../../domain/trust';
import type { WorkerMessageEnvelope } from '../../schemas/worker';
import type { IssueRecord, WorkspaceLedgerEntry, WorkspaceSnapshot } from '../../schemas/workspace';

export interface PendingWorkerRequest {
  correlationId: string;
  type: string;
  workspaceVersion: number;
}

export interface WorkspaceKernelData {
  snapshot: WorkspaceSnapshot;
  ledger: WorkspaceLedgerEntry[];
  workspaceVersion: number;
  pendingWorkerRequests: Record<string, PendingWorkerRequest>;
}

export interface KernelMutationMeta {
  actorId: string;
  correlationId: string;
  occurredAt: string;
  actorKind?: string;
}

export interface PromoteReferenceGraphInput extends KernelMutationMeta {
  graphId: string;
  reason?: string;
}

export interface QueueWorkerRequestInput {
  correlationId: string;
  type: string;
}

export interface ReplaceSnapshotInput {
  snapshot: WorkspaceSnapshot;
  ledger: WorkspaceLedgerEntry[];
}

export interface ApplyWorkerEnvelopeSuccess {
  applied: true;
}

export interface ApplyWorkerEnvelopeFailure {
  applied: false;
  reason: 'unknown-correlation' | 'stale-workspace-version' | 'type-mismatch';
}

export type ApplyWorkerEnvelopeResult = ApplyWorkerEnvelopeSuccess | ApplyWorkerEnvelopeFailure;

export interface WorkerEnvelopeContext<TPayload extends Record<string, unknown>> {
  message: WorkerMessageEnvelope & { payload: TPayload };
  snapshot: WorkspaceSnapshot;
  workspaceVersion: number;
}

export type WorkspaceSnapshotPatch = Partial<WorkspaceSnapshot>;

export interface WorkspaceKernelCommands {
  replaceSnapshot(input: ReplaceSnapshotInput): void;
  promoteReferenceGraph(input: PromoteReferenceGraphInput): void;
  replaceIssues(issues: IssueRecord[], meta?: KernelMutationMeta): void;
  updateTelemetrySnapshot(
    telemetrySnapshot: WorkspaceSnapshot['telemetrySnapshot'],
    meta: KernelMutationMeta,
  ): void;
  queueWorkerRequest(input: QueueWorkerRequestInput): void;
  applyWorkerEnvelope<TPayload extends Record<string, unknown>>(
    message: WorkerMessageEnvelope & { payload: TPayload },
    apply: (context: WorkerEnvelopeContext<TPayload>) => WorkspaceSnapshotPatch,
  ): ApplyWorkerEnvelopeResult;
}

export interface WorkspaceKernelSelectors {
  activeGraphId(): string;
  referenceGraphId(): string;
  issueState(): IssueState;
  repairEntryPoints(): RepairEntryPointSummary[];
  readinessSummary(): ReadinessSummary;
  telemetrySnapshot(): TelemetrySummary;
  compatibilityState(): CompatibilityState;
  persistedWorkspace(): WorkspaceSnapshot;
}

export interface WorkspaceKernelState extends WorkspaceKernelData {
  commands: WorkspaceKernelCommands;
  selectors: WorkspaceKernelSelectors;
}

export interface WorkspaceKernelStoreOptions {
  snapshot: WorkspaceSnapshot;
  ledger?: WorkspaceLedgerEntry[];
}

export type WorkspaceKernelStore = StoreApi<WorkspaceKernelState>;
