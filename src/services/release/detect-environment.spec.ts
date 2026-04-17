import { describe, expect, it } from 'vitest';

import { releaseManifestFixture } from '../../test/fixtures/api/release-manifest.fixture';
import { supportMatrixFixture } from '../../test/fixtures/api/support-matrix.fixture';
import { detectBrowserEnvironment, evaluateShellEnvironment } from './detect-environment';

describe('evaluateShellEnvironment', () => {
  it('treats desktop Chrome as supported when it matches the published matrix', () => {
    const decision = evaluateShellEnvironment({
      browser: {
        family: 'chrome',
        majorVersion: 126,
        isDesktop: true,
        secureContext: true,
        userAgent: 'Mozilla/5.0 Chrome/126.0.0.0',
      },
      releaseManifest: releaseManifestFixture,
      supportMatrix: supportMatrixFixture,
      workspaceCompatibility: {
        workspaceFormatVersion: '1.0.0',
      },
    });

    expect(decision.lifecycle).toBe('ready');
    expect(decision.shouldRouteToUnsupported).toBe(false);
    expect(decision.browserStatus).toBe('supported');
  });

  it('treats Safari as blocked and routes to unsupported', () => {
    const decision = evaluateShellEnvironment({
      browser: {
        family: 'safari',
        majorVersion: 17,
        isDesktop: true,
        secureContext: true,
        userAgent: 'Mozilla/5.0 Version/17.0 Safari/605.1.15',
      },
      releaseManifest: releaseManifestFixture,
      supportMatrix: supportMatrixFixture,
      workspaceCompatibility: {
        workspaceFormatVersion: '1.0.0',
      },
    });

    expect(decision.lifecycle).toBe('blocked');
    expect(decision.shouldRouteToUnsupported).toBe(true);
    expect(decision.reasons.some((reason) => reason.includes('Safari'))).toBe(true);
  });

  it('marks secondary browsers as degraded rather than blocked', () => {
    const decision = evaluateShellEnvironment({
      browser: {
        family: 'firefox',
        majorVersion: 126,
        isDesktop: true,
        secureContext: true,
        userAgent: 'Mozilla/5.0 Firefox/126.0',
      },
      releaseManifest: releaseManifestFixture,
      supportMatrix: supportMatrixFixture,
    });

    expect(decision.lifecycle).toBe('degraded');
    expect(decision.shouldRouteToUnsupported).toBe(false);
    expect(decision.browserStatus).toBe('secondary');
  });

  it('blocks mobile browsers when the support matrix requires desktop-only environments', () => {
    const decision = evaluateShellEnvironment({
      browser: {
        family: 'chrome',
        majorVersion: 126,
        isDesktop: false,
        secureContext: true,
        userAgent: 'Mozilla/5.0 Chrome/126.0.0.0 Mobile',
      },
      releaseManifest: releaseManifestFixture,
      supportMatrix: supportMatrixFixture,
      workspaceCompatibility: {
        workspaceFormatVersion: '1.0.0',
      },
    });

    expect(decision.lifecycle).toBe('blocked');
    expect(decision.shouldRouteToUnsupported).toBe(true);
    expect(decision.reasons.some((reason) => reason.includes('desktop-only'))).toBe(true);
  });

  it('blocks browsers whose major version cannot be determined against the support matrix', () => {
    const decision = evaluateShellEnvironment({
      browser: {
        family: 'chrome',
        majorVersion: null,
        isDesktop: true,
        secureContext: true,
        userAgent: 'Mozilla/5.0 Chrome',
      },
      releaseManifest: releaseManifestFixture,
      supportMatrix: supportMatrixFixture,
      workspaceCompatibility: {
        workspaceFormatVersion: '1.0.0',
      },
    });

    expect(decision.lifecycle).toBe('blocked');
    expect(decision.shouldRouteToUnsupported).toBe(true);
    expect(decision.browserStatus).toBe('unknown');
    expect(decision.reasons.some((reason) => reason.includes('version'))).toBe(true);
  });

  it('detects Chrome from userAgentData brand names', () => {
    const environment = detectBrowserEnvironment({
      userAgent: 'Mozilla/5.0',
      userAgentData: {
        brands: [
          { brand: 'Not A(Brand', version: '99' },
          { brand: 'Google Chrome', version: '126' },
        ],
      },
      secureContext: true,
    });

    expect(environment.family).toBe('chrome');
    expect(environment.majorVersion).toBe(126);
  });

  it('detects Edge from userAgentData brand names', () => {
    const environment = detectBrowserEnvironment({
      userAgent: 'Mozilla/5.0',
      userAgentData: {
        brands: [
          { brand: 'Not A(Brand', version: '99' },
          { brand: 'Microsoft Edge', version: '126' },
        ],
      },
      secureContext: true,
    });

    expect(environment.family).toBe('edge');
    expect(environment.majorVersion).toBe(126);
  });

  it('marks mobile user agents as non-desktop environments', () => {
    const environment = detectBrowserEnvironment({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
      secureContext: true,
    });

    expect(environment.family).toBe('unknown');
    expect(environment.isDesktop).toBe(false);
  });
});
