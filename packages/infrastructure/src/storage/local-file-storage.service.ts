import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

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
 * Local-filesystem implementation of {@link IFileStorageService}.
 *
 * Writes files into `storageDir` and returns URLs under `publicPath`. In a
 * Vite/TanStack Start app this pairs with a `public/` directory so the web
 * server serves the stored files automatically. Swapping to S3 later means a
 * new adapter implementing the same port plus one line at the composition root.
 */
export class LocalFileStorageService implements IFileStorageService {
  constructor(private readonly config: LocalFileStorageConfig) {}

  async save(buffer: Uint8Array, ext: string): Promise<ImageUrl> {
    const filename = `${randomUUID()}${normalizeExtension(ext)}`
    await mkdir(this.config.storageDir, { recursive: true })
    await writeFile(join(this.config.storageDir, filename), buffer)
    return `${this.config.publicPath}/${filename}`
  }

  async delete(url: ImageUrl): Promise<void> {
    const filename = basename(url)
    const target = join(this.config.storageDir, filename)

    // Guard against path traversal: the resolved file must live inside the
    // configured storage directory.
    if (!target.startsWith(this.config.storageDir)) return

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
