import { packFocus, STAGE_GAP, TILE_ASPECT, type SlotRect, type StageBox, type StageLayout, type StageSlot } from './stageLayout'

export const PHONE_MAX_WIDTH = 640
export const TABLET_MAX_WIDTH = 1024
export const SWIPE_MIN_PX = 48
export const SWIPE_AXIS_RATIO = 2

export interface StageEnvironment {
    touch: boolean
    width: number
    height: number
}

export type StageForm = 'wide' | 'phone-portrait' | 'phone-landscape' | 'tablet-portrait'

export type StageMode = 'grid' | 'single' | 'stacked' | 'side-by-side'

export interface StageView {
    form: StageForm
    mode: StageMode
    pov: string | null
    visible: string[]
    switcher: boolean
}

export type Swipe = 'left' | 'right' | 'up' | 'down'

export function stageForm(environment: StageEnvironment | null): StageForm {
    if (!environment?.touch) return 'wide'
    const { width, height } = environment
    if (height >= width) return width < PHONE_MAX_WIDTH ? 'phone-portrait' : 'tablet-portrait'
    return width < TABLET_MAX_WIDTH ? 'phone-landscape' : 'wide'
}

export function isPhone(form: StageForm): boolean {
    return form === 'phone-portrait' || form === 'phone-landscape'
}

function modeFor(form: StageForm, tiles: number): StageMode {
    switch (form) {
        case 'wide': return 'grid'
        case 'phone-portrait': return 'single'
        case 'phone-landscape': return tiles === 2 ? 'side-by-side' : 'single'
        case 'tablet-portrait': return tiles >= 2 ? 'stacked' : 'single'
    }
}

function inView(mode: StageMode): number {
    return mode === 'single' ? 1 : 2
}

export function stageView(tiles: readonly StageSlot[], environment: StageEnvironment | null, pov: string | null): StageView {
    const form = stageForm(environment)
    const mode = modeFor(form, tiles.length)
    const ids = tiles.map(tile => tile.id)
    if (mode === 'grid') return { form, mode, pov: null, visible: ids, switcher: false }
    const start = Math.max(0, ids.indexOf(pov ?? ''))
    const count = Math.min(inView(mode), ids.length)
    const visible = Array.from({ length: count }, (_, i) => ids[(start + i) % ids.length])
    return { form, mode, pov: ids[start] ?? null, visible, switcher: ids.length > count }
}

export function stepPov(tiles: readonly StageSlot[], view: StageView, step: 1 | -1): string | null {
    const ids = tiles.map(tile => tile.id)
    if (!view.switcher || ids.length === 0) return view.pov
    const at = Math.max(0, ids.indexOf(view.pov ?? ''))
    return ids[(at + step + ids.length) % ids.length]
}

export function povForAudio(view: StageView, audible: readonly string[]): string | null {
    if (view.mode === 'grid' || audible.length === 0 || audible.some(capId => view.visible.includes(capId))) return null
    return audible[audible.length - 1]
}

export function swipeOf(dx: number, dy: number): Swipe | null {
    const along = Math.max(Math.abs(dx), Math.abs(dy))
    const across = Math.min(Math.abs(dx), Math.abs(dy))
    if (along < SWIPE_MIN_PX || along < across * SWIPE_AXIS_RATIO) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
    return dy < 0 ? 'up' : 'down'
}

export function stageAspect(view: StageView): number {
    return view.mode === 'side-by-side' ? 2 * TILE_ASPECT : TILE_ASPECT
}

function packLine<S extends StageSlot>(slots: readonly S[], across: boolean, box: StageBox, gap: number): StageLayout<S> {
    const count = slots.length
    const width = across
        ? Math.min((box.width - (count - 1) * gap) / count, box.height * TILE_ASPECT)
        : Math.min(box.width, ((box.height - (count - 1) * gap) / count) * TILE_ASPECT)
    if (count === 0 || width <= 0) return { columns: 0, rows: 0, tileWidth: 0, tileHeight: 0, placed: [] }
    const height = width / TILE_ASPECT
    const left = (box.width - (across ? count * width + (count - 1) * gap : width)) / 2
    const top = (box.height - (across ? height : count * height + (count - 1) * gap)) / 2
    const rectAt = (i: number): SlotRect => ({
        x: across ? left + i * (width + gap) : left,
        y: across ? top : top + i * (height + gap),
        width,
        height,
    })
    return {
        columns: across ? count : 1,
        rows: across ? 1 : count,
        tileWidth: width,
        tileHeight: height,
        placed: slots.map((slot, i) => ({ slot, rect: rectAt(i) })),
    }
}

export function packView<S extends StageSlot>(slots: readonly S[], view: StageView, focus: string | null, box: StageBox, gap = STAGE_GAP): StageLayout<S> {
    if (view.mode === 'grid') return packFocus(slots, focus, box, gap)
    const byId = new Map(slots.map(slot => [slot.id, slot]))
    const shown = view.visible.flatMap(id => byId.get(id) ?? [])
    return packLine(shown, view.mode === 'side-by-side', box, gap)
}
