import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PackingProjection from '../components/PackingProjection.vue';
import type { PackingItem, PackingPlan, Placement, Suitcase } from '../../core/models';

const suitcase: Suitcase = { length: 40, width: 30, height: 20, maxWeight: 10 };
const items: PackingItem[] = [
  { id: 'lower', name: '下层盒', category: '杂物', length: 20, width: 20, height: 8, weight: 1, priority: 1, mustHave: false },
  { id: 'upper', name: '上层盒', category: '杂物', length: 20, width: 20, height: 8, weight: 1, priority: 1, mustHave: false },
];
const placements: Placement[] = [
  { itemId: 'lower', x: 0, y: 0, z: 0, dimensions: { length: 20, width: 20, height: 8 } },
  { itemId: 'upper', x: 0, y: 0, z: 8, dimensions: { length: 20, width: 20, height: 8 } },
];
const plan = { id: 'comfort', name: '舒适版', placements, unplaced: [], totalWeight: 2, usedVolume: 0, capacityRatio: 0.3 } as PackingPlan;

function render(view: 'top' | 'side', slicing: boolean, sliceHeight: number) {
  return mount(PackingProjection, { props: { plan, suitcase, items, view, slicing, sliceHeight } });
}

describe('PackingProjection height slices', () => {
  it('shows nothing above every item and displays the empty hint in the top view', () => {
    const wrapper = render('top', true, 17);
    expect(wrapper.findAll('[data-item-id]').filter((b) => b.attributes('data-in-slice') === 'true')).toHaveLength(0);
    expect(wrapper.find('[data-testid="slice-empty"]').exists()).toBe(true);
  });

  it('splits two touching items at their shared boundary', () => {
    const wrapper = render('top', true, 8);
    const buttons = wrapper.findAll('[data-item-id]');
    expect(buttons.find((b) => b.attributes('data-item-id') === 'lower')!.attributes('data-in-slice')).toBe('false');
    expect(buttons.find((b) => b.attributes('data-item-id') === 'upper')!.attributes('data-in-slice')).toBe('true');
  });

  it('at the ceiling only shows items whose top surface reaches it', () => {
    const wrapper = render('top', true, 20);
    const buttons = wrapper.findAll('[data-item-id]');
    expect(buttons.every((b) => b.attributes('data-in-slice') === 'false')).toBe(true);
    expect(wrapper.find('[data-testid="slice-empty"]').exists()).toBe(true);
  });

  it('shows an item exactly touching the ceiling when sliced at the ceiling', () => {
    const reaching: Placement[] = [
      { itemId: 'lower', x: 0, y: 0, z: 0, dimensions: { length: 20, width: 20, height: 8 } },
      { itemId: 'upper', x: 0, y: 0, z: 12, dimensions: { length: 20, width: 20, height: 8 } },
    ];
    const wrapper = mount(PackingProjection, { props: { plan: { ...plan, placements: reaching }, suitcase, items, view: 'top', slicing: true, sliceHeight: 20 } });
    const buttons = wrapper.findAll('[data-item-id]');
    expect(buttons.find((b) => b.attributes('data-item-id') === 'lower')!.attributes('data-in-slice')).toBe('false');
    expect(buttons.find((b) => b.attributes('data-item-id') === 'upper')!.attributes('data-in-slice')).toBe('true');
    expect(wrapper.find('[data-testid="slice-empty"]').exists()).toBe(false);
  });

  it('marks the slice height on the side view at the correct vertical position', () => {
    const wrapper = render('side', true, 8);
    const line = wrapper.get('[data-testid="side-slice-line"]');
    expect(line.attributes('style')).toContain('top: 40%');
    expect(line.text()).toContain('8 cm');
  });

  it('keeps every item visible when slicing is off', () => {
    const wrapper = render('top', false, 17);
    expect(wrapper.findAll('[data-item-id]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="slice-empty"]').exists()).toBe(false);
  });
});
