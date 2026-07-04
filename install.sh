#!/bin/bash

EXTENSIONS_PATH="/Users/sunb/dev/sunb/raycast/extensions/extensions"
CUSTOM_EXTENSIONS=$(ls "$EXTENSIONS_PATH")
CUSTOM_EXTENSIONS="amazon-aws"

for e in $CUSTOM_EXTENSIONS; do
  cd "$EXTENSIONS_PATH/$e" || exit
  CI=true pnpm i
  pnpm run dev &
  PID="$!"
  sleep 2
  kill "$PID"
done
