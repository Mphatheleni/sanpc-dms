import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export default function Card({ children, className = '', padding = true, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${padding ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
