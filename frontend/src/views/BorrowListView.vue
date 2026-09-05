<script setup lang="ts">
/** 借阅记录 — 关键词/日期/状态筛选（PRD 3.4.4） */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBorrowsStore, type BorrowQuery } from '@/stores/borrows'
import { useAuthStore } from '@/stores/auth'
import { borrowNo, money } from '@/utils/format'
import type { BorrowRecord } from '@/types'

const router = useRouter()
const borrows = useBorrowsStore()
const auth = useAuthStore()

const query = reactive<BorrowQuery>({ keyword: '', status: '', from: '', to: '' })
const page = ref(1)
const pageSize = 10

// 普通用户只能查看自己的借阅记录（PRD 3.4.4）
const scopeFiltered = computed(() => {
  const all = borrows.list(query)
  return auth.isAdmin ? all : all.filter((r) => r.userId === auth.user!.userId)
})

const paged = computed(() => scopeFiltered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

function statusTag(r: BorrowRecord): { text: string; type: 'success' | 'warning' | 'info' | 'danger' } {
  if (r.status === 'returned') return { text: '已归还', type: 'success' }
  if (r.status === 'overdue') return { text: '逾期中', type: 'danger' }
  return { text: '借阅中', type: 'info' }
}

const STATUS_OPTIONS = [
  { label: '借阅中', value: 'borrowed' },
  { label: '已归还', value: 'returned' },
  { label: '逾期中', value: 'overdue' },
]
</script>

<template>
  <div class="page-card">
    <div class="page-toolbar">
      <el-input v-model="query.keyword" placeholder="搜索借阅单号、用户名或书名" clearable style="width: 240px" />
      <el-date-picker v-model="query.from" type="date" placeholder="借出日期起" value-format="YYYY-MM-DD" style="width: 150px" />
      <el-date-picker v-model="query.to" type="date" placeholder="借出日期止" value-format="YYYY-MM-DD" style="width: 150px" />
      <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px">
        <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <div style="flex: 1" />
      <el-tag v-if="!auth.isAdmin" type="info">当前展示「{{ auth.user?.username }}」本人的借阅记录</el-tag>
    </div>

    <el-table :data="paged" stripe>
      <el-table-column label="借阅单号" width="170">
        <template #default="{ row }">{{ borrowNo(row.borrowId, row.borrowDate) }}</template>
      </el-table-column>
      <el-table-column v-if="auth.isAdmin" label="借阅人" width="110">
        <template #default="{ row }">{{ borrows.userLabel(row.userId) }}</template>
      </el-table-column>
      <el-table-column label="书名" min-width="140">
        <template #default="{ row }">{{ borrows.bookTitle(row.bookId) }}</template>
      </el-table-column>
      <el-table-column prop="borrowDate" label="借出日期" width="120" />
      <el-table-column prop="dueDate" label="应还日期" width="120" />
      <el-table-column label="归还日期" width="120">
        <template #default="{ row }">{{ row.actualReturnDate ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="日租金" width="90">
        <template #default="{ row }">{{ money(row.dailyRate) }}</template>
      </el-table-column>
      <el-table-column label="押金" width="90">
        <template #default="{ row }">{{ money(row.deposit) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row).type">{{ statusTag(row).text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="auth.isAdmin" label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-link v-if="!row.actualReturnDate" type="primary" @click="router.push({ path: '/return/new', query: { borrowId: String(row.borrowId) } })">去归还</el-link>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="page" class="pager" background layout="prev, pager, next, total" :total="scopeFiltered.length" :page-size="pageSize" />
  </div>
</template>

<style scoped>
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
