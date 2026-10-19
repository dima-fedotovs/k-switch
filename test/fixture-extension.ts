// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import KSwitch from '../src/extension.js';
import { runShellChecks } from './shell-checks.js';
import { runFreshSetupChecks } from './fresh-setup-checks.js';

export default class TestKSwitch extends KSwitch {
  #timer: number | null = null;
  #hasStarted = false;

  override enable(): void {
    super.enable();
    if (this.#hasStarted) {
      return;
    }
    this.#hasStarted = true;
    this.#timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.#timer = null;
      const checks =
        GLib.getenv('K_SWITCH_FRESH_SETUP') === '1'
          ? runFreshSetupChecks(this.getSettings())
          : runShellChecks(this);
      void checks.then(
        (checks) => {
          report({ passed: true, checks });
        },
        (error: unknown) => {
          report({ passed: false, error: String(error) });
        },
      );
      return GLib.SOURCE_REMOVE;
    });
  }

  override disable(): void {
    if (this.#timer !== null) {
      GLib.source_remove(this.#timer);
      this.#timer = null;
    }
    super.disable();
  }
}

function report(result: unknown): void {
  const path = GLib.getenv('K_SWITCH_RESULT');
  if (path === null) {
    throw new Error('Result path is required');
  }
  GLib.file_set_contents(path, JSON.stringify(result, null, 2));
}
