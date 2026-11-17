import { Fragment, type ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The drag handle (⋮⋮). Only shown when the list can be reordered. */
export type Handle = ReactNode

function Row({ id, canDrag, children }: { id: string; canDrag: boolean; children: (handle: Handle) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !canDrag })
  const handle = canDrag ? (
    <span {...attributes} {...listeners} role="button" aria-label="Drag to reorder" title="Drag to reorder"
      className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <GripVertical className="h-4 w-4" />
    </span>
  ) : <span className="w-4 shrink-0" />
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 rounded-md bg-background shadow-lg ring-1 ring-border')}>
      {children(handle)}
    </div>
  )
}

/** A vertical list the host can reorder by dragging the handle (mouse, touch or keyboard). */
export function SortableList<T extends { id: string }>({ items, enabled, canDrag = () => true, onReorder, renderItem, between }: {
  items: T[]
  enabled: boolean
  canDrag?: (item: T) => boolean
  onReorder: (ids: string[]) => void
  renderItem: (item: T, index: number, handle: Handle) => ReactNode
  /** Optional content shown after the item at this index (e.g. the "Next session" line). */
  between?: (index: number) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = items.map((x) => x.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <Fragment key={item.id}>
            <Row id={item.id} canDrag={enabled && canDrag(item)}>{(h) => renderItem(item, i, h)}</Row>
            {between?.(i)}
          </Fragment>
        ))}
      </SortableContext>
    </DndContext>
  )
}
