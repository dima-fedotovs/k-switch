// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ExtensionState } from 'resource:///org/gnome/shell/misc/extensionUtils.js';
import { runtimeVersion } from '../src/shared/shell-version.js';
import { UUID, VERSION } from '../src/shared/release.js';
import { verifyStartupRequests } from './startup-requests.js';
import { verifyRepeatedLifecycle } from './repeated-lifecycle.js';

export interface RuntimeExtension {
  readonly dir: Gio.File;
  readonly metadata: Record<string, unknown>;
  enable(): void;
  disable(): void;
  getSettings(): Gio.Settings;
}

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

export async function failedStartup(extension: RuntimeExtension, expected: string): Promise<void> {
  const source = MessageTray.getSystemSource();
  const notifications: MessageTray.Notification[] = [];
  const signal = source.connect('notification-added', (_source, notification) => {
    if (notification.title?.startsWith('K-switch') === true) {
      notifications.push(notification);
    }
  });
  try {
    extension.enable();
    await settle();
    await settle();
    extension.enable();
    await settle();
    check(
      notifications.length === 1 &&
        notifications.some((notification) =>
          `${notification.title ?? ''}: ${notification.body ?? ''}`.includes(expected),
        ),
      `Expected one startup notification containing ${expected}: ${notifications.map((notification) => notification.body).join('; ')}`,
    );
    check(
      Main.panel.statusArea['k-switch'] === undefined,
      'Failed startup releases switching resources',
    );
    check(
      (await runtimeVersion(new Gio.Cancellable())) === VERSION,
      'Failed startup retains executing-code RPC until disable',
    );
  } finally {
    source.disconnect(signal);
    for (const notification of notifications) {
      notification.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
    }
  }
}

async function metadataChecks(extension: RuntimeExtension): Promise<void> {
  const settings = extension.getSettings();
  const saved = settings.get_string('configuration');
  const file = extension.dir.get_child('metadata.json');
  const [, original] = file.load_contents(null);
  const value: unknown = JSON.parse(new TextDecoder().decode(original));
  check(typeof value === 'object' && value !== null, 'Fixture metadata must be an object');
  const metadata = value as Record<string, unknown>;
  const factory = extension.getSettings.bind(extension);
  let calls = 0;
  extension.getSettings = (): Gio.Settings => {
    calls += 1;
    return factory();
  };
  try {
    for (const field of ['uuid', 'version-name', 'settings-schema']) {
      file.replace_contents(
        JSON.stringify({ ...metadata, [field]: 'wrong-value' }),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );
      await failedStartup(extension, 'Log out and sign in again');
      extension.disable();
    }
    for (const content of ['{', '{}', new Uint8Array([255])]) {
      file.replace_contents(content, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
      await failedStartup(extension, 'Cannot start');
      extension.disable();
    }
    file.delete(null);
    await failedStartup(extension, 'Cannot start');
    extension.disable();
    file.replace_contents(original, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    const schema = extension.metadata['settings-schema'];
    extension.metadata['settings-schema'] = 'stale.schema';
    try {
      await failedStartup(extension, 'Log out and sign in again');
    } finally {
      extension.metadata['settings-schema'] = schema;
      extension.disable();
    }
    check(calls === 0, 'Metadata checks must precede every GSettings factory call');
    check(
      settings.get_string('configuration') === saved,
      'Failed metadata checks preserve configuration',
    );
  } finally {
    extension.disable();
    extension.getSettings = factory;
    file.replace_contents(original, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
  }
}

async function managerCancellation(extension: RuntimeExtension): Promise<void> {
  check(Main.extensionManager.disableExtension(UUID), 'Manager accepts disable');
  await settle();
  const enable = extension.enable.bind(extension);
  let stateAtDisable: ExtensionState | undefined;
  extension.enable = (): void => {
    enable();
    GLib.idle_add(GLib.PRIORITY_HIGH, () => {
      stateAtDisable = Main.extensionManager.lookup(UUID).state;
      Main.extensionManager.disableExtension(UUID);
      return GLib.SOURCE_REMOVE;
    });
  };
  try {
    Main.extensionManager.enableExtension(UUID);
    await settle();
    await settle();
    check(
      stateAtDisable === ExtensionState.ACTIVE,
      'Synchronous entry point is ACTIVE before pending-I/O cancellation',
    );
    check(
      Main.extensionManager.lookup(UUID).state === ExtensionState.INACTIVE,
      'Real manager reaches INACTIVE',
    );
    check(
      Main.panel.statusArea['k-switch'] === undefined,
      'Manager cancellation creates no late indicator',
    );
    let exported = true;
    try {
      await runtimeVersion(new Gio.Cancellable());
    } catch {
      exported = false;
    }
    check(!exported, 'Manager disable unexports runtime-version service');
  } finally {
    extension.enable = enable;
  }
}

async function rapidRestart(extension: RuntimeExtension): Promise<void> {
  const desktop = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
  const previous = desktop.get_strv('xkb-options').join(',');
  extension.enable();
  extension.disable();
  extension.enable();
  await settle();
  check(
    Main.panel.statusArea['k-switch'] !== undefined,
    'New activation survives stale completion/failure',
  );
  check(
    (await runtimeVersion(new Gio.Cancellable())) === VERSION,
    'New activation retains its RPC',
  );
  extension.disable();
  await settle();
  check(
    desktop.get_strv('xkb-options').join(',') === previous,
    'Restart/disable restores independent XKB options',
  );
}

// Main.sessionMode is untyped upstream; validate the actual fixture contract.
interface ModeStack {
  pushMode(name: string): void;
  popMode(name: string): void;
}
function isModeStack(value: unknown): value is ModeStack {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pushMode' in value &&
    typeof value.pushMode === 'function' &&
    'popMode' in value &&
    typeof value.popMode === 'function'
  );
}

async function sessionModes(): Promise<void> {
  Main.extensionManager.enableExtension(UUID);
  await settle();
  const mode: unknown = Main.sessionMode;
  if (!isModeStack(mode)) {
    throw new Error('Expected the GNOME 50 session-mode stack');
  }
  mode.pushMode('unlock-dialog');
  try {
    await settle();
    check(Main.panel.statusArea['k-switch'] === undefined, 'Lock mode releases the session');
  } finally {
    mode.popMode('unlock-dialog');
  }
  await settle();
  check(Main.panel.statusArea['k-switch'] !== undefined, 'Unlock restarts the normal user session');
  Main.extensionManager.disableExtension(UUID);
  await settle();
}

export async function runLifecycleChecks(extension: RuntimeExtension): Promise<string[]> {
  await managerCancellation(extension);
  await rapidRestart(extension);
  await verifyRepeatedLifecycle(extension);
  await verifyStartupRequests(extension);
  await metadataChecks(extension);
  await sessionModes();
  return [
    'Real manager cancellation during pending metadata: inactive, no late resources or RPC',
    'Rapid restart preserves the new activation and restores XKB; lock/unlock cleans up',
    'Repeated lifecycle calls warn without losing pending cancellation, duplicating resources or retrying failed startup',
    'UUID/version/schema, malformed/missing/invalid-UTF-8 metadata block before settings; failure notifies once and retains version RPC',
  ];
}
