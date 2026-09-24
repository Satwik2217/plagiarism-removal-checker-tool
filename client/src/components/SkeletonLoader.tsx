interface SkeletonLoaderProps {
  lines?: number;
  height?: string;
}

export default function SkeletonLoader({ lines = 3, height = 'h-4' }: SkeletonLoaderProps) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton ${height} ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}