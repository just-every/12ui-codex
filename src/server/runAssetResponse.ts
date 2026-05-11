import type { IncomingMessage, ServerResponse } from 'node:http';
import type { readRunAsset } from './assets.js';

type RunAssetResponse = Awaited<ReturnType<typeof readRunAsset>>;

const headerValue = (value: string | string[] | undefined): string | null => (
  Array.isArray(value) ? value.join(',') : value ?? null
);

export const etagMatches = (ifNoneMatch: string | null, etag: string): boolean => (
  Boolean(ifNoneMatch?.split(',').map((value) => value.trim()).some((value) => value === etag || value === '*'))
);

export const notModifiedSince = (ifModifiedSince: string | null, lastModified: string): boolean => {
  if (!ifModifiedSince) return false;
  const requestTime = Date.parse(ifModifiedSince);
  const assetTime = Date.parse(lastModified);
  return Number.isFinite(requestTime) && Number.isFinite(assetTime) && requestTime >= assetTime;
};

export const sendRunAsset = (
  request: IncomingMessage,
  response: ServerResponse,
  asset: RunAssetResponse,
): void => {
  const cacheHeaders = {
    'cache-control': 'private, max-age=31536000, immutable',
    etag: asset.etag,
    'last-modified': asset.lastModified,
  } as const;
  const ifNoneMatch = headerValue(request.headers['if-none-match']);
  const ifModifiedSince = headerValue(request.headers['if-modified-since']);
  const isFresh = etagMatches(ifNoneMatch, asset.etag)
    || (!ifNoneMatch && notModifiedSince(ifModifiedSince, asset.lastModified));

  if (isFresh) {
    response.writeHead(304, cacheHeaders);
    response.end();
    return;
  }

  response.writeHead(200, {
    ...cacheHeaders,
    'content-type': asset.contentType,
    'content-length': asset.contentLength,
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  response.end(asset.bytes);
};
