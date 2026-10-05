export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-4 w-28" />
      <div className="skeleton h-64 w-full rounded-[1.25rem]" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="skeleton h-72 rounded-[1.25rem] lg:col-span-3" />
        <div className="skeleton h-72 rounded-[1.25rem] lg:col-span-2" />
      </div>
    </div>
  );
}
