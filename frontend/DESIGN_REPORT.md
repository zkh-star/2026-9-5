# 墨香斋小说租赁管理系统 — 前端工程分析设计报告

> 日期：2026-09-05
> 版本：release 1.0.0
> 技术栈：Vue 3 + TypeScript + Vue Router + Pinia + Element Plus（Vite 构建）
> 适配范围：PC 端（不做移动端适配）

---

## 1. 项目概述

本项目是基于《小说租赁管理系统 PRD》与 UI 原型（`f:\demo\ui`）实现的前端单页应用（SPA），覆盖 PRD 中全部核心业务模块：认证、仪表盘、图书管理、借阅管理、归还管理、逾期管理、用户管理与个人中心。

- **运行方式**：纯前端演示工程，数据层由本地 Mock（localStorage 持久化）驱动，无需后端即可完整体验全部业务流程。
- **业务规则**：完整实现 PRD 3.4 / 3.5 / 3.6 的核心规则（借阅上限、逾期费率 1.5 倍、损坏赔偿比例、押金结算、状态流转等）。
- **角色权限**：系统管理员（admin）与普通用户（user）两级，路由守卫 + 菜单过滤 + 数据范围三层控制。

### 1.1 启动方式

```bash
cd frontend
npm install
npm run dev      # 开发环境 http://localhost:5173
npm run build    # 类型检查 + 生产构建
```

### 1.2 演示账号

| 账号 | 密码 | 角色 | 说明 |
|------|------|------|------|
| admin | admin123 | 系统管理员 | 拥有全部功能入口 |
| 王小明 / 李思琪 / 陈小雨 / 赵书虫 | 123456 | 普通用户 | 仅可查看图书与本人借阅记录 |
| 张大山 | 123456 | 普通用户 | 已冻结状态，用于演示登录拦截 |

侧边栏底部提供「重置演示数据」入口（恢复种子数据），用户下拉菜单中亦有相同功能。

---

## 2. 工程结构

```
frontend/
├── index.html
├── package.json
├── vite.config.ts               # @ 别名 → src
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── DESIGN_REPORT.md             # 本报告
└── src/
    ├── main.ts                  # 应用入口：Pinia + Router + Element Plus(zh-cn)
    ├── App.vue                  # 仅 <router-view/>
    ├── style.css                # 全局样式与设计变量（墨绿/米白/金棕）
    ├── router/index.ts          # 路由表 + 全局守卫（登录/角色/标题）
    ├── layout/MainLayout.vue    # 侧边栏 + 顶栏（面包屑/用户菜单/重置数据）
    ├── types/index.ts           # 领域类型 + RULES/DAMAGE_LEVELS 业务常量
    ├── utils/format.ts          # 日期/金额/逾期费/赔偿/单号等纯函数
    ├── mocks/
    │   ├── seed.ts              # 种子数据（日期相对当前生成，演示状态恒定）
    │   └── db.ts                # 响应式 Mock 数据库 + localStorage 持久化
    ├── stores/
    │   ├── auth.ts              # 会话（localStorage uid）、登录/注册/登出
    │   ├── books.ts             # 图书 CRUD / 状态流转
    │   ├── users.ts             # 用户 CRUD / 冻结 / 删除 / 资料与密码
    │   └── borrows.ts           # 借阅/归还/逾期/费用/仪表盘统计/AI 文案
    └── views/                   # 12 个页面组件（见 §4）
```

### 2.1 分层设计

```
View（页面/表单校验/交互）
   ↓ 调用
Store（Pinia：业务规则与状态唯一来源）
   ↓ 读写
mocks/db.ts（响应式数据库，localStorage 持久化）
   ↓ 依赖
types + utils（类型与纯函数，无副作用）
```

要点：
- **业务规则全部收敛在 Store 层**，页面不直接操作 `db`，保证规则一致（如借阅配额、冻结校验在 users/borrows store 内实现，页面只负责展示结果）。
- `db.ts` 使用 Vue `reactive` 包装数据，任何 Store 的修改都会直接驱动视图更新，无需手动同步。
- 数据通过 `localStorage` 持久化（key 前缀 + 版本号），刷新页面后演示状态保留；「重置演示数据」清空并重新播种。

---

## 3. 数据模型（types/index.ts）

| 实体 | 关键字段 | 说明 |
|------|----------|------|
| User | userId, username, password, phone, email, role(`admin/user`), status(`active/frozen/deleted`), createdAt | 软删除（deleted 不可见）；删除前校验无在借、无未缴费 |
| Book | bookId, title, author, isbn, category(6 类), price, dailyRent, deposit, status(`available/borrowed/repairing/lost`), location | 状态机：完好归还→available；损坏→repairing；丢失→lost |
| BorrowRecord | borrowId, userId, bookId, borrowDate, dueDate, actualReturnDate, dailyRate, deposit, status(`borrowed/overdue/returned`) | 归还时写 actualReturnDate 并结算 |
| Fine | fineId, borrowId, userId, amount, type(`overdue/damage/loss`), status(`paid/unpaid`) | 归还结算自动生成 |
| DamageRecord | recordId, borrowId, bookId, damageLevel(`none/minor/moderate/severe/lost`), compensation, description | 归还时按等级生成 |

**业务常量（RULES / DAMAGE_LEVELS）**

```
MAX_BORROW_COUNT = 5      # 每人同时在借上限
MAX_BORROW_DAYS  = 30     # 单次借阅天数上限
OVERDUE_MULTIPLIER = 1.5  # 逾期日租金倍率
损坏赔偿比例：完好 0% / 轻微 10% / 中度 30% / 严重 100% / 丢失 150%
逾期费 = 逾期天数 × 日租金 × 1.5
损坏赔偿 = 图书定价 × 赔偿比例
押金处理 = 押金 − (逾期费 + 赔偿)，负数则补收
```

---

## 4. 页面清单与功能点

| 路由 | 页面 | 角色限制 | 核心功能 |
|------|------|----------|----------|
| /login | 登录 | 公开 | 表单校验、错误提示、演示账号一键填充、记住登录 |
| /register | 注册 | 公开 | 用户名唯一、两次密码一致、手机/邮箱格式校验 |
| / | 仪表盘 | 登录 | 今日借/还、在库/借出、逾期数、累计缴费；热门借阅榜；AI 阅读推荐（模拟 Dify）；7 日内到期列表（一键去归还） |
| /books | 图书列表 | 登录 | 关键词实时搜索（书名/作者/ISBN/分类）、分类/状态筛选、分页；admin 可编辑/转维修/恢复在库/删除 |
| /books/new、/books/:id/edit | 图书录入/编辑 | admin | 必填校验、ISBN 格式、日租金/押金数字校验 |
| /borrow/new | 办理借阅 | admin | 用户下拉（排除冻结）、图书下拉（仅 available）、剩余配额提示、租金/押金实时计算、确认弹窗、成功凭据（单号/应还日期/押金） |
| /borrows | 借阅记录 | 登录（数据范围隔离） | 单号/用户名/书名搜索、日期区间、状态筛选、分页；普通用户仅见本人记录且隐藏「借阅人」列 |
| /borrows/overdue | 逾期管理 | admin | 逾期天数档位筛选（1-3/4-7/7+）、预估罚款（1.5 倍）、单条与批量 AI 提醒（模拟 Dify 文案） |
| /return/new | 办理归还 | admin | 三步流程：查询单据（单号/用户名/书名模糊，支持 ?borrowId= 直达）→ 损坏检查（5 档，实时描述与赔偿计算）→ 费用结算（逾期+赔偿+押金处理）→ 确认弹窗 → 完成态 |
| /users | 用户管理 | admin | 搜索/角色/状态筛选、新增用户弹窗、冻结/解冻（有在借拦截）、删除（有在借或未缴费拦截） |
| /users/:id | 用户详情 | 登录 | 基本信息卡片（在借/累计/未缴费统计）、借阅记录 Tab、费用记录 Tab |
| /profile | 个人中心 | 登录 | 我的借阅、修改联系方式、修改密码（验证原密码） |

---

## 5. 关键设计与实现

### 5.1 路由与权限守卫（router/index.ts）

```ts
// 伪代码摘要
beforeEach:
  1. document.title = `${页面标题} · 墨香斋小说租赁`
  2. meta.public → 放行（已登录访问 login/register 则回仪表盘）
  3. 未登录 → 重定向 /login（携带 redirect 参数，登录后回跳）
  4. meta.roles 不含当前角色 → 重定向仪表盘
```

三层权限控制实测：
- 菜单层：`MainLayout` 按 `adminOnly` 过滤导航项（普通用户不显示办理借阅/归还、逾期管理、用户管理）；
- 路由层：直接输入 URL 访问受保护路由被重定向（实测普通用户访问 `/users` → 回到 `/`）；
- 数据层：`BorrowListView` 对普通用户强制 `userId` 过滤并提示「当前展示本人借阅记录」。

### 5.2 Mock 数据库（mocks/db.ts）

- 使用 `reactive` 包裹 `{ users, books, borrows, fines, damages, seq }`；
- 写操作即时同步到 `localStorage`（`moxiang_db_v1`），启动时恢复；
- `seed.ts` 的日期全部相对「今天」生成（如 `shift(-31)`），保证任何时间打开演示数据都恰好有：2 条逾期、1 条 7 日内到期、各类状态的图书，演示效果恒定。

### 5.3 业务规则实现（stores）

以借阅与归还为例（borrows.ts）：

```
createBorrow(userId, bookId, days):
  用户存在且 active      → 否则 4018
  图书 status=available  → 否则 4002
  在借数 < 5             → 否则 4001
  1 ≤ days ≤ 30          → 否则 4019
  写入借阅单 + 图书转 borrowed

confirmReturn(borrowId, damageLevel, description):
  未归还校验（防重复）   → 否则 4020
  写归还日期、状态 returned
  逾期费 > 0  → 生成 overdue 未缴费用
  损坏 ≠ none → 生成 DamageRecord + damage/loss 未缴费用
  图书状态流转：lost / repairing / available
```

「AI 能力」为本地模拟（`aiRemindText`），按逾期天数切换语气生成个性化催还文案，并在注释中标明接入真实 Dify 服务的替换点，与 PRD 3.6 对齐。

### 5.4 UI 设计还原

配色与版式沿用 UI 原型（`f:\demo\ui/css/style.css`）：

| 变量 | 值 | 用途 |
|------|----|------|
| `--mo-green` | #2d4a3e | 侧边栏、主按钮、强调数字 |
| `--mo-green-dark` | #1f3529 | 侧边栏底部渐变 |
| `--mo-cream` | #f6f4ee | 主内容区背景（书页米白） |
| `--mo-gold` | #b8975a | 登录/注册主按钮（烫金）、品牌点缀 |

Element Plus 组件通过 zh-cn 语言包本地化；表单统一 `label-position/top` + 尺寸规范；表格均带斑马纹与分页。

---

## 6. 测试报告（浏览器实测）

测试环境：`npm run dev`（Vite 8.2.2）→ Chrome 内核浏览器逐步操作，控制台全程无报错。

### 6.1 功能用例与结果

| # | 用例 | 结果 |
|---|------|------|
| 1 | 未登录访问 `/` → 重定向 `/login` | ✅ |
| 2 | 错误密码登录 → 提示「用户名或密码不正确」 | ✅ |
| 3 | admin 登录 → 进入仪表盘，统计卡片/热榜/推荐渲染 | ✅ |
| 4 | 图书列表搜索「三体」→ 实时过滤出 1 条 | ✅ |
| 5 | 办理借阅：用户下拉排除冻结用户（张大山） | ✅ |
| 6 | 选用户后显示剩余配额「4 本（上限 5 本）」 | ✅ |
| 7 | 选《三体》15 天 → 租金 ¥6.00 + 押金 ¥20.00 实时计算 | ✅ |
| 8 | 确认借阅 → 单号 #B-20260905-009、应还 2026-09-20；用户在借数 1→2，图书从可借下拉消失 | ✅ |
| 9 | 借阅记录新增单据置顶，共 9 条 | ✅ |
| 10 | 逾期管理：罚款 = 天数×日租金×1.5（¥0.75 / ¥10.50） | ✅ |
| 11 | AI 提醒 → 按逾期天数生成个性化文案，按钮变「已提醒」 | ✅ |
| 12 | 归还 `?borrowId=4` 直达第二步，单据信息完整 | ✅ |
| 13 | 选「中度 30%」→ 逾期 ¥10.50 + 赔偿 ¥32.40（108×30%）= ¥42.90，退还押金 ¥7.10 | ✅ |
| 14 | 确认归还 → 完成态；用户详情未缴费变 ¥42.90（逾期 10.50 + 赔偿 32.40） | ✅ |
| 15 | 用户详情：借阅记录显示「平凡的世界」已归还；费用记录 3 条（2 未缴 + 1 已缴） | ✅ |
| 16 | 冻结有在借图书的用户 → 拦截「还有 1 本图书未归还，冻结前需先归还」 | ✅ |
| 17 | 新增用户「测试读者」→ 列表即时出现（共 7 条） | ✅ |
| 18 | 个人中心修改电话 → 「联系方式已更新」 | ✅ |
| 19 | 退出登录 → 回登录页；王小明登录后菜单仅剩 4 项 | ✅ |
| 20 | 普通用户直访 `/users` → 重定向仪表盘 | ✅ |
| 21 | 普通用户借阅记录 → 仅 3 条本人记录 + 范围提示 | ✅ |
| 22 | 浏览器控制台 JS 错误 | ✅ 无 |

### 6.2 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
|------|------|------|
| 归还结算表显示 `{{ DAMAGE_LEVELS[...] }}` 原始文本 | 在普通 attribute 中使用 mustache 插值（Vue 3 不支持） | 改为 `:label="`损坏赔偿（${...}）`"` 动态绑定 |
| 用户详情费用记录 Tab 无数据 | store 未导出 `finesOf`，页面 computed 为占位代码 | borrows store 导出 `finesOf(userId)` 并在页面正确调用 |
| 仪表盘「借出 N 本」统计口径错误 | 用 `总数 − 在库` 计算，维修中图书被误计入借出 | 统计新增 `borrowedCount`（status=borrowed 数） |
| 构建失败：`Books` 图标不存在 / 多处未使用变量 / `role: string` 不兼容 / `tsconfig` baseUrl 弃用 | Element Plus 无 `Books` 导出；TS 严格模式 noUnusedLocals；TS 新版弃用 baseUrl | 图标改用 `Reading`；清理未用导入；表单类型显式标注 `UserRole`；移除 `baseUrl` 改用相对路径 `paths` |

### 6.3 构建产物

```
npm run build → vue-tsc -b && vite build ✅（类型检查通过）
dist/：33 个资源文件，入口 JS 868KB（gzip 277KB，Element Plus 全量引入所致）
```

> 优化建议（非阻塞）：生产环境可改用 `unplugin-vue-components` 按需引入 Element Plus，并开启代码分割，可将首包体积降低约 60%。

---

## 7. 质量评估与结论

### 7.1 覆盖度对照（PRD → 实现）

| PRD 模块 | 状态 |
|----------|------|
| 3.1 认证（登录/注册/登出/登录守卫） | ✅ 完整 |
| 3.2 用户管理（CRUD/冻结/删除/详情/个人中心） | ✅ 完整，含前置校验规则 |
| 3.3 图书管理（录入/编辑/状态流转/查询） | ✅ 完整 |
| 3.4 借阅管理（办理/校验/记录/逾期提醒） | ✅ 完整，含配额与期限上限 |
| 3.5 归还管理（三步流程/费用结算/状态流转） | ✅ 完整 |
| 3.6 智能化辅助（Dify 提醒文案/阅读推荐） | ✅ 演示级模拟，预留接入点 |
| 7.3 通用 UI 规范（布局/配色/交互） | ✅ 与 UI 原型一致 |

### 7.2 结论

前端工程已按 PRD 完成 release 1.0.0 全部功能开发，经 22 项浏览器实测用例验证，核心业务流（借阅 → 逾期 → 归还 → 费用结算 → 状态流转）闭环正确，权限三层隔离有效，类型检查与生产构建通过，达到交付标准。
