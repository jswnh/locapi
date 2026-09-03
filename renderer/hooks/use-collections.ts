import { useEffect } from 'react';
import { useCollectionStore } from '@/stores/collection-store';

export function useCollections() {
  const {
    collections,
    isLoading,
    hasLoaded,
    loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    createFolder,
    updateFolder,
    deleteFolder,
    createRequest,
    updateRequest,
    deleteRequest,
    duplicateRequest,
    reorderRequests,
  } = useCollectionStore();

  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      loadCollections();
    }
  }, [hasLoaded, isLoading, loadCollections]);

  return {
    collections,
    isLoading,
    refresh: loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    createFolder,
    updateFolder,
    deleteFolder,
    createRequest,
    updateRequest,
    deleteRequest,
    duplicateRequest,
    reorderRequests,
  };
}
