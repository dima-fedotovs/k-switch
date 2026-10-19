// SPDX-License-Identifier: GPL-3.0-or-later
import Gettext from 'gettext';
import { GETTEXT_DOMAIN } from './release.js';
import { formatMessage, MessageError } from '../core/messages.js';

export function _(template: string): string {
  return Gettext.dgettext(GETTEXT_DOMAIN, template);
}

export function text(template: string, ...parameters: string[]): string {
  return formatMessage(_(template), parameters);
}

export function errorText(error: unknown): string {
  if (error instanceof MessageError) {
    return formatMessage(_(error.template), error.parameters);
  }
  return text('Could not complete the operation: %s', String(error));
}
