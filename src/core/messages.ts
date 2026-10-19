// SPDX-License-Identifier: GPL-3.0-or-later

// Extraction marker only: pure policy does not select a language or load gettext.
export function N_(template: string): string {
  return template;
}

// Only string placeholders are used. Positional forms allow translators to
// reorder parameters; inserting values never interprets their percent signs.
export function formatMessage(template: string, parameters: readonly string[]): string {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?s|%%/gu, (match: string, position: string | undefined) => {
    if (match === '%%') {
      return '%';
    }
    const index = position === undefined ? next++ : Number(position) - 1;
    return String(parameters[index]);
  });
}

export class MessageError extends Error {
  readonly template: string;
  readonly parameters: readonly string[];

  constructor(template: string, ...parameters: string[]) {
    super(formatMessage(template, parameters));
    this.template = template;
    this.parameters = parameters;
  }
}
