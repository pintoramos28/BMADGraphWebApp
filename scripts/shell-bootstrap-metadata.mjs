import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { releaseManifestSchema, supportMatrixSchema } from './shell-bootstrap-contracts.mjs';

export const CANONICAL_BOOTSTRAP_PATHS = {
  releaseManifest: path.join('src', 'test', 'fixtures', 'api', 'release-manifest.fixture.json'),
  supportMatrix: path.join('src', 'test', 'fixtures', 'api', 'support-matrix.fixture.json'),
};

export const DEPLOYED_BOOTSTRAP_ASSET_PATHS = {
  health: path.join('api', 'health.json'),
  releaseManifest: path.join('api', 'release-manifest.json'),
  supportMatrix: path.join('api', 'support-matrix.json'),
};

const absoluteRequestTargetPattern = /^https?:\/\//iu;

function stripRequestTargetPathname(requestTarget) {
  return requestTarget.split('#', 1)[0]?.split('?', 1)[0] ?? '/';
}

export function resolveRequestPathname(requestTarget) {
  if (!absoluteRequestTargetPattern.test(requestTarget)) {
    return {
      rawPathname: stripRequestTargetPathname(requestTarget),
      isAbsoluteForm: false,
    };
  }

  try {
    return {
      rawPathname: new URL(requestTarget).pathname || '/',
      isAbsoluteForm: true,
    };
  } catch {
    throw new URIError('Malformed request path.');
  }
}

function decodeRequestPathSegments(rawPathname) {
  return rawPathname.split('/').map((segment) => decodeURIComponent(segment));
}

function expandDecodedRequestPathSegments(rawPathname) {
  return decodeRequestPathSegments(rawPathname).flatMap((segment) => segment.split('/'));
}

function hasPathSeparatorAlias(rawPathname) {
  return decodeRequestPathSegments(rawPathname).some((segment) => segment.includes('/'));
}

export function decodeRequestPathname(rawPathname) {
  return expandDecodedRequestPathSegments(rawPathname).join('/');
}

export function hasDotSegmentPathAlias(rawPathname) {
  return expandDecodedRequestPathSegments(rawPathname).some((segment) => segment === '.' || segment === '..');
}

export function createShellDeliveryFailureResponse(pathname, failureMode) {
  if (failureMode === 'release-manifest-unavailable') {
    if (pathname === '/api/release-manifest' || pathname === '/api/health') {
      return {
        statusCode: 503,
        payload: { status: 'error', message: 'release manifest unavailable' },
      };
    }

    return null;
  }

  if (failureMode === 'support-matrix-unavailable') {
    if (pathname === '/api/support-matrix' || pathname === '/api/health') {
      return {
        statusCode: 503,
        payload: { status: 'error', message: 'support matrix unavailable' },
      };
    }
  }

  return null;
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function serializeJsonAsset(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function sha256Hex(payload) {
  return createHash('sha256').update(payload).digest('hex');
}

export function validateShellBootstrapMetadata(metadata) {
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

export function createShellHealthPayload(metadata) {
  const releaseManifestAsset = serializeJsonAsset(metadata.releaseManifest);
  const supportMatrixAsset = serializeJsonAsset(metadata.supportMatrix);

  return {
    status: 'ok',
    releaseManifestVersion: metadata.releaseManifest.appBuildVersion,
    releaseManifestSha256: sha256Hex(releaseManifestAsset),
    supportMatrixVersion: metadata.supportMatrix.version,
    supportMatrixSha256: sha256Hex(supportMatrixAsset),
  };
}

export function validateShellHealthPayload(healthPayload) {
  if (!healthPayload || typeof healthPayload !== 'object') {
    throw new Error('Configured shell health payload must be an object.');
  }

  if (healthPayload.status !== 'ok') {
    throw new Error('Configured shell health payload must report ok status.');
  }

  if (
    typeof healthPayload.releaseManifestVersion !== 'string' ||
    healthPayload.releaseManifestVersion.length === 0 ||
    typeof healthPayload.releaseManifestSha256 !== 'string' ||
    healthPayload.releaseManifestSha256.length === 0 ||
    typeof healthPayload.supportMatrixVersion !== 'string' ||
    healthPayload.supportMatrixVersion.length === 0 ||
    typeof healthPayload.supportMatrixSha256 !== 'string' ||
    healthPayload.supportMatrixSha256.length === 0
  ) {
    throw new Error('Configured shell health payload must include manifest/support versions and asset digests.');
  }

  return healthPayload;
}

export async function loadShellBootstrapMetadataFromFiles({ releaseManifestPath, supportMatrixPath }) {
  const [releaseManifest, supportMatrix] = await Promise.all([
    readJsonFile(releaseManifestPath),
    readJsonFile(supportMatrixPath),
  ]);

  return validateShellBootstrapMetadata({ releaseManifest, supportMatrix });
}

export async function loadCanonicalShellBootstrapMetadata({ repoRoot }) {
  return loadShellBootstrapMetadataFromFiles({
    releaseManifestPath: path.join(repoRoot, CANONICAL_BOOTSTRAP_PATHS.releaseManifest),
    supportMatrixPath: path.join(repoRoot, CANONICAL_BOOTSTRAP_PATHS.supportMatrix),
  });
}

export async function loadDeployedShellBootstrapMetadata({ distRoot }) {
  return loadShellBootstrapMetadataFromFiles({
    releaseManifestPath: path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest),
    supportMatrixPath: path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix),
  });
}

export async function loadDeployedShellHealthPayload({ distRoot }) {
  const [healthPayload, rawReleaseManifest, rawSupportMatrix] = await Promise.all([
    readJsonFile(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.health)).then(validateShellHealthPayload),
    readFile(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest), 'utf8'),
    readFile(path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix), 'utf8'),
  ]);
  const metadata = validateShellBootstrapMetadata({
    releaseManifest: JSON.parse(rawReleaseManifest),
    supportMatrix: JSON.parse(rawSupportMatrix),
  });

  if (healthPayload.releaseManifestVersion !== metadata.releaseManifest.appBuildVersion) {
    throw new Error('Configured shell health payload is stale for the deployed release manifest asset.');
  }

  if (healthPayload.supportMatrixVersion !== metadata.supportMatrix.version) {
    throw new Error('Configured shell health payload is stale for the deployed support matrix asset.');
  }

  if (healthPayload.releaseManifestSha256 !== sha256Hex(rawReleaseManifest)) {
    throw new Error('Configured shell health payload does not match the deployed release manifest asset.');
  }

  if (healthPayload.supportMatrixSha256 !== sha256Hex(rawSupportMatrix)) {
    throw new Error('Configured shell health payload does not match the deployed support matrix asset.');
  }

  return healthPayload;
}

export async function emitShellBootstrapMetadataAssets({ distRoot, metadata }) {
  const healthPath = path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.health);
  const releaseManifestPath = path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.releaseManifest);
  const supportMatrixPath = path.join(distRoot, DEPLOYED_BOOTSTRAP_ASSET_PATHS.supportMatrix);

  await mkdir(path.dirname(releaseManifestPath), { recursive: true });

  const healthAsset = serializeJsonAsset(createShellHealthPayload(metadata));
  const releaseManifestAsset = serializeJsonAsset(metadata.releaseManifest);
  const supportMatrixAsset = serializeJsonAsset(metadata.supportMatrix);

  await Promise.all([
    writeFile(healthPath, healthAsset, 'utf8'),
    writeFile(releaseManifestPath, releaseManifestAsset, 'utf8'),
    writeFile(supportMatrixPath, supportMatrixAsset, 'utf8'),
  ]);
}

function hasSingleSegmentRoute(pathname, prefix) {
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const remainder = pathname.slice(prefix.length);
  return remainder.length > 0 && !remainder.includes('/');
}

function normalizeShellRoutePathname(pathname) {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/u, '');
}

export function isShellRoutePathname(pathname) {
  const normalizedPathname = normalizeShellRoutePathname(pathname);

  return (
    normalizedPathname === '/' ||
    normalizedPathname === '/workspace' ||
    hasSingleSegmentRoute(normalizedPathname, '/workspace/') ||
    hasSingleSegmentRoute(normalizedPathname, '/review/') ||
    normalizedPathname === '/unsupported'
  );
}

export function isCanonicalShellRouteRequestPath(rawPathname) {
  if (hasPathSeparatorAlias(rawPathname)) {
    return false;
  }

  return isShellRoutePathname(decodeRequestPathname(rawPathname));
}
