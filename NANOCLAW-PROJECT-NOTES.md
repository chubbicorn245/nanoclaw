# NanoClaw — Project Notes

_Last updated: 2026-06-12_

Working notes for this install + the "package & resell" idea. Not part of the codebase — local record only.

---

## Current State (works today)

- **Discord DM → agent "Nano"** is wired and working. This is the primary, fully-functional channel.
- Host: Mac mini, always-on, launchd service `com.nanoclaw-v2-e2d86b05`.
- Version: **v2.1.11** (synced from 2.1.4 this session; 0 commits behind upstream as of 2026-06-12).
- Owner identity: `discord:314817450887741450` (global owner).

## What was done this session

1. **Discord receive was broken** — Gateway crashed on `Used disallowed intents`. Fixed by enabling **Message Content Intent** in the Discord Developer Portal. Now healthy (sends + receives).
2. **Mac mini never sleeps** — `sudo pmset -c sleep 0` so the service stays up 24/7. (`autorestart` still 0 — won't auto-boot after a power outage; optional `sudo pmset -c autorestart 1` if wanted.)
3. **Pasted-text / file attachments fix** — Discord file attachments (incl. auto-`message.txt` from long pastes) weren't readable. Root cause: bridge only downloaded via `fetchData()`, but Discord exposes only a `url`. Fixed in `src/channels/chat-sdk-bridge.ts` (`enrichAttachments`). Submitted upstream as **PR #2752** (https://github.com/nanocoai/nanoclaw/pull/2752).
4. **Warm-container fix (response latency)** — containers were reaped after 30 min idle, so messages after a gap paid a ~30s–2.5min cold start. Added `IDLE_TIMEOUT` knob (now **4h**) so the container stays warm. Files: `src/config.ts`, `src/host-sweep.ts`, `.env`.
5. **Upstream sync** — merged 31 commits to v2.1.11 cleanly. Backup tag: **`pre-update-a232f58-20260612-110920`** (rollback: `git reset --hard <tag>`).
6. **iMessage — attempted, then reverted.** See below.

## iMessage — parked

- Installed the iMessage channel (local mode) but discovered the Mac mini's Messages is signed into **`symbolman@gmail.com` (husband's Apple ID)** — local mode reads that whole inbox, which is a privacy non-starter.
- **Fully disabled and cleaned up**: adapter off, all iMessage DB rows/sessions/roles removed, husband's account no longer read. Channel _code_ remains installed but dormant.
- **To revisit later**, options (pricing as of 2026-06-12):
  - **Dedicated bot Apple ID** on a separate macOS user (local mode) — $0, fully private, more setup. _Recommended for real iMessage._
  - **Photon remote relay** (https://photon.codes/pricing) — Free tier ($0) likely covers 1:1 personal use; Pro $25/mo; dedicated line $250/mo. Tradeoff: messages route through a third party.
  - Or just use **Telegram/WhatsApp/Signal** — simplest, no Apple-ID-on-shared-Mac problem.
- Note: Full Disk Access was granted to `/opt/homebrew/Cellar/node@22/22.22.3/bin/node`. No longer needed — **can be revoked** in System Settings → Privacy & Security → Full Disk Access for privacy.

## Reselling NanoClaw — findings

- **License is MIT** (`Copyright (c) 2026 Gavriel`). **Resale is permitted.** Conditions:
  1. Keep the MIT copyright + license notice in shipped code.
  2. **Rebrand** — MIT covers code, not the "NanoClaw" name.
  3. **Can't resell Claude** — each customer needs their own Anthropic API access; you sell packaging/service, not the model.
- **Key reality:** NanoClaw is built as a **single-user, single-host, bespoke** assistant — _not_ multi-tenant. "Packaging" = real productization work. Three shapes:
  - **Done-for-you setup/hosting** (per client) — _lowest effort, recommended start._ Sell a service, no re-architecture.
  - **Self-host distribution** — medium; only works for technical buyers (Docker, always-on host, API keys).
  - **SaaS** — highest; needs multi-tenancy, per-customer billing/secrets, ops. Months of work.

## Local customizations (re-apply after any `/update-nanoclaw`)

These are NOT upstream and will need replaying on update (or commit them):
- `IDLE_TIMEOUT` warm-container wiring — `src/config.ts`, `src/host-sweep.ts`, `.env` (`IDLE_TIMEOUT=14400000`)
- `ALLOWLIST_ONLY_CHANNELS` feature — `src/config.ts`, `src/router.ts` (+ test `src/router-allowlist.test.ts`). _Code present; `.env` entry removed when iMessage was disabled._
- Attachment fix — `src/channels/chat-sdk-bridge.ts` (until PR #2752 merges upstream)
- Discord channel install — `src/channels/discord.ts`, `src/channels/index.ts`, deps

## Open items / next time

- [ ] Decide iMessage path (dedicated Apple ID vs Photon vs different channel).
- [ ] (Optional) Revoke Full Disk Access on node — no longer needed.
- [ ] (Optional) Commit local customizations to a branch; consider upstream PR for `ALLOWLIST_ONLY_CHANNELS` (clean, default-off).
- [ ] Reselling: pick a customer/niche and a model (lean toward done-for-you service first).
- [ ] (Optional) `sudo pmset -c autorestart 1` for auto-recovery after power loss.
