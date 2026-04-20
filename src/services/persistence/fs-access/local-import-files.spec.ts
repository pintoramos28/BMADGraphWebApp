import { describe, expect, it, vi } from 'vitest';

import { BrowserLocalImportFileAccess, resolveLocalImportAccept } from './local-import-files';

describe('BrowserLocalImportFileAccess', () => {
  it('uses the browser file picker when available', async () => {
    const getFile = vi.fn(async () => new File(['sample'], 'clean.csv', { type: 'text/csv' }));
    const pickerHost = {
      showOpenFilePicker: vi.fn(async () => [
        {
          getFile,
        },
      ]),
    };
    const access = new BrowserLocalImportFileAccess(pickerHost, undefined);

    const file = await access.openLocalImportFile({
      sourceKind: 'csv-file',
    });

    expect(pickerHost.showOpenFilePicker).toHaveBeenCalledTimes(1);
    expect(getFile).toHaveBeenCalledTimes(1);
    expect(file?.name).toBe('clean.csv');
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
      } as FileList,
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

  it('resolves accepted extensions for CSV and Excel import entrypoints', () => {
    expect(resolveLocalImportAccept('csv-file')).toContain('.csv');
    expect(resolveLocalImportAccept('excel-file')).toContain('.xlsx');
  });
});
