export type DesignRunSourceAsset = {
  storageKey: string;
  filename?: string;
  contentType?: string | null;
  sizeBytes?: number;
  url?: string | null;
  expiresAt?: string | null;
  role?: 'sketch_layout_note' | 'user_attachment' | string;
  label?: string | null;
};

export type SourceAssetUpload = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadProgress?: number;
  error?: string;
  storageKey?: string;
  filename?: string;
  contentType?: string | null;
  sizeBytes?: number;
};
