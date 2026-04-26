import { describe, expect, it, vi } from 'vitest';

import { validateWorkspaceFileHandleSnapshot, type WorkspaceFileHandle } from './portable-workspace-files';

function createWorkspaceHandle(file: File): WorkspaceFileHandle {
  return {
    name: file.name,
    getFile: vi.fn(async () => file),
    async createWritable() {
      return {
        async write() {},
        async close() {},
      };
    },
  };
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

describe('validateWorkspaceFileHandleSnapshot', () => {
  it('checks cancellation before starting workspace file-handle validation reads', async () => {
    const file = new File(['live'], 'workspace.json', {
      lastModified: 1713830400000,
    });
    const handle = createWorkspaceHandle(file);
    const abortController = new AbortController();
    abortController.abort(new Error('Workspace validation already canceled.'));

    await expect(validateWorkspaceFileHandleSnapshot(handle, {
      fileName: 'workspace.json',
      fileSize: file.size,
      fileLastModified: file.lastModified,
      fileSha256: await sha256Hex(file),
    }, {
      signal: abortController.signal,
    })).resolves.toBeNull();
    expect(handle.getFile).not.toHaveBeenCalled();
  });
});
