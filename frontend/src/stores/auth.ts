/** 认证 store — 登录 / 注册 / 登出（PRD 3.1） */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/mocks/db'
import type { ApiResult, User } from '@/types'

const SESSION_KEY = 'moxiang_session_uid'

const sessionUid = ref<number | null>(readSession())

function readSession(): number | null {
  const raw = localStorage.getItem(SESSION_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : null
}

export const useAuthStore = defineStore('auth', () => {
  const user = computed<User | null>(() => db.users.find((u) => u.userId === sessionUid.value) ?? null)
  const isLoggedIn = computed(() => user.value !== null && user.value.status !== 'deleted')
  const isAdmin = computed(() => isLoggedIn.value && user.value!.role === 'admin')
  const displayName = computed(() => (user.value ? `${user.value.username}（${user.value.role === 'admin' ? '系统管理员' : '普通用户'}）` : ''))

  function login(username: string, password: string): ApiResult<User> {
    const found = db.users.find((u) => u.username === username)
    if (!found || found.password !== password) {
      return { code: 4003, message: '用户名或密码不正确', data: null }
    }
    if (found.status === 'frozen') {
      return { code: 4004, message: '账号已被冻结，请联系管理员', data: null }
    }
    if (found.status === 'deleted') {
      return { code: 4005, message: '账号不存在', data: null }
    }
    sessionUid.value = found.userId
    localStorage.setItem(SESSION_KEY, String(found.userId))
    return { code: 0, message: 'ok', data: found }
  }

  function register(payload: { username: string; password: string; phone?: string; email?: string }): ApiResult<User> {
    if (db.users.some((u) => u.username === payload.username)) {
      return { code: 4006, message: '用户名已存在', data: null }
    }
    const newUser: User = {
      userId: db.seq.user++,
      username: payload.username,
      password: payload.password,
      phone: payload.phone ?? '',
      email: payload.email ?? '',
      role: 'user',
      status: 'active',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    db.users.push(newUser)
    return { code: 0, message: 'ok', data: newUser }
  }

  function logout(): void {
    sessionUid.value = null
    localStorage.removeItem(SESSION_KEY)
  }

  return { user, isLoggedIn, isAdmin, displayName, login, register, logout }
})
