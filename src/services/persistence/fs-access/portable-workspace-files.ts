export interface WorkspaceWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface WorkspaceFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WorkspaceWritableFileStream>;
}

export interface WorkspaceFileHandleSnapshot {
  fileName: string;
  fileSize?: number | undefined;
  fileLastModified?: number | undefined;
  fileSha256: string;
}

export interface WorkspaceFileHandleSnapshotValidationOptions {
  signal?: AbortSignal | undefined;
  assertNotStale?: (() => void) | undefined;
  timeoutMs?: number | undefined;
}

export interface OpenWorkspaceFileOptions {
  multiple?: boolean;
}

export interface SaveWorkspaceFileOptions {
  suggestedName: string;
  contents: BlobPart[];
  mimeType?: string;
}

interface FilePickerHost {
  showOpenFilePicker?: (options?: Record<string, unknown>) => Promise<WorkspaceFileHandle[]>;
  showSaveFilePicker?: (options?: Record<string, unknown>) => Promise<WorkspaceFileHandle>;
}

function createFileHandleValidationCancellationError(signal: AbortSignal | undefined) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error('Workspace file-handle validation was canceled.');
}

function createFileHandleValidationTimeoutError() {
  return new Error('Workspace file-handle validation timed out.');
}

function assertWorkspaceFileHandleValidationActive(options: WorkspaceFileHandleSnapshotValidationOptions) {
  if (options.signal?.aborted) {
    throw createFileHandleValidationCancellationError(options.signal);
  }

  options.assertNotStale?.();
}

function createAggregateValidationOptions(
  options: WorkspaceFileHandleSnapshotValidationOptions,
) {
  if (options.timeoutMs === undefined) {
    return () => options;
  }

  const deadline = Date.now() + Math.max(0, options.timeoutMs);

  return () => ({
    ...options,
    timeoutMs: Math.max(0, deadline - Date.now()),
  });
}

async function awaitWorkspaceFileHandleValidation<T>(
  operation: Promise<T>,
  options: WorkspaceFileHandleSnapshotValidationOptions = {},
) {
  if (!options.signal && !options.assertNotStale && options.timeoutMs === undefined) {
    return operation;
  }

  let cleanup = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    const rejectIfAborted = () => reject(createFileHandleValidationCancellationError(options.signal));
    let staleCheckTimer: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (options.signal) {
      if (options.signal.aborted) {
        rejectIfAborted();

        return;
      }

      options.signal.addEventListener('abort', rejectIfAborted, { once: true });
    }

    if (options.assertNotStale) {
      staleCheckTimer = setInterval(() => {
        try {
          options.assertNotStale?.();
        } catch (error) {
          reject(error);
        }
      }, 10);
    }

    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(() => reject(createFileHandleValidationTimeoutError()), options.timeoutMs);
    }

    cleanup = () => {
      if (options.signal) {
        options.signal.removeEventListener('abort', rejectIfAborted);
      }

      if (staleCheckTimer !== undefined) {
        clearInterval(staleCheckTimer);
      }

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    };
  });

  try {
    return await Promise.race([operation, cancellation]);
  } finally {
    cleanup();
  }
}

async function sha256Hex(
  binaryContent: ArrayBuffer,
  options: WorkspaceFileHandleSnapshotValidationOptions = {},
) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Browser source-file verification is unavailable in this environment.');
  }

  const digest = await awaitWorkspaceFileHandleValidation(crypto.subtle.digest('SHA-256', binaryContent), options);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function validateWorkspaceFileHandleSnapshot(
  handle: WorkspaceFileHandle,
  expected: WorkspaceFileHandleSnapshot,
  options: WorkspaceFileHandleSnapshotValidationOptions = {},
): Promise<WorkspaceFileHandleSnapshot | null> {
  let file: File;
  const createValidationPhaseOptions = createAggregateValidationOptions(options);

  try {
    assertWorkspaceFileHandleValidationActive(createValidationPhaseOptions());
    file = await awaitWorkspaceFileHandleValidation(handle.getFile(), createValidationPhaseOptions());
    assertWorkspaceFileHandleValidationActive(createValidationPhaseOptions());
  } catch {
    return null;
  }

  if (
    file.name !== expected.fileName
    || (expected.fileSize !== undefined && file.size !== expected.fileSize)
    || (expected.fileLastModified !== undefined && file.lastModified !== expected.fileLastModified)
  ) {
    return null;
  }

  try {
    assertWorkspaceFileHandleValidationActive(createValidationPhaseOptions());
    const fileSha256 = await sha256Hex(
      await awaitWorkspaceFileHandleValidation(file.arrayBuffer(), createValidationPhaseOptions()),
      createValidationPhaseOptions(),
    );
    assertWorkspaceFileHandleValidationActive(createValidationPhaseOptions());

    if (fileSha256 !== expected.fileSha256) {
      return null;
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      fileSha256,
    };
  } catch {
    return null;
  }
}

export class BrowserPortableWorkspaceFileAccess {
  readonly #host: FilePickerHost;

  constructor(host: FilePickerHost = globalThis as typeof globalThis & FilePickerHost) {
    this.#host = host;
  }

  async openWorkspaceFiles(options: OpenWorkspaceFileOptions = {}) {
    if (!this.#host.showOpenFilePicker) {
      throw new Error('File System Access API is unavailable in this environment.');
    }

    return this.#host.showOpenFilePicker({
      excludeAcceptAllOption: false,
      multiple: options.multiple ?? false,
    });
  }

  async saveWorkspaceFile(options: SaveWorkspaceFileOptions) {
    if (!this.#host.showSaveFilePicker) {
      throw new Error('File System Access API is unavailable in this environment.');
    }

    const handle = await this.#host.showSaveFilePicker({
      suggestedName: options.suggestedName,
      types: [
        {
          description: 'BMAD workspace',
          accept: {
            [options.mimeType ?? 'application/json']: ['.json'],
          },
        },
      ],
    });
    const writable = await handle.createWritable();

    await writable.write(new Blob(options.contents, { type: options.mimeType ?? 'application/json' }));
    await writable.close();

    return handle;
  }
}
