'use client';

import { useEffect } from 'react';
import { installBasePath } from '@/deploy/installBasePath';

/** Installed after paint so it wraps Next's own history patch. */
export function BasePath() {
  useEffect(() => {
    const id = window.setTimeout(installBasePath, 0);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
