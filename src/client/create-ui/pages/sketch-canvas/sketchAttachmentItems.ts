import type { DesignRunSourceAsset, SourceAssetUpload } from '../../app/types';

export type SketchCanvasAttachmentItem = {
  id: string;
  name: string;
  detail: string;
  status: 'ready' | SourceAssetUpload['uploadStatus'];
  file?: File;
  sourceAsset?: DesignRunSourceAsset;
  storageKey?: string;
  uploadFileIds?: string[];
};

export const formatAttachmentFileSize = (bytes: number | undefined): string => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'Reference image';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeStorageKey = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const resolveAttachmentName = (asset: DesignRunSourceAsset): string => (
  asset.filename || asset.storageKey.split('/').pop() || 'Reference image'
);

export const buildSketchAttachmentItems = (args: {
  reusedSourceAssets: DesignRunSourceAsset[];
  attachmentFiles: SourceAssetUpload[];
}): SketchCanvasAttachmentItem[] => {
  const seenStorageKeys = new Set<string>();
  const localFilesByStorageKey = new Map<string, SourceAssetUpload[]>();

  for (const file of args.attachmentFiles) {
    const storageKey = normalizeStorageKey(file.storageKey);
    if (!storageKey) continue;
    const files = localFilesByStorageKey.get(storageKey) ?? [];
    files.push(file);
    localFilesByStorageKey.set(storageKey, files);
  }

  const reusedItems = args.reusedSourceAssets.flatMap((asset) => {
    const storageKey = normalizeStorageKey(asset.storageKey);
    if (!storageKey || seenStorageKeys.has(storageKey)) return [];
    seenStorageKeys.add(storageKey);
    return [{
      id: storageKey,
      name: resolveAttachmentName(asset),
      detail: formatAttachmentFileSize(asset.sizeBytes),
      status: 'ready' as const,
      sourceAsset: asset,
      storageKey,
      uploadFileIds: (localFilesByStorageKey.get(storageKey) ?? []).map((file) => file.id),
    }];
  });

  const localItems = args.attachmentFiles.flatMap((file) => {
    const storageKey = normalizeStorageKey(file.storageKey);
    if (storageKey) {
      if (seenStorageKeys.has(storageKey)) return [];
      seenStorageKeys.add(storageKey);
    }
    return [{
      id: file.id,
      name: file.filename || file.name || 'Reference image',
      detail: file.error || formatAttachmentFileSize(file.sizeBytes ?? file.size),
      status: file.uploadStatus,
      file: file.file,
      ...(storageKey ? { storageKey, uploadFileIds: [file.id] } : { uploadFileIds: [file.id] }),
    }];
  });

  return [...reusedItems, ...localItems];
};
