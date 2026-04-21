import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { releaseManifestSchema, type ReleaseManifest } from '../../schemas/api/release-manifest';
import { supportMatrixSchema, type SupportMatrix } from '../../schemas/api/support-matrix';

export type ShellBootstrapMetadata = {
  releaseManifest: ReleaseManifest;
  supportMatrix: SupportMatrix;
};

export const DEPLOYED_BOOTSTRAP_ASSET_PATHS = {
  health: path.join('api', 'health.json'),
  releaseManifest: path.join('api', 'release-manifest.json'),
  supportMatrix: path.join('api', 'support-matrix.json'),
} as const;

function serializeJsonAsset(payload: unknown) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function sha256Hex(payload: string) {
  return createHash('sha256').update(payload).digest('hex');
}

export function validateShellBootstrapMetadata(metadata: ShellBootstrapMetadata): ShellBootstrapMetadata {
  const releaseManifest = releaseManifestSchema.parse(metadata.releaseManifest);
  const supportMatrix = supportMatrixSchema.parse(metadata.supportMatrix);

  if (releaseManifest.supportMatrixVersion !== supportMatrix.version) {
    throw new Error(
      `Configured shell metadata is inconsistent: manifest expects ${releaseManifest.supportMatrixVersion} but support matrix is ${supportMatrix.version}.`,
    );
  }

  if (releaseManifest.supportMatrixUrl !== '/api/support-matrix') {
    throw new Error('Configured shell metadata must point supportMatrixUrl at /api/support-matrix.');
  }

  if (
    releaseManifest.workspaceCompatibility.minReadableFormat !== supportMatrix.workspaceCompatibility.minimumReadableFormat ||
    releaseManifest.workspaceCompatibility.maxReadableFormat !== supportMatrix.workspaceCompatibility.maximumReadableFormat
  ) {
    throw new Error('Configured shell metadata must keep workspace compatibility aligned with the support matrix.');
  }

  return {
    releaseManifest,
    supportMatrix,
  };
}

export function createShellHealthPayload(metadata: ShellBootstrapMetadata) {
  const releaseManifestAsset = serializeJsonAsset(metadata.releaseManifest);
  const supportMatrixAsset = serializeJsonAsset(metadata.supportMatrix);

  return {
    status: 'ok' as const,
    releaseManifestVersion: metadata.releaseManifest.appBuildVersion,
    releaseManifestSha256: sha256Hex(releaseManifestAsset),
    supportMatrixVersion: metadata.supportMatrix.version,
    supportMatrixSha256: sha256Hex(supportMatrixAsset),
  };
}

export async function loadShellBootstrapMetadataFromFiles(paths: {
  releaseManifestPath: string;
  supportMatrixPath: string;
}): Promise<ShellBootstrapMetadata> {
  const [releaseManifest, supportMatrix] = await Promise.all([
    readFile(paths.releaseManifestPath, 'utf8').then((value) => JSON.parse(value) as ReleaseManifest),
    readFile(paths.supportMatrixPath, 'utf8').then((value) => JSON.parse(value) as SupportMatrix),
  ]);

  return validateShellBootstrapMetadata({ releaseManifest, supportMatrix });
}

export async function emitShellBootstrapMetadataAssets(args: {
  distRoot: string;
  metadata: ShellBootstrapMetadata;
}) {
  const releaseManifestPath = path.join(args.distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest);
  const supportMatrixPath = path.join(args.distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix);
  const healthPath = path.join(args.distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.health);

  await mkdir(path.dirname(releaseManifestPath), { recursive: true });

  const healthAsset = serializeJsonAsset(createShellHealthPayload(args.metadata));
  const releaseManifestAsset = serializeJsonAsset(args.metadata.releaseManifest);
  const supportMatrixAsset = serializeJsonAsset(args.metadata.supportMatrix);

  await Promise.all([
    writeFile(healthPath, healthAsset, 'utf8'),
    writeFile(releaseManifestPath, releaseManifestAsset, 'utf8'),
    writeFile(supportMatrixPath, supportMatrixAsset, 'utf8'),
  ]);
}

function hasSingleSegmentRoute(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const remainder = pathname.slice(prefix.length);
  return remainder.length > 0 && !remainder.includes('/');
}

function normalizeShellRoutePathname(pathname: string) {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/u, '');
}

export function isShellRoutePathname(pathname: string) {
  const normalizedPathname = normalizeShellRoutePathname(pathname);

  return (
    normalizedPathname === '/' ||
    normalizedPathname === '/workspace' ||
    hasSingleSegmentRoute(normalizedPathname, '/workspace/') ||
    hasSingleSegmentRoute(normalizedPathname, '/review/') ||
    normalizedPathname === '/unsupported'
  );
}
