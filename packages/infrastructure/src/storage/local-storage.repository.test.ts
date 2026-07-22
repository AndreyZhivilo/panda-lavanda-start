import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedObject } from 'vitest'
import { z } from 'zod'

import {
  LocalStorageParseError,
  LocalStorageRepository,
  LocalStorageUnavailableError,
  type LocalStorageRepositoryConfig,
} from './local-storage.repository'

/**
 * Minimal concrete subclass used to exercise the abstract base. Owns its Zod
 * schema (a `{ count: number }` document) and a fixed seed value.
 */
class CounterRepository extends LocalStorageRepository<{ count: number }> {
  protected readonly schema = z.object({ count: z.number().int().nonnegative() })
  protected defaultValue() {
    return { count: 0 }
  }
  constructor(config: LocalStorageRepositoryConfig) {
    super(config)
  }
  // Expose the protected API for testing.
  readForTest() {
    return this.read()
  }
  writeForTest(value: { count: number }) {
    this.write(value)
  }
  readOrSeedForTest(reporter?: { report(error: unknown): void }) {
    return this.readOrSeed(reporter)
  }
}

const KEY = 'test:counter'

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  describe('read', () => {
    it('seeds and persists the default value when the key is absent', () => {
      const repo = new CounterRepository({ storageKey: KEY })
      expect(repo.readForTest()).toEqual({ count: 0 })
      // Persisted so the next read finds it.
      expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ count: 0 }))
    })

    it('returns the stored value when it parses and validates', () => {
      localStorage.setItem(KEY, JSON.stringify({ count: 7 }))
      const repo = new CounterRepository({ storageKey: KEY })
      expect(repo.readForTest()).toEqual({ count: 7 })
    })

    it('throws LocalStorageParseError on malformed JSON', () => {
      localStorage.setItem(KEY, '{not json')
      const repo = new CounterRepository({ storageKey: KEY })
      let caught: unknown
      try {
        repo.readForTest()
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(LocalStorageParseError)
      expect((caught as LocalStorageParseError).storageKey).toBe(KEY)
      expect((caught as LocalStorageParseError).raw).toBe('{not json')
    })

    it('throws LocalStorageParseError when the value fails schema validation', () => {
      localStorage.setItem(KEY, JSON.stringify({ count: 'oops' }))
      const repo = new CounterRepository({ storageKey: KEY })
      expect(() => repo.readForTest()).toThrow(LocalStorageParseError)
    })
  })

  describe('write', () => {
    it('persists the value as JSON', () => {
      const repo = new CounterRepository({ storageKey: KEY })
      repo.writeForTest({ count: 42 })
      expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ count: 42 }))
    })

    it('throws when writing a value that fails schema validation', () => {
      const repo = new CounterRepository({ storageKey: KEY })
      // Bypass the type system to exercise the runtime guard.
      expect(() =>
        repo.writeForTest({ count: -1 as unknown as number }),
      ).toThrow(LocalStorageParseError)
      // Nothing was written.
      expect(localStorage.getItem(KEY)).toBeNull()
    })
  })

  describe('readOrSeed', () => {
    it('returns the stored value when valid', () => {
      localStorage.setItem(KEY, JSON.stringify({ count: 9 }))
      const repo = new CounterRepository({ storageKey: KEY })
      expect(repo.readOrSeedForTest()).toEqual({ count: 9 })
    })

    it('seeds and returns the default when missing', () => {
      const repo = new CounterRepository({ storageKey: KEY })
      expect(repo.readOrSeedForTest()).toEqual({ count: 0 })
    })

    it('logs corrupt data to the crash reporter, re-seeds, and returns the default', () => {
      localStorage.setItem(KEY, '{bad')
      const reporter: MockedObject<{ report(error: unknown): void }> = {
        report: vi.fn(),
      }
      const repo = new CounterRepository({ storageKey: KEY })
      const result = repo.readOrSeedForTest(reporter)

      expect(result).toEqual({ count: 0 })
      expect(reporter.report).toHaveBeenCalledOnce()
      // Logged error is the parse error, with the raw payload preserved.
      const reported = reporter.report.mock.calls[0][0]
      expect(reported).toBeInstanceOf(LocalStorageParseError)
      // Storage was re-seeded so the next read succeeds without logging.
      reporter.report.mockClear()
      expect(repo.readOrSeedForTest(reporter)).toEqual({ count: 0 })
      expect(reporter.report).not.toHaveBeenCalled()
    })
  })

  describe('window guard', () => {
    it('throws LocalStorageUnavailableError when localStorage is undefined', () => {
      const original = globalThis.localStorage
      // `localStorage` is a read-only property on `window`, so redefine via
      // `Object.defineProperty` (vi.stubGlobal can't overwrite it on jsdom).
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new ReferenceError('localStorage is not defined')
        },
      })

      const repo = new CounterRepository({ storageKey: KEY })
      try {
        expect(() => repo.readForTest()).toThrow(LocalStorageUnavailableError)
        expect(() => repo.writeForTest({ count: 1 })).toThrow(
          LocalStorageUnavailableError,
        )
      } finally {
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          value: original,
        })
      }
    })
  })
})
