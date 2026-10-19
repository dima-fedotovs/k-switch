// SPDX-License-Identifier: GPL-3.0-or-later
import GObject from 'gi://GObject';

export function traceDisconnections(): void {
  // Preserve GJS's default forwarding behavior, including its critical on an
  // invalid ID. The private Shell fixture adds the JS owner/stack for CI logs.
  GObject.Object.prototype.disconnect = function (this: GObject.Object, id: number): void {
    if (!GObject.signal_handler_is_connected(this, id)) {
      console.warn(
        `Invalid disconnect: ${this.constructor.name} handler=${String(id)}\n${new Error().stack ?? ''}`,
      );
    }
    GObject.signal_handler_disconnect(this, id);
  };
}
