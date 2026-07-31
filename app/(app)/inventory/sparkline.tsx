// Inline SVG, no charting dependency (S-19 in_scope decision) -- a plain
// polyline is sufficient for a trend indicator at card and detail scale.
export function Sparkline({ points, width = 80, height = 24 }: { points: { unitPrice: number }[]; width?: number; height?: number }) {
  if (points.length < 2) {
    return <span className="text-xs text-muted-foreground">no trend yet</span>;
  }

  const values = points.map((p) => p.unitPrice);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const coords = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block text-primary" role="img" aria-label="Price trend">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
