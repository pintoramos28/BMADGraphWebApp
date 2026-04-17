import { releaseManifestSchema, type ReleaseManifest } from '../../schemas/api';

export interface LoadReleaseManifestOptions {
  fetchImpl?: typeof fetch;
  url?: string;
}

async function fetchJson(fetchImpl: typeof fetch, url: string) {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Failed to load release manifest from ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loadReleaseManifest(options: LoadReleaseManifestOptions = {}): Promise<ReleaseManifest> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.url ?? '/api/release-manifest';
  const payload = await fetchJson(fetchImpl, url);

  return releaseManifestSchema.parse(payload);
}
