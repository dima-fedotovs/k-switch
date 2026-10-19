// SPDX-License-Identifier: GPL-3.0-or-later
import type { InputSource } from '@girs/gnome-shell/ui/status/keyboard';
// The published GNOME 50 typings omit InputSourceManager. This contract follows
// GNOME Shell 50.1 js/ui/status/keyboard.js; the integration test checks it at runtime.
declare module 'resource:///org/gnome/shell/ui/status/keyboard.js' {
  interface InputSourceManager50 {
    readonly inputSources: Record<string, InputSource>;
    readonly currentSource: InputSource | null;
    readonly keyboardManager: { apply(id: string): void };
    _modifiersSwitcher(): void;
    connect(signal: 'current-source-changed' | 'sources-changed', callback: () => void): number;
    disconnect(id: number): void;
  }
  export function getInputSourceManager(): InputSourceManager50;
}

// GNOME 50 renamed ENABLED/DISABLED and their transitional states. The
// published typings still contain the pre-50 names; use the actual 50.1 names.
declare module '@girs/gnome-shell/misc/extensionUtils' {
  enum ExtensionState {
    ACTIVE = 1,
    INACTIVE = 2,
    DEACTIVATING = 7,
    ACTIVATING = 8,
  }
}
