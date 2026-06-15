---
name: node-version-requirement
description: This machine must run NanoClaw on Node 22 (node@26 breaks better-sqlite3 native build)
metadata:
  type: project
---

On this machine, NanoClaw must run under Node 22 (LTS, matches repo `.nvmrc`). The user originally had Homebrew's default `node` = v26.0.0, which fails to compile `better-sqlite3@11.10.0` native bindings (V8 13.x removed `info.This()` on `PropertyCallbackInfo`), aborting setup at the bootstrap step.

Fix applied 2026-06-11: `brew install node@22` then `brew unlink node && brew link --overwrite node@22`. `node@26` keg is still installed but unlinked; `brew link node` switches back.

If `better-sqlite3` build errors or setup bootstrap fails again, check `node -v` first — it must be 22.x, not 25/26.
