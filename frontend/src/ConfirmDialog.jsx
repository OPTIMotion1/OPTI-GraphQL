import './ConfirmDialog.css';

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, warning, danger }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-header ${danger ? 'danger' : ''}`}>
          <h3>{title}</h3>
        </div>
        
        <div className="confirm-body">
          <p className="confirm-message">{message}</p>
          {warning && (
            <div className="confirm-warning">
              ⚠️ {warning}
            </div>
          )}
        </div>
        
        <div className="confirm-actions">
          <button 
            className="btn-cancel" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className={`btn-confirm ${danger ? 'danger' : ''}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
