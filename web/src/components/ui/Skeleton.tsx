interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rectangular' | 'circular' | 'text';
}

export default function Skeleton({ className = '', width, height, variant = 'rectangular' }: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-slate-800/50 rounded-lg';
  const variantStyles = {
    rectangular: '',
    circular: 'rounded-full',
    text: 'h-4 w-full mb-2',
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{
        width: width,
        height: height,
      }}
    />
  );
}
