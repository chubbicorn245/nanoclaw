import { describe, expect, it } from 'bun:test';

import { isDisallowedSkill } from './claude.js';

describe('isDisallowedSkill', () => {
  it('blocks the built-in claude.ai `schedule` skill', () => {
    expect(isDisallowedSkill('schedule')).toBeTruthy();
  });

  it('blocks it when plugin-qualified or oddly cased', () => {
    expect(isDisallowedSkill('plugin:schedule')).toBeTruthy();
    expect(isDisallowedSkill('Schedule')).toBeTruthy();
    expect(isDisallowedSkill('  schedule  ')).toBeTruthy();
  });

  it('names `ncl tasks create` in the block reason so the agent can recover', () => {
    expect(isDisallowedSkill('schedule')).toContain('ncl tasks create');
  });

  it('leaves NanoClaw container skills alone', () => {
    for (const name of ['agent-browser', 'frontend-engineer', 'onecli-gateway', 'self-customize', 'welcome']) {
      expect(isDisallowedSkill(name)).toBeNull();
    }
  });

  it('does not block on a non-string or empty skill argument', () => {
    expect(isDisallowedSkill(undefined)).toBeNull();
    expect(isDisallowedSkill('')).toBeNull();
    expect(isDisallowedSkill(42)).toBeNull();
  });
});
