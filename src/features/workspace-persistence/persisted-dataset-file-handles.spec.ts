import { describe, expect, it } from 'vitest';

import type { PersistedDatasetFileHandle } from '../../services/persistence';
import type { WorkspaceFileHandle } from '../../services/persistence/fs-access/portable-workspace-files';
import {
  preparePersistedDatasetFileHandlesForSave,
  sanitizePersistedDatasetFileHandlesForHydration,
} from './persisted-dataset-file-handles';

function createFileHandle(file: File): WorkspaceFileHandle {
  return {
    name: file.name,
    async getFile() {
      return file;
    },
    async createWritable() {
      return {
        async write() {},
        async close() {},
      };
    },
  };
}

describe('persisted dataset file handle helpers', () => {
  it('captures file metadata before persisting dataset file handles', async () => {
    const file = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const prepared = await preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        handle: createFileHandle(file),
      },
    ]);

    expect(prepared).toEqual([
      expect.objectContaining({
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        fileSize: 4,
        fileLastModified: 1713830400000,
      }),
    ]);
  });

  it('rejects same-name foreign handles during hydration when the live file metadata does not match the persisted metadata', async () => {
    const trustedFile = new File(['live'], 'live.csv', {
      lastModified: 1713830400000,
    });
    const foreignFile = new File(['changed-content'], 'live.csv', {
      lastModified: 1713830405000,
    });
    const trustedHandle = createFileHandle(trustedFile);
    const foreignHandle = createFileHandle(foreignFile);
    const prepared = await preparePersistedDatasetFileHandlesForSave([
      {
        datasetId: 'dataset_live',
        fileName: 'live.csv',
        fileHandleToken: 'live_token',
        handle: trustedHandle,
      },
    ]);
    const [trustedEntry] = prepared as PersistedDatasetFileHandle[];

    const sanitized = await sanitizePersistedDatasetFileHandlesForHydration([
      {
        ...trustedEntry,
        handle: foreignHandle,
      },
    ]);

    expect(sanitized).toEqual([]);
  });
});
