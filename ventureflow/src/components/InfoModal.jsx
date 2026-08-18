import { playSound } from '../audio/soundEngine';

/**
 * A small, generic "explain this" popup — used next to setup-screen choices
 * that might be confusing at a glance (currently: scenario/goal cards, see
 * SetupScreen.jsx's info button on each one). Deliberately content-only
 * (icon/title/body passed in) so it's reusable anywhere a quick explainer
 * is useful without writing a new modal component each time.
 */
export default function InfoModal({ open, icon, title, body, onClose }) {
  if (!open) return null;

  function handleClose() {
    playSound('click');
    onClose();
  }

  return (
    <div className="vf-modal-overlay" onClick={handleClose}>
      <div className="vf-card vf-modal vf-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vf-info-modal__icon">{icon}</div>
        <h3 className="vf-info-modal__title">{title}</h3>
        <p className="vf-info-modal__body">{body}</p>
        <button type="button" className="vf-btn vf-btn--primary vf-btn--block" onClick={handleClose}>
          Got it!
        </button>
      </div>
    </div>
  );
}
