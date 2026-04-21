import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ReleaseManifest, SupportMatrix } from '../../schemas/api';
import releaseManifestFixture from '../../test/fixtures/api/release-manifest.fixture.json';
import supportMatrixFixture from '../../test/fixtures/api/support-matrix.fixture.json';
import {
  DEPLOYED_BOOTSTRAP_ASSET_PATHS,
  createShellHealthPayload,
  emitShellBootstrapMetadataAssets,
  isShellRoutePathname,
  loadShellBootstrapMetadataFromFiles,
  validateShellBootstrapMetadata,
} from './shell-bootstrap-metadata';
// @ts-expect-error Vitest imports the preview helper directly from the Node ESM script for parity coverage.
import * as previewShellBootstrapMetadata from '../../../scripts/shell-bootstrap-metadata.mjs';

const tempDirectories: string[] = [];
const canonicalReleaseManifest = releaseManifestFixture as ReleaseManifest;
const canonicalSupportMatrix = supportMatrixFixture as SupportMatrix;
const { loadDeployedShellBootstrapMetadata, loadDeployedShellHealthPayload } = previewShellBootstrapMetadata;

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe('shell bootstrap metadata helpers', () => {
  it('rejects schema-invalid metadata before health checks report success', () => {
    const invalidManifest = {
      ...canonicalReleaseManifest,
      telemetry: {
        ...canonicalReleaseManifest.telemetry,
        schemaVersion: 'invalid-semver',
      },
    } as ReleaseManifest;

    expect(() =>
      validateShellBootstrapMetadata({
        releaseManifest: invalidManifest,
        supportMatrix: canonicalSupportMatrix,
      }),
    ).toThrow(/semantic version/i);
  });

  it('rejects manifest and support matrix drift before health checks report success', () => {
    const driftedManifest: ReleaseManifest = {
      ...canonicalReleaseManifest,
      supportMatrixVersion: '2099-01-01',
    };

    expect(() =>
      validateShellBootstrapMetadata({
        releaseManifest: driftedManifest,
        supportMatrix: canonicalSupportMatrix,
      }),
    ).toThrow(/manifest expects 2099-01-01/);
  });

  it('writes deployment-ready bootstrap assets that can be reloaded without src fixtures', async () => {
    const distRoot = await mkdtemp(path.join(os.tmpdir(), 'shell-bootstrap-assets-'));
    tempDirectories.push(distRoot);

    const metadata = validateShellBootstrapMetadata({
      releaseManifest: canonicalReleaseManifest,
      supportMatrix: canonicalSupportMatrix,
    });

    await emitShellBootstrapMetadataAssets({ distRoot, metadata });

    const reloadedMetadata = await loadShellBootstrapMetadataFromFiles({
      releaseManifestPath: path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest),
      supportMatrixPath: path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix),
    });

    expect(reloadedMetadata).toEqual(metadata);

    const releaseManifestAsset = await readFile(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest), 'utf8');
    const supportMatrixAsset = await readFile(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix), 'utf8');
    const healthAsset = await readFile(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.health), 'utf8');

    expect(JSON.parse(releaseManifestAsset)).toEqual(canonicalReleaseManifest);
    expect(JSON.parse(supportMatrixAsset)).toEqual(canonicalSupportMatrix);
    expect(createShellHealthPayload(reloadedMetadata)).toMatchObject({
      status: 'ok',
      releaseManifestVersion: canonicalReleaseManifest.appBuildVersion,
      supportMatrixVersion: canonicalSupportMatrix.version,
    });
    expect(JSON.parse(healthAsset)).toEqual(createShellHealthPayload(reloadedMetadata));
  });

  it('fails preview health checks when the deployed release manifest asset is missing', async () => {
    const distRoot = await mkdtemp(path.join(os.tmpdir(), 'shell-bootstrap-health-'));
    tempDirectories.push(distRoot);

    const metadata = validateShellBootstrapMetadata({
      releaseManifest: canonicalReleaseManifest,
      supportMatrix: canonicalSupportMatrix,
    });

    await emitShellBootstrapMetadataAssets({ distRoot, metadata });
    await rm(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest));

    await expect(loadDeployedShellHealthPayload({ distRoot })).rejects.toThrow();
  });

  it('fails preview health checks when the deployed release manifest drifts after health generation', async () => {
    const distRoot = await mkdtemp(path.join(os.tmpdir(), 'shell-bootstrap-health-'));
    tempDirectories.push(distRoot);

    const metadata = validateShellBootstrapMetadata({
      releaseManifest: canonicalReleaseManifest,
      supportMatrix: canonicalSupportMatrix,
    });

    await emitShellBootstrapMetadataAssets({ distRoot, metadata });

    await writeFile(
      path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest),
      `${JSON.stringify(
        {
          ...canonicalReleaseManifest,
          appBuildVersion: '0.1.1',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await expect(loadDeployedShellHealthPayload({ distRoot })).rejects.toThrow();
  });

  it('fails preview health checks when the deployed support matrix becomes schema-invalid after health generation', async () => {
    const distRoot = await mkdtemp(path.join(os.tmpdir(), 'shell-bootstrap-health-'));
    tempDirectories.push(distRoot);

    const metadata = validateShellBootstrapMetadata({
      releaseManifest: canonicalReleaseManifest,
      supportMatrix: canonicalSupportMatrix,
    });

    await emitShellBootstrapMetadataAssets({ distRoot, metadata });

    await writeFile(
      path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix),
      `${JSON.stringify(
        {
          ...canonicalSupportMatrix,
          supportedBrowsers: [],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await expect(loadDeployedShellHealthPayload({ distRoot })).rejects.toThrow();
  });

  it('rejects schema-invalid deployed metadata before preview serves bootstrap payloads', async () => {
    const distRoot = await mkdtemp(path.join(os.tmpdir(), 'shell-bootstrap-assets-'));
    tempDirectories.push(distRoot);

    const metadata = validateShellBootstrapMetadata({
      releaseManifest: canonicalReleaseManifest,
      supportMatrix: canonicalSupportMatrix,
    });

    await emitShellBootstrapMetadataAssets({ distRoot, metadata });

    await writeFile(
      path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest),
      `${JSON.stringify(
        {
          ...canonicalReleaseManifest,
          telemetry: {
            ...canonicalReleaseManifest.telemetry,
            schemaVersion: 'invalid-semver',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await expect(loadDeployedShellBootstrapMetadata({ distRoot })).rejects.toThrow(/semantic version/i);
  });

  it('limits SPA fallback decisions to the shell-owned route inventory', () => {
    expect(isShellRoutePathname('/')).toBe(true);
    expect(isShellRoutePathname('/workspace')).toBe(true);
    expect(isShellRoutePathname('/workspace/')).toBe(true);
    expect(isShellRoutePathname('/workspace/demo-workspace')).toBe(true);
    expect(isShellRoutePathname('/workspace/demo-workspace/')).toBe(true);
    expect(isShellRoutePathname('/review/demo-workspace')).toBe(true);
    expect(isShellRoutePathname('/review/demo-workspace/')).toBe(true);
    expect(isShellRoutePathname('/unsupported')).toBe(true);
    expect(isShellRoutePathname('/unsupported/')).toBe(true);
    expect(isShellRoutePathname('/assets/index-missing.js')).toBe(false);
    expect(isShellRoutePathname('/workspace/demo-workspace/extra')).toBe(false);
    expect(isShellRoutePathname('/missing')).toBe(false);
  });
});
