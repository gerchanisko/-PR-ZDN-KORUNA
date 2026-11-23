#!/bin/sh
# contact.sh out.png img1 img2 ... (max 6) -> mřížka 3x2 v 480x360
out=$1; shift
args=""; n=0
for f in "$@"; do args="$args -i $f"; n=$((n+1)); done
filter=""; i=0
for f in "$@"; do filter="$filter[$i:v]scale=480:360[v$i];"; i=$((i+1)); done
while [ $i -lt 6 ]; do args="$args -f lavfi -i color=black:s=480x360:d=1"; filter="$filter[$i:v]null[v$i];"; i=$((i+1)); done
ffmpeg -y -loglevel error $args -filter_complex "${filter}[v0][v1][v2]hstack=3[a];[v3][v4][v5]hstack=3[b];[a][b]vstack[o]" -map "[o]" -frames:v 1 "$out"
