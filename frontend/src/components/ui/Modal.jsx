// Dialog: small margins on mobile, capped height with the body scrolling inside, header and
// footer (so also the close button) always visible. A click on the backdrop does not close it,
// so typed text cannot be lost by accident.
import { X } from 'lucide-react';

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const Modal = ({ title, subtitle, onClose, size = 'md', footer, children }) => (
  <div className="modal-backdrop">
    <div className={`modal-panel ${WIDTHS[size] || WIDTHS.md}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header">
        <div className="min-w-0">
          <h2 className="section-title break-words">{title}</h2>
          {subtitle && <p className="meta mt-0.5">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="btn-icon bg-slate-100 text-slate-600 hover:bg-slate-200">
          <X size={18} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>
);

export default Modal;
