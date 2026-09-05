<script setup lang="ts">
/** 注册页 — 用户名唯一性 + 两次密码一致（PRD 3.1.2） */
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const formRef = ref<FormInstance>()

const form = reactive({ username: '', password: '', confirm: '', phone: '', email: '' })

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名需 2-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => {
        if (v !== form.password) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const result = auth.register({ username: form.username.trim(), password: form.password, phone: form.phone, email: form.email })
  if (result.code !== 0) {
    ElMessage.error(result.message)
    return
  }
  ElMessage.success('注册成功，请登录')
  router.push('/login')
}
</script>

<template>
  <div class="auth-split">
    <div class="auth-brand">
      <div class="ab-name">墨香斋</div>
      <p class="ab-slogan">注册即成为墨香斋会员，<br />可自助查询图书、查看个人借阅记录。</p>
    </div>

    <div class="auth-form-side">
      <el-card class="auth-form-box" shadow="never">
        <h2 class="af-title">创建账号</h2>
        <p class="af-sub">注册后由管理员为您开通借阅权限</p>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="submit">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="2-20 个字符" clearable />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" placeholder="至少 6 位" show-password />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirm">
            <el-input v-model="form.confirm" type="password" placeholder="再次输入密码" show-password />
          </el-form-item>
          <el-form-item label="联系电话（选填）" prop="phone">
            <el-input v-model="form.phone" placeholder="11 位手机号" />
          </el-form-item>
          <el-form-item label="电子邮箱（选填）" prop="email">
            <el-input v-model="form.email" placeholder="example@mail.com" />
          </el-form-item>
          <el-button type="primary" class="gold-btn" size="large" style="width: 100%" @click="submit">注 册</el-button>
          <div class="af-foot">已有账号？<router-link to="/login">返回登录</router-link></div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.auth-split { display: flex; min-height: 100vh; }
.auth-brand { flex: 1.1; background: linear-gradient(135deg, #2d4a3e, #1f3529); color: #e8e4da; display: flex; flex-direction: column; justify-content: center; padding: 0 8%; }
.ab-name { font-size: 44px; font-weight: 800; letter-spacing: 6px; }
.ab-slogan { font-size: 15px; line-height: 2; opacity: 0.9; margin-top: 24px; }
.auth-form-side { flex: 1; display: flex; align-items: center; justify-content: center; padding: 30px 40px; }
.auth-form-box { width: 100%; max-width: 440px; border-radius: 12px; padding: 10px 8px; }
.af-title { margin: 4px 0 6px; font-size: 24px; }
.af-sub { color: #8a8a8a; font-size: 13px; margin: 0 0 16px; }
.af-foot { text-align: center; font-size: 13px; color: #8a8a8a; margin-top: 14px; }
.af-foot a { color: var(--mo-gold); text-decoration: none; font-weight: 600; }

@media (max-width: 900px) {
  .auth-brand { display: none; }
}
</style>
