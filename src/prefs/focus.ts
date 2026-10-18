// SPDX-License-Identifier: GPL-3.0-or-later
import type Gtk from 'gi://Gtk?version=4.0';

export function control<T extends Gtk.Widget>(widget: T, name: string): T {
  widget.name = name;
  widget.add_css_class('k-switch-control');
  return widget;
}

export function focusName(window: Gtk.Window): string | null {
  let widget = window.get_focus();
  while (widget !== null) {
    if (widget.has_css_class('k-switch-control')) {
      return widget.name;
    }
    widget = widget.get_parent();
  }
  return null;
}

export function restoreFocus(root: Gtk.Widget, name: string | null): void {
  if (name === null) {
    return;
  }
  const pending = [root];
  for (const widget of pending) {
    if (widget.has_css_class('k-switch-control') && widget.name === name) {
      widget.grab_focus();
      return;
    }
    for (let child = widget.get_first_child(); child !== null; child = child.get_next_sibling()) {
      pending.push(child);
    }
  }
}
