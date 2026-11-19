# Secret scans

| Date (UTC) | Tool | Scope | Result |
|---|---|---|---|
| 2026-11-19 14:10 | gitleaks 8.30.1 (official release binary, SHA-256 verified against the release checksums) | full history, all refs (`--log-opts=--all`), 21 commits, ~616 KB | **0 findings** |
| 2026-11-19 14:10 | `scripts/secret-scan.sh --all` (WIF, 64-hex key assignments, private-key or WIF variable assignments with a value, 12/24-word mnemonics) | all tracked files | **clean** |

The same two checks run in CI on every push (`.github/workflows/ci.yml`, job `secrets`), and `secret-scan.sh --staged` runs as a pre-commit hook.
Throwaway keys live only in `.secrets/` (gitignored); demo seat keys on Vercel are derived from `DEMO_SEED` in encrypted env.
