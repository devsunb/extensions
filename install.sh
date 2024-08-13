#!/bin/bash

EXTENSIONS_PATH="/Users/sunb/dev/raycast/extensions/extensions"
#CUSTOM_EXTENSIONS="youtube-music google-workspace amazon-aws things jira-time-tracking"
CUSTOM_EXTENSIONS=$(ls "$EXTENSIONS_PATH")

for e in $CUSTOM_EXTENSIONS; do
  cd "$EXTENSIONS_PATH/$e"
  pnpm i
  pnpm run dev &
  PID="$!"
  sleep 2
  kill "$PID"
done
