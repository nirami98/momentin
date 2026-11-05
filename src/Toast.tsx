import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
type Toast = { id: number; kind: 'success' | 'error'; message: string };
const Context = createContext<(kind: Toast['kind'], message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((kind: Toast['kind'], message: string) => {
    if (!message) { setToasts([]); return; }
    setToasts([{ id: Date.now() + Math.random(), kind, message }]);
  }, []);
  return <Context.Provider value={notify}>{children}<div className="toast-stack" aria-label="Notifications">
    {toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-atomic="true">
      <span className="toast-icon" aria-hidden="true">{toast.kind === 'success' ? '✓' : '!'}</span><p>{toast.message}</p>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}>×</button>
    </div>)}
  </div></Context.Provider>;
}
export function useNotifications() {
  const notify = useContext(Context);
  return { setError: (message: string) => notify('error', message), setNotice: (message: string) => notify('success', message) };
}
