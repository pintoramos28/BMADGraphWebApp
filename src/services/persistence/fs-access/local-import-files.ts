import type { ImportSourceKind } from '../../../features/import';

interface FilePickerHandle {
  getFile(): Promise<File>;
}

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

export const HIDDEN_INPUT_CANCEL_POLL_MS = 50;
export const HIDDEN_INPUT_CANCEL_GRACE_MS = 500;
export const HIDDEN_INPUT_PICKER_STALE_TIMEOUT_MS = 60_000;

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

  constructor(
    pickerHost: FilePickerHost = globalThis as typeof globalThis & FilePickerHost,
    documentRef: DocumentLike | undefined = globalThis.document as DocumentLike | undefined,
    interactionHost: InteractionHost = globalThis as typeof globalThis & InteractionHost,
  ) {
    this.#pickerHost = pickerHost;
    this.#document = documentRef;
    this.#interactionHost = interactionHost;
  }

  async openLocalImportFile(options: OpenLocalImportFileOptions) {
    let nativePickerError: unknown = null;

    if (this.#pickerHost.showOpenFilePicker) {
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

        return handles[0]?.getFile() ?? null;
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

    return new Promise<File | null>((resolve, reject) => {
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
        resolve(file);
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
}
