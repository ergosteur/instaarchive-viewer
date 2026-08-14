import { ArchiveFile, ArchiveSource } from '../types';

export class LocalArchiveFile implements ArchiveFile {
  /** Blob URLs minted here are revocable and must be released when done. */
  readonly revocable = true;

  /**
   * @param explicitPath Set when the file came from the File System Access API,
   *   whose File objects carry an empty webkitRelativePath.
   */
  constructor(private file: File, private explicitPath?: string) {}
  get name() { return this.file.name; }
  get webkitRelativePath() { return this.explicitPath ?? this.file.webkitRelativePath; }
  get size() { return this.file.size; }
  text() { return this.file.text(); }
  arrayBuffer() { return this.file.arrayBuffer(); }

  /**
   * A blob: URL backed directly by the on-disk File.
   *
   * Deliberately does NOT go through arrayBuffer() — a File is already a Blob,
   * so this hands the browser a disk-backed handle instead of pulling the whole
   * file into memory. Doing otherwise means a 20GB archive tries to become 20GB
   * of resident blobs.
   *
   * When the picker gave us no MIME type, slice() re-tags the blob with a hint.
   * slice() is a zero-copy view, so this stays memory-free either way.
   */
  createObjectUrl(mimeHint?: string) {
    const source = this.file.type || !mimeHint
      ? this.file
      : this.file.slice(0, this.file.size, mimeHint);
    return URL.createObjectURL(source);
  }
}

export class RemoteArchiveFile implements ArchiveFile {
  /** Served over HTTP; there is no object URL to release. */
  readonly revocable = false;

  constructor(
    public name: string,
    public webkitRelativePath: string,
    public size: number,
    public url: string,
    public source?: ArchiveSource,
    public mtime?: number
  ) {}
  async text() {
    const res = await fetch(this.url);
    return res.text();
  }
  async arrayBuffer() {
    const res = await fetch(this.url);
    return res.arrayBuffer();
  }
  createObjectUrl() {
    return this.url;
  }
}
