import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ReleaseManifest } from '../../../schemas/api';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'release-manifest.fixture.json');

export const releaseManifestFixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ReleaseManifest;
