import { getToken } from './auth';
import { ApiError } from './api';

export type UploadResult = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes: number;
  resourceType: string;
  mimetype: string;
  filename: string;
};

/**
 * Upload one media file via the backend's `POST /api/v1/uploads` endpoint (Cloudinary
 * under the hood). Returns the public URL plus a bit of metadata.
 *
 * Use the dedicated `fetch` here rather than `api()` because the latter always JSON-
 * encodes; uploads are multipart/form-data.
 */
export async function uploadMedia(
  file: File,
  options: { folder?: string } = {},
): Promise<UploadResult> {
  const token = getToken();

  const fd = new FormData();
  fd.append('file', file);

  const qs = options.folder ? `?folder=${encodeURIComponent(options.folder)}` : '';
  const res = await fetch(`/api/v1/uploads${qs}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  let json: { success: true; data: UploadResult } | { success: false; error: { code: string; message: string } };
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'invalid_response', `Upload failed (HTTP ${res.status})`);
  }

  if (!json.success) {
    throw new ApiError(res.status, json.error.code, json.error.message);
  }
  return json.data;
}
