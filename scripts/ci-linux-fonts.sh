#!/usr/bin/env bash
set -euo pipefail

url=https://github.com/microsoft/Selawik/releases/download/1.01/Selawik_Release.zip
sum=3f62c51e05e3b5a1e6241cf92a371f0be2ea1183aa87b30718bbd40832a8d423
fonts="$HOME/.local/share/fonts/selawik"
work="$(mktemp -d)"

curl -fsSL -o "$work/selawik.zip" "$url"
echo "$sum  $work/selawik.zip" | sha256sum -c -
mkdir -p "$fonts" "$HOME/.config/fontconfig"
unzip -q -j -o "$work/selawik.zip" '*.ttf' -d "$fonts"

cat > "$HOME/.config/fontconfig/fonts.conf" <<'CONF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <match target="pattern">
    <test qual="any" name="family"><string>system-ui</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Selawik</string></edit>
  </match>
  <alias binding="strong">
    <family>sans-serif</family>
    <prefer><family>Selawik</family></prefer>
  </alias>
  <alias binding="strong">
    <family>sans</family>
    <prefer><family>Selawik</family></prefer>
  </alias>
</fontconfig>
CONF

fc-cache -f "$fonts"
fc-list : family style weight file | grep -i selawik
for family in system-ui sans-serif sans; do echo "$family: $(fc-match "$family")"; done
