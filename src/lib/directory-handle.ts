import { LocalArchiveFile } from './archive-files';

/**
 * File System Access API helpers.
 *
 * A `blob:` URL dies with the document, so a cached local archive whose media
 * URLs are blob: URLs is worthless after a reload. A FileSystemDirectoryHandle,
 * by contrast, is structured-cloneable and survives in IndexedDB — so we can
 * re-open the same folder on a return visit and mint fresh URLs from it.
 *
 * Only Chromium implements showDirectoryPicker today; callers must handle the
 * unsupported case by falling back to the <input webkitdirectory> flow.
 */

// Minimal typings — TS's lib.dom does not ship these in the configured version.
type PermissionState = 'granted' | 'denied' | 'prompt';
interface FileSystemHandlePermissionDescriptor { mode?: 'read' | 'readwrite' }
export interface DirectoryHandle {
  name: string;
  kind: 'directory';
  values(): AsyncIterableIterator<DirectoryHandle | FileHandle>;
  queryPermission?(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}
interface FileHandle {
  name: string;
  kind: 'file';
  getFile(): Promise<File>;
}

export const isDirectoryPickerSupported = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export const pickDirectory = async (): Promise<DirectoryHandle | null> => {
  if (!isDirectoryPickerSupported()) return null;
  try {
    return await (window as any).showDirectoryPicker({ mode: 'read' });
  } catch (err) {
    // AbortError simply means the user dismissed the picker.
    return null;
  }
};

/**
 * Confirm we may still read this handle. Returns false when the user declines
 * or the grant has lapsed, in which case the caller should re-prompt.
 *
 * `requestPermission` must be called from a user gesture, so only call this
 * while handling a click.
 */
export const ensureReadPermission = async (handle: DirectoryHandle): Promise<boolean> => {
  try {
    if (!handle.queryPermission) return true;
    if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return true;
    if (!handle.requestPermission) return false;
    return (await handle.requestPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
};

/**
 * Recursively collect every file in the directory.
 *
 * Paths are prefixed with the root directory's name so they line up with the
 * `webkitRelativePath` values produced by <input webkitdirectory>, keeping
 * cached media paths valid regardless of which picker created them.
 */
export const filesFromDirectory = async (handle: DirectoryHandle): Promise<LocalArchiveFile[]> => {
  const out: LocalArchiveFile[] = [];

  const walk = async (dir: DirectoryHandle, prefix: string) => {
    for await (const entry of dir.values()) {
      const entryPath = `${prefix}/${entry.name}`;
      if (entry.kind === 'directory') {
        await walk(entry as DirectoryHandle, entryPath);
      } else {
        const file = await (entry as FileHandle).getFile();
        out.push(new LocalArchiveFile(file, entryPath));
      }
    }
  };

  await walk(handle, handle.name);
  return out;
};
