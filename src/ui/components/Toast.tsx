import { useEffect, useState } from 'react'
import { useGameStore } from '../store'
import type { ToastMsg } from '../store'

const STYLES: Record<ToastMsg['type'], { border: string; text: string; bg: string; icon: string }> = {
  success: { border: '#4ade80', text: '#86efac', bg: 'rgba(5,25,5,0.97)', icon: 'OK' },
  error: { border: '#ef4444', text: '#fca5a5', bg: 'rgba(25,5,5,0.97)', icon: '!' },
  info: { border: '#c8860a', text: '#f5c842', bg: 'rgba(20,12,2,0.97)', icon: 'i' },
}

function ToastCard({ t, onDismiss }: { t: ToastMsg; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const s = STYLES[t.type]
  const lifetime = t.type === 'error' ? 3000 : 2000

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, lifetime)
    return () => clearTimeout(timer)
  }, [lifetime, onDismiss])

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onDismiss, 300) }}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 3,
        padding: '6px 12px 6px 10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 12,
        boxShadow: `2px 2px 0 #000, 0 0 10px ${s.border}55`,
        maxWidth: 320,
        minWidth: 180,
        cursor: 'pointer',
        userSelect: 'none',
        pointerEvents: 'auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <span style={{ color: s.border, fontWeight: 'bold', marginTop: 1, flexShrink: 0 }}>
        {s.icon}
      </span>
      <span style={{ color: s.text, lineHeight: '1.45', wordBreak: 'break-word' }}>
        {t.message}
      </span>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useGameStore((s) => s.toasts)
  const removeToast = useGameStore((s) => s.removeToast)

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 8,
      zIndex: 99999,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastCard key={t.id} t={t} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  )
}
