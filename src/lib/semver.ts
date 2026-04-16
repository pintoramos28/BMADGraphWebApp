function parseCoreVersion(version: string) {
  const coreVersion = version.split(/[+-]/, 1)[0] ?? version;
  const [major = '0', minor = '0', patch = '0'] = coreVersion.split('.');

  return [Number(major), Number(minor), Number(patch)] as const;
}

export function compareSemver(left: string, right: string) {
  const leftParts = parseCoreVersion(left);
  const rightParts = parseCoreVersion(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

export function matchesVersionRange(version: string, range: string) {
  if (!range.endsWith('.x')) {
    return compareSemver(version, range) === 0;
  }

  const rangeParts = range.replace(/\.x$/, '').split('.');
  const versionParts = version.split('.');

  return rangeParts.every((part, index) => part === (versionParts[index] ?? ''));
}
