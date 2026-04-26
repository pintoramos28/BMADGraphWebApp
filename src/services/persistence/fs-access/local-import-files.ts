import type { ImportSourceKind } from '../../../features/import';
import type { WorkspaceFileHandle } from './portable-workspace-files';

type FilePickerHandle = WorkspaceFileHandle;

interface FilePickerHost {
  showOpenFilePicker?: (options?: Record<string, unknown>) => Promise<FilePickerHandle[]>;
}

interface FileInputLike {
  type: string;
  accept: string;
  multiple: boolean;
  style: {
    display: string;
  };
  files: FileList | null;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: { once?: boolean }): void;
  removeEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
  click(): void;
  remove(): void;
}

interface DocumentLike {
  body?: {
    appendChild(node: unknown): void;
  };
  createElement(tagName: 'input'): FileInputLike;
}

interface InteractionHost {
  addEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: { once?: boolean },
  ): void;
  removeEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
  setTimeout(handler: () => void, timeout?: number): ReturnType<typeof globalThis.setTimeout>;
  clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>): void;
}

export interface OpenLocalImportFileOptions {
  sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>;
}

export interface BrowserLocalImportFileAccessOptions {
  preferNativePicker?: boolean;
}

export interface LocalImportSelection {
  file: File;
  handle?: WorkspaceFileHandle;
}

export interface LocalImportSourceValidationInput {
  sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>;
  fileName: string;
  previewFile: File;
  signal?: AbortSignal | undefined;
  selection: {
    sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>;
    fileName: string;
    handle?: WorkspaceFileHandle | undefined;
  } | null;
}

export interface ValidatedLocalImportSourceFileHandle {
  handle: WorkspaceFileHandle;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  fileSha256: string;
}

export class LocalImportSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalImportSourceValidationError';
  }
}

export const HIDDEN_INPUT_CANCEL_POLL_MS = 50;
export const HIDDEN_INPUT_CANCEL_GRACE_MS = 500;
export const HIDDEN_INPUT_PICKER_STALE_TIMEOUT_MS = 60_000;
export const LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS = 30_000;

const SOURCE_RESELECTION_MESSAGE = 'Reselect the source file before confirming this import.';
const SOURCE_CHANGED_MESSAGE = 'The selected source file changed after preview. Reselect and preview it again before confirming.';
const SOURCE_VALIDATION_CANCELED_MESSAGE = 'The source-file validation was canceled because the preview changed.';
const SOURCE_VALIDATION_TIMEOUT_MESSAGE = 'The source-file validation timed out. Reselect the source file before confirming this import.';

function assertSourceValidationNotAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new LocalImportSourceValidationError(SOURCE_VALIDATION_CANCELED_MESSAGE);
  }
}

async function awaitWithSourceValidationCancellation<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
  deadlineMs: number = Date.now() + LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS,
) {
  assertSourceValidationNotAborted(signal);

  let cleanup = () => {};
  const cancellation = signal
    ? new Promise<never>((_, reject) => {
        const rejectIfAborted = () => reject(new LocalImportSourceValidationError(SOURCE_VALIDATION_CANCELED_MESSAGE));

        signal.addEventListener('abort', rejectIfAborted, { once: true });
        cleanup = () => signal.removeEventListener('abort', rejectIfAborted);
      })
    : null;
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    const timeoutMs = Math.max(0, deadlineMs - Date.now());

    timeoutHandle = globalThis.setTimeout(() => {
      reject(new LocalImportSourceValidationError(SOURCE_VALIDATION_TIMEOUT_MESSAGE));
    }, timeoutMs);
  });

  try {
    return await Promise.race(cancellation ? [operation, cancellation, timeout] : [operation, timeout]);
  } finally {
    cleanup();

    if (timeoutHandle !== undefined) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
}

function isSourceValidationControlError(error: unknown) {
  return error instanceof LocalImportSourceValidationError && (
    error.message === SOURCE_VALIDATION_CANCELED_MESSAGE || error.message === SOURCE_VALIDATION_TIMEOUT_MESSAGE
  );
}

async function sha256Hex(binaryContent: ArrayBuffer, signal?: AbortSignal | undefined, deadlineMs?: number | undefined) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new LocalImportSourceValidationError(SOURCE_RESELECTION_MESSAGE);
  }

  const digest = await awaitWithSourceValidationCancellation(crypto.subtle.digest('SHA-256', binaryContent), signal, deadlineMs);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function readFileBytesForSourceValidation(file: File, signal?: AbortSignal | undefined, deadlineMs?: number | undefined) {
  try {
    return await awaitWithSourceValidationCancellation(file.arrayBuffer(), signal, deadlineMs);
  } catch (error) {
    if (isSourceValidationControlError(error)) {
      throw error;
    }

    throw new LocalImportSourceValidationError(SOURCE_RESELECTION_MESSAGE);
  }
}

export async function validateLocalImportFileHandleMatchesPreview({
  sourceKind,
  fileName,
  previewFile,
  signal,
  selection,
}: LocalImportSourceValidationInput): Promise<ValidatedLocalImportSourceFileHandle | undefined> {
  const validationDeadlineMs = Date.now() + LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS;

  assertSourceValidationNotAborted(signal);

  if (!selection?.handle) {
    return undefined;
  }

  if (selection.sourceKind !== sourceKind || selection.fileName !== fileName) {
    throw new LocalImportSourceValidationError(SOURCE_RESELECTION_MESSAGE);
  }

  let liveFile: File;

  try {
    assertSourceValidationNotAborted(signal);
    liveFile = await awaitWithSourceValidationCancellation(selection.handle.getFile(), signal, validationDeadlineMs);
  } catch (error) {
    if (isSourceValidationControlError(error)) {
      throw error;
    }

    assertSourceValidationNotAborted(signal);
    throw new LocalImportSourceValidationError(SOURCE_RESELECTION_MESSAGE);
  }

  assertSourceValidationNotAborted(signal);

  if (
    liveFile.name !== previewFile.name
    || liveFile.size !== previewFile.size
    || liveFile.lastModified !== previewFile.lastModified
  ) {
    throw new LocalImportSourceValidationError(SOURCE_CHANGED_MESSAGE);
  }

  assertSourceValidationNotAborted(signal);
  const liveSha256 = await sha256Hex(
    await readFileBytesForSourceValidation(liveFile, signal, validationDeadlineMs),
    signal,
    validationDeadlineMs,
  );
  assertSourceValidationNotAborted(signal);
  const previewSha256 = await sha256Hex(
    await readFileBytesForSourceValidation(previewFile, signal, validationDeadlineMs),
    signal,
    validationDeadlineMs,
  );
  assertSourceValidationNotAborted(signal);

  if (liveSha256 !== previewSha256) {
    throw new LocalImportSourceValidationError(SOURCE_CHANGED_MESSAGE);
  }

  return {
    handle: selection.handle,
    fileName: liveFile.name,
    fileSize: liveFile.size,
    fileLastModified: liveFile.lastModified,
    fileSha256: liveSha256,
  };
}

export function resolveLocalImportAccept(sourceKind: OpenLocalImportFileOptions['sourceKind']) {
  return sourceKind === 'excel-file'
    ? '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
    : '.csv,.tsv,text/csv,text/tab-separated-values,text/plain';
}

export function isFilePickerCancellationError(error: unknown) {
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export class BrowserLocalImportFileAccess {
  readonly #pickerHost: FilePickerHost;
  readonly #document: DocumentLike | undefined;
  readonly #interactionHost: InteractionHost;
  readonly #preferNativePicker: boolean;

  constructor(
    pickerHost: FilePickerHost = globalThis as typeof globalThis & FilePickerHost,
    documentRef: DocumentLike | undefined = globalThis.document as DocumentLike | undefined,
    interactionHost: InteractionHost = globalThis as typeof globalThis & InteractionHost,
    options: BrowserLocalImportFileAccessOptions = {},
  ) {
    this.#pickerHost = pickerHost;
    this.#document = documentRef;
    this.#interactionHost = interactionHost;
    this.#preferNativePicker = options.preferNativePicker ?? false;
  }

  async openLocalImportSource(options: OpenLocalImportFileOptions): Promise<LocalImportSelection | null> {
    let nativePickerError: unknown = null;

    if (this.#preferNativePicker && this.#pickerHost.showOpenFilePicker) {
      try {
        const handles = await this.#pickerHost.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              description: options.sourceKind === 'excel-file' ? 'Excel workbook' : 'Delimited text',
              accept: {
                ...(options.sourceKind === 'excel-file'
                  ? {
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                      'application/vnd.ms-excel': ['.xls'],
                    }
                  : {
                      'text/csv': ['.csv'],
                      'text/tab-separated-values': ['.tsv'],
                      'text/plain': ['.csv', '.tsv'],
                    }),
              },
            },
          ],
        });

        const handle = handles[0];

        if (!handle) {
          return null;
        }

        const file = await handle.getFile();

        return {
          file,
          handle,
        };
      } catch (error) {
        if (isFilePickerCancellationError(error)) {
          return null;
        }

        nativePickerError = error;
      }
    }

    const documentRef = this.#document;
    const documentBody = documentRef?.body;

    if (!documentRef || !documentBody) {
      if (nativePickerError) {
        throw nativePickerError;
      }

      throw new Error('File selection is unavailable in this environment.');
    }

    return new Promise<LocalImportSelection | null>((resolve, reject) => {
      const input = documentRef.createElement('input');
      input.type = 'file';
      input.accept = resolveLocalImportAccept(options.sourceKind);
      input.multiple = false;
      input.style.display = 'none';
      let selectionPollTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
      let focusCancelTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
      let stalePickerTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
      let settled = false;

      const clearSelectionPollTimeout = () => {
        if (selectionPollTimeout === null) {
          return;
        }

        this.#interactionHost.clearTimeout(selectionPollTimeout);
        selectionPollTimeout = null;
      };

      const clearStalePickerTimeout = () => {
        if (stalePickerTimeout === null) {
          return;
        }

        this.#interactionHost.clearTimeout(stalePickerTimeout);
        stalePickerTimeout = null;
      };

      const clearFocusCancelTimeout = () => {
        if (focusCancelTimeout === null) {
          return;
        }

        this.#interactionHost.clearTimeout(focusCancelTimeout);
        focusCancelTimeout = null;
      };

      const pollForSelection = () => {
        selectionPollTimeout = null;
        const selectedFile = input.files?.[0] ?? null;

        if (selectedFile) {
          settle(selectedFile);
          return;
        }

        selectionPollTimeout = this.#interactionHost.setTimeout(pollForSelection, HIDDEN_INPUT_CANCEL_POLL_MS);
      };

      const settle = (file: File | null) => {
        if (settled) {
          return;
        }

        settled = true;
        clearSelectionPollTimeout();
        clearFocusCancelTimeout();
        clearStalePickerTimeout();
        this.#interactionHost.removeEventListener?.('focus', handleFocusReturn);
        input.remove();
        resolve(file ? { file } : null);
      };

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        clearSelectionPollTimeout();
        clearFocusCancelTimeout();
        clearStalePickerTimeout();
        this.#interactionHost.removeEventListener?.('focus', handleFocusReturn);
        input.remove();
        reject(error);
      };

      const handleFocusReturn = () => {
        clearFocusCancelTimeout();
        focusCancelTimeout = this.#interactionHost.setTimeout(() => {
          focusCancelTimeout = null;

          if (input.files?.[0]) {
            settle(input.files[0]);
            return;
          }

          settle(null);
        }, HIDDEN_INPUT_CANCEL_GRACE_MS);
      };

      input.addEventListener(
        'change',
        () => {
          settle(input.files?.[0] ?? null);
        },
        { once: true },
      );
      input.addEventListener(
        'cancel',
        () => {
          settle(null);
        },
        { once: true },
      );

      documentBody.appendChild(input);
      this.#interactionHost.addEventListener?.('focus', handleFocusReturn);
      selectionPollTimeout = this.#interactionHost.setTimeout(pollForSelection, HIDDEN_INPUT_CANCEL_POLL_MS);
      stalePickerTimeout = this.#interactionHost.setTimeout(() => {
        settle(null);
      }, HIDDEN_INPUT_PICKER_STALE_TIMEOUT_MS);

      try {
        input.click();
      } catch (error) {
        fail(error);
      }
    });
  }

  async openLocalImportFile(options: OpenLocalImportFileOptions) {
    const selection = await this.openLocalImportSource(options);

    return selection?.file ?? null;
  }
}
