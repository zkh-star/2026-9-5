<script setup lang="ts">
/** 用户详情 — 基本信息 + 借阅记录 + 费用记录（PRD 3.2.5） */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUsersStore } from '@/stores/users'
import { useBorrowsStore } from '@/stores/borrows'
import { borrowNo, money } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const usersStore = useUsersStore()
const borrows = useBorrowsStore()

const userId = Number(route.params.id)
const user = computed(() => usersStore.getById(userId))
const activeTab = ref('borrows')

const userBorrows = computed(() =>
  borrows
    .list()
    .filter((r) => r.userId === userId),
)

const userFines = computed(() => borrows.finesOf(userId))
</script>

<template>
  <div v-if="user">
    <div class="page-card head-card">
      <el-avatar :size="56" class="avatar">{{ user.username.charAt(0) }}</el-avatar>
      <div class="head-info">
        <div class="head-name">
          {{ user.username }}
          <el-tag :type="user.role === 'admin' ? 'warning' : 'info'" size="small">{{ user.role === 'admin' ? '系统管理员' : '普通用户' }}</el-tag>
          <el-tag :type="user.status === 'active' ? 'success' : 'danger'" size="small">{{ user.status === 'active' ? '正常' : '已冻结' }}</el-tag>
        </div>
        <div class="head-meta">📞 {{ user.phone || '—' }}　✉️ {{ user.email || '—' }}　📅 注册于 {{ user.createdAt }}</div>
      </div>
      <div class="head-stats">
        <div><strong>{{ usersStore.activeBorrowCount(user.userId) }}</strong><span>在借</span></div>
        <div><strong>{{ userBorrows.length }}</strong><span>累计借阅</span></div>
        <div><strong>¥{{ usersStore.unpaidFineAmount(user.userId).toFixed(2) }}</strong><span>未缴费</span></div>
      </div>
    </div>

    <div class="page-card mt16">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="借阅记录" name="borrows">
          <el-table :data="userBorrows" stripe>
            <el-table-column label="借阅单号" width="170">
              <template #default="{ row }">{{ borrowNo(row.borrowId, row.borrowDate) }}</template>
            </el-table-column>
            <el-table-column label="书名">
              <template #default="{ row }">{{ borrows.bookTitle(row.bookId) }}</template>
            </el-table-column>
            <el-table-column prop="borrowDate" label="借出日期" width="120" />
            <el-table-column prop="dueDate" label="应还日期" width="120" />
            <el-table-column label="归还日期" width="120">
              <template #default="{ row }">{{ row.actualReturnDate ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'returned' ? 'success' : row.status === 'overdue' ? 'danger' : 'info'">
                  {{ row.status === 'returned' ? '已归还' : row.status === 'overdue' ? '逾期中' : '借阅中' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="费用记录" name="fines">
          <el-table :data="userFines" stripe>
            <el-table-column prop="fineId" label="费用ID" width="90" />
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag :type="row.type === 'overdue' ? 'warning' : row.type === 'loss' ? 'danger' : 'info'">
                  {{ row.type === 'overdue' ? '逾期费' : row.type === 'loss' ? '丢失赔偿' : '损坏赔偿' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="110">
              <template #default="{ row }">{{ money(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="缴费状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.status === 'paid' ? 'success' : 'danger'">{{ row.status === 'paid' ? '已缴' : '未缴' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="产生时间" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div style="margin-top: 16px">
      <el-button @click="router.push('/users')">← 返回用户列表</el-button>
    </div>
  </div>
  <el-empty v-else description="用户不存在" />
</template>

<style scoped>
.head-card { display: flex; align-items: center; gap: 18px; }
.avatar { background: var(--mo-green); color: #e8d9b0; font-size: 22px; font-weight: 700; }
.head-name { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.head-meta { font-size: 13px; color: #8a8a8a; margin-top: 8px; }
.head-stats { margin-left: auto; display: flex; gap: 28px; }
.head-stats div { text-align: center; }
.head-stats strong { display: block; font-size: 20px; color: var(--mo-green); }
.head-stats span { font-size: 12px; color: #9a9a9a; }
.mt16 { margin-top: 16px; }
</style>
