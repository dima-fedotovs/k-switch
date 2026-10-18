// SPDX-License-Identifier: GPL-3.0-or-later
export interface SignalPort {
  findDefault(): number;
  block(id: number): void;
  unblock(id: number): void;
  connect(callback: () => boolean): number;
  disconnect(id: number): void;
}

export class SignalOverride {
  readonly #port: SignalPort;
  readonly #original: number;
  #replacement: number | null = null;

  constructor(port: SignalPort, callback: () => boolean) {
    this.#port = port;
    this.#original = port.findDefault();
    if (this.#original === 0) {
      throw new Error('GNOME 50 keyboard handler was not found.');
    }
    port.block(this.#original);
    try {
      this.#replacement = port.connect(callback);
    } catch (error) {
      port.unblock(this.#original);
      throw error;
    }
  }

  release(): void {
    if (this.#replacement === null) {
      return;
    }
    this.#port.disconnect(this.#replacement);
    this.#replacement = null;
    this.#port.unblock(this.#original);
  }
}
