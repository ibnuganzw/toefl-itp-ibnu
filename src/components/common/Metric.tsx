export function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
