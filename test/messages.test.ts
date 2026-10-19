// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMessage, MessageError, N_ } from '../src/core/messages.js';

void test('pure messages retain templates and data without selecting a UI language', () => {
  const template = N_('Unknown shortcut: %s');
  const error = new MessageError(template, '<Ctrl>100%');
  assert.equal(error.template, template);
  assert.deepEqual(error.parameters, ['<Ctrl>100%']);
  assert.equal(error.message, 'Unknown shortcut: <Ctrl>100%');
  assert.equal(new MessageError('No parameters.').message, 'No parameters.');
});

void test('translation parameters can be reordered and literal percent signs survive', () => {
  assert.equal(
    formatMessage('%2$s / %1$s / %% / %s', ['<first>', 'second']),
    'second / <first> / % / <first>',
  );
});
