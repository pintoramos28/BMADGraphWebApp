export interface WorkspaceBinaryArtifactStore {
  writeArtifact(path: string, contents: BlobPart[]): Promise<void>;
  readArtifact(path: string): Promise<File | null>;
  deleteArtifact(path: string): Promise<void>;
}

async function resolveParentDirectory(root: FileSystemDirectoryHandle, path: string) {
  const segments = path.split('/').filter(Boolean);
  const fileName = segments.pop();

  if (!fileName) {
    throw new Error('Artifact path must include a file name.');
  }

  let directory = root;

  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, {
      create: true,
    });
  }

  return {
    directory,
    fileName,
  };
}

export class OpfsBinaryArtifactStore implements WorkspaceBinaryArtifactStore {
  readonly #getRootDirectory: () => Promise<FileSystemDirectoryHandle>;

  constructor(getRootDirectory: () => Promise<FileSystemDirectoryHandle> = () => navigator.storage.getDirectory()) {
    this.#getRootDirectory = getRootDirectory;
  }

  async writeArtifact(path: string, contents: BlobPart[]) {
    const root = await this.#getRootDirectory();
    const { directory, fileName } = await resolveParentDirectory(root, path);
    const handle = await directory.getFileHandle(fileName, {
      create: true,
    });
    const writable = await handle.createWritable();

    await writable.write(new Blob(contents));
    await writable.close();
  }

  async readArtifact(path: string) {
    try {
      const root = await this.#getRootDirectory();
      const { directory, fileName } = await resolveParentDirectory(root, path);
      const handle = await directory.getFileHandle(fileName);

      return handle.getFile();
    } catch {
      return null;
    }
  }

  async deleteArtifact(path: string) {
    const root = await this.#getRootDirectory();
    const { directory, fileName } = await resolveParentDirectory(root, path);

    await directory.removeEntry(fileName);
  }
}
