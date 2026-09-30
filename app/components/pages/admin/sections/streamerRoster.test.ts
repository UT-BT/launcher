import { describe, expect, it } from 'vitest'
import { assignmentLine, twitchChannelLabel } from './streamerRoster'

describe('twitchChannelLabel', () => {
  it('drops the scheme, www and trailing slashes', () => {
    expect(twitchChannelLabel('https://www.twitch.tv/Rin_Plays/')).toBe('twitch.tv/Rin_Plays')
  })

  it('keeps a bare channel path as it is', () => {
    expect(twitchChannelLabel('twitch.tv/rin')).toBe('twitch.tv/rin')
  })
})

describe('assignmentLine', () => {
  const assignment = { match_id: 'm1', event: { slug: 'cup', name: 'Summer Cup' }, label: 'Alpha vs Bravo' }

  it('names the event, the match and when it is scheduled', () => {
    const line = assignmentLine({ ...assignment, scheduled_at: '2026-10-02T18:00:00+00:00' })
    expect(line.startsWith('Summer Cup · Alpha vs Bravo · ')).toBe(true)
    expect(line).not.toContain('Unscheduled')
  })

  it('says Unscheduled when the match has no time', () => {
    expect(assignmentLine({ ...assignment, scheduled_at: null })).toBe('Summer Cup · Alpha vs Bravo · Unscheduled')
  })
})
