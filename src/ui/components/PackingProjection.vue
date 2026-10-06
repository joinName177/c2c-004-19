<script setup lang="ts">
import { computed } from 'vue';
import { passesSlice } from '../../core/geometry';
import type { PackingItem, PackingPlan, Placement, Suitcase } from '../../core/models';
import { itemColor } from '../item-colors';
import { formatCm } from '../format';

const props = defineProps<{ plan: PackingPlan; suitcase: Suitcase; items: PackingItem[]; view: 'top'|'side'; selectedId?: string; slicing: boolean; sliceHeight: number }>();
const emit = defineEmits<{ select: [id: string] }>();

const itemIndex = computed(() => new Map(props.items.map((item, index) => [item.id, index])));
const effectiveHeight = computed(() => Math.min(Math.max(props.sliceHeight, 0), props.suitcase.height));

interface ViewRow { placement: Placement; order: number; visible: boolean }

const rows = computed<ViewRow[]>(() => props.plan.placements.map((placement, order) => ({
  placement,
  order,
  visible: !props.slicing || passesSlice(placement.z, placement.dimensions.height, effectiveHeight.value, props.suitcase.height),
})));
const visibleRows = computed(() => rows.value.filter((row) => row.visible));

function styleFor(row: ViewRow) {
  const { placement } = row;
  const maxY = props.view === 'top' ? props.suitcase.width : props.suitcase.height;
  const y = props.view === 'top' ? placement.y : placement.z;
  const sizeY = props.view === 'top' ? placement.dimensions.width : placement.dimensions.height;
  return {
    left: `${placement.x / props.suitcase.length * 100}%`,
    top: `${y / maxY * 100}%`,
    width: `${placement.dimensions.length / props.suitcase.length * 100}%`,
    height: `${sizeY / maxY * 100}%`,
    background: itemColor(itemIndex.value.get(placement.itemId) ?? 0),
  };
}
</script>

<template>
  <div class="projection-card">
    <header>
      <span>{{ view === 'top' ? 'TOP VIEW' : 'SIDE VIEW' }}</span>
      <b>{{ view === 'top' ? '俯视图' : '侧视图' }}</b>
      <em v-if="slicing" class="slice-tag" :data-testid="`slice-tag-${view}`">切面 {{ formatCm(effectiveHeight) }}/{{ formatCm(suitcase.height) }} cm</em>
    </header>
    <div class="projection" :class="view">
      <template v-for="row in rows" :key="row.placement.itemId">
        <button
          v-show="view === 'side' || row.visible"
          type="button"
          :data-item-id="row.placement.itemId"
          :data-in-slice="row.visible ? 'true' : 'false'"
          :class="{ selected: row.placement.itemId === selectedId, dimmed: slicing && !row.visible }"
          :style="styleFor(row)"
          @click="emit('select', row.placement.itemId)"
        ><span>{{ row.order + 1 }}</span></button>
      </template>
      <div
        v-if="view === 'side' && slicing"
        class="slice-line"
        data-testid="side-slice-line"
        :style="{ top: `${effectiveHeight / suitcase.height * 100}%` }"
      ><i></i><b>{{ formatCm(effectiveHeight) }} cm</b></div>
      <p v-if="view === 'top' && slicing && visibleRows.length === 0" class="slice-empty" data-testid="slice-empty">
        此高度没有穿过的物品
      </p>
    </div>
  </div>
</template>
