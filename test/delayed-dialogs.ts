// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

interface PendingDialog {
  readonly source: Gtk.FileDialog;
  readonly cancellable: Gio.Cancellable;
  readonly callback: Gio.AsyncReadyCallback<Gtk.FileDialog>;
}

export class DelayedDialogs {
  readonly #restore: (() => void)[] = [];
  #pending: PendingDialog | null = null;

  constructor(file: Gio.File) {
    for (const name of ['open', 'save', 'open_finish', 'save_finish']) {
      const descriptor = Object.getOwnPropertyDescriptor(Gtk.FileDialog.prototype, name);
      if (descriptor === undefined) {
        throw new Error(`Missing GTK file dialog method: ${name}`);
      }
      this.#restore.push(() => {
        Object.defineProperty(Gtk.FileDialog.prototype, name, descriptor);
      });
    }
    const capture = (
      source: Gtk.FileDialog,
      cancellable: Gio.Cancellable | null,
      callback: Gio.AsyncReadyCallback<Gtk.FileDialog>,
    ): void => {
      if (cancellable === null || this.#pending !== null) {
        throw new Error('Dialog must have a cancellable and no outstanding operation');
      }
      this.#pending = { source, cancellable, callback };
    };
    const choose = function (
      this: Gtk.FileDialog,
      _parent: Gtk.Window | null,
      cancellable: Gio.Cancellable | null,
      callback: Gio.AsyncReadyCallback<Gtk.FileDialog>,
    ): void {
      capture(this, cancellable, callback);
    };
    Object.defineProperty(Gtk.FileDialog.prototype, 'open', { value: choose });
    Object.defineProperty(Gtk.FileDialog.prototype, 'save', { value: choose });
    Object.defineProperty(Gtk.FileDialog.prototype, 'open_finish', { value: (): Gio.File => file });
    Object.defineProperty(Gtk.FileDialog.prototype, 'save_finish', { value: (): Gio.File => file });
  }

  get cancellable(): Gio.Cancellable {
    if (this.#pending === null) {
      throw new Error('No pending file dialog');
    }
    return this.#pending.cancellable;
  }

  complete(): void {
    const pending = this.#pending;
    if (pending === null) {
      throw new Error('No pending completion');
    }
    this.#pending = null;
    const result = Gio.Task.new(pending.source, pending.cancellable, null);
    result.return_boolean(true);
    pending.callback(pending.source, result, null);
  }

  destroy(): void {
    this.#pending = null;
    for (const restore of this.#restore) {
      restore();
    }
  }
}
