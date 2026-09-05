<script setup lang="ts">
/** 办理借阅 — 用户/图书选择 + 费用实时计算 + 业务规则校验（PRD 3.4） */
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBooksStore } from '@/stores/books'
import { useUsersStore } from '@/stores/users'
import { useBorrowsStore } from '@/stores/borrows'
import { borrowNo, money } from '@/utils/format'
import { RULES } from '@/types'

const booksStore = useBooksStore()
const usersStore = useUsersStore()
const borrowsStore = useBorrowsStore()

const form = reactive({ userId: undefined as number | undefined, bookId: undefined as number | undefined, days: 15 })

const activeUsers = computed(() => usersStore.list({ status: 'active' }))
const availableBooks = computed(() => booksStore.list({ status: 'available' }))

const selectedUser = computed(() => (form.userId ? usersStore.getById(form.userId) : undefined))
const selectedBook = computed(() => (form.bookId ? booksStore.getById(form.bookId) : undefined))
const userBorrowing = computed(() => (form.userId ? usersStore.activeBorrowCount(form.userId) : 0))
const quotaLeft = computed(() => RULES.MAX_BORROW_COUNT - userBorrowing.value)

const rent = computed(() => (selectedBook.value ? Math.round(selectedBook.value.dailyRent * form.days * 100) / 100 : 0))

const submitting = ref(false)
const lastOrder = ref<{ no: string; dueDate: string; deposit: number } | null>(null)

async function submit() {
  if (!form.userId) return ElMessage.warning('请选择借阅用户')
  if (!form.bookId) return ElMessage.warning('请选择借阅图书')
  submitting.value = true
  const result = borrowsStore.createBorrow(form.userId, form.bookId, form.days)
  submitting.value = false
  if (result.code !== 0) {
    ElMessage.error(result.message)
    return
  }
  const r = result.data!
  lastOrder.value = { no: borrowNo(r.borrowId, r.borrowDate), dueDate: r.dueDate, deposit: r.deposit }
  await ElMessageBox.confirm(
    `借阅单 ${lastOrder.value.no} 已创建：应还日期 ${r.dueDate}，押金 ${money(r.deposit)}。是否打印凭条？`,
    '办理成功',
    { confirmButtonText: '打印凭条', cancelButtonText: '完成', type: 'success' },
  ).catch(() => null)
  ElMessage.success('借阅手续办理完成')
  // 重置表单便于连续办理
  form.bookId = undefined
  lastOrder.value = null
}

function reset() {
  form.userId = undefined
  form.bookId = undefined
  form.days = 15
}
</script>

<template>
  <el-row :gutter="16">
    <el-col :span="14">
      <div class="page-card">
        <h3 class="page-title">办理借阅</h3>
        <el-form label-width="110px">
          <el-form-item label="借阅用户" required>
            <el-select v-model="form.userId" filterable placeholder="选择用户..." style="width: 100%">
              <el-option v-for="u in activeUsers" :key="u.userId" :label="`${u.username}（ID: ${u.userId}，在借 ${usersStore.activeBorrowCount(u.userId)} 本）`" :value="u.userId" :disabled="usersStore.activeBorrowCount(u.userId) >= RULES.MAX_BORROW_COUNT" />
            </el-select>
            <div v-if="selectedUser" class="tip">
              {{ selectedUser.status === 'frozen' ? '⚠️ 该用户已被冻结，不可借阅' : `剩余可借额度：${quotaLeft} 本（上限 ${RULES.MAX_BORROW_COUNT} 本）` }}
            </div>
          </el-form-item>
          <el-form-item label="借阅图书" required>
            <el-select v-model="form.bookId" filterable placeholder="选择图书..." style="width: 100%">
              <el-option v-for="b in availableBooks" :key="b.bookId" :label="`${b.title} · ${b.author}（${money(b.dailyRent)}/天，押金 ${money(b.deposit)}）`" :value="b.bookId" />
            </el-select>
          </el-form-item>
          <el-form-item label="借阅天数" required>
            <el-input-number v-model="form.days" :min="1" :max="RULES.MAX_BORROW_DAYS" />
            <span class="tip" style="margin-left: 12px">最长 {{ RULES.MAX_BORROW_DAYS }} 天</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" class="gold-btn" :loading="submitting" @click="submit">📖 确认借阅</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-col>

    <el-col :span="10">
      <div class="page-card fee-card">
        <h3 class="page-title">费用预估</h3>
        <template v-if="selectedBook">
          <div class="fee-row"><span>日租金</span><strong>{{ money(selectedBook.dailyRent) }}</strong></div>
          <div class="fee-row"><span>借阅天数</span><strong>{{ form.days }} 天</strong></div>
          <div class="fee-row total"><span>预计租金</span><strong>{{ money(rent) }}</strong></div>
          <div class="fee-row"><span>应收押金</span><strong>{{ money(selectedBook.deposit) }}</strong></div>
          <div class="fee-note">💡 归还时如无损坏无逾期，押金全额退还</div>
        </template>
        <el-empty v-else description="请先选择图书" :image-size="60" />
      </div>
    </el-col>
  </el-row>
</template>

<style scoped>
.tip { font-size: 12px; color: #9a9a9a; margin-top: 4px; }
.fee-card { background: #fff; }
.fee-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eee; font-size: 14px; color: #666; }
.fee-row strong { color: #333; }
.fee-row.total strong { color: var(--mo-gold); font-size: 18px; }
.fee-note { font-size: 12px; color: #a0a0a0; margin-top: 12px; }
</style>
