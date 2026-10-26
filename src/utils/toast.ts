type ToastListener = (text: string, type?: 'success' | 'error' | 'info') => void;
let listener: ToastListener | null = null;

export function registerToastListener(cb: ToastListener) {
  listener = cb;
  return () => {
    if (listener === cb) listener = null;
  };
}

export function showGlobalToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  if (listener) {
    listener(text, type);
  }
}
