export interface MediaFile {
  name: string;
  url: string;
  type: 'image' | 'video';
  index: number;
  size?: number;
}

export interface Post {
  id: string;
  date: string;
  username: string;
  caption: string;
  media: MediaFile[];
  thumbnail: string;
  isStory?: boolean;
}

/**
 * Common interface for both local File objects and remote server-side files.
 */
export interface ArchiveFile {
  name: string;
  webkitRelativePath: string;
  size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array>;
  url?: string;
}

export interface ServerArchive {
  name: string;
  thumbnail: string;
  path: string;
  fileCount: number;
}
