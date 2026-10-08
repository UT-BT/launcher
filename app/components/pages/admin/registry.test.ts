import { describe, expect, it } from 'vitest'
import { ROLE } from '@/app/utils/roles'
import { ADMIN_SECTIONS, findSection, visibleSections } from './registry'

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

describe('the Map Uploads section', () => {
  it('sits in the Game Content group, right after Maps Management', () => {
    const ids = ADMIN_SECTIONS.map((section) => section.id)
    expect(findSection('map-uploads')?.group).toBe('game-content')
    expect(ids.indexOf('map-uploads')).toBe(ids.indexOf('maps-management') + 1)
  })

  it.each([ROLE.MODERATOR, ROLE.ADMIN])('is visible to staff role %i', (role) => {
    expect(visibleSections(role).map((section) => section.id)).toContain('map-uploads')
  })

  it.each([ROLE.CUP_ADMIN, ROLE.USER])('is hidden from role %i', (role) => {
    expect(visibleSections(role).map((section) => section.id)).not.toContain('map-uploads')
  })
})
