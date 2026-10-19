#!/usr/bin/env bash
set -euo pipefail
umask 077
test_root="$1"
test "${XDG_CONFIG_HOME:-}" = "$test_root/config"
test "${XDG_DATA_HOME:-}" = "$test_root/data"
test "${XDG_CACHE_HOME:-}" = "$test_root/cache"
test "${XDG_STATE_HOME:-}" = "$test_root/state"
test "${XDG_RUNTIME_DIR:-}" = "$test_root/runtime"
export GSETTINGS_SCHEMA_DIR="$XDG_DATA_HOME/gnome-shell/extensions/k-switch@bug.guru/schemas"
export K_SWITCH_RESULT="$test_root/result.json"
export LIBGL_ALWAYS_SOFTWARE=1
unset DISPLAY WAYLAND_DISPLAY
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_STATE_HOME" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
gsettings set org.gnome.desktop.input-sources sources "${K_SWITCH_INITIAL_SOURCES:?Launcher must supply isolated fixture sources}"
gsettings set org.gnome.desktop.input-sources xkb-options "['compose:ralt','grp:alt_shift_toggle']"
gsettings set org.gnome.shell enabled-extensions "['k-switch@bug.guru']"
gnome-shell --headless --wayland --no-x11 --virtual-monitor 1280x900 --mode=user > "$test_root/shell.log" 2>&1 &
shell_pid=$!
cleanup() {
  kill "$shell_pid" 2> /dev/null || true
  wait "$shell_pid" 2> /dev/null || true
  if mountpoint --quiet "$XDG_RUNTIME_DIR/doc"; then
    echo "Unmounting private document portal before D-Bus shutdown"
    fusermount3 -u "$XDG_RUNTIME_DIR/doc"
  fi
}
trap cleanup EXIT
for ((attempt = 0; attempt < 180; attempt++)); do
  if test -f "$K_SWITCH_RESULT"; then
    sleep 0.5
    exit 0
  fi
  if ! kill -0 "$shell_pid" 2> /dev/null; then break; fi
  sleep 0.2
done
tail -80 "$test_root/shell.log"
exit 1
