import * as React from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary'

const variantClasses: Record<BadgeVariant, string> = {
  default:   'bg-gray-100 text-gray-700',
  success:   'bg-green-100 text-green-700',
  warning:   'bg-amber-100 text-amber-700',
  danger:    'bg-red-100 text-red-700',
  info:      'bg-blue-100 text-blue-700',
  secondary: 'bg-purple-100 text-purple-700',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export default function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant] ?? variantClasses.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
