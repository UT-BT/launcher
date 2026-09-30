import { describe, expect, it } from 'vitest'
import { ROLE } from '@/app/utils/roles'
import { findSection, visibleSections } from './registry'

describe('the Streamers section', () => {
  it('sits in the Events group', () => {
    expect(findSection('streamers')?.group).toBe('events')
  })

  it.each([ROLE.MODERATOR, ROLE.ADMIN])('is visible to staff role %i', (role) => {
    expect(visibleSections(role).map((section) => section.id)).toContain('streamers')
  })

  it.each([ROLE.CUP_ADMIN, ROLE.USER])('is hidden from role %i', (role) => {
    expect(visibleSections(role).map((section) => section.id)).not.toContain('streamers')
  })
})
