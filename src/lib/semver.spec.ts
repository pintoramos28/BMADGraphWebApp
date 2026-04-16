import { describe, expect, it } from 'vitest';

import { matchesVersionRange } from './semver';

describe('matchesVersionRange', () => {
  it('matches major-only ranges', () => {
    expect(matchesVersionRange('1.2.3', '1.x')).toBe(true);
    expect(matchesVersionRange('2.0.0', '1.x')).toBe(false);
  });

  it('matches major-minor wildcard ranges', () => {
    expect(matchesVersionRange('1.2.3', '1.2.x')).toBe(true);
    expect(matchesVersionRange('1.3.0', '1.2.x')).toBe(false);
  });
});
