import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import type { IFileStorageService } from '@panda-lavanda/domain'
import type { ImageUrl } from '@panda-lavanda/shared'

/** Configuration injected at the composition root. */
export interface LocalFileStorageConfig {
  /** Absolute filesystem directory where files are written. */
  storageDir: string
  /** Public URL prefix that maps onto `storageDir` (e.g. `/uploads`). */
  publicPath: string
}

/**
 * Local-filesystem implementation of {@link IFileStorageService} for the API
 * backend.
 *
 * This mirrors `packages/infrastructure/src/storage/local-file-storage.service.ts`
 * on purpose. By architecture rule `apps/api` is a thin adapter that imports the
 * domain **as types only** and owns its own small adapters (it does not import
 * `packages/infrastructure` — that's where the client-side HTTP adapters live).
 * The storage contract lives in the domain; this is the backend's concrete
 * implementation of it, just as `apps/api/src/repositories/*` are its concrete
 * repository implementations. Swapping to S3 later means a new adapter here
 * plus one line at the composition root.
 *
 * Writes files into `storageDir` and returns URLs under `publicPath`; the
 * `@fastify/static` plugin serves `storageDir` at that public path so the
 * returned URLs are immediately resolvable.
 */
export class LocalFileStorageService implements IFileStorageService {
  private readonly storageDir: string

  constructor(private readonly config: LocalFileStorageConfig) {
    // Resolve once so the traversal guard below compares canonical paths.
    this.storageDir = resolve(config.storageDir)
  }

  async save(buffer: Uint8Array, ext: string): Promise<ImageUrl> {
    const filename = `${randomUUID()}${normalizeExtension(ext)}`
    await mkdir(this.storageDir, { recursive: true })
    await writeFile(join(this.storageDir, filename), buffer)
    return `${this.config.publicPath}/${filename}`
  }

  async delete(url: ImageUrl): Promise<void> {
    const filename = basename(url)
    const target = join(this.storageDir, filename)

    // Guard against path traversal: the resolved file must live inside the
    // configured storage directory.
    if (!target.startsWith(this.storageDir)) return

    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      // Already gone — nothing to do.
      if (error.code === 'ENOENT') return
      throw error
    })
  }
}

/** Lower-cases and ensures a single leading dot (e.g. `webp`, `.JPG` → `.jpg`). */
function normalizeExtension(ext: string): string {
  const cleaned = ext.trim().toLowerCase()
  return cleaned.startsWith('.') ? cleaned : `.${cleaned}`
}
