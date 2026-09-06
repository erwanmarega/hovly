import { describe, it, expect, beforeEach, vi } from 'vitest'

const etats = new Map<string, { value: any }>()
vi.stubGlobal('useState', (cle: string, init: () => any) => {
  if (!etats.has(cle)) etats.set(cle, { value: init() })
  return etats.get(cle)!
})
vi.stubGlobal('computed', (getter: () => any) => ({
  get value() {
    return getter()
  }
}))

const { useDeleteSelection } = await import('../app/composables/useDeleteSelection')

beforeEach(() => etats.clear())

describe('useDeleteSelection', () => {
  it('démarre vide et inactif', () => {
    const s = useDeleteSelection()
    expect(s.active.value).toBe(false)
    expect(s.selection.value).toEqual([])
    expect(s.count.value).toBe(0)
  })

  it('toggle ajoute puis retire un id', () => {
    const s = useDeleteSelection()
    s.toggle('a')
    expect(s.isSelected('a')).toBe(true)
    expect(s.selection.value).toEqual(['a'])
    s.toggle('a')
    expect(s.isSelected('a')).toBe(false)
    expect(s.selection.value).toEqual([])
  })

  it('accumule plusieurs ids', () => {
    const s = useDeleteSelection()
    s.toggle('a')
    s.toggle('b')
    expect(s.count.value).toBe(2)
    expect(s.selection.value).toEqual(['a', 'b'])
  })

  it('clear vide la sélection', () => {
    const s = useDeleteSelection()
    s.toggle('a')
    s.toggle('b')
    s.clear()
    expect(s.selection.value).toEqual([])
    expect(s.count.value).toBe(0)
  })

  it('enable active le mode sans toucher la sélection', () => {
    const s = useDeleteSelection()
    s.toggle('a')
    s.enable()
    expect(s.active.value).toBe(true)
    expect(s.selection.value).toEqual(['a'])
  })

  it('disable désactive le mode et vide la sélection', () => {
    const s = useDeleteSelection()
    s.toggle('a')
    s.enable()
    s.disable()
    expect(s.active.value).toBe(false)
    expect(s.selection.value).toEqual([])
  })

  it('partage l’état entre deux appels (useState)', () => {
    const a = useDeleteSelection()
    const b = useDeleteSelection()
    a.toggle('x')
    expect(b.selection.value).toEqual(['x'])
    expect(b.count.value).toBe(1)
  })
})
