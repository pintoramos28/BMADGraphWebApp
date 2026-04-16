import { createStore } from 'zustand/vanilla';

export type ShellStatus = 'notStarted' | 'loading' | 'ready' | 'degraded' | 'blocked' | 'error';

export interface ViewStateData {
  panels: Record<string, boolean>;
  shellStatus: ShellStatus;
  focusReturnTarget: string | null;
  transientSelectionId: string | null;
}

export interface ViewStateCommands {
  setPanelOpen(panelKey: string, isOpen: boolean): void;
  setShellStatus(status: ShellStatus): void;
  setFocusReturnTarget(target: string | null): void;
  setTransientSelection(selectionId: string | null): void;
}

export interface ViewStateSelectors {
  isPanelOpen(panelKey: string): boolean;
  shellStatus(): ShellStatus;
  focusReturnTarget(): string | null;
}

export interface ViewStateStore {
  commands: ViewStateCommands;
  selectors: ViewStateSelectors;
}

export type ViewState = ViewStateData & ViewStateStore;

export function createViewStateStore() {
  return createStore<ViewState>((set, get) => ({
    panels: {},
    shellStatus: 'notStarted',
    focusReturnTarget: null,
    transientSelectionId: null,
    commands: {
      setPanelOpen(panelKey, isOpen) {
        set((state) => ({
          panels: {
            ...state.panels,
            [panelKey]: isOpen,
          },
        }));
      },
      setShellStatus(status) {
        set({
          shellStatus: status,
        });
      },
      setFocusReturnTarget(target) {
        set({
          focusReturnTarget: target,
        });
      },
      setTransientSelection(selectionId) {
        set({
          transientSelectionId: selectionId,
        });
      },
    },
    selectors: {
      isPanelOpen(panelKey) {
        return Boolean(get().panels[panelKey]);
      },
      shellStatus() {
        return get().shellStatus;
      },
      focusReturnTarget() {
        return get().focusReturnTarget;
      },
    },
  }));
}
