---
name: git
description: "Git push and releases for the nhl94-its-in-the-script repo, which ships three install channels (Stable, Latest, Fun). /git push commits anything uncommitted (Conventional Commits) and pushes main, which auto-updates Latest + Fun. /git release cuts a SemVer release (CHANGELOG, README What's new, tag) and moves the stable branch. /git hotfix puts one fix on Stable. /git status previews. Use when the user types /git, /git push, /git release, /git hotfix, /git status, or asks to push changes, release, or ship something to stable."
argument-hint: "push | release | hotfix <commit> | status"
---

# /git: push, release, hotfix

The repo is `codystewy/nhl94-its-in-the-script`. The shipped file is `nhl94-its-in-the-script.user.js`. Versions are SemVer `1.MINOR.PATCH`, tagged `vX.Y.Z`.

## Channels (how shipping works)

All work happens on `main`. People install from one of three branches:

| Branch | Moves when | Version users see |
| --- | --- | --- |
| `stable` | `/git release` or `/git hotfix` pushes to it | `X.Y.Z` |
| `latest` | automatically on every push to `main` (`.github/workflows/channels.yml` runs `dev/build-channel.sh latest`) | `X.Y.Z.<commit count>` |
| `fun` | same as latest, built with `CHANNEL = 'fun'` | `X.Y.Z.<commit count>` |

- Never edit `latest` or `fun` by hand. Never push work-in-progress to `stable`.
- Fun-only extras are gated with `if (FUN)` in the script. Keep that in mind when previewing a release: Stable gets the code, but `FUN` is off there.

| Command | Does |
| --- | --- |
| `/git` or `/git push` | Commit + push `main`. No release question. |
| `/git release` | Version bump, CHANGELOG, README, tag, push, move `stable`, GitHub release. |
| `/git hotfix <commit>` | Ship one fix to Stable without everything else on `main`. |
| `/git status` | Preview only: what's unpushed and what the next release would be. Writes nothing. |

## Shared steps

### Gather
```bash
git status --short
git fetch -q origin
LAST=$(git describe --tags --abbrev=0 2>/dev/null)          # last release tag
git log --oneline origin/main..HEAD                          # unpushed commits
git log --oneline "$LAST"..HEAD                              # everything since the last release
grep -m1 '@version' nhl94-its-in-the-script.user.js          # current script version
```

### Commit anything uncommitted
- Group the changes into logical commits, one per change. Use a [Conventional Commits](https://www.conventionalcommits.org) message: `feat|fix|style|perf|refactor|docs|chore(scope): what changed`.
- Scopes: `home`, `coach`, `theme`, `my-leagues`, `nav`, `standings`, `install`, `skill`, `dev`, `ci`, `channels`…
- Never commit `screenshots/`, `dev/out/`, or `dev/local-loader.user.js`. They're gitignored, so keep it that way.
- End each message with the attribution line from the system reminder.
- If the script changed, run `node --check nhl94-its-in-the-script.user.js` first. If it fails, stop and report.

### Summarize changes
One line per change, newest first, grouped by category:
```
✨ Features   feat(my-leagues): …  → plain-English one-liner of what a player notices
🐛 Fixes      fix(standings): …    → …
🎨 Looks      style(home): …       → …
📖 Docs/other docs/chore/refactor  → …
```

**Writing style** (summaries, CHANGELOG, README):
- Plain English, upbeat and a little funny. Hockey puns welcome.
- **No technical jargon:** never "refactor", "tokens", "localStorage", "DOM", "regex", "selector".
- Describe what a player sees or can now do.

## /git push (default)

1. Gather, then commit anything uncommitted.
2. `git push origin main`.
3. Report in a few lines:
   - the summary of what was pushed
   - "Latest + Fun users get this on their next update check (version `X.Y.Z.<count>`)", using `git rev-list --count HEAD`
   - optionally, one line confirming the workflow started: `gh run list --workflow channels.yml -L 1`
   - if anything since the last tag is a `feat`/`fix`/`style`/`perf`, add one line: "Stable is N changes behind. Say `/git release` when you're happy."

Don't ask a release question. Don't bump the version.

## /git release

1. Gather, then commit anything uncommitted.
2. Summarize every change since `$LAST`.
3. Decide the version from all commits since the last tag:

   | Contains | Release |
   | --- | --- |
   | Breaking (`!`, `BREAKING CHANGE:`, removes a feature, wipes saved data, `@match`/`@grant` change that needs users to re-approve) | **MAJOR**. **Ask first** (AskUserQuestion) |
   | Any `feat` | **MINOR** |
   | Only `fix` / `style` / `perf` | **PATCH** |
   | Only `docs` / `chore` / `refactor` / tooling | Nothing to release. Say so and stop (offer `/git push`). |

   The user can name a version in the args (`/git release 1.4.2`). That version wins.
4. Show the preview:
   - version (`old → new` + reason)
   - a 2–4 sentence release summary
   - the CHANGELOG entry
   - the README What's new block
   - any `if (FUN)` code that stays off in Stable

   Running `/git release` is the go-ahead, so don't ask again unless it's MAJOR.
   - **CHANGELOG entry**, to go at the top of `CHANGELOG.md`, below the intro. Leave out empty groups. Add the compare link at the bottom: `[X.Y.Z]: https://github.com/codystewy/nhl94-its-in-the-script/compare/vLAST...vX.Y.Z`.
     ```markdown
     ## [X.Y.Z] – YYYY-MM-DD
     ### ✨ New
     - **Bold hook.** One fun, plain sentence.
     ### 🎨 Looks
     ### 🐛 Fixed
     ```
   - **README `## What's new`**: replace everything up to the next `## ` with `**vX.Y.Z:** …` plus 2–5 emoji bullets. Keep the `See the full [changelog](CHANGELOG.md)…` line.
5. Write it:
   1. Set `// @version      X.Y.Z` **and** `const SCRIPT_VERSION = 'X.Y.Z';` in the script.
   2. Update the CHANGELOG and README.
   3. Run `node --check`.
   4. Commit `chore(release): vX.Y.Z`, then `git tag -a vX.Y.Z -m "vX.Y.Z"`.
6. Ship:
   ```bash
   git push origin main --follow-tags
   git push origin main:stable          # fast-forward; never --force
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "<the CHANGELOG entry body>"
   ```
   If `main:stable` is rejected as non-fast-forward, a hotfix landed on `stable`. Merge it with `git merge origin/stable` on `main` (keep main's version), then push again.
7. Report: the version, the release link, and "Stable users update on their next check. Latest + Fun move to `X.Y.Z.<count>`."

## /git hotfix <commit>

For when Stable needs one fix now, but `main` has unfinished stuff.

1. `git worktree add ../nhl94-hotfix origin/stable && cd ../nhl94-hotfix && git checkout -b hotfix`
2. `git cherry-pick <commit>`. If it conflicts, resolve it if trivial. Otherwise stop and explain.
3. Bump PATCH. Set the version in both `@version` and `SCRIPT_VERSION`. Add a CHANGELOG entry. Run `node --check`. Commit `chore(release): vX.Y.Z`, then tag.
4. `git push origin hotfix:stable --follow-tags`, then `gh release create …`.
5. Back on `main`: `git merge origin/stable`, resolving the version to the hotfix version, then `git push origin main`. Remove the worktree.
6. Report.

## /git status

Gather, then summarize. Show what `/git release` *would* produce (version + CHANGELOG preview). List uncommitted changes as "would commit". Write nothing.

## Reminders
- **Repo visibility:** while the repo is private, raw install links and auto-updates don't reach anyone. Check with `gh repo view --json visibility -q .visibility`, and mention it in the report if it's still private.
- **Never** force-push, rewrite pushed history, or delete tags or branches without the user explicitly asking.
