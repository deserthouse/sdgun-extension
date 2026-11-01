// R6-2 全局 toast（轻量队列，无需依赖）——反馈从 inline span 解耦
import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; kind: 'ok' | 'info' | 'err' };
let seq = 1;
let push: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  push?.({ text, kind });
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = seq++;
      setItems((v) => [...v, { ...t, id }]);
      setTimeout(() => setItems((v) => v.filter((x) => x.id !== id)), 2600);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="toast-host" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">{t.text}</div>
      ))}
    </div>
  );
}
