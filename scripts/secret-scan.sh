#!/usr/bin/env bash
# Fails if anything that looks like a private key, WIF, mnemonic or secret assignment is
# staged (pre-commit) or tracked (CI). Usage: scripts/secret-scan.sh [--staged|--all]
set -euo pipefail
mode="${1:---all}"
if [ "$mode" = "--staged" ]; then
  files=$(git diff --cached --name-only --diff-filter=ACM)
else
  files=$(git ls-files)
fi
files=$(echo "$files" | grep -vE '(^|/)(package-lock\.json|.*\.png|.*\.jpg|.*\.ico|.*\.woff2?)$' | grep -vE '^src/contracts/.*\.json$' || true)
[ -z "$files" ] && exit 0
fail=0
check() { # pattern description
  local hits
  hits=$(echo "$files" | xargs -d '\n' grep -nIE "$1" -- 2>/dev/null | grep -v 'secret-scan: allow' || true)
  if [ -n "$hits" ]; then echo "SECRET SCAN: $2"; echo "$hits" | head -20; fail=1; fi
}
# WIF (mainnet K/L/5, testnet c/9), base58, 51-52 chars, as a standalone token
check '(^|[^1-9A-HJ-NP-Za-km-z])[KLc59][1-9A-HJ-NP-Za-km-z]{50,51}([^1-9A-HJ-NP-Za-km-z]|$)' 'possible WIF private key'
# 64-hex private keys assigned or quoted (txids/categories are 64-hex too, so only flag key-ish names)
check '(priv(ate)?_?key|secret|seed)[A-Za-z_]*["'"'"' :=]+["'"'"']?[0-9a-fA-F]{64}' 'possible hex private key'
check '(PRIVATE_KEY|WIF|DEMO_SEAT_WIFS|CRON_SECRET|VERCEL_TOKEN)=[^[:space:]<#]{8,}' 'secret assignment with a value'
# 12 or 24 lowercase words on a line (mnemonic)
check '^[[:space:]]*([a-z]{3,8}[[:space:]]+){11}[a-z]{3,8}[[:space:]]*$' 'possible 12-word mnemonic'
check '^[[:space:]]*([a-z]{3,8}[[:space:]]+){23}[a-z]{3,8}[[:space:]]*$' 'possible 24-word mnemonic'
exit $fail
