import { workspaceSnapshotSchema, type WorkspaceSnapshot } from '../../schemas/workspace';
import type { PersistedDatasetFileHandle } from '../../services/persistence';

export function synchronizeDatasetSourceFileMetadata(
  snapshot: WorkspaceSnapshot,
  datasetFileHandles: PersistedDatasetFileHandle[],
) {
  const sourceFilesByDatasetId = new Map(
    datasetFileHandles.map((entry) => [
      entry.datasetId,
      {
        fileName: entry.fileName,
        fileHandleToken: entry.fileHandleToken,
      },
    ]),
  );
  let snapshotChanged = false;

  const datasets = snapshot.datasets.map((dataset) => {
    const sourceFile = sourceFilesByDatasetId.get(dataset.datasetId);

    if (!sourceFile) {
      if (!dataset.sourceFile) {
        return dataset;
      }

      snapshotChanged = true;

      const datasetWithoutSourceFile = { ...dataset };
      delete datasetWithoutSourceFile.sourceFile;
      return datasetWithoutSourceFile;
    }

    if (
      dataset.sourceFile?.fileName === sourceFile.fileName
      && dataset.sourceFile?.fileHandleToken === sourceFile.fileHandleToken
    ) {
      return dataset;
    }

    snapshotChanged = true;

    return {
      ...dataset,
      sourceFile,
    };
  });

  if (!snapshotChanged) {
    return snapshot;
  }

  return workspaceSnapshotSchema.parse({
    ...snapshot,
    datasets,
  } satisfies WorkspaceSnapshot);
}
