import type { ImageUrl } from '@panda-lavanda/shared'

/**
 * File storage contract.
 *
 * Persists arbitrary file bytes and returns a public URL that the rest of the
 * application (entities, API responses, the database) refers to. The interface
 * lives in the domain layer; concrete implementations (local filesystem, S3,
 * etc.) live in the infrastructure layer and are injected at the composition
 * root. This keeps the domain independent of any storage backend — swapping to
 * S3 later is a single new adapter plus one line at the composition root.
 */
export interface IFileStorageService {
  /**
   * Stores the given bytes under a generated unique name and returns the
   * public URL pointing at the stored file.
   *
   * @param buffer File contents. `Uint8Array` is the framework-agnostic base
   *   type; Node `Buffer` is a subtype and is accepted without conversion.
   * @param ext File extension, with or without a leading dot (e.g. `"webp"`,
   *   `".jpg"`). Used for the resulting filename only.
   */
  save(buffer: Uint8Array, ext: string): Promise<ImageUrl>
  /**
   * Removes the file pointed to by a previously returned URL. Silently
   * succeeds if the file is already gone.
   */
  delete(url: ImageUrl): Promise<void>
}
