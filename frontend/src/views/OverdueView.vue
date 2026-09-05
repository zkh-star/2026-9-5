<script setup lang="ts">
/** 逾期管理 — 逾期档位筛选 + AI 提醒（模拟 Dify，PRD 3.4.3 / 3.6.2） */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useBorrowsStore } from '@/stores/borrows'
import { borrowNo, overdueFee, money } from '@/utils/format'

const router = useRouter()
const borrows = useBorrowsStore()

const range = ref('')
const remindedIds = ref<Set<number>>(new Set())

const records = computed(() => borrows.overdueList())

const filtered = computed(() => {
  if (!range.value) return records.value
  const days = records.value.map((r) => ({ r, d: borrows.overdueDays(r) }))
  const inRange = (d: number) => (range.value === '1-3' ? d >= 1 && d <= 3 : range.value === '4-7' ? d >= 4 && d <= 7 : d > 7)
  return days.filter((x) => inRange(x.d)).map((x) => x.r)
})

function fineOf(row: (typeof records.value)[number]) {
  return overdueFee(borrows.overdueDays(row), row.dailyRate)
}

function remind(row: (typeof records.value)[number]) {
  // 模拟调用 Dify 生成个性化提醒文案（PRD 3.6.2）
  const text = borrows.aiRemindText(row)
  remindedIds.value.add(row.borrowId)
  ElMessage({ message: text, type: 'success', duration: 5000, showClose: true })
}

const remindDialogVisible = ref(false)
const remindText = ref('')

function remindAll() {
  if (!filtered.value.length) return ElMessage.warning('当前档位没有逾期记录')
  const lines = filtered.value.map((r) => `【${borrows.userLabel(r.userId)} · ${borrows.bookTitle(r.bookId)}】\n${borrows.aiRemindText(r)}`)
  remindText.value = lines.join('\n\n')
  remindDialogVisible.value = true
  ElMessage.success(`已批量生成 ${filtered.value.length} 条 AI 逾期提醒文案`)
}
</script>

<template>
  <div class="page-card">
    <div class="page-toolbar">
      <el-select v-model="range" placeholder="全部逾期" clearable style="width: 140px">
        <el-option label="1-3 天" value="1-3" />
        <el-option label="4-7 天" value="4-7" />
        <el-option label="7 天以上" value="7+" />
      </el-select>
      <div style="flex: 1" />
      <el-button type="primary" class="gold-btn" @click="remindAll">🤖 AI 批量提醒</el-button>
    </div>

    <el-table :data="filtered" stripe>
      <el-table-column label="借阅单号" width="170">
        <template #default="{ row }">{{ borrowNo(row.borrowId, row.borrowDate) }}</template>
      </el-table-column>
      <el-table-column label="借阅人" width="110">
        <template #default="{ row }">{{ borrows.userLabel(row.userId) }}</template>
      </el-table-column>
      <el-table-column label="书名" min-width="130">
        <template #default="{ row }">{{ borrows.bookTitle(row.bookId) }}</template>
      </el-table-column>
      <el-table-column label="应还日期" width="120" prop="dueDate" />
      <el-table-column label="逾期天数" width="110">
        <template #default="{ row }">
          <el-tag type="danger">已逾期 {{ borrows.overdueDays(row) }} 天</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="预估罚款" width="100">
        <template #default="{ row }">{{ money(fineOf(row)) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="remind(row)">
            {{ remindedIds.has(row.borrowId) ? '✓ 已提醒' : '📨 提醒' }}
          </el-button>
          <el-link type="primary" style="margin-left: 10px" @click="router.push({ path: '/return/new', query: { borrowId: String(row.borrowId) } })">去归还</el-link>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="remindDialogVisible" title="AI 批量提醒文案（模拟 Dify 生成）" width="640px">
      <el-input :model-value="remindText" type="textarea" :rows="12" readonly />
      <template #footer>
        <el-button type="primary" class="gold-btn" @click="remindDialogVisible = false">复制并关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
