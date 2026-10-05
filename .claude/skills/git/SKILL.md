---
name: git
description: "Git push for the nhl94-its-in-the-script repo. Commits anything uncommitted (Conventional Commits), summarizes every unpushed change, decides whether a release is warranted (patch/minor/major), previews the version bump, CHANGELOG entry and README What's new, then pushes after the user confirms. Use when the user types /git, /git push, /git status, or asks to push changes or cut a release."
argument-hint: "push | status"
---

# /git: summarize, version and push

`/git push` (or just `/git`) runs the whole flow below. `/git status` runs steps 1–3 only and stops with the preview, without committing, bumping or pushing anything.

The repo is `codystewy/nhl94-its-in-the-script`, and the shipped file is `nhl94-its-in-the-script.user.js`. Versions are SemVer `1.MINOR.PATCH` and are tagged `vX.Y.Z`.

## 1. Gather

```bash
git status --short
git fetch -q origin
LAST=$(git describe --tags --abbrev=0 2>/dev/null)          # last release tag
git log --oneline origin/main..HEAD                          # unpushed commits
git log --oneline "$LAST"..HEAD                              # everything since the last release
grep -m1 '@version' nhl94-its-in-the-script.user.js          # current script version
```

- **Uncommitted changes:** group them into logical commits, one per change, each with a [Conventional Commits](https://www.conventionalcommits.org) message: `feat|fix|style|perf|refactor|docs|chore(scope): what changed`. Scopes: `home`, `coach`, `theme`, `my-leagues`, `nav`, `standings`, `install`, `skill`, `dev`… Never commit `screenshots/`, `dev/out/`, or `dev/local-loader.user.js`; they're gitignored, so keep it that way. End each message with the attribution line from the system reminder. In `status` mode, only list what you *would* commit.
- **Code changes:** if the script changed, run `node --check nhl94-its-in-the-script.user.js` before going on. If it fails, stop and report.

## 2. Summarize every change

Print one line per change since the last release tag, newest first, grouped by category:

```
✨ Features   feat(my-leagues): …  → plain-English one-liner of what a player notices
🐛 Fixes      fix(standings): …    → …
🎨 Looks      style(home): …       → …
📖 Docs/other docs/chore/refactor  → …
```

Mark which ones are **not pushed yet**.

## 3. Decide the version

Base it on all commits since the last tag:

| Contains | Release | Example |
| --- | --- | --- |
| A breaking change (`!` after the type, `BREAKING CHANGE:`, removes a feature, wipes saved data, changes `@match`/`@grant` in a way that needs users to re-approve) | **MAJOR**. Ask first, never assume | 1.4.1 → 2.0.0 |
| Any `feat` | **MINOR** | 1.4.1 → 1.5.0 |
| Only `fix` / `style` / `perf` | **PATCH** | 1.4.1 → 1.4.2 |
| Only `docs` / `chore` / `refactor` / dev tooling | **No release.** Say so: "Not enough to warrant a version change. These can be pushed as-is." | – |

Then show a preview, without writing anything yet:

- **Proposed version:** `vX.Y.Z` (current `@version` → new), with a one-line reason.
- **Release summary:** 2–4 sentences on what players get.
- **CHANGELOG preview:** the exact markdown entry that would go at the top of `CHANGELOG.md`:
  ```markdown
  ## [X.Y.Z] – YYYY-MM-DD
  ### ✨ New
  - **Bold hook.** One fun, plain sentence.
  ### 🎨 Looks
  ### 🐛 Fixed
  ```
  Leave out empty groups. Add a compare link: `[X.Y.Z]: https://github.com/codystewy/nhl94-its-in-the-script/compare/vLAST...vX.Y.Z`.
- **README "What's new" preview:** the replacement block (`**vX.Y.Z:** …` plus 2–5 emoji bullets).

**Writing style:** plain English, upbeat and a little funny, with hockey puns welcome. **No technical jargon** (never "refactor", "tokens", "localStorage", "DOM", "regex", "selector"). Describe what a player sees or can now do.

If the args were `status`, stop here.

## 4. Confirm

Use AskUserQuestion. Put the recommended option first:

- **Release vX.Y.Z and push** (recommended when a release is warranted)
- **Push without a release.** Tell the user the version stays the same, so Tampermonkey users won't get the code changes until the next release.
- **Change the version.** Let them pick patch/minor/major or type one.
- **Cancel**

## 5. Release (if chosen)

1. Set `// @version      X.Y.Z` in `nhl94-its-in-the-script.user.js`.
2. Insert the CHANGELOG entry at the top (below the intro), plus the compare link at the bottom.
3. Replace the README `## What's new` section (up to the next `## `) with the new block, keeping the `See the full [changelog](CHANGELOG.md)…` line.
4. `node --check nhl94-its-in-the-script.user.js`
5. Commit `chore(release): vX.Y.Z` with the attribution line, then `git tag -a vX.Y.Z -m "vX.Y.Z"`.

## 6. Push

```bash
git push origin main --follow-tags
```

If a release was made, also publish it on GitHub:
```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "<the CHANGELOG entry body>"
```

## 7. Report

Report briefly:
- what was pushed (commit list)
- the new version and tag, or "no version change"
- a link to the repo or the release

**Reminders:**
- **Repo is private:** if the repo is still private, Tampermonkey auto-update won't reach anyone. Check with `gh repo view --json visibility -q .visibility`.
- **Never** force-push, rewrite pushed history, or delete tags without the user explicitly asking.
