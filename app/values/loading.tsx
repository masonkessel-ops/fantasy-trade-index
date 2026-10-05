export default function Loading() {
  return (
    <div>
      <div className="skeleton mb-3 h-4 w-40" />
      <div className="skeleton mb-8 h-12 w-72" />
      <div className="skeleton mb-3 h-11 w-full" />
      <div className="card space-y-1 p-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="skeleton h-14 w-full" style={{ opacity: 1 - i * 0.07 }} />
        ))}
      </div>
    </div>
  );
}
