<script setup lang="ts">
/** 个人中心 — 基本信息展示 + 联系方式修改 + 密码修改 + 我的借阅（PRD 3.2.6） */
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { useBorrowsStore } from '@/stores/borrows'
import { borrowNo, money } from '@/utils/format'

const auth = useAuthStore()
const usersStore = useUsersStore()
const borrows = useBorrowsStore()

const user = computed(() => auth.user!)

const profileFormRef = ref<FormInstance>()
const pwdFormRef = ref<FormInstance>()

const profileForm = reactive({ phone: user.value.phone, email: user.value.email })
const pwdForm = reactive({ oldPwd: '', newPwd: '', confirm: '' })

const rules: FormRules = {
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}
const pwdRules: FormRules = {
  oldPwd: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPwd: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => {
        if (v !== pwdForm.newPwd) cb(new Error('两次输入的新密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

const myBorrows = computed(() => borrows.list().filter((r) => r.userId === user.value.userId))

async function saveProfile() {
  const valid = await profileFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const result = usersStore.updateProfile(user.value.userId, {
    phone: profileForm.phone.trim(),
    email: profileForm.email.trim(),
  })
  if (result.code !== 0) {
    ElMessage.error(result.message)
    return
  }
  ElMessage.success('联系方式已更新')
}

async function savePwd() {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const result = usersStore.changePassword(user.value.userId, pwdForm.oldPwd, pwdForm.newPwd)
  if (result.code !== 0) {
    ElMessage.error(result.message)
    return
  }
  ElMessage.success('密码修改成功，下次登录请使用新密码')
  pwdForm.oldPwd = ''
  pwdForm.newPwd = ''
  pwdForm.confirm = ''
  pwdFormRef.value?.clearValidate()
}
</script>

<template>
  <div>
    <div class="page-card head-card">
      <el-avatar :size="56" class="avatar">{{ user.username.charAt(0) }}</el-avatar>
      <div class="head-info">
        <div class="head-name">
          {{ user.username }}
          <el-tag :type="user.role === 'admin' ? 'warning' : 'info'" size="small">{{ user.role === 'admin' ? '系统管理员' : '普通用户' }}</el-tag>
          <el-tag type="success" size="small">正常</el-tag>
        </div>
        <div class="head-meta">📅 注册于 {{ user.createdAt }}</div>
      </div>
      <div class="head-stats">
        <div><strong>{{ borrows.list().filter((r) => r.userId === user.userId && r.actualReturnDate === null).length }}</strong><span>在借</span></div>
        <div><strong>{{ myBorrows.length }}</strong><span>累计借阅</span></div>
        <div><strong>¥{{ usersStore.unpaidFineAmount(user.userId).toFixed(2) }}</strong><span>未缴费</span></div>
      </div>
    </div>

    <el-row :gutter="16" class="mt16">
      <el-col :span="14">
        <div class="page-card">
          <h3 class="card-title">我的借阅记录</h3>
          <el-table :data="myBorrows" stripe size="small">
            <el-table-column label="借阅单号" width="160">
              <template #default="{ row }">{{ borrowNo(row.borrowId, row.borrowDate) }}</template>
            </el-table-column>
            <el-table-column label="书名">
              <template #default="{ row }">{{ borrows.bookTitle(row.bookId) }}</template>
            </el-table-column>
            <el-table-column prop="borrowDate" label="借出" width="105" />
            <el-table-column prop="dueDate" label="应还" width="105" />
            <el-table-column label="状态" width="95">
              <template #default="{ row }">
                <el-tag :type="row.status === 'returned' ? 'success' : row.status === 'overdue' ? 'danger' : 'info'" size="small">
                  {{ row.status === 'returned' ? '已归还' : row.status === 'overdue' ? '逾期中' : '借阅中' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="日租金" width="90">
              <template #default="{ row }">{{ money(row.dailyRate) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="page-card">
          <h3 class="card-title">修改联系方式</h3>
          <el-form ref="profileFormRef" :model="profileForm" :rules="rules" label-width="90px">
            <el-form-item label="用户名">
              <el-input :model-value="user.username" disabled />
            </el-form-item>
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="profileForm.phone" placeholder="11 位手机号" clearable />
            </el-form-item>
            <el-form-item label="电子邮箱" prop="email">
              <el-input v-model="profileForm.email" placeholder="example@mail.com" clearable />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveProfile">保存修改</el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="page-card mt16">
          <h3 class="card-title">修改密码</h3>
          <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="90px">
            <el-form-item label="原密码" prop="oldPwd">
              <el-input v-model="pwdForm.oldPwd" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码" prop="newPwd">
              <el-input v-model="pwdForm.newPwd" type="password" show-password placeholder="至少 6 位" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirm">
              <el-input v-model="pwdForm.confirm" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="savePwd">修改密码</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
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
.card-title { margin: 0 0 14px; font-size: 15px; color: var(--mo-green); }
.mt16 { margin-top: 16px; }
</style>
