import React from 'react';

export interface AlertMessage {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onCloseAction?: () => void;
}

interface AlertModalProps {
  alert: AlertMessage | null;
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ alert, onClose }) => {
  if (!alert) return null;

  const handleClose = () => {
    onClose();
    if (alert.onCloseAction) {
      alert.onCloseAction();
    }
  };

  const getIconAndColor = () => {
    switch (alert.type) {
      case 'success':
        return { icon: '🎉', color: '#10b981', label: 'Sucesso' };
      case 'error':
        return { icon: '⚠️', color: '#ef4444', label: 'Erro' };
      case 'warning':
        return { icon: '🔔', color: '#f59e0b', label: 'Atenção' };
      case 'info':
      default:
        return { icon: 'ℹ️', color: '#3b82f6', label: 'Informação' };
    }
  };

  const { icon, color, label } = getIconAndColor();

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '420px',
          width: '90%',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.35)',
          borderRadius: '16px',
          padding: '1.75rem',
          textAlign: 'center',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `${color}20`,
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            margin: '0 auto 1.25rem auto'
          }}
        >
          {icon}
        </div>

        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-color)', fontSize: '1.25rem', fontWeight: 700 }}>
          {alert.title || label}
        </h3>

        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
          {alert.message}
        </p>

        <button
          onClick={handleClose}
          className="btn-primary"
          style={{
            background: '#334155',
            color: '#fff',
            fontWeight: 600,
            padding: '12px 32px',
            borderRadius: '25px',
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            width: '100%',
            transition: 'all 0.2s ease'
          }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
};

export default AlertModal;
