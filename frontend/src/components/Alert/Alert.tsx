import type { ReactNode } from 'react'
import './Alert.css'

type AlertVariant = 'success' | 'error' | 'info'

interface AlertProps {
  variant: AlertVariant
  title: string
  message?: string
  children?: ReactNode
  onDismiss?: () => void
}

export function Alert({
  variant,
  title,
  message,
  children,
  onDismiss,
}: AlertProps) {
  return (
    <section
      className={`alert alert--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="alert__symbol" aria-hidden="true">
        {variant === 'success' ? '✓' : variant === 'error' ? '!' : 'i'}
      </div>
      <div className="alert__content">
        <h2 className="alert__title">{title}</h2>
        {message && <p className="alert__message">{message}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="alert__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          ×
        </button>
      )}
    </section>
  )
}

