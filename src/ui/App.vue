<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LocalPlannerRepository } from '../adapters/local-planner.repository';
import { BrowserPrintAdapter } from '../adapters/browser-print.adapter';
import { validateSuitcase } from '../core/packing-engine';
import { clampSliceHeight, crossesSlice, placementRange } from '../core/slice';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';
import { usePlanner } from './usePlanner';
import SuitcaseForm from './components/SuitcaseForm.vue';
import ItemEditor from './components/ItemEditor.vue';
import ItemList from './components/ItemList.vue';
import PackingProjection from './components/PackingProjection.vue';
import PlanCompare from './components/PlanCompare.vue';
import RiskPanel from './components/RiskPanel.vue';
import PrintSheet from './components/PrintSheet.vue';

const props = defineProps<{ repository?: PlannerRepository; printPort?: PrintPort }>();
const planner = usePlanner({ repository: props.repository ?? new LocalPlannerRepository(window.localStorage), printPort: props.printPort ?? new BrowserPrintAdapter() });
const selectedItem = ref('');
const sliceEnabled = ref(false);
const sliceHeight = ref(0);
const errors = computed(() => validateSuitcase(planner.state.suitcase));

const activeSliceHeight = computed(() => (sliceEnabled.value ? sliceHeight.value : undefined));
const sliceLabel = computed(() => (sliceHeight.value >= planner.state.suitcase.height ? `箱顶 ${sliceHeight.value} cm` : `${sliceHeight.value} cm`));
const selectedDetail = computed(() => {
  const item = planner.state.items.find((entry) => entry.id === selectedItem.value);
  if (!item) return undefined;
  const placement = planner.currentPlan.value.placements.find((entry) => entry.itemId === item.id);
  return { item, placement, range: placement ? placementRange(placement) : undefined };
});
const selectedOutsideSlice = computed(() => {
  const detail = selectedDetail.value;
  if (!detail?.placement || activeSliceHeight.value === undefined) return false;
  return !crossesSlice(detail.placement, activeSliceHeight.value, planner.state.suitcase.height);
});

watch([() => planner.state.suitcase.height, planner.plans], () => {
  sliceHeight.value = clampSliceHeight(sliceHeight.value, planner.state.suitcase.height);
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar"><div class="brand"><span class="brand-mark">PACK<br><b>WISE</b></span><div><small>TRAVEL LAB / 004</small><h1>行李箱空间规划师</h1></div></div><div class="header-actions"><span :class="{ stale: planner.isStale.value }">{{ planner.isStale.value ? '方案待更新' : '规划已同步' }}</span><button type="button" data-testid="print-button" @click="planner.print">打印清单</button><button type="button" class="primary" :disabled="errors.length > 0" @click="planner.regenerate">智能装箱 ↗</button></div></header>
    <main>
      <section class="hero"><div><small>SPACE, WEIGHT & PRIORITY</small><h2>把每一寸空间，<em>留给真正重要的。</em></h2><p>输入清单，比较三种策略，在出发前看清重量、空间与风险。</p></div><div class="hero-stamp"><b>{{ planner.state.items.length }}</b><span>ITEMS<br>TO PACK</span></div></section>
      <PlanCompare :plans="planner.plans.value" :selected="planner.state.selectedPlan" :suitcase="planner.state.suitcase" @select="planner.selectPlan" />
      <div class="workspace">
        <aside class="left-column">
          <SuitcaseForm :suitcase="planner.state.suitcase" :errors="errors" @update="planner.updateSuitcase" />
          <section class="panel inventory"><div class="section-title"><div><span>02 / INVENTORY</span><h2>待装物品</h2></div><b>{{ planner.state.items.length }} 件</b></div><ItemEditor @add="planner.addItem" /><ItemList :items="planner.state.items" @remove="planner.removeItem" @toggle="(id, mustHave) => planner.updateItem(id, { mustHave })" /></section>
        </aside>
        <section class="right-column">
          <div class="canvas-panel">
            <div class="canvas-head"><div><span>03 / PACKING MAP</span><h2>{{ planner.currentPlan.value.name }}摆放方案</h2></div><div class="metrics"><span><b>{{ Math.round(planner.currentPlan.value.capacityRatio * 100) }}%</b>空间利用</span><span><b>{{ planner.currentPlan.value.totalWeight.toFixed(1) }}</b>kg 已装</span><span><b>{{ planner.currentPlan.value.unplaced.length }}</b>件未装</span></div></div>
            <div class="slice-bar">
              <label class="slice-toggle"><input type="checkbox" data-testid="slice-toggle" v-model="sliceEnabled" /> 按高度切片</label>
              <template v-if="sliceEnabled">
                <input aria-label="切片高度" type="range" min="0" :max="planner.state.suitcase.height" step="0.5" v-model.number="sliceHeight" />
                <output data-testid="slice-value">{{ sliceLabel }}</output>
              </template>
              <span v-else class="slice-hint">上下叠放互相遮挡时，可按高度查看水平切片</span>
            </div>
            <div class="projections"><PackingProjection view="top" :plan="planner.currentPlan.value" :suitcase="planner.state.suitcase" :items="planner.state.items" :selected-id="selectedItem" :slice-height="activeSliceHeight" @select="selectedItem = $event" /><PackingProjection view="side" :plan="planner.currentPlan.value" :suitcase="planner.state.suitcase" :items="planner.state.items" :selected-id="selectedItem" :slice-height="activeSliceHeight" @select="selectedItem = $event" /></div>
            <div v-if="selectedDetail" class="slice-detail" data-testid="slice-detail">
              <strong>{{ selectedDetail.item.name }}</strong>
              <span>尺寸 {{ selectedDetail.item.length }}×{{ selectedDetail.item.width }}×{{ selectedDetail.item.height }} cm</span>
              <span v-if="selectedDetail.range && !selectedOutsideSlice">所在高度 {{ selectedDetail.range.bottom }}–{{ selectedDetail.range.top }} cm</span>
              <em v-else-if="selectedDetail.range">不在当前切片 · 位于 {{ selectedDetail.range.bottom }}–{{ selectedDetail.range.top }} cm</em>
              <span v-else>未装入当前方案</span>
            </div>
            <p class="canvas-note">点击色块可在两个视图中同步定位物品。摆放坐标以箱体左下后角为原点。</p>
          </div>
          <RiskPanel :risks="planner.risks.value" />
        </section>
      </div>
      <p class="notice" aria-live="polite">{{ planner.notice.value }}</p>
    </main>
    <PrintSheet :suitcase="planner.state.suitcase" :items="planner.state.items" :plan="planner.currentPlan.value" :risks="planner.risks.value" />
  </div>
</template>
