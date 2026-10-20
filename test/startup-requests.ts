// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import { runtimeVersion } from '../src/shared/shell-version.js';
import { VERSION } from '../src/shared/release.js';
import type { RuntimeExtension } from './runtime-lifecycle.js';

function check(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function delayedReader(
  file: Gio.File,
  completions: (() => void)[],
  requests: (Gio.Cancellable | null)[],
): typeof file.load_contents_async {
  const load = file.load_contents_async.bind(file);
  function read(request: Gio.Cancellable | null): Promise<[Uint8Array, string]>;
  function read(
    request: Gio.Cancellable | null,
    callback: Gio.AsyncReadyCallback<Gio.File> | null,
  ): void;
  function read(
    request: Gio.Cancellable | null,
    callback?: Gio.AsyncReadyCallback<Gio.File> | null,
  ): Promise<[Uint8Array, string]> | void {
    if (callback === undefined) {
      return load(request);
    }
    requests.push(request);
    load(request, (_file, result) => {
      completions.push(() => {
        callback?.(file, result, null);
      });
    });
  }
  return read;
}

export async function verifyStartupRequests(extension: RuntimeExtension): Promise<void> {
  const directory = extension.dir;
  const getChild = directory.get_child.bind(directory);
  const file = getChild('metadata.json');
  const load = file.load_contents_async.bind(file);
  const [, bytes] = file.load_contents(null);
  const completions: (() => void)[] = [];
  const requests: (Gio.Cancellable | null)[] = [];
  const source = MessageTray.getSystemSource();
  let notifications = 0;
  const signal = source.connect('notification-added', (_source, notification) => {
    if (notification.title?.startsWith('K-switch') === true) {
      notifications += 1;
    }
  });
  directory.get_child = (name): Gio.File => (name === 'metadata.json' ? file : getChild(name));
  file.load_contents_async = delayedReader(file, completions, requests);
  try {
    for (const stale of [new TextDecoder().decode(bytes), '{']) {
      file.replace_contents(stale, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
      extension.enable();
      extension.enable();
      await settle();
      check(
        completions.length === 1 &&
          requests.length === 1 &&
          Main.panel.statusArea['k-switch'] === undefined,
        'Metadata completion is held before switching starts',
      );
      check(
        (await runtimeVersion(new Gio.Cancellable())) === VERSION,
        'Version RPC reports executing code during pending initialization',
      );
      extension.disable();
      check(requests[0]?.is_cancelled() === true, 'Disable cancels the original owned request');
      extension.disable();
      file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
      extension.enable();
      await settle();
      check(completions.length === 2, 'Both real IO completions are controlled independently');
      const old = completions.shift();
      const current = completions.shift();
      current?.();
      await settle();
      old?.();
      await settle();
      check(
        Main.panel.statusArea['k-switch'] !== undefined,
        'Old success/failure cannot tear down the new session',
      );
      check(notifications === 0, 'Cancelled stale success/failure stays quiet');
      extension.disable();
      requests.length = 0;
    }
  } finally {
    extension.disable();
    directory.get_child = getChild;
    file.load_contents_async = load;
    for (const complete of completions) {
      complete();
    }
    source.disconnect(signal);
    file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
  }
}
