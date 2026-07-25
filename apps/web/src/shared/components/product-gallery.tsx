import { useState } from 'react'

import type { ImageUrl } from '@panda-lavanda/shared'

import { cn } from '#/shared/lib/utils'

interface ProductGalleryProps {
  images: ImageUrl[]
  /** Alt text for every image (usually the product name). */
  alt: string
}

/**
 * Product image gallery: a large preview plus a row of thumbnails.
 *
 * Pure presentational — state is local (`useState` for the active image). When
 * `images` is empty, a muted placeholder is shown, matching the empty state of
 * `ProductCard`.
 */
export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const hasImages = images.length > 0
  const active = hasImages ? images[Math.min(activeIndex, images.length - 1)] : null

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
        {active ? (
          <img
            src={active}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      {hasImages && images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <li key={`${image}-${index}`}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Фото ${index + 1}`}
                aria-pressed={index === activeIndex}
                className={cn(
                  'size-16 shrink-0 overflow-hidden rounded-md border bg-muted transition',
                  index === activeIndex
                    ? 'border-ring ring-2 ring-ring/40'
                    : 'hover:border-ring/50',
                )}
              >
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
