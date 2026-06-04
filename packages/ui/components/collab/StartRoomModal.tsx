import React, { useEffect, useMemo, useState } from 'react';
import { PRESENCE_SWATCHES } from '@plannotator/ui/utils/presenceColor';
import { OverlayScrollArea } from '../OverlayScrollArea';
import {
  FileTree,
  buildFileTree,
  collectFilePaths,
  collectFolderPaths,
  sumFileCounts,
} from '../file-tree/FileTree';

/**
 * Pure create-room dialog. Collects display name, color, expiry, and
 * confirms the image-strip consequence when relevant. In folder sessions,
 * additionally renders a file picker so the user can choose which docs
 * enter the room snapshot.
 *
 * Emits one callback (`onStart`) with the settled options; the parent
 * (`App.tsx`'s `handleConfirmStartRoom`) calls `createRoom()` directly
 * because the flow needs a synchronous `window.open()` inside the click
 * handler's user-activation window — a React hook boundary between click
 * and open would get the popup blocked in most browsers.
 *
 * Not a controlled modal — parent decides when to mount. Dismiss via the
 * Cancel button (not Esc-only) so the caller can abort an in-flight
 * createRoom via AbortController.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartRoomSubmit {
  displayName: string;
  color: string;
  expiresInDays: 0 | 1 | 7 | 30;
  selectedPaths?: string[];
}

export interface FolderFileEntry {
  /** Relative path from folder root (e.g. "README.md", "src/design.md") */
  path: string;
  /** Display name (basename) */
  name: string;
  /** Byte length of the file content */
  sizeBytes: number;
}

export interface FolderSessionInfo {
  files: FolderFileEntry[];
  preselectedPaths: Set<string>;
  annotationCounts: Map<string, number>;
  rootName?: string;
  rootPath?: string;
  /** Per-file count of annotations that carry images (will be stripped for rooms). */
  imageAnnotationCounts?: Map<string, number>;
}

export interface StartRoomModalProps {
  initialDisplayName?: string;
  initialColor?: string;
  imageAnnotationsToStrip?: number;
  inFlight?: boolean;
  errorMessage?: string;
  folderSession?: FolderSessionInfo;
  onStart(submit: StartRoomSubmit): void;
  onCancel(): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RAW_BYTES = 5 * 1024 * 1024; // 5 MB plaintext picker cap

// ---------------------------------------------------------------------------
// File Picker (folder-mode section)
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// FilePicker (composed tree)
// ---------------------------------------------------------------------------

const FilePicker: React.FC<{
  session: FolderSessionInfo;
  selected: Set<string>;
  onToggle: (path: string) => void;
  onSelectAnnotated: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  disabled: boolean;
}> = ({ session, selected, onToggle, onSelectAnnotated, onSelectAll, onClear, disabled }) => {
  const tree = useMemo(() => buildFileTree(session.files), [session.files]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(collectFolderPaths(tree)),
  );

  useEffect(() => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      for (const path of collectFolderPaths(tree)) next.add(path);
      return next;
    });
  }, [tree]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectedBytes = useMemo(
    () => session.files.filter(f => selected.has(f.path)).reduce((sum, f) => sum + f.sizeBytes, 0),
    [session.files, selected],
  );
  const overBudget = selectedBytes > MAX_RAW_BYTES;
  const annotatedCount = session.preselectedPaths.size;
  const rootLabel = session.rootName ?? 'Folder';

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border/50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Documents</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {selected.size}/{session.files.length} selected
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={session.rootPath ?? rootLabel}>
              {rootLabel}
            </div>
          </div>
          <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-border/60 bg-background/60 text-[10px]">
            <button
              type="button"
              onClick={onSelectAnnotated}
              disabled={disabled || annotatedCount === 0}
              className="px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              Annotated
            </button>
            <button
              type="button"
              onClick={onSelectAll}
              disabled={disabled}
              className="border-l border-border/60 px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              All
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="border-l border-border/60 px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              None
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${overBudget ? 'bg-destructive' : 'bg-primary/70'}`}
              style={{ width: `${Math.min(100, (selectedBytes / MAX_RAW_BYTES) * 100)}%` }}
            />
          </div>
          <div className={`flex items-center justify-between text-[11px] ${overBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
            <span className="tabular-nums">{formatBytes(selectedBytes)}</span>
            <span className="tabular-nums">{formatBytes(MAX_RAW_BYTES)} limit</span>
          </div>
        </div>
      </div>
      <OverlayScrollArea className="min-h-[260px] flex-1">
        <FileTree
          nodes={tree}
          expandedFolders={expandedFolders}
          onToggleFolder={(path) => toggleFolder(path)}
          onSelectFile={(node) => onToggle(node.path)}
          getFileDisplayName={(node) => node.name}
          getFolderCount={(node) => sumFileCounts(node, session.annotationCounts)}
          getFileCount={(node) => session.annotationCounts.get(node.path) ?? 0}
          isFileDisabled={(node) => disabled || (overBudget && !selected.has(node.path))}
          renderFolderControl={({ node }) => {
            const childFiles = collectFilePaths(node);
            const allChecked = childFiles.length > 0 && childFiles.every(p => selected.has(p));
            const someChecked = !allChecked && childFiles.some(p => selected.has(p));
            const folderDisabled = disabled || (overBudget && !childFiles.some(p => selected.has(p)));
            const toggleFolderSelection = () => {
              if (folderDisabled) return;
              if (allChecked || someChecked) {
                for (const p of childFiles) if (selected.has(p)) onToggle(p);
              } else {
                for (const p of childFiles) if (!selected.has(p)) onToggle(p);
              }
            };
            return (
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleFolderSelection}
                disabled={folderDisabled}
                className="rounded border-border accent-primary flex-shrink-0"
                onClick={e => e.stopPropagation()}
              />
            );
          }}
          renderFileControl={({ node, disabled: fileDisabled }) => (
            <input
              type="checkbox"
              checked={selected.has(node.path)}
              onChange={() => onToggle(node.path)}
              disabled={fileDisabled}
              className="rounded border-border accent-primary flex-shrink-0"
              onClick={e => e.stopPropagation()}
            />
          )}
          renderFileMeta={({ node }) => (
            <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 tabular-nums">
              {formatBytes(node.sizeBytes ?? 0)}
            </span>
          )}
        />
      </OverlayScrollArea>
      {overBudget && (
        <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-[11px] text-destructive">
          Selection exceeds the 5 MB limit. Deselect some files to continue.
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export function StartRoomModal({
  initialDisplayName = '',
  initialColor = PRESENCE_SWATCHES[0],
  imageAnnotationsToStrip = 0,
  inFlight = false,
  errorMessage,
  folderSession,
  onStart,
  onCancel,
}: StartRoomModalProps): React.ReactElement {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [color, setColor] = useState<string>(initialColor);
  const [expiresInDays, setExpiresInDays] = useState<0 | 1 | 7 | 30>(7);

  // File picker state (folder mode only)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(
    () => folderSession ? new Set(folderSession.preselectedPaths) : new Set(),
  );

  const isFolder = !!folderSession;

  const effectiveImageStrip = useMemo(() => {
    if (!isFolder || !folderSession?.imageAnnotationCounts) return imageAnnotationsToStrip;
    let total = 0;
    for (const path of selectedFiles) {
      total += folderSession.imageAnnotationCounts.get(path) ?? 0;
    }
    return total;
  }, [isFolder, folderSession, selectedFiles, imageAnnotationsToStrip]);
  const strips = effectiveImageStrip > 0;

  const selectedBytes = useMemo(() => {
    if (!folderSession) return 0;
    return folderSession.files.filter(f => selectedFiles.has(f.path)).reduce((s, f) => s + f.sizeBytes, 0);
  }, [folderSession, selectedFiles]);
  const overBudget = isFolder && selectedBytes > MAX_RAW_BYTES;
  const noFilesSelected = isFolder && selectedFiles.size === 0;

  const ctaLabel = inFlight
    ? 'Creating…'
    : strips ? 'Strip images and start' : 'Start room';

  function handleToggle(path: string) {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight || overBudget || noFilesSelected) return;
    const trimmed = displayName.trim();
    if (!trimmed) return;
    onStart({
      displayName: trimmed,
      color,
      expiresInDays,
      ...(isFolder ? { selectedPaths: [...selectedFiles] } : {}),
    });
  }

  const settingsFields = (
    <>
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Display name</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          disabled={inFlight}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none transition-colors focus:border-ring"
          placeholder="Your name"
          autoFocus={!isFolder}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Color</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESENCE_SWATCHES.map(s => (
            <button
              key={s}
              type="button"
              disabled={inFlight}
              onClick={() => setColor(s)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${color === s ? 'border-foreground scale-105' : 'border-transparent'}`}
              style={{ backgroundColor: s }}
              aria-label={`Color ${s}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase text-muted-foreground">Expires</label>
        <select
          value={expiresInDays}
          onChange={e => setExpiresInDays(Number(e.target.value) as 0 | 1 | 7 | 30)}
          disabled={inFlight}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none transition-colors focus:border-ring"
        >
          <option value={1}>1 day</option>
          <option value={7}>7 days (default)</option>
          <option value={30}>30 days</option>
          <option value={0}>Never</option>
        </select>
      </div>
    </>
  );

  const notices = (
    <>
      {strips && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
          <strong>Images won't travel.</strong>{' '}
          {effectiveImageStrip} item{effectiveImageStrip === 1 ? '' : 's'} with image attachments will be stripped before sharing. Your local copies stay intact.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive" role="alert">
          {errorMessage}
        </div>
      )}
    </>
  );

  const actions = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={inFlight || !displayName.trim() || overBudget || noFilesSelected}
        className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background transition-opacity disabled:opacity-50"
      >
        {ctaLabel}
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      data-testid="start-room-modal"
    >
      <form
        onSubmit={handleSubmit}
        className={`max-w-[90vw] overflow-hidden rounded-xl border border-border bg-card shadow-2xl ${
          isFolder ? 'flex max-h-[min(86vh,760px)] w-[780px] flex-col' : 'w-[420px] space-y-4 p-5'
        }`}
      >
        {isFolder && folderSession ? (
          <>
            <div className="border-b border-border/50 px-5 py-4">
              <h2 className="text-base font-semibold">Start live room</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground" title={folderSession.rootPath}>
                {folderSession.rootName ?? 'Folder'} folder session
              </p>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_230px]">
              <FilePicker
                session={folderSession}
                selected={selectedFiles}
                onToggle={handleToggle}
                onSelectAnnotated={() => setSelectedFiles(new Set(folderSession.preselectedPaths))}
                onSelectAll={() => setSelectedFiles(new Set(folderSession.files.map(f => f.path)))}
                onClear={() => setSelectedFiles(new Set())}
                disabled={inFlight}
              />
              <div className="space-y-4 border-t border-border/50 bg-muted/10 p-4 md:border-l md:border-t-0">
                {settingsFields}
                {notices}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/50 px-5 py-3">
              <div className={`min-w-0 text-xs ${overBudget || noFilesSelected ? 'text-destructive' : 'text-muted-foreground'}`}>
                {noFilesSelected
                  ? 'Select at least one file.'
                  : `${selectedFiles.size} file${selectedFiles.size === 1 ? '' : 's'} ready`}
              </div>
              {actions}
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold">Start live review session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Share a link. Collaborators see your plan and annotations in real time.
              </p>
            </div>
            {settingsFields}
            {notices}
            <div className="pt-2">
              {actions}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
