<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LocalPlannerRepository } from '../adapters/local-planner.repository';
import { BrowserPrintAdapter } from '../adapters/browser-print.adapter';
import { validateSuitcase } from '../core/packing-engine';
import { passesSlice } from '../core/geometry';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';
import { usePlanner } from './usePlanner';
import { itemColor } from './item-colors';
import { formatCm } from './format';
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
const errors = computed(() => validateSuitcase(planner.state.suitcase));

const slicing = ref(false);
const sliceHeight = ref(0);
const effectiveSlice = computed(() => {
  const max = planner.state.suitcase.height;
  return Math.min(Math.max(sliceHeight.value, 0), max);
});
// 缩小箱高或重新装箱后修正越界切面，避免继续沿用旧位置。
watch(() => planner.state.suitcase.height, (max) => {
  if (sliceHeight.value > max) sliceHeight.value = Math.max(max, 0);
});
watch(() => planner.currentPlan.value, (plan) => {
  if (plan.placements.length === 0) return;
  const ceiling = Math.max(...plan.placements.map((p) => p.z + p.dimensions.height));
  if (sliceHeight.value > ceiling) sliceHeight.value = ceiling;
});

const itemIndex = computed(() => new Map(planner.state.items.map((item, index) => [item.id, index])));
const selectedDetail = computed(() => {
  const id = selectedItem.value;
  if (!id) return undefined;
  const item = planner.state.items.find((candidate) => candidate.id === id);
  const placement = planner.currentPlan.value.placements.find((candidate) => candidate.itemId === id);
  if (!item) return undefined;
  const inSlice = slicing.value && placement
    ? passesSlice(placement.z, placement.dimensions.height, effectiveSlice.value, planner.state.suitcase.height)
    : true;
  return { id, item, placement, inSlice, color: itemColor(itemIndex.value.get(id) ?? 0) };
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
          <div class="canvas-panel"><div class="canvas-head"><div><span>03 / PACKING MAP</span><h2>{{ planner.currentPlan.value.name }}摆放方案</h2></div><div class="metrics"><span><b>{{ Math.round(planner.currentPlan.value.capacityRatio * 100) }}%</b>空间利用</span><span><b>{{ planner.currentPlan.value.totalWeight.toFixed(1) }}</b>kg 已装</span><span><b>{{ planner.currentPlan.value.unplaced.length }}</b>件未装</span></div></div>
          <div class="slice-controls" data-testid="slice-controls">
            <label class="slice-toggle"><input type="checkbox" data-testid="slice-toggle" v-model="slicing" /><span>按高度查看水平切片</span></label>
            <div class="slice-slider" :class="{ disabled: !slicing }">
              <button type="button" data-testid="slice-bottom" :disabled="!slicing" @click="sliceHeight = 0">箱底</button>
              <input type="range" aria-label="切片高度" data-testid="slice-range" min="0" :max="planner.state.suitcase.height" step="0.1" :value="effectiveSlice" :disabled="!slicing" @input="sliceHeight = Number(($event.target as HTMLInputElement).value)" />
              <button type="button" data-testid="slice-top" :disabled="!slicing" @click="sliceHeight = planner.state.suitcase.height">箱顶</button>
              <b>{{ formatCm(effectiveSlice) }}<i>/ {{ formatCm(planner.state.suitcase.height) }} cm</i></b>
            </div>
            <p class="slice-hint">切面下界包含、上界不包含；贴合摆放的物品不会因共用边界同时出现。</p>
          </div>
          <div class="projections"><PackingProjection view="top" :plan="planner.currentPlan.value" :suitcase="planner.state.suitcase" :items="planner.state.items" :selected-id="selectedItem" :slicing="slicing" :slice-height="effectiveSlice" @select="selectedItem = $event" /><PackingProjection view="side" :plan="planner.currentPlan.value" :suitcase="planner.state.suitcase" :items="planner.state.items" :selected-id="selectedItem" :slicing="slicing" :slice-height="effectiveSlice" @select="selectedItem = $event" /></div>
          <div v-if="selectedDetail" class="item-detail" data-testid="item-detail">
            <i :style="{ background: selectedDetail.color }"></i>
            <div class="detail-copy">
              <strong>{{ selectedDetail.item.name }}</strong>
              <span v-if="selectedDetail.placement">完整尺寸 {{ formatCm(selectedDetail.placement.dimensions.length) }} × {{ formatCm(selectedDetail.placement.dimensions.width) }} × {{ formatCm(selectedDetail.placement.dimensions.height) }} cm · 水平位置 ({{ formatCm(selectedDetail.placement.x) }}, {{ formatCm(selectedDetail.placement.y) }})</span>
              <span v-else class="detail-unplaced" data-testid="detail-unplaced">该物品未装入当前方案</span>
            </div>
            <b v-if="selectedDetail.placement" class="detail-level" :data-in-slice="selectedDetail.inSlice">
              所在高度 {{ formatCm(selectedDetail.placement.z) }}–{{ formatCm(selectedDetail.placement.z + selectedDetail.placement.dimensions.height) }} cm
              <template v-if="slicing && !selectedDetail.inSlice">（当前切面 {{ formatCm(effectiveSlice) }} cm，俯视图中不可见）</template>
            </b>
            <button type="button" class="detail-close" aria-label="关闭物品详情" @click="selectedItem = ''">×</button>
          </div>
          <p class="canvas-note">点击色块可在两个视图中同步定位物品。摆放坐标以箱体左下后角为原点。</p></div>
          <RiskPanel :risks="planner.risks.value" />
        </section>
      </div>
      <p class="notice" aria-live="polite">{{ planner.notice.value }}</p>
    </main>
    <PrintSheet :suitcase="planner.state.suitcase" :items="planner.state.items" :plan="planner.currentPlan.value" :risks="planner.risks.value" />
  </div>
</template>
