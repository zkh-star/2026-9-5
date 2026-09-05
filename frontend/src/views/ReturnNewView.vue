<script setup lang="ts">
/** 办理归还 — 三步流程：查询单据 → 损坏检查 → 费用结算（PRD 3.5） */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBorrowsStore } from '@/stores/borrows'
import { borrowNo, money } from '@/utils/format'
import { DAMAGE_LEVELS, RULES } from '@/types'
import type { DamageLevel } from '@/types'

const route = useRoute()
const router = useRouter()
const borrows = useBorrowsStore()

const step = ref(1)
const keyword = ref('')
const searchedId = ref<number | null>(null)
const damageLevel = ref<DamageLevel>('none')
const description = ref('')
const settlement = ref<ReturnType<typeof borrows.previewReturn>>(null)

// 未归还的借阅单（供下拉选择）
const openRecords = computed(() =>
  borrows.list().filter((r) => !r.actualReturnDate),
)

// 支持 ?borrowId= 直接定位（仪表盘/记录页跳转）
if (route.query.borrowId) {
  const id = Number(route.query.borrowId)
  const rec = borrows.getById(id)
  if (rec && !rec.actualReturnDate) {
    searchedId.value = id
    keyword.value = borrowNo(id, rec.borrowDate)
    step.value = 2
  }
}

function query() {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return ElMessage.warning('请输入借阅单号')
  const found = openRecords.value.find((r) => {
    const no = borrowNo(r.borrowId, r.borrowDate).toLowerCase()
    const uname = borrows.userLabel(r.userId).toLowerCase()
    const btitle = borrows.bookTitle(r.bookId).toLowerCase()
    return no.includes(kw) || uname.includes(kw) || btitle.includes(kw)
  })
  if (!found) return ElMessage.error('未找到未归还的借阅单，请检查单号/用户名/书名')
  searchedId.value = found.borrowId
  step.value = 2
}

const record = computed(() => (searchedId.value ? borrows.getById(searchedId.value) : undefined))
const book = computed(() => (record.value ? borrows.bookTitle(record.value.bookId) : ''))

watch(damageLevel, () => {
  if (searchedId.value) settlement.value = borrows.previewReturn(searchedId.value, damageLevel.value)
})

async function confirm() {
  if (!searchedId.value) return
  const s = borrows.previewReturn(searchedId.value, damageLevel.value)!
  const text =
    `逾期费用 ${money(s.overdueAmount)} + 损坏赔偿 ${money(s.damageAmount)} = 合计 ${money(s.totalAmount)}，` +
    (s.refund >= 0 ? `退还押金 ${money(s.refund)}` : `押金不足，需补收 ${money(-s.refund)}`)
  const ok = await ElMessageBox.confirm(text, '确认归还结算', { confirmButtonText: '确认', cancelButtonText: '再看看', type: 'warning' }).catch(() => false)
  if (!ok) return
  const result = borrows.confirmReturn(searchedId.value, damageLevel.value, description.value.trim())
  if (result.code !== 0) return ElMessage.error(result.message)
  step.value = 4
  ElMessage.success('归还手续办理完成')
}

function restart() {
  step.value = 1
  searchedId.value = null
  keyword.value = ''
  damageLevel.value = 'none'
  description.value = ''
  settlement.value = null
}
</script>

<template>
  <div class="page-card" style="max-width: 860px">
    <h3 class="page-title">办理归还</h3>
    <el-steps :active="step - 1" align-center finish-status="success" style="margin-bottom: 24px">
      <el-step title="查询借阅" />
      <el-step title="损坏检查" />
      <el-step title="费用结算" />
    </el-steps>

    <!-- 第一步：查询 -->
    <template v-if="step === 1">
      <el-input v-model="keyword" size="large" placeholder="输入借阅单号（如 #B-20260831-003）或用户名 / 书名" @keyup.enter="query">
        <template #append>
          <el-button @click="query">查询</el-button>
        </template>
      </el-input>
      <el-alert type="info" :closable="false" style="margin-top: 14px" :title="`当前未归还借阅单 ${openRecords.length} 张，可按单号 / 用户名 / 书名模糊查询`" />
    </template>

    <!-- 第二步 + 第三步 -->
    <template v-else-if="record && step < 4">
      <el-descriptions :column="3" border>
        <el-descriptions-item label="借阅单号">{{ borrowNo(record.borrowId, record.borrowDate) }}</el-descriptions-item>
        <el-descriptions-item label="借阅人">{{ borrows.userLabel(record.userId) }}</el-descriptions-item>
        <el-descriptions-item label="书名">{{ book }}</el-descriptions-item>
        <el-descriptions-item label="借出日期">{{ record.borrowDate }}</el-descriptions-item>
        <el-descriptions-item label="应还日期">{{ record.dueDate }}</el-descriptions-item>
        <el-descriptions-item label="日租金 / 押金">{{ money(record.dailyRate) }} / {{ money(record.deposit) }}</el-descriptions-item>
      </el-descriptions>

      <h4 class="step-sub">第二步：损坏检查</h4>
      <el-radio-group v-model="damageLevel">
        <el-radio-button v-for="l in (Object.keys(DAMAGE_LEVELS) as DamageLevel[])" :key="l" :value="l">
          {{ DAMAGE_LEVELS[l].label }} {{ DAMAGE_LEVELS[l].ratio * 100 }}%
        </el-radio-button>
      </el-radio-group>
      <div class="level-desc">{{ DAMAGE_LEVELS[damageLevel].desc }}</div>
      <el-input v-model="description" type="textarea" :rows="2" placeholder="损坏描述（选填）" style="margin-top: 12px" />

      <h4 class="step-sub">第三步：费用结算</h4>
      <el-descriptions v-if="settlement" :column="2" border>
        <el-descriptions-item label="逾期费用">{{ money(settlement.overdueAmount) }}（逾期 {{ settlement.overdueDays }} 天 × 日租金 × {{ RULES.OVERDUE_MULTIPLIER }}）</el-descriptions-item>
        <el-descriptions-item :label="`损坏赔偿（${DAMAGE_LEVELS[damageLevel].label}）`">{{ money(settlement.damageAmount) }}</el-descriptions-item>
        <el-descriptions-item label="费用合计"><strong style="color: var(--mo-danger)">{{ money(settlement.totalAmount) }}</strong></el-descriptions-item>
        <el-descriptions-item label="押金处理">
          <span v-if="settlement.refund >= 0">退还押金 <strong style="color: var(--mo-green)">{{ money(settlement.refund) }}</strong></span>
          <span v-else style="color: var(--mo-danger)">押金不足，需补收 {{ money(-settlement.refund) }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <div style="margin-top: 20px; text-align: right">
        <el-button @click="restart">重 新 开 始</el-button>
        <el-button type="primary" class="gold-btn" @click="confirm">✅ 确认归还</el-button>
      </div>
    </template>

    <!-- 完成 -->
    <el-result v-else-if="step === 4" icon="success" title="归还成功" sub-title="借阅记录已更新，图书状态已按损坏等级流转">
      <template #extra>
        <el-button type="primary" class="gold-btn" @click="restart">继续办理下一单</el-button>
        <el-button @click="router.push('/borrows')">查看借阅记录</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.step-sub { margin: 22px 0 12px; font-size: 14px; color: #555; }
.level-desc { font-size: 12px; color: #9a9a9a; margin-top: 8px; }
</style>
