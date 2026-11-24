#!/usr/bin/env bash
# Installs Frigg, the open market for Omarchy, for the current user only.
#
#   curl -fsSL https://raw.githubusercontent.com/hasky00/Frigg/main/install.sh | bash
#
# It does two things, both inside your home folder:
#   1. puts the `frigg` command in ~/.local/bin
#   2. adds a "Frigg" row under Install in the Omarchy menu, through your own
#      menu extension file (a backup of that file is kept next to it)
# To remove Frigg: delete ~/.local/bin/frigg and the "install.frigg" line.
set -euo pipefail

FRIGG_URL="${FRIGG_URL:-https://raw.githubusercontent.com/hasky00/Frigg/main}"
BIN="$HOME/.local/bin"
MENU="$HOME/.config/omarchy/extensions/omarchy-menu.jsonc"
ROW='  "install.frigg": {"icon":"","label":"Frigg","description":"The open market for Omarchy","aliases":["frigg","store","market"],"action":"omarchy-launch-floating-terminal-with-presentation ~/.local/bin/frigg"},'

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
  if grep -q '"install.frigg"' "$MENU"; then
    return 0
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
