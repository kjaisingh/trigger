import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - Trigger` : "Trigger - say it, we'll watch it";
  }, [title]);
}
