// components/account-skeleton.tsx

export default function AccountSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Sidebar skeleton (hidden on mobile) */}
      <div className="hidden lg:flex lg:gap-8">
        <aside className="w-56 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-gray-200" />
          ))}
        </aside>
        <div className="flex-1 space-y-4">
          <div className="h-6 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
        </div>
      </div>
      {/* Mobile tabs skeleton */}
      <div className="lg:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-md bg-gray-200" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-6 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
