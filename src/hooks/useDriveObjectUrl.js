import { useEffect, useState } from 'react';
import { getDriveBlob } from '../lib/syncService';

// Avoid refetching the same file for every card or modal render. Entries are
// cleared automatically if the download fails.
const blobCache = new Map();

function loadBlob(fileId) {
  if (!blobCache.has(fileId)) {
    const promise = getDriveBlob(fileId);
    blobCache.set(fileId, promise);
    promise.catch(() => blobCache.delete(fileId));
  }
  return blobCache.get(fileId);
}

/**
 * Resolve a Google Drive file ID to a local object URL so it can be shown in
 * an <img>. The URL is revoked when the component unmounts.
 */
export function useDriveObjectUrl(fileId) {
  const [state, setState] = useState({ url: null, loading: Boolean(fileId), error: null });

  useEffect(() => {
    if (!fileId) {
      setState({ url: null, loading: false, error: null });
      return undefined;
    }

    let active = true;
    let objectUrl = null;
    setState({ url: null, loading: true, error: null });

    loadBlob(fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          url: null,
          loading: false,
          error: error.message || 'This image could not be loaded from Google Drive.',
        });
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  return state;
}
