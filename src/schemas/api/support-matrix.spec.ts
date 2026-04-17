import { describe, expect, it } from 'vitest';

import { supportMatrixSchema } from './support-matrix';
import { supportMatrixFixture } from '../../test/fixtures/api/support-matrix.fixture';

describe('supportMatrixSchema', () => {
  it('accepts the locked support matrix fixture', () => {
    expect(supportMatrixSchema.parse(supportMatrixFixture)).toEqual(supportMatrixFixture);
  });

  it('rejects unsupported browser entries without a desktop-only flag', () => {
    const candidate = structuredClone(supportMatrixFixture) as any;
    delete candidate.supportedBrowsers[0].desktopOnly;

    expect(supportMatrixSchema.safeParse(candidate).success).toBe(false);
  });
});
