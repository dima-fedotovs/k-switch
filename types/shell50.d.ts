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
