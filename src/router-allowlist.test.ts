/**
 * Regression tests for ALLOWLIST_ONLY_CHANNELS.
 *
 * A channel listed in ALLOWLIST_ONLY_CHANNELS engages ONLY senders with a
 * pre-wired messaging group. A message from any other sender is dropped
 * silently in the router's auto-create block — no messaging_groups row, no
 * owner approval card, no pending_channel_approvals row. This exists for
 * "whole-inbox" channels like local-mode iMessage, where the bot reads the
 * operator's personal account and must not ping the owner for every stranger
 * who texts it.
 *
 * The contrast test asserts a non-allowlisted channel still escalates, so the
 * guard is proven specific to the configured set, not a blanket change.
 */
import fs from 'fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { initTestDb, closeDb, runMigrations } from './db/index.js';
import { createAgentGroup } from './db/agent-groups.js';
import { getMessagingGroupByPlatform } from './db/messaging-groups.js';
import { upsertUser } from './modules/permissions/db/users.js';
import { grantRole } from './modules/permissions/db/user-roles.js';

vi.mock('./container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
}));

const deliverMock = vi.fn().mockResolvedValue('plat-msg-id');
vi.mock('./delivery.js', () => ({
  getDeliveryAdapter: () => ({ deliver: deliverMock }),
}));

vi.mock('./modules/permissions/user-dm.js', () => ({
  ensureUserDm: vi.fn(async (userId: string) => {
    const { getDb } = await import('./db/connection.js');
    return getDb()
      .prepare(
        `SELECT mg.* FROM messaging_groups mg
           JOIN user_dms ud ON ud.messaging_group_id = mg.id
          WHERE ud.user_id = ?`,
      )
      .get(userId);
  }),
}));

const TEST_DIR = '/tmp/nanoclaw-test-router-allowlist';

// imessage is allowlist-only; telegram is not (the contrast channel).
vi.mock('./config.js', async () => {
  const actual = await vi.importActual('./config.js');
  return { ...actual, DATA_DIR: TEST_DIR, ALLOWLIST_ONLY_CHANNELS: new Set(['imessage']) };
});

function now() {
  return new Date().toISOString();
}

beforeEach(async () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  runMigrations(initTestDb());

  await import('./modules/permissions/index.js'); // register hooks

  createAgentGroup({ id: 'ag-1', name: 'Nano', folder: 'nano', agent_provider: null, created_at: now() });

  // Owner with a reachable DM, so an escalation WOULD fire if not suppressed.
  upsertUser({ id: 'telegram:owner', kind: 'telegram', display_name: 'Owner', created_at: now() });
  grantRole({ user_id: 'telegram:owner', role: 'owner', agent_group_id: null, granted_by: null, granted_at: now() });

  const { createMessagingGroup } = await import('./db/messaging-groups.js');
  createMessagingGroup({
    id: 'mg-dm-owner',
    channel_type: 'telegram',
    platform_id: 'dm-owner',
    name: 'Owner DM',
    is_group: 0,
    unknown_sender_policy: 'public',
    created_at: now(),
  });
  const { getDb } = await import('./db/connection.js');
  getDb()
    .prepare(`INSERT INTO user_dms (user_id, channel_type, messaging_group_id, resolved_at) VALUES (?, ?, ?, ?)`)
    .run('telegram:owner', 'telegram', 'mg-dm-owner', now());

  deliverMock.mockClear();
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

function dm(channelType: string, platformId: string) {
  return {
    channelType,
    platformId,
    threadId: null,
    message: {
      id: `msg-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'chat' as const,
      content: JSON.stringify({ senderId: 'stranger', senderName: 'Stranger', text: 'hello' }),
      timestamp: now(),
      isMention: true, // DM bridge sets isMention=true
    },
  };
}

describe('ALLOWLIST_ONLY_CHANNELS', () => {
  it('drops an unwired sender silently on an allowlist-only channel (no card, no row)', async () => {
    const { routeInbound } = await import('./router.js');
    await routeInbound(dm('imessage', 'imessage:+15550009999'));
    await new Promise((r) => setTimeout(r, 10));

    expect(deliverMock).not.toHaveBeenCalled();
    expect(getMessagingGroupByPlatform('imessage', 'imessage:+15550009999')).toBeFalsy();
    const { getDb } = await import('./db/connection.js');
    const count = (getDb().prepare('SELECT COUNT(*) AS c FROM pending_channel_approvals').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('still escalates an unwired sender on a non-allowlisted channel (guard is scoped)', async () => {
    const { routeInbound } = await import('./router.js');
    await routeInbound(dm('telegram', 'dm-stranger'));
    await new Promise((r) => setTimeout(r, 10));

    expect(deliverMock).toHaveBeenCalledTimes(1);
    const { getDb } = await import('./db/connection.js');
    const count = (getDb().prepare('SELECT COUNT(*) AS c FROM pending_channel_approvals').get() as { c: number }).c;
    expect(count).toBe(1);
  });
});
