#!/usr/bin/env bash
# Pin the exact Deno release the app is developed against (v2.9.7) by
# downloading it into .runtime/ at build time. Nixpacks' own `deno` nix
# package is unpinned and may not even expose Deno.openKv (KV needs the
# --unstable-kv flag on the 2.9.x builds we target), so we run the server
# with this binary instead.
#
# This must stay a *single* shell command from nixpacks' point of view
# (invoke as `bash scripts/install-deno.sh`): nixpacks splits a multi-line
# build command into raw Dockerfile lines, which crashes the build with
# "unknown instruction: mkdir". Keeping the steps in a file avoids that.
set -euo pipefail

mkdir -p .runtime
case "$(uname -m)" in
  x86_64*)  arch="x86_64-unknown-linux-gnu" ;;
  aarch64*) arch="aarch64-unknown-linux-gnu" ;;
  *) echo "unsupported CPU architecture: $(uname -m)" >&2; exit 1 ;;
esac
url="https://dl.deno.land/release/v2.9.7/deno-${arch}.zip"
echo "pinning Deno v2.9.7 (${arch})"
curl -fsSL -o .runtime/deno.zip "$url"
if command -v unzip >/dev/null 2>&1; then
  unzip -o -q .runtime/deno.zip -d .runtime
else
  python3 -m zipfile -e .runtime/deno.zip .runtime
fi
rm -f .runtime/deno.zip
chmod +x .runtime/deno
./.runtime/deno --version
