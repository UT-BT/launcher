import type { RosterAssignment } from '@/app/utils/api'
import { formatDateTime } from '../components/controls'

export const ROSTER_NOTE_MAX_LENGTH = 200

export function twitchChannelLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '')
}

export function assignmentLine(assignment: RosterAssignment): string {
  const when = assignment.scheduled_at ? formatDateTime(assignment.scheduled_at) : 'Unscheduled'
  return `${assignment.event.name} · ${assignment.label} · ${when}`
}
