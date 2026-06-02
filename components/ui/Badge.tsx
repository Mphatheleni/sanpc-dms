import { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default:   'bg-gray-100 text-gray-700',
  success:   'bg-green-100 text-green-700',
  warning:   'bg-yellow-100 text-yellow-800',
  danger:    'bg-red-100 text-red-700',
  info:      'bg-sanpc-navy-light text-sanpc-navy',
  secondary: 'bg-purple-100 text-purple-700',
}

export default function Badge({ variant = 'default', children, className = '', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
