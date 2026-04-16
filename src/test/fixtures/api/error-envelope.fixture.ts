export const errorEnvelopeFixture = {
  ok: false,
  error: {
    code: 'shell.release-manifest-unavailable',
    title: 'Release manifest unavailable',
    detail: 'The hosted shell could not load release metadata.',
    severity: 'warning',
    retryable: true,
    contextRef: 'release-manifest',
  },
};
