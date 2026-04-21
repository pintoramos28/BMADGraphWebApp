import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SupportMatrix } from '../../../schemas/api/support-matrix';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'support-matrix.fixture.json');

export const supportMatrixFixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as SupportMatrix;
