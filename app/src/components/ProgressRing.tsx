interface Props {
  percent: number;
  size?: number;
  stroke?: number;
}

function ringColor(p: number) {
  if (p >= 85) return 'var(--green)';
  if (p >= 60) return 'var(--primary)';
  return 'var(--orange)';
}

export default function ProgressRing({ percent, size = 62, stroke = 7 }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = ringColor(percent);
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4eaf4" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)}
        />
      </svg>
      <span className="ring-label" style={{ color }}>{percent}%</span>
    </span>
  );
}
