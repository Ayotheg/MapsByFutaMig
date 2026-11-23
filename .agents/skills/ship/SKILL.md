---
name: ship
description: Build, commit and open a pull request for the current changes.
---

# Ship

1. `git status` and `git diff`: confirm only intended files changed. No `.env*` or secrets.
2. If on `main`, create a branch: `git checkout -b <short-topic>`.
3. `npm run build`. If it fails, fix it first.
4. Commit with a short message saying what changed and why.
5. Ask the user before pushing. Then `git push -u origin HEAD`.
6. `gh pr create --fill` (if `gh` is missing, give the user the link
   `https://github.com/Ayotheg/MapsByFutaMig/compare/main...<branch>`).
7. Reply with the PR link and a 2–3 line summary.
