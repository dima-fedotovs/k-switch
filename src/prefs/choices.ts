// SPDX-License-Identifier: GPL-3.0-or-later
import GnomeDesktop from 'gi://GnomeDesktop?version=4.0';

export function sourceLabel(source: string): string {
  if (source.startsWith('xkb:')) {
    const [found, name] = new GnomeDesktop.XkbInfo().get_layout_info(source.slice(4));
    if (found) {
      return name;
    }
  }
  return source.startsWith('ibus:') ? `IBus · ${source.slice(5)}` : source;
}
