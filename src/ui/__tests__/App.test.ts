import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';
import { createSampleSnapshot } from '../../core/sample-data';
import { packItems } from '../../core/packing-engine';
import { passesSlice } from '../../core/geometry';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render() {
  let printCount = 0;
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(new MemoryStorage()),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="行李箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });

  describe('height slices', () => {
    const sample = createSampleSnapshot();
    const plan = packItems(sample.suitcase, sample.items, sample.selectedPlan);
    const topCard = (wrapper: ReturnType<typeof render>['wrapper']) => wrapper.findAll('.projection-card')[0];
    const sideCard = (wrapper: ReturnType<typeof render>['wrapper']) => wrapper.findAll('.projection-card')[1];

    it('shows every item without a slice and keeps statistics untouched', async () => {
      const { wrapper } = render();
      expect(topCard(wrapper).findAll('[data-item-id]')).toHaveLength(plan.placements.length);
      expect(wrapper.get('[data-testid="slice-range"]').attributes('max')).toBe(String(sample.suitcase.height));
    });

    it('filters the top view with a half-open interval and marks the height in the side view', async () => {
      const { wrapper } = render();
      await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
      await wrapper.get('[data-testid="slice-range"]').setValue('5');
      const expected = plan.placements.filter((p) => passesSlice(p.z, p.dimensions.height, 5));
      const topButtons = topCard(wrapper).findAll('[data-item-id]');
      expect(topButtons.filter((b) => b.attributes('data-in-slice') === 'true')).toHaveLength(expected.length);
      expect(topButtons.filter((b) => b.attributes('data-in-slice') === 'false')).toHaveLength(plan.placements.length - expected.length);
      const line = sideCard(wrapper).get('[data-testid="side-slice-line"]');
      expect(line.attributes('style')).toContain(`top: ${5 / sample.suitcase.height * 100}%`);
    });

    it('at the ceiling only shows items whose top surface touches it', async () => {
      const { wrapper } = render();
      await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
      await wrapper.get('[data-testid="slice-top"]').trigger('click');
      const ceiling = sample.suitcase.height;
      const expected = plan.placements.filter((p) => passesSlice(p.z, p.dimensions.height, ceiling, ceiling));
      const topButtons = topCard(wrapper).findAll('[data-item-id]');
      expect(topButtons.filter((b) => b.attributes('data-in-slice') === 'true')).toHaveLength(expected.length);
    });

    it('keeps the selected name and announces its height when it leaves the slice', async () => {
      const { wrapper } = render();
      const upper = plan.placements.find((p) => p.z > 0);
      expect(upper).toBeDefined();
      const item = sample.items.find((candidate) => candidate.id === upper!.itemId)!;
      await topCard(wrapper).get(`[data-item-id="${upper!.itemId}"]`).trigger('click');
      expect(wrapper.get('[data-testid="item-detail"]').text()).toContain(item.name);
      await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
      // 取上层物品上界之上 0.1（上界不包含），该物品即离开切片。
      await wrapper.get('[data-testid="slice-range"]').setValue(String(Math.round((upper!.z + upper!.dimensions.height + 0.1) * 10) / 10));
      expect(passesSlice(upper!.z, upper!.dimensions.height, upper!.z + upper!.dimensions.height + 0.1)).toBe(false);
      const detail = wrapper.get('[data-testid="item-detail"]');
      expect(detail.text()).toContain(item.name);
      expect(detail.text()).toContain('俯视图中不可见');
      expect(detail.text()).toContain(`所在高度 ${upper!.z}–${upper!.z + upper!.dimensions.height} cm`);
    });

    it('clamps the slice after the suitcase is shortened and repacked', async () => {
      const { wrapper } = render();
      await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
      await wrapper.get('[data-testid="slice-range"]').setValue('20');
      await wrapper.get('[aria-label="行李箱高度"]').setValue('15');
      await wrapper.get('button.primary').trigger('click');
      const range = wrapper.get('[data-testid="slice-range"]');
      expect(range.attributes('max')).toBe('15');
      const repacked = packItems({ ...sample.suitcase, height: 15 }, sample.items, sample.selectedPlan);
      const expected = repacked.placements.filter((p) => passesSlice(p.z, p.dimensions.height, 15, 15));
      const topButtons = topCard(wrapper).findAll('[data-item-id]');
      expect(topButtons.filter((b) => b.attributes('data-in-slice') === 'true')).toHaveLength(expected.length);
    });
  });
});
