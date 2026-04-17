import { compareSemver, matchesVersionRange } from '../../lib/semver';
import type { ReleaseManifest } from '../../schemas/api';
import type { SupportMatrix, SupportedBrowserFamily } from '../../schemas/api/support-matrix';

export type BrowserSupportStatus = 'supported' | 'secondary' | 'unsupported' | 'unknown';

export interface BrowserEnvironment {
  family: SupportedBrowserFamily | 'unknown';
  majorVersion: number | null;
  isDesktop: boolean;
  secureContext: boolean;
  userAgent: string;
}

export interface WorkspaceCompatibilityInput {
  workspaceFormatVersion?: string | null;
  zoomLevel?: string | null;
  unresolvedReason?: string | null;
}

interface ShellUserAgentData {
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
}

function resolveBrowserFamilyFromBrand(brand: string): SupportedBrowserFamily | null {
  const normalizedBrand = brand.trim().toLowerCase();

  if (normalizedBrand.includes('edge')) {
    return 'edge';
  }

  if (normalizedBrand.includes('chrome')) {
    return 'chrome';
  }

  if (normalizedBrand.includes('firefox')) {
    return 'firefox';
  }

  if (normalizedBrand.includes('safari')) {
    return 'safari';
  }

  return null;
}

export interface ShellEnvironmentInput {
  browser: BrowserEnvironment;
  releaseManifest: ReleaseManifest;
  supportMatrix: SupportMatrix;
  workspaceCompatibility?: WorkspaceCompatibilityInput | null;
}

export interface ShellEnvironmentDecision {
  lifecycle: 'ready' | 'degraded' | 'blocked';
  browserStatus: BrowserSupportStatus;
  workspaceStatus: 'supported' | 'unsupported' | 'unchecked';
  secureContext: boolean;
  supportMatrixVersion: string;
  releaseNotes: ReleaseManifest['releaseNotes'];
  updatePromptMode: ReleaseManifest['serviceWorker']['updatePromptMode'];
  cacheScope: string;
  offlineReadyTimeoutMs: number;
  reasons: string[];
  shouldRouteToUnsupported: boolean;
}

function normalizeBrowserSupportStatus(
  browser: BrowserEnvironment,
  supportMatrix: SupportMatrix,
): { status: BrowserSupportStatus; rule?: SupportMatrix['supportedBrowsers'][number]; reason?: string } {
  const rule = supportMatrix.supportedBrowsers.find((candidate) => candidate.family === browser.family);

  if (!rule) {
    return { status: 'unknown' };
  }

  if (rule.supportLevel === 'unsupported') {
    return { status: 'unsupported', rule };
  }

  if (rule.desktopOnly && !browser.isDesktop) {
    return {
      status: 'unsupported',
      rule,
      reason: `Browser ${formatBrowserLabel(browser.family)} is only supported in desktop-only environments.`,
    };
  }

  if (typeof rule.minimumMajorVersion === 'number') {
    if (browser.majorVersion === null) {
      return {
        status: 'unknown',
        rule,
        reason: `Browser ${formatBrowserLabel(browser.family)} version could not be determined against the published support matrix.`,
      };
    }

    if (browser.majorVersion < rule.minimumMajorVersion) {
      return {
        status: 'unsupported',
        rule,
        reason: `Browser ${formatBrowserLabel(browser.family)} ${browser.majorVersion} is older than the supported major version ${rule.minimumMajorVersion}.`,
      };
    }
  }

  return { status: rule.supportLevel, rule };
}

function formatBrowserLabel(family: BrowserEnvironment['family']) {
  return family === 'unknown' ? 'Unknown' : family.charAt(0).toUpperCase() + family.slice(1);
}

export function evaluateWorkspaceCompatibility(
  releaseManifest: ReleaseManifest,
  workspaceCompatibility?: WorkspaceCompatibilityInput | null,
) {
  if (!workspaceCompatibility) {
    return { status: 'unchecked' as const, reasons: [] as string[] };
  }

  if (workspaceCompatibility.unresolvedReason) {
    return {
      status: 'unsupported' as const,
      reasons: [workspaceCompatibility.unresolvedReason],
    };
  }

  if (!workspaceCompatibility.workspaceFormatVersion) {
    return {
      status: 'unsupported' as const,
      reasons: ['The shell could not validate the saved workspace format before reopening this route.'],
    };
  }

  const supported =
    compareSemver(
      workspaceCompatibility.workspaceFormatVersion,
      releaseManifest.workspaceCompatibility.minReadableFormat,
    ) >= 0 &&
    matchesVersionRange(
      workspaceCompatibility.workspaceFormatVersion,
      releaseManifest.workspaceCompatibility.maxReadableFormat,
    );

  return supported
    ? { status: 'supported' as const, reasons: [] as string[] }
    : {
        status: 'unsupported' as const,
        reasons: [
          `Workspace format ${workspaceCompatibility.workspaceFormatVersion} is outside the readable range ${releaseManifest.workspaceCompatibility.minReadableFormat} to ${releaseManifest.workspaceCompatibility.maxReadableFormat}.`,
        ],
      };
}

export function evaluateShellEnvironment(input: ShellEnvironmentInput): ShellEnvironmentDecision {
  const browser = normalizeBrowserSupportStatus(input.browser, input.supportMatrix);
  const workspace = evaluateWorkspaceCompatibility(input.releaseManifest, input.workspaceCompatibility);
  const reasons: string[] = [];

  if (!input.browser.secureContext) {
    reasons.push('The hosted shell requires a secure context.');
  }

  if (browser.status === 'unsupported') {
    reasons.push(browser.reason ?? `Browser ${formatBrowserLabel(input.browser.family)} is not supported for the hosted shell.`);
  }

  if (browser.status === 'unknown') {
    reasons.push(browser.reason ?? 'The browser could not be matched against the published support matrix.');
  }

  if (workspace.status === 'unsupported') {
    reasons.push(...workspace.reasons);
  }

  const isBlocked = !input.browser.secureContext || browser.status === 'unsupported' || browser.status === 'unknown' || workspace.status === 'unsupported';
  const lifecycle = isBlocked
    ? 'blocked'
    : browser.status === 'secondary'
      ? 'degraded'
      : 'ready';

  if (browser.status === 'secondary') {
    reasons.push(`Browser ${formatBrowserLabel(input.browser.family)} is supported as a secondary compatibility target.`);
  }

  if (input.workspaceCompatibility && input.workspaceCompatibility.zoomLevel && input.workspaceCompatibility.zoomLevel !== input.supportMatrix.standardZoom) {
    reasons.push(`Workspace zoom ${input.workspaceCompatibility.zoomLevel} differs from the standard ${input.supportMatrix.standardZoom}.`);
  }

  return {
    lifecycle,
    browserStatus: browser.status,
    workspaceStatus: workspace.status,
    secureContext: input.browser.secureContext,
    supportMatrixVersion: input.supportMatrix.version,
    releaseNotes: input.releaseManifest.releaseNotes,
    updatePromptMode: input.releaseManifest.serviceWorker.updatePromptMode,
    cacheScope: input.releaseManifest.serviceWorker.scope,
    offlineReadyTimeoutMs: input.releaseManifest.serviceWorker.offlineReadyTimeoutMs,
    reasons,
    shouldRouteToUnsupported: isBlocked,
  };
}

export function detectBrowserEnvironment(input: {
  userAgent?: string;
  userAgentData?: ShellUserAgentData | null;
  secureContext?: boolean;
} = {}): BrowserEnvironment {
  const userAgent = input.userAgent ?? globalThis.navigator?.userAgent ?? '';
  const navigatorWithData = globalThis.navigator as Navigator & { userAgentData?: ShellUserAgentData | null };
  const userAgentData = input.userAgentData ?? navigatorWithData?.userAgentData ?? null;
  const secureContext = input.secureContext ?? Boolean(globalThis.window?.isSecureContext);
  const isDesktop =
    typeof userAgentData?.mobile === 'boolean'
      ? !userAgentData.mobile
      : !/(android|iphone|ipad|ipod|mobile|tablet)/i.test(userAgent);

  const brand =
    userAgentData?.brands?.find((candidate: { brand: string; version: string }) =>
      resolveBrowserFamilyFromBrand(candidate.brand) === 'edge',
    ) ??
    userAgentData?.brands?.find((candidate: { brand: string; version: string }) =>
      resolveBrowserFamilyFromBrand(candidate.brand) === 'chrome',
    ) ??
    userAgentData?.brands?.find((candidate: { brand: string; version: string }) =>
      resolveBrowserFamilyFromBrand(candidate.brand) === 'firefox',
    ) ??
    userAgentData?.brands?.find((candidate: { brand: string; version: string }) =>
      resolveBrowserFamilyFromBrand(candidate.brand) === 'safari',
    );

  if (brand) {
    return {
      family: resolveBrowserFamilyFromBrand(brand.brand) ?? 'unknown',
      majorVersion: Number.parseInt(brand.version, 10) || null,
      isDesktop,
      secureContext,
      userAgent,
    };
  }

  const edge = /Edg\/(\d+)/.exec(userAgent);
  if (edge) {
    return {
      family: 'edge',
      majorVersion: Number.parseInt(edge[1] ?? '', 10) || null,
      isDesktop,
      secureContext,
      userAgent,
    };
  }

  const firefox = /Firefox\/(\d+)/.exec(userAgent);
  if (firefox) {
    return {
      family: 'firefox',
      majorVersion: Number.parseInt(firefox[1] ?? '', 10) || null,
      isDesktop,
      secureContext,
      userAgent,
    };
  }

  const chrome = /Chrome\/(\d+)/.exec(userAgent);
  if (chrome && !/Edg\//.test(userAgent)) {
    return {
      family: 'chrome',
      majorVersion: Number.parseInt(chrome[1] ?? '', 10) || null,
      isDesktop,
      secureContext,
      userAgent,
    };
  }

  const safari = /Version\/(\d+).+Safari\//.exec(userAgent);
  if (safari) {
    return {
      family: 'safari',
      majorVersion: Number.parseInt(safari[1] ?? '', 10) || null,
      isDesktop,
      secureContext,
      userAgent,
    };
  }

  return {
    family: 'unknown',
    majorVersion: null,
    isDesktop,
    secureContext,
    userAgent,
  };
}
