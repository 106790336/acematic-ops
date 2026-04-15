# ACEMATIC 运营管理系统 - 产品需求文档

## 产品概述

ACEMATIC 运营管理系统是一个企业级战略执行管理平台，帮助CEO和高管团队实现从公司战略制定到部门计划执行、再到成果考核的全流程数字化管理。系统提供实时数据看板、计划进度跟踪、绩效考核等功能，助力企业战略落地。

**核心特色**：
- 任务来源追溯 · 战略对齐管理 · 执行全流程数字化
- **审核工作流**：Draft → Pending → Active 全流程管控
- **权限精细化**：角色分层、操作权限、数据权限三维控制

---

## 核心功能

### 1. 用户认证与权限管理

#### 1.1 登录认证
- 账号密码登录
- 记住密码功能
- Token 管理（JWT）
- 自动登出机制

#### 1.2 角色权限体系

| 角色 | 层级 | 权限范围 |
|------|------|----------|
| CEO | L1 | 全局管理、战略审批、人事任免 |
| 高管（Executive） | L2 | 分管部门管理、计划审批 |
| 经理（Manager） | L3 | 本部门管理、任务分配审核 |
| 员工（Employee） | L4 | 个人任务管理、日报周报 |

#### 1.3 权限矩阵

| 功能 | CEO | 高管 | 经理 | 员工 |
|------|-----|------|------|------|
| 战略管理 | 全部 | 查看 | 查看 | 查看（本部门） |
| 计划管理 | 全部 | 审批部门计划 | 审批个人计划 | 创建/编辑草稿 |
| 任务管理 | 全部 | 分配任务 | 分配/审核任务 | 查看/创建/编辑 |
| 任务删除 | ✅ | ✅ | ✅ | ❌ |
| 人员管理 | 全部 | 查看 | 查看（本部门） | 仅个人 |
| 考核管理 | 全部 | 部门考核 | 团队考核 | 仅个人 |

---

### 2. 审核工作流（2026年4月更新）

#### 2.1 工作流概述

系统采用 **Draft → Pending → Active** 三阶段工作流，确保所有重要内容经过审核：

```
┌─────────┐   提交审核   ┌─────────┐   审核通过   ┌─────────┐
│  Draft  │ ──────────→ │ Pending │ ──────────→ │  Active │
│  草稿   │             │ 待审核  │             │  生效   │
└─────────┘             └─────────┘             └─────────┘
     ↑                       │                       │
     │      撤回/驳回        │                       │
     └───────────────────────┘                       │
     │                                               │
     │              申请变更                         │
     └───────────────────────────────────────────────┘
```

#### 2.2 状态说明

| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| Draft（草稿） | 创建者编辑中 | 编辑、删除、提交审核 |
| Pending（待审核） | 等待上级审批 | 撤回（创建者）、审核（审批者） |
| Active（生效） | 已审批通过执行中 | 查看详情、申请变更 |

#### 2.3 各模块工作流规则

##### 战略管理
- **创建者**：CEO、高管
- **审核者**：CEO
- **流程**：
  1. 创建者新建战略，状态为 Draft
  2. 创建者提交审核，状态变为 Pending
  3. CEO 审核通过，状态变为 Active；驳回则回退到 Draft
  4. Active 状态的战略不可直接编辑，需提交变更申请

##### 计划管理
- **公司计划**：创建者 CEO → 审核者 CEO
- **部门计划**：创建者 部门负责人 → 审核者 CEO/高管
- **个人计划**：创建者 员工 → 审核者 经理

##### 任务管理
- **创建者**：所有角色
- **审核者**：经理及以上
- **特殊规则**：
  - 员工创建的任务，提交后由上级审核
  - 员工 **不能删除** 任何任务（包括自己创建的草稿）
  - 上级分配的任务，下级确认后执行

#### 2.4 变更申请机制

已生效（Active）的内容需要修改时：
1. 创建者提交变更申请（Change Request）
2. 申请中需说明变更原因、变更内容
3. 原审批者审核变更申请
4. 审核通过后更新内容，保留历史版本

---

### 3. 数据看板（Dashboard）

#### 3.1 战略概览
- 公司整体战略目标完成度
- 关键指标实时展示
- 战略对齐度统计

#### 3.2 部门绩效
- 各部门计划执行进度
- KPI 达成率
- 预警提醒

#### 3.3 实时数据
- 待办事项数量
- 待审核数量（管理者视图）
- 预警提醒
- 重要通知

---

### 4. 战略计划管理

#### 4.1 战略目标
- 公司级年度战略目标制定
- 目标分解（年度 → 季度 → 月度 → 周 → 日）
- 进度跟踪

#### 4.2 部门计划
- 部门工作计划制定
- 任务分解
- 里程碑管理

#### 4.3 计划执行
- 执行进度实时更新
- 偏差预警
- 调整申请

---

### 5. 任务管理

#### 5.1 任务来源体系
- **上级分配**：总经理 → 运营总监 → 中心负责人 → 部门成员
- **主动提交**：员工提交任务申请，上级审核确认
- **计划分解**：从月度/周计划自动分解生成

#### 5.2 战略对齐机制
- 每项任务必须关联至少一个上层计划/目标
- 系统自动计算"战略对齐度" = 有关联目标的任务数 ÷ 总任务数
- 未对齐任务需说明理由

#### 5.3 任务流程
```
待确认 → 已确认 → 进行中 → 已完成 → 已验收
```

#### 5.4 对齐度预警
- 🟢 对齐度 ≥ 90%：正常
- 🟡 对齐度 70%-90%：提醒改进
- 🔴 对齐度 < 70%：需提交说明

---

### 6. 执行管理

#### 6.1 每日日志
- 记录每日工作内容、成果、问题
- 关联任务进度更新

#### 6.2 周报管理
- 部门周报提交
- 汇总分析
- 领导点评

#### 6.3 问题清单
- 问题发现与登记
- 问题跟踪
- 解决闭环

---

### 7. 考核评价系统

#### 7.1 绩效考核
- 部门绩效评分
- 个人考核记录
- 多维度评估

#### 7.2 成果管理
- 工作成果提交
- 评审反馈
- 成果归档

#### 7.3 数据分析
- 考核结果统计
- 趋势分析
- 对比分析

---

### 8. 基础数据管理

#### 8.1 组织架构
- 部门层级管理
- 汇报关系配置
- 组织架构图

#### 8.2 人员管理
- 员工档案
- 岗位信息
- 权限配置

#### 8.3 系统设置
- 指标库管理
- 模板配置
- 参数设置

---

## 数据模型

### 核心实体

#### Strategy（战略）
```typescript
{
  id: string;
  title: string;
  description: string;
  year: number;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'cancelled';
  createdById: string;
  submittedById: string | null;
  submittedAt: Date | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
}
```

#### Plan（计划）
```typescript
{
  id: string;
  title: string;
  type: 'company' | 'department' | 'personal';
  status: 'draft' | 'pending' | 'active' | 'completed' | 'cancelled';
  strategyId: string | null;
  departmentId: string | null;
  createdById: string;
  submittedById: string | null;
  reviewedById: string | null;
}
```

#### Task（任务）
```typescript
{
  id: string;
  title: string;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'verified';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sourceType: 'assigned' | 'self_initiated' | 'plan_decomposition';
  assigneeId: string;
  createdById: string;
  planId: string | null;
  strategicAlignment: boolean;
}
```

#### ChangeRequest（变更申请）
```typescript
{
  id: string;
  entityType: 'strategy' | 'plan' | 'task';
  entityId: string;
  requestType: 'modify' | 'cancel';
  requesterId: string;
  reason: string;
  oldData: string;  // JSON
  newData: string;  // JSON
  status: 'pending' | 'approved' | 'rejected';
  reviewerId: string | null;
  reviewComment: string | null;
}
```

---

## 页面结构

### 前端路由
```
/                    # 重定向到登录或看板
/login               # 登录页
/dashboard           # 数据看板
/strategy            # 战略管理
/strategy/:id        # 战略详情
/plan                # 计划管理
/plan/:id            # 计划详情
/tasks               # 任务管理
/tasks/:id           # 任务详情
/daily-log           # 每日执行
/weekly-reports      # 周报管理
/issues              # 问题清单
/department          # 部门管理
/users               # 人员管理
/assessment          # 考核管理
/settings            # 系统设置
/profile             # 个人中心
```

---

## 测试账号

| 用户名 | 密码 | 角色 | 部门 |
|--------|------|------|------|
| ceo | 123456 | CEO | 总经办 |
| executive | 123456 | 高管 | 运营中心 |
| manager | 123456 | 经理 | 产品中心 |
| employee | 123456 | 员工 | 运营中心 |

---

## 技术架构

### 前端技术栈
- React 19 + TypeScript
- Vite 构建工具
- Tailwind CSS + shadcn/ui
- React Router v6
- Framer Motion 动画
- Recharts 图表库

### 后端技术栈
- Express.js + TypeScript
- Prisma ORM
- PostgreSQL 数据库
- JWT 认证
- Zod 数据验证

### 部署架构
- PM2 进程管理
- Nginx 反向代理
- SSL/HTTPS 支持

---

## 更新日志

### v2.0.0 (2026-04-15)
- ✨ 新增审核工作流（Draft → Pending → Active）
- ✨ 新增变更申请机制
- 🔒 权限控制增强：员工无法删除任务
- 🔒 只有草稿状态可编辑/删除
- 📝 完善审核记录和版本历史
- 🐛 修复权限校验漏洞

### v1.0.0 (2026-04-10)
- 🎉 初始版本发布
- ✨ 战略计划管理
- ✨ 任务管理系统
- ✨ 数据看板
- ✨ 考核评价
