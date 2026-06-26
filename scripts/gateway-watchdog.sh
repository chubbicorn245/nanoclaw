#!/bin/bash
#
# NanoClaw gateway watchdog.
#
# Problem: the Discord gateway can silently go "half-open" — reports READY but
# stops receiving messages — and the in-process auto-restart never fires. The
# bot goes quiet until a manual restart.
#
# We CANNOT detect staleness from logs: a healthy gateway is silent for hours
# during normal quiet periods (measured max gap ~18h) and the protocol heartbeat
# isn't surfaced. So this watchdog does a PREVENTIVE gateway refresh during true
# idle windows, which keeps the connection fresh so staleness rarely develops,
# and is gated so it never interrupts active work.
#
# Design notes (learned the hard way):
#   - NO docker: OrbStack's socket isn't reachable from a launchd gui-agent, so
#     `docker ps` returns empty there and can't be trusted. Activity is judged
#     purely from session-file mtimes (inbound.db / outbound.db / .heartbeat),
#     which update reliably whenever Nano receives or works on anything.
#   - FAIL SAFE: if activity can't be assessed (no session files found), SKIP.
#     Never restart on unknown state.
#   - Restart via `pkill` + launchd KeepAlive, NOT `launchctl kickstart` — a
#     peer-agent kickstart is a no-op from the launchd context. Killing the host
#     process lets the service's KeepAlive respawn it with a fresh gateway.
#
# Runs every 5 min via com.nanoclaw-watchdog-*.plist.

set -u

PROJECT="/Users/j/projects/nanoclaw/nanoclaw-v2"
LOG="$PROJECT/logs/watchdog.log"
STATE="$PROJECT/logs/watchdog-state"        # epoch of last preventive refresh

REFRESH_COOLDOWN=$((4 * 3600))              # ≥4h between preventive refreshes
IDLE_GUARD=$((15 * 60))                     # all session files quiet this long

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

now="$(date +%s)"

# --- Newest mtime across all session activity files (docker-free liveness). ---
# inbound.db  : updated when a message arrives
# outbound.db : updated when the agent writes a reply
# .heartbeat  : touched while the container is actively working
newest=0
found=0
for f in "$PROJECT"/data/v2-sessions/*/*/inbound.db \
         "$PROJECT"/data/v2-sessions/*/*/outbound.db \
         "$PROJECT"/data/v2-sessions/*/*/.heartbeat; do
  [ -f "$f" ] || continue
  found=1
  m="$(stat -f %m "$f" 2>/dev/null || echo 0)"
  [ "$m" -gt "$newest" ] && newest="$m"
done

# FAIL SAFE: couldn't find any session files → can't judge activity → skip.
if [ "$found" -eq 0 ]; then
  log "SKIP: no session files found (cannot assess activity — failing safe)"
  exit 0
fi

idle_for=$((now - newest))

# Recent activity → possibly mid-conversation or container working → skip.
if [ "$idle_for" -lt "$IDLE_GUARD" ]; then
  exit 0
fi

# Cooldown → don't refresh more often than REFRESH_COOLDOWN.
last=0
[ -f "$STATE" ] && last="$(cat "$STATE" 2>/dev/null || echo 0)"
if [ $((now - last)) -lt "$REFRESH_COOLDOWN" ]; then
  exit 0
fi

# Host process present? (If already down, KeepAlive is handling respawn.)
host_pid="$(pgrep -f "$PROJECT/dist/index.js" | head -1)"
if [ -z "$host_pid" ]; then
  log "SKIP: host process not running (launchd KeepAlive should respawn it)"
  exit 0
fi

# Idle + cooldown elapsed → preventive gateway refresh.
# Kill the host; launchd KeepAlive respawns it with a fresh gateway connection.
log "idle ${idle_for}s, cooldown elapsed → restart host pid $host_pid (KeepAlive respawn) [preventive refresh]"
/usr/bin/pkill -TERM -f "$PROJECT/dist/index.js"
echo "$now" > "$STATE"
exit 0
