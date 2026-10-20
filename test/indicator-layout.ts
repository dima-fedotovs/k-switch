// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export function verifyIndicatorLayout(
  button: PanelMenu.Button,
  icon: St.Icon,
  label: St.Label,
): void {
  const reference = new PanelMenu.Button(0.0, 'Standard indicator layout reference');
  reference.style = icon.visible && !label.visible ? '-natural-hpadding: 10px;' : null;
  const content = new St.BoxLayout({ style_class: 'panel-status-indicators-box' });
  if (icon.visible) {
    content.add_child(
      new St.Icon({ gicon: icon.gicon, style_class: 'system-status-icon', style: 'margin: 0;' }),
    );
  }
  if (label.visible) {
    content.add_child(new St.Label({ text: label.text, y_align: Clutter.ActorAlign.CENTER }));
  }
  reference.add_child(content);
  Main.panel.addToStatusArea('k-switch-layout-reference', reference);
  reference.visible = button.visible;
  try {
    const [, actual] = button.get_preferred_width(-1);
    const [, expected] = reference.get_preferred_width(-1);
    if (Math.abs(actual - expected) > 1) {
      throw new Error(
        `Indicator width ${String(actual)} must match standard content width ${String(expected)}`,
      );
    }
    const children = button.get_children();
    const box = children[0];
    if (
      children.length !== 1 ||
      !(box instanceof St.BoxLayout) ||
      icon.get_parent() !== box ||
      label.get_parent() !== box
    ) {
      throw new Error('PanelMenu.Button must have one container for the visible icon or label');
    }
  } finally {
    reference.destroy();
  }
}
