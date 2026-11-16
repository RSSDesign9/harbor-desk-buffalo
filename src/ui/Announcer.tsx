import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/** One polite live region for concise action results (“Dock check requested. Issue stays open.”). */
const Ctx = createContext<(message: string) => void>(() => undefined);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((m: string) => {
    // Clear first so repeating the same message is announced again.
    setMessage('');
    window.requestAnimationFrame(() => setMessage(m));
  }, []);
  return (
    <Ctx.Provider value={announce}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" data-testid="announcer">
        {message}
      </div>
    </Ctx.Provider>
  );
}

export const useAnnounce = () => useContext(Ctx);
