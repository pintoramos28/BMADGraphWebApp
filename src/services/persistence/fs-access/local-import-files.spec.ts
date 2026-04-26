import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BrowserLocalImportFileAccess,
  HIDDEN_INPUT_CANCEL_GRACE_MS,
  HIDDEN_INPUT_PICKER_STALE_TIMEOUT_MS,
  LocalImportSourceValidationError,
  LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS,
  resolveLocalImportAccept,
  validateLocalImportFileHandleMatchesPreview,
} from './local-import-files';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BrowserLocalImportFileAccess', () => {
  it('validates local import handles by byte identity behind the file-access boundary', async () => {
    const previewFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const handle = {
      name: 'source.csv',
      getFile: vi.fn(async () => previewFile),
      createWritable: vi.fn(async () => ({
        async write() {},
        async close() {},
      })),
    };

    await expect(validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle,
      },
    })).resolves.toEqual({
      handle,
      fileName: 'source.csv',
      fileSize: previewFile.size,
      fileLastModified: 1713830400000,
      fileSha256: expect.any(String),
    });
  });

  it('does not hold live and preview source bytes in memory concurrently during validation', async () => {
    const previewFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const liveFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const previewArrayBuffer = vi.spyOn(previewFile, 'arrayBuffer');
    let resolveLiveBytes: (value: ArrayBuffer) => void = (value: ArrayBuffer) => {
      void value;
      throw new Error('Live byte read did not start.');
    };
    let markLiveByteReadStarted: () => void = () => {};
    const liveByteReadStarted = new Promise<void>((resolve) => {
      markLiveByteReadStarted = resolve;
    });

    vi.spyOn(liveFile, 'arrayBuffer').mockImplementation(() => new Promise<ArrayBuffer>((resolve) => {
      markLiveByteReadStarted();
      resolveLiveBytes = resolve;
    }));

    const validation = validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          async getFile() {
            return liveFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    });

    await liveByteReadStarted;
    expect(previewArrayBuffer).not.toHaveBeenCalled();

    resolveLiveBytes(await new File(['Sample,Reading\nA-1,42.5'], 'source.csv').arrayBuffer());

    await expect(validation).resolves.toEqual(expect.objectContaining({
      fileSha256: expect.any(String),
    }));
    expect(previewArrayBuffer).toHaveBeenCalledTimes(1);
  });

  it('re-checks cancellation before starting preview source byte reads during validation', async () => {
    const previewFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const liveFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const abortController = new AbortController();
    const previewArrayBuffer = vi.spyOn(previewFile, 'arrayBuffer');

    vi.spyOn(liveFile, 'arrayBuffer').mockImplementation(async () => {
      abortController.abort();

      return new File(['Sample,Reading\nA-1,42.5'], 'source.csv').arrayBuffer();
    });

    await expect(validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      signal: abortController.signal,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          async getFile() {
            return liveFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    })).rejects.toThrow('source-file validation was canceled');
    expect(previewArrayBuffer).not.toHaveBeenCalled();
  });

  it('rejects promptly when validation is aborted during a pending source byte read', async () => {
    const previewFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const liveFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const abortController = new AbortController();

    vi.spyOn(liveFile, 'arrayBuffer').mockReturnValue(new Promise<ArrayBuffer>(() => {}));

    const validation = validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      signal: abortController.signal,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          async getFile() {
            return liveFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    });

    await Promise.resolve();
    abortController.abort();

    await expect(validation).rejects.toThrow('source-file validation was canceled');
  });

  it('times out non-cooperative local source validation before confirm materialization can start', async () => {
    vi.useFakeTimers();

    const previewFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const validation = validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          getFile: vi.fn(() => new Promise<File>(() => {})),
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    });

    await vi.advanceTimersByTimeAsync(LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS - 1);
    await expect(Promise.race([validation.then(() => 'resolved', () => 'rejected'), Promise.resolve('pending')]))
      .resolves.toBe('pending');

    await vi.advanceTimersByTimeAsync(1);

    await expect(validation).rejects.toThrow('source-file validation timed out');
  });

  it('uses one aggregate source-validation deadline across file and digest phases', async () => {
    vi.useFakeTimers();

    const liveFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const previewFile = new File(['Sample,Reading\nA-1,42.5'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    vi.spyOn(liveFile, 'arrayBuffer').mockImplementation(() => new Promise<ArrayBuffer>((resolve) => {
      setTimeout(() => resolve(new TextEncoder().encode('Sample,Reading\nA-1,42.5').buffer), LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS - 1);
    }));
    vi.spyOn(previewFile, 'arrayBuffer').mockReturnValue(new Promise<ArrayBuffer>(() => {}));

    const validation = validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          async getFile() {
            return liveFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    });
    const observedValidation = validation.then(
      () => null,
      (error: unknown) => error,
    );

    await vi.advanceTimersByTimeAsync(LOCAL_IMPORT_SOURCE_VALIDATION_TIMEOUT_MS - 1);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1);

    await expect(observedValidation).resolves.toEqual(expect.objectContaining({
      message: expect.stringContaining('source-file validation timed out'),
    }));
  });

  it('reports unreadable local source bytes as source-reselection failures', async () => {
    const previewFile = new File(['previewed'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    const unreadableFile = new File(['previewed'], 'source.csv', {
      type: 'text/csv',
      lastModified: 1713830400000,
    });
    vi.spyOn(unreadableFile, 'arrayBuffer').mockRejectedValue(new Error('not readable'));

    await expect(validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          async getFile() {
            return unreadableFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    })).rejects.toThrow(LocalImportSourceValidationError);
    await expect(validateLocalImportFileHandleMatchesPreview({
      sourceKind: 'csv-file',
      fileName: 'source.csv',
      previewFile,
      selection: {
        sourceKind: 'csv-file',
        fileName: 'source.csv',
        handle: {
          name: 'source.csv',
          async getFile() {
            return unreadableFile;
          },
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      },
    })).rejects.toThrow('Reselect the source file');
  });

  it('returns the native picker handle alongside the selected file when available', async () => {
    const handle = {
      name: 'clean.csv',
      getFile: vi.fn(async () => new File(['sample'], 'clean.csv', { type: 'text/csv' })),
      createWritable: vi.fn(async () => ({
        async write() {},
        async close() {},
      })),
    };
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => [handle]),
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, undefined, undefined, {
      preferNativePicker: true,
    });

    const selection = await access.openLocalImportSource({
      sourceKind: 'csv-file',
    });

    expect(selection).toEqual({
      file: expect.objectContaining({ name: 'clean.csv' }),
      handle,
    });
  });

  it('uses the browser file picker when available', async () => {
    const getFile = vi.fn(async () => new File(['sample'], 'clean.csv', { type: 'text/csv' }));
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => [
        {
          name: 'clean.csv',
          getFile,
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      ]),
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, undefined, undefined, {
      preferNativePicker: true,
    });

    const file = await access.openLocalImportFile({
      sourceKind: 'csv-file',
    });

    expect(pickerHost.showOpenFilePicker).toHaveBeenCalledTimes(1);
    expect(getFile).toHaveBeenCalledTimes(1);
    expect(file?.name).toBe('clean.csv');
  });

  it('advertises TSV files in the native delimited picker', async () => {
    const getFile = vi.fn(async () => new File(['sample\tvalue'], 'clean.tsv', { type: 'text/tab-separated-values' }));
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => [
        {
          name: 'clean.tsv',
          getFile,
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      ]),
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, undefined, undefined, {
      preferNativePicker: true,
    });

    await access.openLocalImportFile({
      sourceKind: 'csv-file',
    });

    expect(pickerHost.showOpenFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        types: [
          expect.objectContaining({
            accept: expect.objectContaining({
              'text/csv': ['.csv'],
              'text/tab-separated-values': ['.tsv'],
            }),
          }),
        ],
      }),
    );
  });

  it('treats native file picker cancellation as a no-op', async () => {
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => {
        throw Object.assign(new Error('The user aborted a request.'), {
          name: 'AbortError',
        });
      }),
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, undefined, undefined, {
      preferNativePicker: true,
    });

    const file = await access.openLocalImportFile({
      sourceKind: 'csv-file',
    });

    expect(file).toBeNull();
    expect(pickerHost.showOpenFilePicker).toHaveBeenCalledTimes(1);
  });

  it('advertises legacy xls files in the native Excel picker', async () => {
    const getFile = vi.fn(async () => new File(['sheet'], 'legacy.xls', { type: 'application/vnd.ms-excel' }));
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => [
        {
          name: 'legacy.xls',
          getFile,
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      ]),
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, undefined, undefined, {
      preferNativePicker: true,
    });

    await access.openLocalImportFile({
      sourceKind: 'excel-file',
    });

    expect(pickerHost.showOpenFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        types: [
          expect.objectContaining({
            accept: expect.objectContaining({
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls'],
            }),
          }),
        ],
      }),
    );
  });

  it('prefers the hidden input fallback by default even when the native picker exists', async () => {
    const file = new File(['sample'], 'fallback.csv', { type: 'text/csv' });
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => [
        {
          name: 'fallback.csv',
          getFile: vi.fn(async () => file),
          async createWritable() {
            return {
              async write() {},
              async close() {},
            };
          },
        },
      ]),
    };
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: {
        0: file,
        length: 1,
        item(index: number) {
          return index === 0 ? file : null;
        },
      } as unknown as FileList,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      click() {
        const listener = listeners.get('change');

        if (typeof listener === 'function') {
          listener(new Event('change'));
          return;
        }

        listener?.handleEvent(new Event('change'));
      },
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener() {},
      removeEventListener() {},
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, documentRef, interactionHost);

    const selected = await access.openLocalImportFile({
      sourceKind: 'csv-file',
    });

    expect(pickerHost.showOpenFilePicker).not.toHaveBeenCalled();
    expect(selected?.name).toBe('fallback.csv');
  });

  it('falls back to the hidden input when the native picker errors before selection starts', async () => {
    const file = new File(['sample'], 'fallback.csv', { type: 'text/csv' });
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => {
        throw new Error('native picker blocked');
      }),
    };
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: {
        0: file,
        length: 1,
        item(index: number) {
          return index === 0 ? file : null;
        },
      } as unknown as FileList,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      click() {
        const listener = listeners.get('change');

        if (typeof listener === 'function') {
          listener(new Event('change'));
          return;
        }

        listener?.handleEvent(new Event('change'));
      },
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, documentRef, undefined, {
      preferNativePicker: true,
    });

    await expect(
      access.openLocalImportFile({
        sourceKind: 'csv-file',
      }),
    ).resolves.toMatchObject({
      name: 'fallback.csv',
    });

    expect(pickerHost.showOpenFilePicker).toHaveBeenCalledTimes(1);
    expect(input.accept).toContain('.csv');
  });

  it('falls back to a hidden file input when picker APIs are unavailable', async () => {
    const file = new File(['sheet'], 'clean.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: {
        0: file,
        length: 1,
        item(index: number) {
          return index === 0 ? file : null;
        },
      } as unknown as FileList,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      click() {
        const listener = listeners.get('change');

        if (typeof listener === 'function') {
          listener(new Event('change'));
          return;
        }

        listener?.handleEvent(new Event('change'));
      },
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef);

    const selected = await access.openLocalImportFile({
      sourceKind: 'excel-file',
    });

    expect(input.accept).toContain('.xlsx');
    expect(selected?.name).toBe('clean.xlsx');
  });

  it('treats hidden-input picker cancellation as a no-op', async () => {
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: null,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
      click() {
        const listener = listeners.get('cancel');

        if (typeof listener === 'function') {
          listener(new Event('cancel'));
          return;
        }

        listener?.handleEvent(new Event('cancel'));
      },
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener() {},
      removeEventListener() {},
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef, interactionHost);

    await expect(
      access.openLocalImportFile({
        sourceKind: 'csv-file',
      }),
    ).resolves.toBeNull();
  });

  it('cleans up the hidden-input fallback when picker startup throws during click', async () => {
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const removeEventListener = vi.fn((type: string) => {
      listeners.delete(type);
    });
    const remove = vi.fn();
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: null,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      removeEventListener,
      click() {
        throw new Error('picker startup failed');
      },
      remove,
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener() {},
      removeEventListener: vi.fn(),
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef, interactionHost);

    await expect(
      access.openLocalImportFile({
        sourceKind: 'csv-file',
      }),
    ).rejects.toThrow('picker startup failed');

    expect(remove).toHaveBeenCalledTimes(1);
    expect(interactionHost.removeEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeEventListener).not.toHaveBeenCalled();
  });

  it('does not treat focus-return as cancellation before a delayed file selection arrives', async () => {
    vi.useFakeTimers();

    const file = new File(['sample'], 'delayed.csv', { type: 'text/csv' });
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const focusListeners = new Map<string, EventListenerOrEventListenerObject>();
    let selectedFiles: FileList | null = null;
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      get files() {
        return selectedFiles;
      },
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
      click() {},
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        focusListeners.set(type, listener);
      },
      removeEventListener(type: string) {
        focusListeners.delete(type);
      },
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef, interactionHost);

    const pendingSelection = access.openLocalImportFile({
      sourceKind: 'csv-file',
    });
    const settleSpy = vi.fn();
    void pendingSelection.then(settleSpy);

    globalThis.setTimeout(() => {
      const listener = focusListeners.get('focus');

      if (typeof listener === 'function') {
        listener(new Event('focus'));
        return;
      }

      listener?.handleEvent(new Event('focus'));
    }, 100);

    globalThis.setTimeout(() => {
      selectedFiles = {
        0: file,
        length: 1,
        item(index: number) {
          return index === 0 ? file : null;
        },
      } as unknown as FileList;
      const listener = listeners.get('change');

      if (typeof listener === 'function') {
        listener(new Event('change'));
        return;
      }

      listener?.handleEvent(new Event('change'));
    }, 400);

    await vi.advanceTimersByTimeAsync(200);

    expect(settleSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);

    await expect(pendingSelection).resolves.toMatchObject({
      name: 'delayed.csv',
    });
  });

  it('does not discard a delayed hidden-input selection after a long picker round-trip', async () => {
    vi.useFakeTimers();

    const file = new File(['sample'], 'slow-selection.csv', { type: 'text/csv' });
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const focusListeners = new Map<string, EventListenerOrEventListenerObject>();
    let selectedFiles: FileList | null = null;
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      get files() {
        return selectedFiles;
      },
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
      click() {},
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        focusListeners.set(type, listener);
      },
      removeEventListener(type: string) {
        focusListeners.delete(type);
      },
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef, interactionHost);

    const pendingSelection = access.openLocalImportFile({
      sourceKind: 'csv-file',
    });

    globalThis.setTimeout(() => {
      const listener = focusListeners.get('focus');

      if (typeof listener === 'function') {
        listener(new Event('focus'));
      } else {
        listener?.handleEvent(new Event('focus'));
      }
    }, 2_950);

    globalThis.setTimeout(() => {
      selectedFiles = {
        0: file,
        length: 1,
        item(index: number) {
          return index === 0 ? file : null;
        },
      } as unknown as FileList;
      const listener = listeners.get('change');

      if (typeof listener === 'function') {
        listener(new Event('change'));
        return;
      }

      listener?.handleEvent(new Event('change'));
    }, 3_000);

    await vi.advanceTimersByTimeAsync(2_500);

    await expect(Promise.race([pendingSelection.then(() => 'resolved'), Promise.resolve('pending')])).resolves.toBe('pending');

    await vi.advanceTimersByTimeAsync(500);

    await expect(pendingSelection).resolves.toMatchObject({
      name: 'slow-selection.csv',
    });
  });

  it('settles canceled hidden-input selections shortly after focus returns on browsers without cancel', async () => {
    vi.useFakeTimers();

    const focusListeners = new Map<string, EventListenerOrEventListenerObject>();
    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: null,
      addEventListener() {},
      removeEventListener() {},
      click() {},
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        focusListeners.set(type, listener);
      },
      removeEventListener(type: string) {
        focusListeners.delete(type);
      },
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef, interactionHost);

    const pendingSelection = access.openLocalImportFile({
      sourceKind: 'csv-file',
    });
    const settleSpy = vi.fn();
    void pendingSelection.then(settleSpy);

    globalThis.setTimeout(() => {
      const listener = focusListeners.get('focus');

      if (typeof listener === 'function') {
        listener(new Event('focus'));
        return;
      }

      listener?.handleEvent(new Event('focus'));
    }, 100);

    await vi.advanceTimersByTimeAsync(100 + HIDDEN_INPUT_CANCEL_GRACE_MS - 1);
    expect(settleSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    await expect(pendingSelection).resolves.toBeNull();
  });

  it('eventually settles the hidden-input fallback even without focus or cancel events', async () => {
    vi.useFakeTimers();

    const input = {
      type: '',
      accept: '',
      multiple: false,
      style: {
        display: '',
      },
      files: null,
      addEventListener() {},
      removeEventListener() {},
      click() {},
      remove() {},
    };
    const documentRef = {
      body: {
        appendChild() {},
      },
      createElement() {
        return input;
      },
    };
    const interactionHost = {
      addEventListener() {},
      removeEventListener() {},
      setTimeout(callback: () => void, timeout?: number) {
        return globalThis.setTimeout(callback, timeout);
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        globalThis.clearTimeout(handle);
      },
    };
    const access = new BrowserLocalImportFileAccess({}, documentRef, interactionHost);

    const pendingSelection = access.openLocalImportFile({
      sourceKind: 'csv-file',
    });
    const settleSpy = vi.fn();
    void pendingSelection.then(settleSpy);

    await vi.advanceTimersByTimeAsync(HIDDEN_INPUT_PICKER_STALE_TIMEOUT_MS - 1);
    expect(settleSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    await expect(pendingSelection).resolves.toBeNull();
  });

  it('resolves accepted extensions for CSV and Excel import entrypoints', () => {
    expect(resolveLocalImportAccept('csv-file')).toContain('.csv');
    expect(resolveLocalImportAccept('csv-file')).toContain('.tsv');
    expect(resolveLocalImportAccept('excel-file')).toContain('.xlsx');
  });
});
