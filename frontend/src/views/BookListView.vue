<script setup lang="ts">
/** 图书列表 — 搜索 + 分类/状态筛选 + 分页（PRD 3.3.1） */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { money } from '@/utils/format'
import type { Book } from '@/types'

const router = useRouter()
const booksStore = useBooksStore()
const auth = useAuthStore()

const query = reactive({ keyword: '', category: '', status: '' })
const page = ref(1)
const pageSize = 8

const categories = computed(() => booksStore.categories)

const filtered = computed(() => booksStore.list(query))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(query, () => (page.value = 1))

const STATUS_MAP: Record<string, { text: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
  available: { text: '在库', type: 'success' },
  borrowed: { text: '借出中', type: 'warning' },
  repairing: { text: '维修中', type: 'info' },
  lost: { text: '已丢失', type: 'danger' },
}

async function toggleRepair(book: Book) {
  const target = book.status === 'available' ? 'repairing' : 'available'
  const result = booksStore.changeStatus(book.bookId, target)
  if (result.code === 0) ElMessage.success(`《${book.title}》已${target === 'repairing' ? '转入维修' : '恢复在库'}`)
  else ElMessage.error(result.message)
}

async function removeBook(book: Book) {
  const { value } = await ElMessageBox.prompt('请输入损坏原因（确认后图书将被标记为丢失并从列表隐藏）', `删除图书《${book.title}》`, {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    inputPlaceholder: '如：书页严重破损无法修复',
    inputValidator: (v: string) => (v && v.trim().length >= 2 ? true : '请输入至少 2 个字符的原因'),
  }).catch(() => ({ value: null }))
  if (!value) return
  const result = booksStore.remove(book.bookId, value.trim())
  if (result.code === 0) ElMessage.success('图书已删除')
  else ElMessage.error(result.message)
}
</script>

<template>
  <div class="page-card">
    <div class="page-toolbar">
      <el-input v-model="query.keyword" placeholder="搜索书名、作者、ISBN 或分类" clearable style="width: 260px" :prefix-icon="undefined" />
      <el-select v-model="query.category" placeholder="全部分类" clearable style="width: 130px">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px">
        <el-option label="在库" value="available" />
        <el-option label="借出中" value="borrowed" />
        <el-option label="维修中" value="repairing" />
      </el-select>
      <div style="flex: 1" />
      <el-button v-if="auth.isAdmin" type="primary" class="gold-btn" @click="router.push('/books/new')">+ 录入新图书</el-button>
    </div>

    <el-table :data="paged" stripe>
      <el-table-column prop="bookId" label="ID" width="60" />
      <el-table-column label="书名 / 作者" min-width="200">
        <template #default="{ row }">
          <div class="bt">{{ row.title }}</div>
          <div class="ba">{{ row.author }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="isbn" label="ISBN" width="150" />
      <el-table-column prop="category" label="分类" width="80" />
      <el-table-column label="定价 / 日租金" width="150">
        <template #default="{ row }">
          <div>{{ money(row.price) }}</div>
          <div class="ba">{{ money(row.dailyRent) }}/天</div>
        </template>
      </el-table-column>
      <el-table-column label="押金" width="90">
        <template #default="{ row }">{{ money(row.deposit) }}</template>
      </el-table-column>
      <el-table-column prop="location" label="书架位置" width="100" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="STATUS_MAP[row.status].type">{{ STATUS_MAP[row.status].text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="auth.isAdmin" label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-link type="primary" @click="router.push(`/books/${row.bookId}/edit`)">编辑</el-link>
          <el-link v-if="row.status === 'available' || row.status === 'repairing'" type="warning" style="margin-left: 10px" @click="toggleRepair(row)">
            {{ row.status === 'available' ? '转维修' : '恢复在库' }}
          </el-link>
          <el-link v-if="row.status === 'available' || row.status === 'repairing'" type="danger" style="margin-left: 10px" @click="removeBook(row)">删除</el-link>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      class="pager"
      background
      layout="prev, pager, next, total"
      :total="filtered.length"
      :page-size="pageSize"
    />
  </div>
</template>

<style scoped>
.bt { font-weight: 600; }
.ba { font-size: 12px; color: #9a9a9a; margin-top: 2px; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
