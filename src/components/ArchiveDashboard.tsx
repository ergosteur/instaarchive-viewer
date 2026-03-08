import React from 'react';
import { 
  FolderOpen, 
  Grid3X3, 
  Play, 
  Trash2, 
  Zap 
} from 'lucide-react';
import { ServerArchive } from '../types';

interface ArchiveDashboardProps {
  archives: ServerArchive[];
  localArchives?: any[];
  cachedArchives: Set<string>;
  onSelect: (archive: ServerArchive) => void;
  onLocalSelect: () => void;
  onClearCache: (name: string) => void;
  isScanning: boolean;
}

export const ArchiveDashboard: React.FC<ArchiveDashboardProps> = ({ 
  archives, 
  localArchives = [],
  cachedArchives,
  onSelect,
  onLocalSelect,
  onClearCache,
  isScanning
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight font-serif italic text-black/80">Archive Explorer</h2>
        <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
          Browse hosted collections or open a local archive folder. All processing happens locally in your browser for maximum privacy.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
        {/* Local Folder Card */}
        <button 
          onClick={onLocalSelect}
          disabled={isScanning}
          className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center gap-4 group disabled:opacity-50 text-black"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors shadow-inner">
            <FolderOpen size={24} />
          </div>
          <div className="text-center px-4">
            <span className="font-bold text-sm block text-black/80">Open Local Folder</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-tight block mt-1">Processed in Browser</span>
          </div>
        </button>

        {/* Server Archives */}
        {archives.map((archive) => {
          const isCached = cachedArchives.has(archive.name);
          return (
            <div key={archive.path} className="relative group text-black">
              <button
                onClick={() => onSelect(archive)}
                disabled={isScanning}
                className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all flex flex-col text-left disabled:opacity-50"
              >
                <div className="flex-1 bg-gray-100 overflow-hidden relative">
                  {archive.thumbnail ? (
                    <img src={archive.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Grid3X3 size={48} strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={32} fill="white" className="text-white" />
                  </div>
                  
                  {isCached && (
                    <div className="absolute top-2 left-2 bg-blue-500 text-white p-1 rounded-md shadow-lg flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider z-10 pr-2 opacity-0 group-hover:opacity-100 transition-all">
                      <Zap size={10} fill="currentColor" />
                      Cached
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <span className="font-bold text-sm block truncate uppercase tracking-tight text-black/80">{archive.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">{archive.fileCount} items</span>
                </div>
              </button>
              
              {isCached && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCache(archive.name);
                  }}
                  className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"
                  title="Clear Cache"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}

        {/* Local Cached Archives */}
        {localArchives.map((archive) => (
          <div key={archive.name} className="relative group text-black">
            <button
              onClick={onLocalSelect}
              disabled={isScanning}
              className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all flex flex-col text-left disabled:opacity-50"
            >
              <div className="flex-1 bg-gray-100 overflow-hidden relative text-black">
                {archive.profileMetadata.profilePic ? (
                  <img src={archive.profileMetadata.profilePic} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Grid3X3 size={48} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FolderOpen size={32} fill="white" className="text-white" />
                </div>
                <div className="absolute bottom-2 left-2 bg-gray-800/80 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest backdrop-blur-sm">
                  Local Cache
                </div>
              </div>
              <div className="p-4 space-y-1 text-black">
                <span className="font-bold text-sm block truncate uppercase tracking-tight text-black/80">{archive.name}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">{archive.fileCount} indexed</span>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearCache(archive.name);
              }}
              className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"
              title="Clear Cache"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
