import { describe, expect, it } from 'vitest'
import {
  FEATURED_SUGGESTION_LIMIT,
  addableTags,
  moveTag,
  pickTag,
  sameTags,
  tagSuggestions,
  tagsWithoutActiveMap,
} from './featuredTags'

describe('moveTag', () => {
  const tags = ['easy', 'hard', 'team', 'speed']

  it('moves a tag down and shifts the ones it passes up', () => {
    expect(moveTag(tags, 0, 2)).toEqual(['hard', 'team', 'easy', 'speed'])
  })

  it('moves a tag up and shifts the ones it passes down', () => {
    expect(moveTag(tags, 3, 1)).toEqual(['easy', 'speed', 'hard', 'team'])
  })

  it('leaves the list as it is for a move to the same place or off either end', () => {
    expect(moveTag(tags, 1, 1)).toBe(tags)
    expect(moveTag(tags, 0, -1)).toBe(tags)
    expect(moveTag(tags, 3, 4)).toBe(tags)
  })

  it('never changes the list it was given', () => {
    moveTag(tags, 0, 3)
    expect(tags).toEqual(['easy', 'hard', 'team', 'speed'])
  })
})

describe('sameTags', () => {
  it('is true for the same tags in the same order', () => {
    expect(sameTags(['easy', 'hard'], ['easy', 'hard'])).toBe(true)
    expect(sameTags([], [])).toBe(true)
  })

  it('counts the order', () => {
    expect(sameTags(['easy', 'hard'], ['hard', 'easy'])).toBe(false)
  })

  it('counts an added or removed tag', () => {
    expect(sameTags(['easy'], ['easy', 'hard'])).toBe(false)
    expect(sameTags(['easy', 'hard'], ['easy'])).toBe(false)
  })
})

describe('tagSuggestions', () => {
  const available = ['Classic', 'easy', 'Halloween', 'hard', 'midsummer', 'Summer Cup', 'team']

  it('matches case-insensitively and keeps the exact tag name', () => {
    expect(tagSuggestions(available, [], 'HALLO')).toEqual(['Halloween'])
  })

  it('lists tags that start with the query before tags that contain it', () => {
    expect(tagSuggestions(available, [], 'summer')).toEqual(['Summer Cup', 'midsummer'])
  })

  it('leaves out tags already featured, whatever their case', () => {
    expect(tagSuggestions(available, ['summer cup'], 'summer')).toEqual(['midsummer'])
  })

  it('suggests nothing for an empty or blank query', () => {
    expect(tagSuggestions(available, [], '')).toEqual([])
    expect(tagSuggestions(available, [], '   ')).toEqual([])
  })

  it('stops at the limit', () => {
    const many = Array.from({ length: 20 }, (_, index) => `tag ${index}`)
    expect(tagSuggestions(many, [], 'tag')).toHaveLength(FEATURED_SUGGESTION_LIMIT)
  })
})

describe('pickTag', () => {
  const available = ['easy', 'Easy Peasy', 'Halloween', 'hard']

  it('picks the tag the query names, case-insensitively, with its exact name', () => {
    expect(pickTag(available, [], ' halloween ')).toBe('Halloween')
  })

  it('picks the one suggestion when only one tag matches', () => {
    expect(pickTag(available, [], 'peas')).toBe('Easy Peasy')
  })

  it('picks nothing when several tags match and none is named exactly', () => {
    expect(pickTag(available, [], 'ea')).toBeNull()
  })

  it('prefers the exact name over a longer match', () => {
    expect(pickTag(available, [], 'easy')).toBe('easy')
  })

  it('never picks a tag that is already featured or not available', () => {
    expect(pickTag(available, ['HALLOWEEN'], 'halloween')).toBeNull()
    expect(pickTag(available, [], 'winter')).toBeNull()
  })
})

describe('addableTags', () => {
  it('is every available tag not featured yet', () => {
    expect(addableTags(['easy', 'hard', 'team'], ['Hard'])).toEqual(['easy', 'team'])
  })
})

describe('tagsWithoutActiveMap', () => {
  it('flags the featured tags no active map carries any more', () => {
    expect(tagsWithoutActiveMap(['Easy', 'retired', 'team'], ['easy', 'team'])).toEqual(new Set(['retired']))
  })
})
