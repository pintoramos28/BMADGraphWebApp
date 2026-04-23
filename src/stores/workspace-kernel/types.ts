import type { StoreApi } from 'zustand/vanilla';

import type { ReadinessSummary } from '../../domain/readiness';
import type { ImportRepairSelections, ImportPreviewSource } from '../../features/import/preview-model';
import type {
  CompatibilityState,
  IssueState,
  RepairEntryPointSummary,
  TelemetrySummary,
} from '../../domain/trust';
import type { PersistedDatasetFileHandle } from '../../services/persistence';
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
  datasetFileHandles: PersistedDatasetFileHandle[];
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
  datasetFileHandles?: PersistedDatasetFileHandle[];
}

export interface ConfirmImportInput extends KernelMutationMeta {
  previewId: string;
  graphId: string;
  source: Pick<ImportPreviewSource, 'sourceKind' | 'sourceLabel' | 'fileName' | 'benchmarkScenario'>;
  repairSelections: ImportRepairSelections;
  dataset: WorkspaceSnapshot['datasets'][number];
  issues: IssueRecord[];
}

export interface RollbackConfirmedImportInput extends KernelMutationMeta {
  datasetId: string;
  graphId: string;
  issueIds: string[];
  previousActiveGraphId: string;
  previousReferenceGraphId: string;
  fallbackDatasets: WorkspaceSnapshot['datasets'];
  fallbackGraphDefinitions: WorkspaceSnapshot['graphDefinitions'];
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
  replaceDatasetFileHandles(datasetFileHandles: PersistedDatasetFileHandle[]): void;
  promoteReferenceGraph(input: PromoteReferenceGraphInput): void;
  confirmImport(input: ConfirmImportInput): void;
  rollbackConfirmedImport(input: RollbackConfirmedImportInput): void;
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
  datasetFileHandles(): PersistedDatasetFileHandle[];
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
  datasetFileHandles?: PersistedDatasetFileHandle[];
}

export type WorkspaceKernelStore = StoreApi<WorkspaceKernelState>;
