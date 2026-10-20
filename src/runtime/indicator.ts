// SPDX-License-Identifier: GPL-3.0-or-later
import { MessageError } from '../core/messages.js';
import { _ } from '../shared/i18n.js';
import Clutter from 'gi://Clutter';
import type Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { groupMenuName, indicatorText, members } from '../core/groups.js';
import type { GroupController } from './groups.js';

export class GroupIndicator {
  readonly button = new PanelMenu.Button(0.0, 'K-switch');
  readonly #label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
  readonly #icon: St.Icon;
  readonly #preferences: () => void;
  readonly #rows = new Map<string, PopupMenu.PopupMenuItem>();
  #structure = '';

  constructor(preferences: () => void, icon: Gio.Icon) {
    this.#preferences = preferences;
    this.#icon = new St.Icon({
      gicon: icon,
      style_class: 'system-status-icon',
      style: 'margin: 0;',
    });
    const content = new St.BoxLayout({ style_class: 'panel-status-indicators-box' });
    content.add_child(this.#icon);
    content.add_child(this.#label);
    this.button.add_child(content);
    Main.panel.addToStatusArea('k-switch', this.button);
  }

  refresh(controller: GroupController): void {
    const group = controller.groups.find((item) => item.id === controller.state.group);
    this.#label.text = indicatorText(
      group,
      controller.sourceLabel,
      controller.configuration.showGroup,
      controller.configuration.showSource,
    );
    this.#label.visible = this.#label.text !== '';
    this.#icon.visible = controller.configuration.showIcon;
    this.button.style =
      this.#icon.visible && !this.#label.visible ? '-natural-hpadding: 10px;' : null;
    this.button.accessible_name = this.#label.text || 'K-switch';
    const menu = this.button.menu;
    if (!(menu instanceof PopupMenu.PopupMenu)) {
      throw new MessageError('Missing indicator menu.');
    }
    const structure = JSON.stringify(
      controller.groups.map((item) => [item.id, groupMenuName(item)]),
    );
    if (structure !== this.#structure) {
      this.#rebuild(controller, menu);
      this.#structure = structure;
    }
    for (const item of controller.groups) {
      const row = this.#rows.get(item.id);
      if (row === undefined) {
        throw new MessageError('Missing group menu item: %s', item.id);
      }
      row.setSensitive(members(item, controller.available).length > 0);
      row.setOrnament(
        item.id === controller.state.group ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE,
      );
    }
    this.button.visible = this.#icon.visible || this.#label.visible;
  }

  #rebuild(controller: GroupController, menu: PopupMenu.PopupMenu): void {
    menu.close();
    menu.removeAll();
    this.#rows.clear();
    for (const item of controller.groups) {
      const row = new PopupMenu.PopupMenuItem(groupMenuName(item));
      row.connect('activate', () => {
        controller.choose(item.id);
      });
      this.#rows.set(item.id, row);
      menu.addMenuItem(row);
    }
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    menu.addAction(_('Settings…'), this.#preferences);
  }

  destroy(): void {
    this.button.destroy();
    this.#rows.clear();
  }
}
