// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignalOverride, type SignalPort } from '../src/core/signal-override.js';

class MemorySignals implements SignalPort {
  events: string[] = [];
  original = 10;
  failConnect = false;
  findDefault(): number {
    return this.original;
  }
  block(id: number): void {
    this.events.push(`block:${String(id)}`);
  }
  unblock(id: number): void {
    this.events.push(`unblock:${String(id)}`);
  }
  connect(callback: () => boolean): number {
    if (this.failConnect) {
      throw new Error('Connection failed');
    }
    assert.equal(callback(), true);
    this.events.push('connect');
    return 20;
  }
  disconnect(id: number): void {
    this.events.push(`disconnect:${String(id)}`);
  }
}

void test('replaces only the native handler and cleans up once', () => {
  const port = new MemorySignals();
  const override = new SignalOverride(port, () => true);
  override.release();
  override.release();
  assert.deepEqual(port.events, ['block:10', 'connect', 'disconnect:20', 'unblock:10']);
});

void test('refuses unsupported Shell state without changing any handlers', () => {
  const port = new MemorySignals();
  port.original = 0;
  assert.throws(() => new SignalOverride(port, () => true), /was not found/);
  assert.deepEqual(port.events, []);
});

void test('rolls back the native handler when installing the replacement fails', () => {
  const port = new MemorySignals();
  port.failConnect = true;
  assert.throws(() => new SignalOverride(port, () => true), /Connection failed/);
  assert.deepEqual(port.events, ['block:10', 'unblock:10']);
});
