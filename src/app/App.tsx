import { lazy, Suspense } from 'react';
import { AppStoreProvider } from './AppStore.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { LoadingShell } from './LoadingShell.tsx';
import { Shell } from './Shell.tsx';
import { AnnouncerProvider } from '../ui/Announcer.tsx';

// QA surface for the T07 component foundation; not linked from the product UI.
const Gallery = lazy(() => import('../ui/gallery/Gallery.tsx'));

export function App() {
  const showGallery = new URLSearchParams(window.location.search).get('ui') === 'primitives';
  return (
    <AnnouncerProvider>
      <ErrorBoundary region="Harbor Desk">
        <AppStoreProvider>
          {showGallery ? (
            <Suspense fallback={<LoadingShell label="Loading component gallery…" />}>
              <Gallery />
            </Suspense>
          ) : (
            <Shell />
          )}
        </AppStoreProvider>
      </ErrorBoundary>
    </AnnouncerProvider>
  );
}
