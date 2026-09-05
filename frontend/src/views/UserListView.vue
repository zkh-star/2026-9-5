<script setup lang="ts">
/** 用户管理 — 列表搜索 + 新增弹窗 + 冻结/删除（PRD 3.2） */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useUsersStore } from '@/stores/users'
import type { User, UserRole } from '@/types'

const router = useRouter()
const usersStore = useUsersStore()

const query = reactive({ keyword: '', role: '', status: '' })
const page = ref(1)
const pageSize = 8

const filtered = computed(() => usersStore.list(query))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(query, () => (page.value = 1))

// ---- 新增用户弹窗 ----
const modalVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<{ username: string; password: string; phone: string; email: string; role: UserRole }>({ username: '', password: '', phone: '', email: '', role: 'user' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }, { min: 2, max: 20, message: '2-20 个字符', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }, { min: 6, message: '至少 6 位', trigger: 'blur' }],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}

async function createUser() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const result = usersStore.create({ ...form })
  if (result.code !== 0) return ElMessage.error(result.message)
  modalVisible.value = false
  ElMessage.success(`用户「${result.data!.username}」创建成功`)
  formRef.value?.resetFields()
}

// ---- 冻结 / 解冻 ----
async function toggleFreeze(user: User) {
  const target = user.status === 'active' ? 'frozen' : 'active'
  const word = target === 'frozen' ? '冻结' : '解冻'
  const ok = await ElMessageBox.confirm(`确定${word}用户「${user.username}」？`, '操作确认', { type: 'warning' }).catch(() => false)
  if (!ok) return
  const result = usersStore.changeStatus(user.userId, target)
  if (result.code === 0) ElMessage.success(`用户「${user.username}」已${word}`)
  else ElMessage.error(result.message)
}

// ---- 删除（软删除，PRD 3.2.4）----
async function removeUser(user: User) {
  const ok = await ElMessageBox.confirm(`确定删除用户「${user.username}」？该操作在演示环境不可撤销`, '删除确认', { type: 'warning' }).catch(() => false)
  if (!ok) return
  const result = usersStore.remove(user.userId)
  if (result.code === 0) ElMessage.success(`用户「${user.username}」已删除`)
  else ElMessage.error(result.message)
}
</script>

<template>
  <div class="page-card">
    <div class="page-toolbar">
      <el-input v-model="query.keyword" placeholder="搜索用户名、电话或邮箱" clearable style="width: 240px" />
      <el-select v-model="query.role" placeholder="全部角色" clearable style="width: 130px">
        <el-option label="普通用户" value="user" />
        <el-option label="管理员" value="admin" />
      </el-select>
      <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px">
        <el-option label="正常" value="active" />
        <el-option label="已冻结" value="frozen" />
      </el-select>
      <div style="flex: 1" />
      <el-button type="primary" class="gold-btn" @click="modalVisible = true">+ 新增用户</el-button>
    </div>

    <el-table :data="paged" stripe>
      <el-table-column prop="userId" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" width="130" />
      <el-table-column prop="phone" label="电话" width="140" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'warning' : 'info'">{{ row.role === 'admin' ? '系统管理员' : '普通用户' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">{{ row.status === 'active' ? '正常' : '已冻结' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="在借 / 未缴费" width="120">
        <template #default="{ row }">
          <span class="mini">{{ usersStore.activeBorrowCount(row.userId) }} 本 / ¥{{ usersStore.unpaidFineAmount(row.userId).toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-link type="primary" @click="router.push(`/users/${row.userId}`)">详情</el-link>
          <el-link type="warning" style="margin-left: 10px" @click="toggleFreeze(row)">{{ row.status === 'active' ? '冻结' : '解冻' }}</el-link>
          <el-link type="danger" style="margin-left: 10px" @click="removeUser(row)">删除</el-link>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="page" class="pager" background layout="prev, pager, next, total" :total="filtered.length" :page-size="pageSize" />

    <!-- 新增用户 -->
    <el-dialog v-model="modalVisible" title="➕ 新增用户" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="2-20 个字符" />
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="电子邮箱" prop="email">
          <el-input v-model="form.email" placeholder="选填" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" class="gold-btn" @click="createUser">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pager { margin-top: 16px; justify-content: flex-end; }
.mini { font-size: 12px; color: #888; }
</style>
