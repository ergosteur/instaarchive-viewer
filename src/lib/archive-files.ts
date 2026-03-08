import { ArchiveFile } from '../types';

export class LocalArchiveFile implements ArchiveFile {
  constructor(private file: File) {}
  get name() { return this.file.name; }
  get webkitRelativePath() { return this.file.webkitRelativePath; }
  get size() { return this.file.size; }
  text() { return this.file.text(); }
  arrayBuffer() { return this.file.arrayBuffer(); }
  stream() { return this.file.stream(); }
}

export class RemoteArchiveFile implements ArchiveFile {
  constructor(
    public name: string,
    public webkitRelativePath: string,
    public size: number,
    public url: string
  ) {}
  async text() {
    const res = await fetch(this.url);
    return res.text();
  }
  async arrayBuffer() {
    const res = await fetch(this.url);
    return res.arrayBuffer();
  }
  stream() {
    const transform = new TransformStream();
    fetch(this.url).then(res => {
      if (res.body) res.body.pipeTo(transform.writable);
      else transform.writable.getWriter().close();
    });
    return transform.readable;
  }
}
