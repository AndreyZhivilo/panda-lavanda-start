import type { Api } from 'grammy'
import type { ImageUrl } from '@panda-lavanda/shared'

/** Configuration injected at the composition root. */
export interface PhotoUploaderConfig {
  /** Backend API origin, e.g. `http://localhost:4000`. No trailing slash. */
  baseUrl: string
  /** Telegram bot token — needed to build the file-download URL. */
  botToken: string
}

/**
 * Uploads product photos to the backend's static store.
 *
 * Telegram file ids are short-lived (~1 hour) and the Bot API's `getFile` is
 * rate-limited, so a photo the admin sends in chat must be **copied** to our own
 * storage to keep a stable URL in the catalog. This helper bridges the two:
 *
 * 1. Resolves the Telegram file path via the passed `Api` (`api.getFile`).
 * 2. Downloads the bytes from the Bot API file endpoint.
 * 3. `POST`s them as multipart/form-data to the backend's `POST /uploads`,
 *    which persists the bytes and returns a permanent public URL.
 *
 * Returns that URL — ready to drop into a product's `images` array. Throws on
 * any failure (network, non-OK response); callers surface the error to the chat.
 *
 * The bot token lives on the uploader config (already in env) rather than being
 * pulled off the `Api`, so this stays decoupled from grammy's internals.
 */
export class PhotoUploader {
  constructor(private readonly config: PhotoUploaderConfig) {}

  /**
   * Uploads a single Telegram photo (by `file_id`) and returns the stored URL.
   *
   * @param api    grammy `Api` (from `ctx.api`) — used to resolve the file path.
   * @param fileId Telegram `file_id` of a photo (from a `Message.photo` entry).
   */
  async upload(api: Api, fileId: string): Promise<ImageUrl> {
    // 1. Resolve the file path on Telegram's servers.
    const file = await api.getFile(fileId)
    if (!file.file_path) {
      throw new Error(`Telegram returned no file_path for ${fileId}`)
    }

    // 2. Download the bytes from the Bot API file endpoint.
    const fileUrl = `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to download Telegram file ${fileId}: ${response.status}`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())

    // 3. Re-upload to the backend as multipart/form-data. The backend infers
    //    the extension from the MIME type, so forward what Telegram reported
    //    (default to jpeg for photos).
    const mime = response.headers.get('content-type') ?? 'image/jpeg'
    const ext = mimeToExt(mime)
    const filename = `photo.${ext}`

    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mime }), filename)

    const uploadResponse = await fetch(`${this.config.baseUrl}/uploads`, {
      method: 'POST',
      body: form,
    })
    if (!uploadResponse.ok) {
      const body = await uploadResponse.text().catch(() => '')
      throw new Error(
        `Backend upload failed: ${uploadResponse.status}${body ? ` — ${body}` : ''}`,
      )
    }

    const result = (await uploadResponse.json()) as { url: string }
    return result.url as ImageUrl
  }
}

/** Maps an image MIME type to a file extension. Defaults to `jpg`. */
function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/webp':
      return 'webp'
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    default:
      return 'jpg'
  }
}
