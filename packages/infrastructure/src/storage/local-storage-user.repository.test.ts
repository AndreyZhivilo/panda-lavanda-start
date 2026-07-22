import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedObject } from 'vitest'

import type { ICrashReporterService } from '@panda-lavanda/domain'

import { LocalStorageParseError } from './local-storage.repository'
import { LocalStorageUserRepository } from './local-storage-user.repository'

const KEY = 'test:user'
const USER_ID = 'anonymous'

/** Builds a crash reporter mock typed so `.mock` is available on its method. */
function mockReporter(): MockedObject<ICrashReporterService> {
  return { report: vi.fn() }
}

describe('LocalStorageUserRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  describe('getCurrent', () => {
    it('seeds an empty user when nothing is stored', async () => {
      const repo = new LocalStorageUserRepository(KEY, USER_ID)
      const user = await repo.getCurrent()
      expect(user).toEqual({ id: USER_ID, favoriteProductIds: [] })
      expect(localStorage.getItem(KEY)).toBe(
        JSON.stringify({ id: USER_ID, favoriteProductIds: [] }),
      )
    })

    it('returns the stored user', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ id: USER_ID, favoriteProductIds: ['p1', 'p2'] }),
      )
      const repo = new LocalStorageUserRepository(KEY, USER_ID)
      expect(await repo.getCurrent()).toEqual({
        id: USER_ID,
        favoriteProductIds: ['p1', 'p2'],
      })
    })

    it('logs corrupt JSON to the crash reporter and re-seeds', async () => {
      localStorage.setItem(KEY, '{bad')
      const reporter = mockReporter()
      const repo = new LocalStorageUserRepository(KEY, USER_ID, reporter)

      const user = await repo.getCurrent()
      expect(user).toEqual({ id: USER_ID, favoriteProductIds: [] })
      expect(reporter.report).toHaveBeenCalledOnce()
      expect(reporter.report.mock.calls[0][0]).toBeInstanceOf(
        LocalStorageParseError,
      )
    })

    it('re-seeds when the stored value fails schema validation', async () => {
      // Missing `favoriteProductIds`; should fail validation.
      localStorage.setItem(KEY, JSON.stringify({ id: USER_ID }))
      const reporter = mockReporter()
      const repo = new LocalStorageUserRepository(KEY, USER_ID, reporter)

      const user = await repo.getCurrent()
      expect(user).toEqual({ id: USER_ID, favoriteProductIds: [] })
      expect(reporter.report).toHaveBeenCalledOnce()
    })
  })

  describe('toggleFavoriteProduct', () => {
    it('adds a product when absent', async () => {
      const repo = new LocalStorageUserRepository(KEY, USER_ID)
      const result = await repo.toggleFavoriteProduct('p1')
      expect(result).toEqual({
        id: USER_ID,
        favoriteProductIds: ['p1'],
      })
      expect(localStorage.getItem(KEY)).toContain('"p1"')
    })

    it('removes a product when present', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ id: USER_ID, favoriteProductIds: ['p1', 'p2'] }),
      )
      const repo = new LocalStorageUserRepository(KEY, USER_ID)
      const result = await repo.toggleFavoriteProduct('p1')
      expect(result).toEqual({
        id: USER_ID,
        favoriteProductIds: ['p2'],
      })
    })

    it('toggling the same id twice returns to the original state', async () => {
      const repo = new LocalStorageUserRepository(KEY, USER_ID)
      await repo.toggleFavoriteProduct('p1')
      const afterSecond = await repo.toggleFavoriteProduct('p1')
      expect(afterSecond.favoriteProductIds).toEqual([])
    })
  })
})
