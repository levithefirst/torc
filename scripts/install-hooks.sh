#!/usr/bin/env bash
set -e
hook=.git/hooks/pre-commit
printf '#!/usr/bin/env bash\nexec scripts/secret-scan.sh --staged\n' > "$hook"
chmod +x "$hook"
echo "pre-commit secret scan installed"
