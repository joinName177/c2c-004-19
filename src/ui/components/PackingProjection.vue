<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem, PackingPlan, Suitcase } from '../../core/models';
import { crossesSlice } from '../../core/slice';
const props = defineProps<{ plan: PackingPlan; suitcase: Suitcase; items: PackingItem[]; view: 'top'|'side'; selectedId?: string; sliceHeight?: number }>();
const emit = defineEmits<{ select: [id: string] }>();
const colors = ['#df6d45', '#507d68', '#d8a84e', '#5978a7', '#9d6a83', '#6d7d86'];
const itemIndex = computed(() => new Map(props.items.map((item, index) => [item.id, index])));
const numbered = computed(() => props.plan.placements.map((placement, index) => ({ placement, index })));
const slicing = computed(() => props.view === 'top' && props.sliceHeight !== undefined);
const visible = computed(() => (slicing.value
  ? numbered.value.filter(({ placement }) => crossesSlice(placement, props.sliceHeight as number, props.suitcase.height))
  : numbered.value));
const markerStyle = computed(() => ({ top: `${(props.sliceHeight ?? 0) / props.suitcase.height * 100}%` }));
function styleFor(itemId: string, x: number, y: number, length: number, width: number) {
  const maxY = props.view === 'top' ? props.suitcase.width : props.suitcase.height;
  return { left: `${x / props.suitcase.length * 100}%`, top: `${y / maxY * 100}%`, width: `${length / props.suitcase.length * 100}%`, height: `${width / maxY * 100}%`, background: colors[(itemIndex.value.get(itemId) ?? 0) % colors.length] };
}
</script>

<template>
  <div class="projection-card">
    <header><span>{{ view === 'top' ? 'TOP VIEW' : 'SIDE VIEW' }}</span><b>{{ view === 'top' ? '俯视图' : '侧视图' }}</b></header>
    <div class="projection" :class="view">
      <button v-for="{ placement, index } in visible" :key="placement.itemId" type="button" :data-item-id="placement.itemId" :class="{ selected: placement.itemId === selectedId }" :style="styleFor(placement.itemId, placement.x, view === 'top' ? placement.y : placement.z, placement.dimensions.length, view === 'top' ? placement.dimensions.width : placement.dimensions.height)" @click="emit('select', placement.itemId)"><span>{{ index + 1 }}</span></button>
      <div v-if="view === 'side' && sliceHeight !== undefined" class="slice-marker" data-testid="slice-marker" :style="markerStyle"><span>{{ sliceHeight }}cm</span></div>
    </div>
    <p v-if="slicing" class="slice-caption" data-testid="slice-caption">{{ visible.length }} / {{ plan.placements.length }} 件穿过此高度</p>
  </div>
</template>
