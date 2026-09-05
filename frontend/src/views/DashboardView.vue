<script setup lang="ts">
/** 仪表盘 — 统计卡片 + 热门借阅 + 即将到期 + AI 阅读推荐（PRD 7.2） */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useBorrowsStore } from '@/stores/borrows'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { borrowNo, diffDays, money, today } from '@/utils/format'

const router = useRouter()
const borrows = useBorrowsStore()
const booksStore = useBooksStore()
const auth = useAuthStore()

const stats = computed(() => borrows.dashboardStats())

const popularBooks = computed(() => {
  // 演示：按在借 + 历史借阅次数排序取 Top4
  const count = new Map<number, number>()
  for (const r of borrows.list()) count.set(r.bookId, (count.get(r.bookId) ?? 0) + 1)
  return [...count.entries()]
    .map(([bookId, n]) => ({ book: booksStore.getById(bookId)!, n }))
    .filter((x) => x.book)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
})

/** AI 阅读推荐 — 演示环境本地模拟 Dify 工作流（PRD 3.6.3） */
const recSets = [
  [
    { tag: '你最近喜欢 悬疑 类', title: '《消失的十三级台阶》', desc: '法律与人性的交织，推理严密，适合一口气读完。' },
    { tag: '补充 武侠 偏好', title: '《天龙八部》', desc: '金庸扛鼎之作，家国与江湖的宏大叙事。' },
  ],
  [
    { tag: '根据 科幻 借阅记录', title: '《球状闪电》', desc: '刘慈欣早期杰作，量子力学的浪漫想象。' },
    { tag: '为你拓展 历史 视野', title: '《明朝那些事儿》', desc: '小人物视角看大明官场，轻松幽默。' },
  ],
  [
    { tag: '延续你对 社会派 的兴趣', title: '《嫌疑人X的献身》', desc: '东野圭吾巅峰之作，逻辑与情感的博弈。' },
    { tag: '轻松一下，试试 言情', title: '《云边有个小卖部》', desc: '张嘉佳温情之作，写给离开我们的人。' },
  ],
]
const recIndex = ref(0)
const recs = computed(() => recSets[recIndex.value % recSets.length])

function nextRecs() {
  recIndex.value++
  ElMessage.success('已为你换一批 AI 推荐')
}

function daysLeft(dueDate: string): number {
  return diffDays(dueDate, today())
}

function goReturn(borrowId: number) {
  router.push({ path: '/return/new', query: { borrowId: String(borrowId) } })
}
</script>

<template>
  <div>
    <!-- 统计卡片 -->
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="never" class="stat">
          <div class="stat-label">馆藏图书</div>
          <div class="stat-value">{{ stats.totalBooks }}</div>
          <div class="stat-sub">在库 {{ stats.availableBooks }} 本 · 借出 {{ stats.borrowedCount }} 本</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat">
          <div class="stat-label">注册用户</div>
          <div class="stat-value">{{ stats.activeUsers }}</div>
          <div class="stat-sub">正常状态账号</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat warn">
          <div class="stat-label">今日借阅 / 归还</div>
          <div class="stat-value">{{ stats.todayBorrowed }} <span class="stat-sep">/</span> {{ stats.todayReturned }}</div>
          <div class="stat-sub">按当日业务单据统计</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat gold">
          <div class="stat-label">逾期未还</div>
          <div class="stat-value">{{ stats.overdue }}</div>
          <div class="stat-sub">累计缴费（已缴）{{ money(stats.monthRevenue) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt16">
      <!-- 热门借阅榜 -->
      <el-col :span="14">
        <el-card shadow="never">
          <template #header><div class="card-head"><span class="card-title">热门借阅榜</span><el-link type="primary" :underline="false" @click="router.push('/books')">查看全部 →</el-link></div></template>
          <el-row :gutter="12">
            <el-col v-for="p in popularBooks" :key="p.book.bookId" :span="6">
              <div class="book-card" :class="'cat-' + p.book.category">
                <div class="bc-title">{{ p.book.title }}</div>
                <div class="bc-author">{{ p.book.author }}</div>
                <div class="bc-meta">累计借阅 {{ p.n }} 次</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>

      <!-- AI 阅读推荐 -->
      <el-col :span="10">
        <el-card shadow="never" class="ai-card">
          <template #header><span class="card-title gold-title">✦ AI 阅读推荐</span></template>
          <div v-for="(r, i) in recs" :key="i" class="rec-item" :class="{ divided: i > 0 }">
            <div class="rec-tag">{{ r.tag }}</div>
            <div class="rec-desc">试试 <strong>{{ r.title }}</strong> —— {{ r.desc }}</div>
          </div>
          <el-button class="gold-btn" style="width: 100%; margin-top: 14px" @click="nextRecs">换一批推荐</el-button>
        </el-card>
      </el-col>
    </el-row>

    <!-- 即将到期 -->
    <el-card shadow="never" class="mt16">
      <template #header><span class="card-title">即将到期（7 天内）</span></template>
      <el-table :data="stats.dueSoon" stripe>
        <el-table-column label="借阅单号" width="180">
          <template #default="{ row }">{{ borrowNo(row.borrowId, row.borrowDate) }}</template>
        </el-table-column>
        <el-table-column label="借阅人" width="120">
          <template #default="{ row }">{{ borrows.userLabel(row.userId) }}</template>
        </el-table-column>
        <el-table-column label="书名">
          <template #default="{ row }">{{ borrows.bookTitle(row.bookId) }}</template>
        </el-table-column>
        <el-table-column label="应还日期" width="130" prop="dueDate" />
        <el-table-column label="剩余天数" width="120">
          <template #default="{ row }">
            <el-tag :type="daysLeft(row.dueDate) <= 2 ? 'warning' : 'info'">{{ daysLeft(row.dueDate) }} 天</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="auth.isAdmin" label="操作" width="100">
          <template #default="{ row }">
            <el-link type="primary" @click="goReturn(row.borrowId)">去归还</el-link>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.mt16 { margin-top: 16px; }
.stat .stat-label { font-size: 13px; color: #8a8a8a; }
.stat .stat-value { font-size: 30px; font-weight: 700; color: var(--mo-green); margin: 6px 0 4px; }
.stat.warn .stat-value { color: #c9862a; }
.stat.gold .stat-value { color: var(--mo-gold); }
.stat-sep { color: #bbb; }
.stat-sub { font-size: 12px; color: #a0a0a0; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-weight: 600; }
.gold-title { color: var(--mo-gold-light); }
.ai-card { background: linear-gradient(135deg, #2d4a3e, #1f3529); border: none; height: 100%; }
.ai-card :deep(.el-card__header) { border-color: rgba(255, 255, 255, 0.1); color: #e8e4da; }
.ai-card :deep(.el-card__body) { color: #e8e4da; }
.rec-item { margin-bottom: 12px; }
.rec-item.divided { border-top: 1px solid rgba(255, 255, 255, 0.12); padding-top: 12px; }
.rec-tag { color: var(--mo-gold-light); font-weight: 600; font-size: 13px; }
.rec-desc { opacity: 0.85; font-size: 13px; margin-top: 4px; line-height: 1.7; }
.book-card { border-radius: 10px; padding: 18px 12px; text-align: center; color: #fff; min-height: 110px; display: flex; flex-direction: column; justify-content: center; background: #5a7268; }
.cat-武侠 { background: linear-gradient(135deg, #8c3f34, #6d2f27); }
.cat-科幻 { background: linear-gradient(135deg, #31547a, #22405f); }
.cat-悬疑 { background: linear-gradient(135deg, #4a3f63, #362e4a); }
.cat-言情 { background: linear-gradient(135deg, #a85a6e, #87455a); }
.cat-历史 { background: linear-gradient(135deg, #7a6430, #5d4c23); }
.bc-title { font-weight: 700; font-size: 15px; }
.bc-author { opacity: 0.8; font-size: 12px; margin-top: 4px; }
.bc-meta { opacity: 0.7; font-size: 11px; margin-top: 8px; }
</style>
