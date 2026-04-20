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
  click(): void;
  remove(): void;
}

interface DocumentLike {
  body?: {
    appendChild(node: unknown): void;
  };
  createElement(tagName: 'input'): FileInputLike;
}

export interface OpenLocalImportFileOptions {
  sourceKind: Extract<ImportSourceKind, 'csv-file' | 'excel-file'>;
}

export function resolveLocalImportAccept(sourceKind: OpenLocalImportFileOptions['sourceKind']) {
  return sourceKind === 'excel-file'
    ? '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
    : '.csv,text/csv,text/plain';
}

export class BrowserLocalImportFileAccess {
  readonly #pickerHost: FilePickerHost;
  readonly #document: DocumentLike | undefined;

  constructor(
    pickerHost: FilePickerHost = globalThis as typeof globalThis & FilePickerHost,
    documentRef: DocumentLike | undefined = globalThis.document as DocumentLike | undefined,
  ) {
    this.#pickerHost = pickerHost;
    this.#document = documentRef;
  }

  async openLocalImportFile(options: OpenLocalImportFileOptions) {
    if (this.#pickerHost.showOpenFilePicker) {
      const handles = await this.#pickerHost.showOpenFilePicker({
        excludeAcceptAllOption: false,
        multiple: false,
        types: [
          {
            description: options.sourceKind === 'excel-file' ? 'Excel workbook' : 'Delimited text',
            accept: {
              [options.sourceKind === 'excel-file'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv']: options.sourceKind === 'excel-file' ? ['.xlsx', '.xls'] : ['.csv'],
            },
          },
        ],
      });

      return handles[0]?.getFile() ?? null;
    }

    if (!this.#document?.body) {
      throw new Error('File selection is unavailable in this environment.');
    }

    return new Promise<File | null>((resolve) => {
      const input = this.#document.createElement('input');
      input.type = 'file';
      input.accept = resolveLocalImportAccept(options.sourceKind);
      input.multiple = false;
      input.style.display = 'none';

      input.addEventListener(
        'change',
        () => {
          const file = input.files?.[0] ?? null;
          input.remove();
          resolve(file);
        },
        { once: true },
      );

      this.#document.body?.appendChild(input);
      input.click();
    });
  }
}
