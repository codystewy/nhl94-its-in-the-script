---
name: git
description: "Git push and releases for the nhl94-its-in-the-script repo, which ships three install channels (Stable, Latest, Fun). /git push lists every change since the last push and asks which channel each goes to (Latest, or Fun only), then pushes. /git summary shows what's on Latest but not yet in Stable and which Fun-only extras exist and how old they are. /git release moves everything on Latest to Stable. Also retires or promotes Fun extras and hotfixes Stable. Use when the user types /git, /git push, /git summary, /git release, /git hotfix, /git status, or asks to push, release, ship to stable, or remove a fun feature."
argument-hint: "push | summary | release | hotfix <commit> | fun remove <id>"
---

# /git: push, release, hotfix

The repo is `codystewy/nhl94-its-in-the-script`. The shipped file is `nhl94-its-in-the-script.user.js`. Versions are SemVer `MAJOR.MINOR.PATCH`, tagged `vX.Y.Z`.

## Channels (how shipping works)

All work happens on `main`. People install from one of three branches:

| Branch | Moves when | Version users see |
| --- | --- | --- |
| `stable` | `/git release` or `/git hotfix` pushes to it | `X.Y.Z` |
| `latest` | automatically on every push to `main` (`.github/workflows/channels.yml` runs `dev/build-channel.sh latest`) | `X.Y.Z.<commit count>` |
| `fun` | same as latest, built with `CHANNEL = 'fun'` | `X.Y.Z.<commit count>` |

- Never edit `latest` or `fun` by hand. Never push work-in-progress to `stable`.
- Fun-only extras are listed in `FUN_EXTRAS` and gated with `if (funOn('id'))`. The code ships in every file, but it only runs on Fun.

How the user thinks about it:
- **Latest:** where normal work goes. Every push lands here, for people who want everything as soon as it's ready.
- **Fun only:** playful extras that most likely **never** reach Stable. Retired when they get old.
- **Stable:** once in a while, the user moves *everything on Latest* to Stable with `/git release`.

| Command | Does |
| --- | --- |
| `/git` or `/git push` | List changes since the last push, ask Latest vs Fun only, push. |
| `/git summary` | What's on Latest but not in Stable, plus the Fun extras and their age. |
| `/git release` | Move everything on Latest to Stable (version bump, CHANGELOG, README, tag, GitHub release). |
| `/git fun remove <id>` | Retire a Fun extra. `/git fun promote <id>` sends it to Latest instead (rare). |
| `/git hotfix <commit>` | Ship one fix to Stable without everything else on `main`. |
| `/git status` | Alias of `/git summary`. |

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

1. **Gather.** List every change since the last push: unpushed commits plus uncommitted work, which you split into the logical commits it *would* become. One plain-English line each, numbered. Mark any change that is already a Fun extra (touches `FUN_EXTRAS` / `funOn(`).
2. **Ask which channel.** Use **one** AskUserQuestion, with the list shown in the question text above it:
   - **All to Latest** (recommended, first)
   - **Some are Fun only.** The user then names them by number. Ask a follow-up only for the names or ids if they aren't obvious.
   - **Cancel**

   Changes that are already Fun extras stay Fun only. Don't re-ask about them.
3. **Make the Fun-only ones Fun only** before committing:
   - Add an entry to `FUN_EXTRAS` near the top of the script: `id: { name: 'Plain name', added: 'YYYY-MM-DD' }`.
   - Wrap every piece of the feature (CSS, markup, listeners) in `if (funOn('id'))`.
   - Run `node --check`. Preview with `dev/build-channel.sh fun` + `SCRIPT=… dev/preview.sh` and also the normal script, to confirm Stable and Latest look unchanged.
   - Commit as `feat(fun): …`.
   - Fun-only *fixes* to existing Fun extras are `fix(fun): …`.
   - If a change is only on Fun but was already committed ungated, add a follow-up commit that gates it. Don't rewrite history.
4. **Commit** the rest (see Shared steps), then `git push origin main`. The workflow rebuilds Latest and Fun.
5. **Report** in a few lines:
   - what went to Latest and what went to Fun only
   - the new channel version `X.Y.Z.<count>` (from `git rev-list --count HEAD`)
   - "Stable is N changes behind. `/git summary` for the full list."

Never bump the version or touch `stable` here.

## /git summary

Read-only. Show three short sections, in plain English, with no jargon:

1. **On Latest, not yet in Stable:** every `feat`/`fix`/`style`/`perf` since the last tag, excluding `fun` scope, grouped ✨/🐛/🎨. Then one line naming the release it would make, e.g. "Enough for **v1.5.0**. Say `/git release` to move it all to Stable." If there's nothing, say "Stable is up to date."
2. **Fun extras:** every entry in `FUN_EXTRAS`, oldest first: name, id, age in days (from `added`). Flag anything older than ~60 days as "getting old? `/git fun remove <id>`". If there are none, say "No Fun extras right now."
3. **Not pushed yet:** count of unpushed commits plus uncommitted changes, if any.

Mention it if the repo is still private.

## /git fun remove <id> / promote <id>

- **remove:**
  1. Delete the `FUN_EXTRAS` entry and every `if (funOn('id'))` block, along with the CSS and helpers only it used. `grep -n "funOn('id')"` must come back empty.
  2. Run `node --check`, then preview the Fun build.
  3. Commit `chore(fun): retire <name>`, then push.

  Fun users lose it on their next update.
- **promote:**
  1. Unwrap the `funOn('id')` blocks so the code runs everywhere, and delete the entry.
  2. Commit `feat(<scope>): <name>`, then push.

  It goes to Latest now and reaches Stable at the next `/git release`.

## /git release

1. Gather, then commit anything uncommitted.
2. Summarize every change since `$LAST`. Leave `fun`-scope commits out: Fun extras never reach Stable, so they don't belong in the CHANGELOG.
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
   - a note that Fun extras (`FUN_EXTRAS`) stay off in Stable

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

## Reminders
- **Repo visibility:** while the repo is private, raw install links and auto-updates don't reach anyone. Check with `gh repo view --json visibility -q .visibility`, and mention it in the report if it's still private.
- **Never** force-push, rewrite pushed history, or delete tags or branches without the user explicitly asking.
