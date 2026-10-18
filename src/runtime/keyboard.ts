// SPDX-License-Identifier: GPL-3.0-or-later
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { SignalOverride, type SignalPort } from '../core/signal-override.js';

const SIGNAL = 'modifiers-accelerator-activated';

export function reapplyCurrentLayout(): void {
  const manager = Keyboard.getInputSourceManager();
  const source = manager.currentSource;
  if (source !== null) {
    // GNOME 50.1 reapply() passes an info object where _doApply() expects an ID.
    // Apply the current ID directly, without emitting a source-change mid-keymap.
    manager.keyboardManager.apply(source.xkbId);
  }
}

export function interceptSwitching(switchLayout: () => void): SignalOverride {
  const display = Shell.Global.get().get_display();
  const signalId = GObject.signal_lookup(SIGNAL, Meta.Display.$gtype);
  const port: SignalPort = {
    findDefault: () =>
      GObject.signal_handler_find(
        display,
        GObject.SignalMatchType.ID,
        signalId,
        0,
        null,
        null,
        null,
      ),
    block: (id) => {
      display.block_signal_handler(id);
    },
    unblock: (id) => {
      display.unblock_signal_handler(id);
    },
    connect: (callback) => display.connect(SIGNAL, callback),
    disconnect: (id) => {
      display.disconnect(id);
    },
  };
  return new SignalOverride(port, () => {
    switchLayout();
    return true;
  });
}
