import { supportMatrixSchema, type SupportMatrix } from '../../schemas/api';

export interface LoadSupportMatrixOptions {
  fetchImpl?: typeof fetch;
  url: string;
}

async function fetchJson(fetchImpl: typeof fetch, url: string) {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Failed to load support matrix from ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loadSupportMatrix(options: LoadSupportMatrixOptions): Promise<SupportMatrix> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const payload = await fetchJson(fetchImpl, options.url);

  return supportMatrixSchema.parse(payload);
}
