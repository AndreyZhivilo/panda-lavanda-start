import { sizeLabel } from '@panda-lavanda/domain'
import type { IExemplar } from '@panda-lavanda/domain'
import type { PriceInRub, UniqueId } from '@panda-lavanda/shared'

import { cn } from '#/shared/lib/utils'

interface ExemplarSelectorProps {
  exemplars: IExemplar[]
  /** The currently selected exemplar id, or `undefined` if none is selected. */
  selectedId?: UniqueId
  /** Called when the shopper picks a different size. */
  onSelectChange: (id: UniqueId) => void
}

/**
 * Selectable list of a product's exemplars (size / price / availability).
 *
 * Pure presentational and **controlled**: the parent owns the selection
 * (`selectedId` + `onSelectChange`) so it can drive a downstream action such
 * as add-to-cart. The price and stock badge below the size buttons reflect the
 * selected exemplar. Out-of-stock sizes stay selectable (so the price is still
 * visible) but are visibly de-emphasized.
 */
export function ExemplarSelector({
  exemplars,
  selectedId,
  onSelectChange,
}: ExemplarSelectorProps) {
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
              onSelect={() => onSelectChange(exemplar.id)}
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

function formatPrice(price: PriceInRub): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
