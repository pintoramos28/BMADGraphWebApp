import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const CANONICAL_BOOTSTRAP_PATHS = {
  releaseManifest: path.join('src', 'test', 'fixtures', 'api', 'release-manifest.fixture.json'),
  supportMatrix: path.join('src', 'test', 'fixtures', 'api', 'support-matrix.fixture.json'),
};

export const DEPLOYED_BOOTSTRAP_ASSET_PATHS = {
  health: path.join('api', 'health.json'),
  releaseManifest: path.join('api', 'release-manifest.json'),
  supportMatrix: path.join('api', 'support-matrix.json'),
};

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const dateVersionPattern = /^\d{4}-\d{2}-\d{2}$/;
const versionRangePattern = /^\d+(?:\.\d+)?\.x$/;
const sha256Pattern = /^sha256:[A-Fa-f0-9]{64}$/;

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDateTimeSchema = nonEmptyStringSchema.refine(
  (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value)),
  'Expected an ISO-8601 UTC timestamp.',
);
const semverSchema = nonEmptyStringSchema.regex(semverPattern, 'Expected a semantic version like 1.0.0.');
const versionRangeSchema = nonEmptyStringSchema.regex(versionRangePattern, 'Expected a version range like 1.x.');
const dateVersionSchema = nonEmptyStringSchema.regex(dateVersionPattern, 'Expected a YYYY-MM-DD contract version.');
const sha256TokenSchema = nonEmptyStringSchema.regex(sha256Pattern, 'Expected a sha256 token.');
const positiveIntegerSchema = z.number().int().positive();

function strictObject(shape) {
  return z.object(shape).strict();
}

const releaseManifestSchema = strictObject({
  schemaVersion: semverSchema,
  appBuildVersion: semverSchema,
  releaseDate: isoDateTimeSchema,
  channel: nonEmptyStringSchema,
  supportMatrixVersion: dateVersionSchema,
  supportMatrixUrl: nonEmptyStringSchema,
  workspaceCompatibility: strictObject({
    minReadableFormat: semverSchema,
    maxReadableFormat: versionRangeSchema,
    migrationPolicy: z.enum(['migrate-on-open']),
  }),
  serviceWorker: strictObject({
    version: nonEmptyStringSchema,
    scope: nonEmptyStringSchema,
    offlineReadyTimeoutMs: positiveIntegerSchema,
    updatePromptMode: z.enum(['soft-refresh', 'hard-refresh']),
  }),
  telemetry: strictObject({
    endpoint: nonEmptyStringSchema,
    schemaVersion: semverSchema,
  }),
  releaseNotes: strictObject({
    title: nonEmptyStringSchema,
    url: nonEmptyStringSchema,
  }),
  integrity: strictObject({
    manifestSha256: sha256TokenSchema,
  }),
});

const browserSupportSchema = strictObject({
  family: z.enum(['chrome', 'edge', 'firefox', 'safari']),
  supportLevel: z.enum(['supported', 'secondary', 'unsupported']),
  minimumMajorVersion: positiveIntegerSchema.optional(),
  desktopOnly: z.literal(true),
  notes: nonEmptyStringSchema.optional(),
});

const supportMatrixSchema = strictObject({
  version: dateVersionSchema,
  publishedAt: isoDateTimeSchema,
  standardZoom: nonEmptyStringSchema,
  supportedBrowsers: z.array(browserSupportSchema).min(1),
  workspaceCompatibility: strictObject({
    minimumReadableFormat: semverSchema,
    maximumReadableFormat: versionRangeSchema,
  }),
});

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
