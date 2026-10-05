export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div>
        <div className="skeleton mb-3 h-4 w-40" />
        <div className="skeleton h-12 w-72" />
      </div>
      <div className="skeleton h-56 w-full rounded-[1.5rem]" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="skeleton h-80 rounded-[1.25rem]" />
        <div className="skeleton h-80 rounded-[1.25rem]" />
      </div>
    </div>
  );
}
