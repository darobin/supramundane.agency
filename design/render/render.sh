#!/bin/sh
# Renders the social card and the two logos with headless Chrome (thin-stroke
# bug, same fonts as the site). Output: public/img/card.png, design/logo-*.png
# (transparent, plus a -white flattened copy of each).
set -e
cd "$(dirname "$0")"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shot() { "$C" --headless=new --screenshot="$2" --window-size="$3" --force-device-scale-factor="$4" --default-background-color=00000000 --hide-scrollbars --allow-file-access-from-files --timeout=6000 "file://$PWD/$1" 2>/dev/null; }
shot card.html ../../public/img/card.png 1200,630 1
shot bug.html /tmp/sm-bug.png 1000,1000 4
shot lockup.html /tmp/sm-lockup.png 1400,700 4
magick /tmp/sm-bug.png -trim +repage -bordercolor none -border 120 ../logo-bug.png
magick /tmp/sm-lockup.png -trim +repage -bordercolor none -border 160 ../logo-lockup.png
for f in bug lockup; do magick ../logo-$f.png -background white -alpha remove -alpha off ../logo-$f-white.png; done
rm -f /tmp/sm-bug.png /tmp/sm-lockup.png
