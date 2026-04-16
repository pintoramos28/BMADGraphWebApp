export interface WorkspaceWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface WorkspaceFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WorkspaceWritableFileStream>;
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
