export default function Modal({ show, title, icon, onClose, children, footer, large }) {
  if (!show) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" onClick={onClose}>
        <div
          className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${large ? 'modal-lg' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center gap-2 fw-bold">
                {icon && <i className={`bi ${icon}`} style={{ color: 'var(--primary)', fontSize: '1.4rem' }} />}
                {title}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
