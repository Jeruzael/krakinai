import React, { useEffect, useState } from 'react';

export const LibraryReloadNotice: React.FC = () => {
  const [required, setRequired] = useState(false);
  useEffect(() => {
    const changed = () => setRequired(true);
    window.addEventListener('krakinai-library-reload-required', changed);
    return () => window.removeEventListener('krakinai-library-reload-required', changed);
  }, []);
  if (!required) return null;
  return <div role="alert" className="banner banner-warning" style={{ position: 'sticky', top: 0, zIndex: 30, display: 'block' }}>
    <strong>Library restored. Reload before saving.</strong>
    <p>Copy any unsaved text you need first. This page cannot save its older state over the restored library.</p>
    <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload Library</button>
  </div>;
};
