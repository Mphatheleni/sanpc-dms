'use client'

import { CheckCircle, Clock, CircleDot } from 'lucide-react'
import type { DocumentStatus } from '@/types'

interface Stage {
  status: DocumentStatus[]
  label: string
  shortLabel: string
  color: string
}

const PIPELINE_STAGES: Stage[] = [
  { status: ['REGISTERED', 'DRAFT'],         label: 'Registered',        shortLabel: 'Registered',     color: '#6B7280' },
  { status: ['IN_REVIEW'],                   label: 'Under Review',      shortLabel: 'Review',         color: '#1C3557' },
  { status: ['UPDATING', 'REVIEW_COMPLETE'], label: 'Updates Required',  shortLabel: 'Updates',        color: '#D97706' },
  { status: ['FINAL_DRAFT', 'PENDING_APPROVAL', 'PENDING_REVIEW'], label: 'Approval', shortLabel: 'Approval', color: '#7C3AED' },
  { status: ['PENDING_AUTHORIZATION'],       label: 'Authorization',     shortLabel: 'Authorization',  color: '#0D9488' },
  { status: ['APPROVED'],                    label: 'Approved',          shortLabel: 'Approved',       color: '#16A34A' },
  { status: ['CONTROLLED'],                  label: 'Controlled',        shortLabel: 'Controlled',     color: '#15803D' },
]

const TERMINAL_STAGES: Stage[] = [
  { status: ['CHANGES_REQUESTED'],   label: 'Changes Requested', shortLabel: 'Changes',   color: '#D97706' },
  { status: ['REJECTED'],            label: 'Rejected',          shortLabel: 'Rejected',  color: '#DC2626' },
  { status: ['SUPERSEDED'],          label: 'Superseded',        shortLabel: 'Superseded', color: '#6B7280' },
  { status: ['CANCELLED'],           label: 'Cancelled',         shortLabel: 'Cancelled', color: '#DC2626' },
  { status: ['EXCO_PENDING'],        label: 'EXCO Pending',      shortLabel: 'EXCO',      color: '#7C3AED' },
]

function getStageIndex(status: DocumentStatus): number {
  return PIPELINE_STAGES.findIndex((s) => s.status.includes(status))
}

function isTerminal(status: DocumentStatus): boolean {
  return TERMINAL_STAGES.some((s) => s.status.includes(status))
}

function getTerminalStage(status: DocumentStatus): Stage | null {
  return TERMINAL_STAGES.find((s) => s.status.includes(status)) ?? null
}

interface Props {
  status: DocumentStatus
}

export default function WorkflowPipeline({ status }: Props) {
  const terminal = isTerminal(status)
  const terminalStage = terminal ? getTerminalStage(status) : null
  const activeIndex = getStageIndex(status)

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Document Workflow</h3>
        {terminal && terminalStage && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: terminalStage.color }}
          >
            <CircleDot className="h-3 w-3" />
            {terminalStage.label}
          </span>
        )}
      </div>

      {/* Pipeline steps */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-100 hidden sm:block" />

        <ol className="relative flex items-start justify-between gap-1 sm:gap-0">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isActive = !terminal && stage.status.includes(status)
            const isDone = !terminal && idx < activeIndex
            const isFuture = terminal || idx > activeIndex

            return (
              <li
                key={stage.label}
                className="relative flex flex-col items-center flex-1 min-w-0"
              >
                {/* Circle */}
                <div
                  className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    isActive
                      ? 'border-transparent shadow-lg'
                      : isDone
                      ? 'border-transparent'
                      : 'border-gray-200 bg-white'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: stage.color, boxShadow: `0 0 0 4px ${stage.color}22` }
                      : isDone
                      ? { backgroundColor: stage.color }
                      : {}
                  }
                >
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 text-white" />
                  ) : isActive ? (
                    <Clock className="h-5 w-5 text-white" />
                  ) : (
                    <span className="text-xs font-bold text-gray-300">{idx + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`mt-2 text-center text-[10px] sm:text-xs font-medium leading-tight px-1 ${
                    isActive ? 'font-bold' : isDone ? '' : 'text-gray-400'
                  }`}
                  style={isActive || isDone ? { color: stage.color } : {}}
                >
                  <span className="hidden sm:block">{stage.label}</span>
                  <span className="sm:hidden">{stage.shortLabel}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Terminal status callout */}
      {terminal && terminalStage && (
        <div
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: `${terminalStage.color}44`, backgroundColor: `${terminalStage.color}0D`, color: terminalStage.color }}
        >
          <strong>{terminalStage.label}:</strong>{' '}
          {status === 'CHANGES_REQUESTED' && 'Changes have been requested. The Document Controller will coordinate updates and resubmit the document.'}
          {status === 'REJECTED' && 'This document was rejected. The Document Controller will review the feedback and coordinate a resubmission.'}
          {status === 'SUPERSEDED' && 'This document has been superseded by a newer revision.'}
          {status === 'CANCELLED' && 'This document has been cancelled and is no longer active.'}
          {status === 'EXCO_PENDING' && 'Awaiting Board/EXCO resolution before the document can be controlled.'}
        </div>
      )}
    </div>
  )
}
