interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  buttonText?: string;
  onClose: () => void;
}

export default function CelebrateModal({ emoji, title, subtitle, buttonText = 'Tuyệt!', onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 56 }}>{emoji}</div>
        <div className="h2 mt-3">{title}</div>
        {subtitle && <div className="muted mt-2">{subtitle}</div>}
        <button className="btn btn-primary btn-block mt-4" onClick={onClose}>{buttonText}</button>
      </div>
    </div>
  );
}
