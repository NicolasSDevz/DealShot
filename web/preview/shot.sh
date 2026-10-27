#!/bin/sh
# Uso: sh preview/shot.sh <nome> "<caminho+query>" [desktop|mobile] [fullpage 0/1]
# Precisa do puppeteer-core (ver SHOOTER abaixo). Salva em preview/shots/<nome>.png (ignorada pelo git).
SHOOTER="${SHOOTER:-/c/Users/supor/AppData/Local/Temp/claude/C--Users-supor/a5d16582-b84b-4102-a2f2-5fa4c94951f8/scratchpad/shooter}"
dir="$(cd "$(dirname "$0")" && pwd)/shots"; mkdir -p "$dir"
node "$SHOOTER/shoot.mjs" "$dir/$1.png" "http://localhost:5199$2" "${3:-desktop}" "${4:-0}" "$5"
