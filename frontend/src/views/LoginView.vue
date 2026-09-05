<script setup lang="ts">
/** 登录页 — 分屏设计：左侧品牌区 + 右侧表单（Element Plus 表单校验） */
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { Collection } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const form = reactive({ username: '', password: '' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}
const loading = ref(false)

function fillDemo() {
  form.username = 'admin'
  form.password = 'admin123'
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  const result = auth.login(form.username.trim(), form.password)
  loading.value = false
  if (result.code !== 0) {
    ElMessage.error(result.message)
    return
  }
  ElMessage.success(`欢迎回来，${result.data!.username}`)
  router.push((route.query.redirect as string) || '/')
}
</script>

<template>
  <div class="auth-split">
    <div class="auth-brand">
      <div class="ab-logo"><el-icon :size="54"><Collection /></el-icon></div>
      <div class="ab-name">墨香斋</div>
      <div class="ab-sub">小说租赁管理系统</div>
      <p class="ab-slogan">以书会友，让每一本小说<em>流转生香</em>。<br />借阅、归还、逾期提醒，一站管理。</p>
      <div class="ab-deco">📚 ✦ 📖</div>
    </div>

    <div class="auth-form-side">
      <el-card class="auth-form-box" shadow="never">
        <h2 class="af-title">欢迎回来</h2>
        <p class="af-sub">登录墨香斋，继续你的阅读之旅</p>

        <el-alert type="info" :closable="false" class="af-demo">
          <span>演示账号：admin / admin123（管理员）；王小明 / 123456（普通用户）</span>
          <el-link type="primary" :underline="false" @click="fillDemo">一键填充</el-link>
        </el-alert>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="submit">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" clearable />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" placeholder="请输入密码（至少 6 位）" show-password />
          </el-form-item>
          <el-form-item>
            <el-checkbox label="记住登录" checked disabled />
          </el-form-item>
          <el-button type="primary" class="login-btn gold-btn" size="large" :loading="loading" @click="submit">登 录</el-button>
          <div class="af-foot">还没有账号？<router-link to="/register">立即注册</router-link></div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.auth-split { display: flex; min-height: 100vh; }
.auth-brand { flex: 1.1; background: linear-gradient(135deg, #2d4a3e, #1f3529); color: #e8e4da; display: flex; flex-direction: column; justify-content: center; padding: 0 8%; }
.ab-logo { width: 92px; height: 92px; border-radius: 24px; background: #b8975a; display: grid; place-items: center; color: #1f3529; margin-bottom: 28px; }
.ab-name { font-size: 44px; font-weight: 800; letter-spacing: 6px; }
.ab-sub { font-size: 15px; opacity: 0.75; margin: 10px 0 26px; letter-spacing: 2px; }
.ab-slogan { font-size: 15px; line-height: 2; opacity: 0.9; }
.ab-slogan em { color: #d4b47a; font-style: normal; font-weight: 600; }
.ab-deco { margin-top: 40px; font-size: 30px; letter-spacing: 12px; opacity: 0.8; }
.auth-form-side { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; }
.auth-form-box { width: 100%; max-width: 420px; border-radius: 12px; padding: 10px 8px; }
.af-title { margin: 4px 0 6px; font-size: 24px; }
.af-sub { color: #8a8a8a; font-size: 13px; margin: 0 0 18px; }
.af-demo { margin-bottom: 20px; }
.login-btn { width: 100%; margin-top: 6px; }
.af-foot { text-align: center; font-size: 13px; color: #8a8a8a; margin-top: 16px; }
.af-foot a { color: var(--mo-gold); text-decoration: none; font-weight: 600; }

@media (max-width: 900px) {
  .auth-brand { display: none; }
}
</style>
