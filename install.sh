#!/usr/bin/env bash
# Installs Frigg, the open market for Omarchy, for the current user only.
#
#   curl -fsSL https://raw.githubusercontent.com/hasky00/Frigg/main/install.sh | bash
#
# It does three things, all inside your home folder:
#   1. puts the `frigg` command in ~/.local/bin
#   2. adds a "Frigg" row under Install in the Omarchy menu, through your own
#      menu extension file (a backup of that file is kept next to it)
#   3. registers frigg:// links, so the store's Buy buttons can start an install
# To remove Frigg: delete ~/.local/bin/frigg, the "install.frigg" line, and
# ~/.local/share/applications/frigg-link.desktop.
set -euo pipefail

FRIGG_URL="${FRIGG_URL:-https://raw.githubusercontent.com/hasky00/Frigg/main}"
BIN="$HOME/.local/bin"
MENU="$HOME/.config/omarchy/extensions/omarchy-menu.jsonc"
ROW='  "install.frigg": {"icon":"","label":"Frigg","description":"The open market for Omarchy","aliases":["frigg","store","market"],"action":"~/.local/bin/frigg store"},'
APPS="$HOME/.local/share/applications"

if (( EUID == 0 )); then
  echo "Run this as yourself, not as root: Frigg installs into your own home folder." >&2
  exit 1
fi

for tool in curl jq git; do
  command -v "$tool" >/dev/null || { echo "Frigg needs '$tool'. On Omarchy: omarchy-pkg-add $tool" >&2; exit 1; }
done

echo "Installing the frigg command..."
mkdir -p "$BIN"
curl -fsSL "$FRIGG_URL/bin/frigg" -o "$BIN/frigg.new"
bash -n "$BIN/frigg.new"            # refuse a broken or half-downloaded file
chmod 755 "$BIN/frigg.new"
mv "$BIN/frigg.new" "$BIN/frigg"

# Same clean-up Omarchy does before reading the file: drop whole-line comments
# and trailing commas, then it must be plain JSON.
menu_is_valid() {
  sed -E '/^[[:space:]]*\/\//d' "$1" | sed -E ':a;N;$!ba;s/,([[:space:]]*[]}])/\1/g' | jq -e 'type == "object"' >/dev/null 2>&1
}

add_menu_row() {
  mkdir -p "$(dirname "$MENU")"

  if [[ ! -s "$MENU" ]]; then
    printf '{\n%s\n}\n' "$ROW" > "$MENU"
    return 0
  fi
  if grep -qF "$ROW" "$MENU"; then
    return 0
  fi
  if grep -q '"install.frigg"' "$MENU"; then
    # An older Frigg row: swap that one line for the current one.
    cp "$MENU" "$MENU.before-frigg"
    awk -v row="$ROW" '/^[[:space:]]*"install\.frigg"[[:space:]]*:/ { print row; next } { print }' "$MENU.before-frigg" > "$MENU.new"
    if menu_is_valid "$MENU.new"; then mv "$MENU.new" "$MENU"; return 0; fi
    rm -f "$MENU.new"
    return 1
  fi
  if ! menu_is_valid "$MENU"; then
    return 1                        # not touching a file we cannot read
  fi

  cp "$MENU" "$MENU.before-frigg"
  # Put the row just before the last closing brace, and make sure the entry
  # above it ends with a comma.
  awk -v row="$ROW" '
    { lines[NR] = $0 }
    END {
      last = 0
      for (i = NR; i >= 1; i--) if (lines[i] ~ /^[[:space:]]*}[[:space:]]*$/) { last = i; break }
      if (!last) exit 1
      for (i = last - 1; i >= 1; i--) {
        if (lines[i] ~ /^[[:space:]]*$/ || lines[i] ~ /^[[:space:]]*\/\//) continue
        if (lines[i] !~ /[,{][[:space:]]*$/) lines[i] = lines[i] ","
        break
      }
      for (i = 1; i < last; i++) print lines[i]
      print row
      for (i = last; i <= NR; i++) print lines[i]
    }' "$MENU.before-frigg" > "$MENU.new" || { rm -f "$MENU.new"; return 1; }

  if menu_is_valid "$MENU.new"; then
    mv "$MENU.new" "$MENU"
  else
    rm -f "$MENU.new"
    return 1
  fi
}

# Lets the store window's Buy buttons (frigg://install/...) reach the frigg command.
mkdir -p "$APPS"
cat > "$APPS/frigg-link.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Frigg
Comment=Opens Frigg store links
Exec=$BIN/frigg open %u
NoDisplay=true
Terminal=false
MimeType=x-scheme-handler/frigg;
DESKTOP
if command -v xdg-mime >/dev/null; then
  xdg-mime default frigg-link.desktop x-scheme-handler/frigg 2>/dev/null || true
fi
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" >/dev/null 2>&1 || true

if add_menu_row; then
  echo "Added Frigg to the Omarchy menu, under Install."
else
  echo "Could not add Frigg to the Omarchy menu automatically. Your menu file was left as it was."
  echo "To add it by hand, put this line inside $MENU:"
  echo "$ROW"
fi

case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo "Note: $BIN is not on your PATH, so run Frigg as ~/.local/bin/frigg" ;;
esac

echo
echo "Frigg is installed. Open the Omarchy menu and pick Install > Frigg, or run: frigg"
