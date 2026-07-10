import * as React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: boolean | number
}

export default function Card({ className = '', padding = true, children, ...props }: CardProps) {
  const paddingClass = padding === false ? '' : 'p-5'
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
