<script setup lang="ts">
/** 主布局：左侧固定导航 + 顶栏（面包屑 / 用户菜单）+ 主内容区（PRD 7.3 通用 UI 规范） */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Odometer, Reading, CirclePlus, Notebook, Warning, RefreshLeft, User, UserFilled, ArrowDown, Collection } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { resetDb } from '@/mocks/db'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

interface NavItem {
  route: string
  title: string
  icon: typeof Odometer
  adminOnly?: boolean
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: '工作台',
    items: [
      { route: '/', title: '仪表盘', icon: Odometer },
      { route: '/books', title: '图书管理', icon: Reading },
      { route: '/borrow/new', title: '办理借阅', icon: CirclePlus, adminOnly: true },
      { route: '/return/new', title: '办理归还', icon: RefreshLeft, adminOnly: true },
    ],
  },
  {
    label: '记录',
    items: [
      { route: '/borrows', title: '借阅记录', icon: Notebook },
      { route: '/borrows/overdue', title: '逾期管理', icon: Warning, adminOnly: true },
    ],
  },
  {
    label: '系统',
    items: [
      { route: '/users', title: '用户管理', icon: User, adminOnly: true },
      { route: '/profile', title: '个人中心', icon: UserFilled },
    ],
  },
]

const visibleGroups = computed(() =>
  groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || auth.isAdmin) }))
    .filter((g) => g.items.length > 0),
)

const activeMenu = computed(() => {
  // 编辑页高亮图书管理；详情页高亮用户管理
  if (route.path.startsWith('/books')) return route.path === '/books' ? '/books' : '/books'
  if (route.path.startsWith('/users')) return route.path === '/users' ? '/users' : '/users'
  return route.path
})

const breadcrumbs = computed(() => {
  const crumbs: { text: string; to?: string }[] = [{ text: '首页', to: '/' }]
  if (route.path === '/') return crumbs
  const title = (route.meta.title as string) ?? ''
  if (route.name === 'book-edit') {
    crumbs.push({ text: '图书管理', to: '/books' }, { text: '编辑图书' })
  } else if (route.name === 'user-detail') {
    crumbs.push({ text: '用户管理', to: '/users' }, { text: '用户详情' })
  } else if (title) {
    crumbs.push({ text: title })
  }
  return crumbs
})

const todayText = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

async function onUserCommand(cmd: string) {
  if (cmd === 'profile') {
    router.push('/profile')
  } else if (cmd === 'reset') {
    const confirmed = await ElMessageBox.confirm('将清空全部本地演示数据并恢复初始状态，确定继续？', '重置演示数据', { type: 'warning' }).catch(() => false)
    if (!confirmed) return
    resetDb()
    ElMessage.success('演示数据已重置')
  } else if (cmd === 'logout') {
    auth.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}

const resetTipVisible = ref(false)
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="brand">
        <span class="brand-icon"><el-icon :size="26"><Collection /></el-icon></span>
        <div>
          <div class="brand-name">墨香斋</div>
          <div class="brand-sub">小说租赁管理系统</div>
        </div>
      </div>

      <el-menu class="menu" :default-active="activeMenu" router background-color="#2d4a3e" text-color="#b9c8bf" active-text-color="#e8d9b0">
        <template v-for="g in visibleGroups" :key="g.label">
          <div class="menu-group-title">{{ g.label }}</div>
          <el-menu-item v-for="item in g.items" :key="item.route" :index="item.route">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>

      <div class="aside-footer" @mouseenter="resetTipVisible = true" @mouseleave="resetTipVisible = false" @click="onUserCommand('reset')">
        <el-tooltip content="清空本地演示数据，恢复初始状态" placement="top">
          <span class="reset-btn">⟳ 重置演示数据</span>
        </el-tooltip>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header" height="60px">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item v-for="(c, i) in breadcrumbs" :key="i" :to="c.to">{{ c.text }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="header-right">
          <span class="date">{{ todayText }}</span>
          <el-dropdown trigger="click" @command="onUserCommand">
            <span class="user-chip">
              <el-avatar :size="30" class="avatar">{{ auth.user?.username.charAt(0) }}</el-avatar>
              <span class="uname">{{ auth.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="reset" divided>重置演示数据</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout { height: 100vh; }
.aside { display: flex; flex-direction: column; background: #2d4a3e; }
.brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px 14px; color: #f0ead8; }
.brand-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: #b8975a; color: #1f3529; }
.brand-name { font-size: 18px; font-weight: 700; letter-spacing: 2px; }
.brand-sub { font-size: 11px; opacity: 0.7; margin-top: 2px; }
.menu { border-right: none; flex: 1; }
.menu-group-title { padding: 14px 20px 6px; font-size: 11px; color: #7d9187; letter-spacing: 2px; }
.aside-footer { padding: 14px 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.reset-btn { font-size: 12px; color: #7d9187; cursor: pointer; }
.reset-btn:hover { color: #e8d9b0; }
.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #eee; }
.header-right { display: flex; align-items: center; gap: 16px; }
.date { font-size: 12px; color: #9a9a9a; }
.user-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; outline: none; }
.avatar { background: #2d4a3e; color: #e8d9b0; font-weight: 600; }
.uname { font-size: 14px; }
.main { background: #f6f4ee; padding: 20px; overflow: auto; }
</style>
