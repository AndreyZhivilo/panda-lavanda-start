import type { FastifyInstance, FastifyPluginAsync } from 'fastify'

import { ValidationError } from '../errors'

/**
 * Maximum accepted upload size (per file), in bytes.
 *
 * Caps the multipart field so an oversized (or malicious) body is rejected
 * before it lands on disk. 10 MB comfortably covers high-res product photos.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * MIME types accepted for product photos, mapped to their file extension.
 *
 * The extension drives the stored filename (and thus the served `Content-Type`
 * via `@fastify/static`'s mime lookup). WebP/JPEG/PNG are the formats the
 * storefront and bots produce; anything else is rejected with a 422.
 */
const ACCEPTED_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/**
 * Mounts the upload endpoint.
 *
 * `POST /uploads` accepts a single image in the `file` multipart field,
 * persists it via `fastify.fileStorage`, and returns `{ url }` — the public URL
 * under which the file is served by `@fastify/static`. Product create/update
 * payloads take an `images` array of such URL strings, so this is the bridge
 * between "admin sent a photo" and "the catalog references a stable URL".
 *
 * Today the endpoint is anonymous (no auth), like the rest of the API. When
 * auth is added, this should be among the admin-gated routes.
 */
export const uploadsRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.post('/uploads', async (request, reply) => {
    const file = await request.file()

    if (!file) {
      throw new ValidationError('Missing "file" field in multipart body')
    }

    const ext = ACCEPTED_MIME[file.mimetype]
    if (!ext) {
      throw new ValidationError(
        `Unsupported file type "${file.mimetype}". Accepted: ${Object.keys(ACCEPTED_MIME).join(', ')}.`,
      )
    }

    // Consume the stream while enforcing the size cap. `file.file` is a
    // Node read stream; accumulating into a Buffer lets us both bound the size
    // and hand `Uint8Array`-compatible bytes to the storage service.
    const buffer = await readBounded(file.file, MAX_UPLOAD_BYTES)

    const url = await fastify.fileStorage.save(buffer, ext)
    return reply.code(201).send({ url })
  })
}

/**
 * Reads the entire stream into a `Buffer`, rejecting if it exceeds `maxBytes`.
 *
 * Enforcing the cap during accumulation (rather than relying solely on the
 * multipart limits) keeps the guard close to the consumer and gives a clear
 * validation error. Throws a `ValidationError` on overflow so the global error
 * handler maps it to 422.
 */
async function readBounded(
  stream: NodeJS.ReadableStream,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0

  for await (const chunk of stream) {
    const buf = chunk as Buffer
    total += buf.byteLength
    if (total > maxBytes) {
      throw new ValidationError(
        `File too large: exceeds ${maxBytes} bytes`,
      )
    }
    chunks.push(buf)
  }

  return Buffer.concat(chunks)
}
