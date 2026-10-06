import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';

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

  it('slices the top view by height and marks the height in the side view', async () => {
    const { wrapper } = render();
    expect(wrapper.find('[data-testid="slice-marker"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-item-id="jacket"]')).toHaveLength(2);
    await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
    // 外套位于 12–17cm，切片 0cm 时俯视图不再显示，侧视图标出切片高度
    expect(wrapper.find('.projection.top [data-item-id="jacket"]').exists()).toBe(false);
    expect(wrapper.find('.projection.side [data-item-id="jacket"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slice-marker"]').exists()).toBe(true);
    // 全箱统计不受切片影响
    expect(wrapper.text()).toContain('49%');
    await wrapper.get('[aria-label="切片高度"]').setValue('12');
    expect(wrapper.findAll('[data-item-id="jacket"]')).toHaveLength(2);
  });

  it('treats the slice as lower-inclusive and upper-exclusive for stacked items', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
    await wrapper.get('[aria-label="切片高度"]').setValue('12');
    // 运动鞋 0–12cm 与外套 12–17cm 共用 12cm 边界，只有外套穿过切片
    expect(wrapper.find('.projection.top [data-item-id="shoes"]').exists()).toBe(false);
    expect(wrapper.find('.projection.top [data-item-id="jacket"]').exists()).toBe(true);
  });

  it('shows only surfaces touching the suitcase top at the top slice', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
    await wrapper.get('[aria-label="切片高度"]').setValue('23');
    expect(wrapper.get('[data-testid="slice-value"]').text()).toContain('箱顶');
    // 只有旅行读物（8–23cm）的上表面触及箱顶，侧视图仍显示全部
    const topButtons = wrapper.get('.projection.top').findAll('button');
    expect(topButtons).toHaveLength(1);
    expect(topButtons[0].attributes('data-item-id')).toBe('book');
    expect(wrapper.get('.projection.side').findAll('button')).toHaveLength(6);
  });

  it('keeps the selected item name and hints its height when outside the slice', async () => {
    const { wrapper } = render();
    await wrapper.get('.projection.top [data-item-id="jacket"]').trigger('click');
    expect(wrapper.get('[data-testid="slice-detail"]').text()).toContain('轻薄外套');
    expect(wrapper.get('[data-testid="slice-detail"]').text()).toContain('30×24×5');
    expect(wrapper.get('[data-testid="slice-detail"]').text()).toContain('所在高度 12–17 cm');
    await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
    expect(wrapper.find('.projection.top [data-item-id="jacket"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="slice-detail"]').text()).toContain('轻薄外套');
    expect(wrapper.get('[data-testid="slice-detail"]').text()).toContain('不在当前切片 · 位于 12–17 cm');
  });

  it('clamps an out-of-range slice after the suitcase shrinks', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-testid="slice-toggle"]').setValue(true);
    await wrapper.get('[aria-label="切片高度"]').setValue('20');
    expect(wrapper.get('[data-testid="slice-value"]').text()).toContain('20');
    await wrapper.get('[aria-label="行李箱高度"]').setValue('15');
    expect(wrapper.get('[data-testid="slice-value"]').text()).toContain('箱顶 15 cm');
  });
});
