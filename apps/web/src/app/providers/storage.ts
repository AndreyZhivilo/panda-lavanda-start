import path from 'node:path'

import type { IFileStorageService } from '@panda-lavanda/domain'
import { LocalFileStorageService } from '@panda-lavanda/infrastructure'

/**
 * Composition root for file storage.
 *
 * This is the only place that knows which concrete storage backend the app
 * uses. Everything else depends on the {@link IFileStorageService} port, so
 * swapping to S3 (or any other backend) later is a change localized here.
 *
 * Files are written into `apps/web/public/uploads`, which Vite serves
 * statically — so the returned URLs (`/uploads/<uuid>.<ext>`) are immediately
 * reachable from the browser.
 */
export const fileStorage: IFileStorageService = new LocalFileStorageService({
  storageDir: path.resolve(process.cwd(), 'public/uploads'),
  publicPath: '/uploads',
})
