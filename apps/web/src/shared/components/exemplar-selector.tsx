import { useMemo, useState } from 'react'

import { Size } from '@panda-lavanda/domain'
import type { IExemplar } from '@panda-lavanda/domain'
import type { PriceInRub, UniqueId } from '@panda-lavanda/shared'

import { cn } from '#/shared/lib/utils'

interface ExemplarSelectorProps {
  exemplars: IExemplar[]
}

/**
 * Selectable list of a product's exemplars (size / price / availability).
 *
 * Pure presentational: owns only local selection state (`useState`). Prefers
 * the first in-stock exemplar on mount; the price and stock badge below the
 * size buttons reflect the selected exemplar. Out-of-stock sizes stay
 * selectable (so the price is still visible) but are visibly de-emphasized.
 */
export function ExemplarSelector({ exemplars }: ExemplarSelectorProps) {
  const firstInStockId = useMemo(
    () => exemplars.find((e) => e.inStock)?.id ?? exemplars[0]?.id,
    [exemplars],
  )
  const [selectedId, setSelectedId] = useState<UniqueId | undefined>(
    firstInStockId,
  )

  const selected = exemplars.find((e) => e.id === selectedId) ?? exemplars[0]

  if (exemplars.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Нет доступных вариантов товара.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="text-sm font-medium">Размер</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {exemplars.map((exemplar) => (
            <SizeButton
              key={exemplar.id}
              exemplar={exemplar}
              selected={exemplar.id === selected?.id}
              onSelect={() => setSelectedId(exemplar.id)}
            />
          ))}
        </div>
      </div>

      {selected ? (
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold">
            {formatPrice(selected.price)}
          </span>
          <span
            className={cn(
              'text-sm',
              selected.inStock
                ? 'text-muted-foreground'
                : 'font-medium text-destructive',
            )}
          >
            {selected.inStock ? 'В наличии' : 'Нет в наличии'}
          </span>
        </div>
      ) : null}
    </div>
  )
}

interface SizeButtonProps {
  exemplar: IExemplar
  selected: boolean
  onSelect: () => void
}

function SizeButton({ exemplar, selected, onSelect }: SizeButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Размер ${sizeLabel(exemplar.size)}`}
      className={cn(
        'min-w-12 rounded-md border px-3 py-2 text-sm font-medium transition',
        selected
          ? 'border-ring bg-primary text-primary-foreground'
          : 'bg-background hover:border-ring/50',
        !exemplar.inStock && !selected && 'opacity-60',
      )}
    >
      {sizeLabel(exemplar.size)}
    </button>
  )
}

/** Human-readable label for a {@link Size} value. */
function sizeLabel(size: Size): string {
  switch (size) {
    case Size.P9:
      return 'P9'
    case Size.P11:
      return 'P11'
    default:
      return size
  }
}

function formatPrice(price: PriceInRub): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
