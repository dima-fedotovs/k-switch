// SPDX-License-Identifier: GPL-3.0-or-later
import Gdk from 'gi://Gdk?version=4.0';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import { control } from './focus.js';

export function moved<T>(items: readonly T[], from: number, to: number): readonly T[] {
  const result = [...items];
  const item = result.splice(from, 1)[0];
  if (item !== undefined) {
    result.splice(to, 0, item);
  }
  return result;
}

export function action(
  icon: string,
  label: string,
  callback: () => void,
  identity: string,
): Gtk.Button {
  const button = new Gtk.Button({
    icon_name: icon,
    tooltip_text: label,
    valign: Gtk.Align.CENTER,
  });
  control(button, identity);
  button.update_property([Gtk.AccessibleProperty.LABEL], [label]);
  button.connect('clicked', callback);
  return button;
}

export function dragHandle(token: string, description: string): Gtk.Image {
  const handle = new Gtk.Image({
    icon_name: 'list-drag-handle-symbolic',
    tooltip_text: description,
  });
  handle.update_property([Gtk.AccessibleProperty.LABEL], [description]);
  const drag = new Gtk.DragSource({ actions: Gdk.DragAction.MOVE });
  drag.set_content(Gdk.ContentProvider.new_for_value(token));
  handle.add_controller(drag);
  return handle;
}

export function dropTarget(widget: Gtk.Widget, accept: (token: string) => boolean): void {
  const target = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
  target.connect('drop', (_target, value: unknown) => typeof value === 'string' && accept(value));
  widget.add_controller(target);
}
