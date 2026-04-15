# 版本迭代记录

## v2.1.0 (2026-04-15)

### 问题修复
- 🔧 **修复权限控制问题**：员工无法创建/编辑任务
- 🔧 **修复任务创建验证**：planId 改为可选，员工可独立创建任务
- 🔧 **修复任务模块缺少审核工作流**

### 新增功能
- ✨ **任务审核工作流**：Draft → Pending → Active
- ✨ **任务创建者追踪**：新增 createdById 字段
- ✨ **任务提交/撤回/审核接口**

### 权限调整
| 操作 | CEO | 高管 | 经理 | 员工 |
|------|-----|------|------|------|
| 创建任务 | ✅ | ✅ | ✅ | ✅ |
| 编辑自己创建的任务 | ✅ | ✅ | ✅ | ✅ |
| 编辑分配给自己的任务 | ✅ | ✅ | ✅ | ✅（仅进度/状态）|
| 删除任务 | ✅ | ✅ | ✅ | ❌ |
| 审核任务 | ✅ | ✅ | ✅ | ❌ |

### 数据库变更
- Task 模型新增字段：
  - `createdById` - 创建者ID
  - `submittedAt` - 提交时间
  - `submittedById` - 提交者ID
  - `reviewedAt` - 审核时间
  - `reviewedById` - 审核者ID
  - `reviewComment` - 审核意见
- Task 状态枚举更新：`draft`, `pending`, `active`, `in_progress`, `completed`, `verified`, `cancelled`

### API 变更
- `POST /api/tasks` - 创建任务（planId 改为可选）
- `POST /api/tasks/:id/submit` - 提交审核
- `POST /api/tasks/:id/withdraw` - 撤回审核
- `POST /api/tasks/:id/review` - 审核任务（经理及以上）
- `DELETE /api/tasks/:id` - 删除任务（经理及以上）

---

## v2.0.0 (2026-04-15)

### 新增功能
- ✨ **审核工作流**：Draft → Pending → Active 三阶段管控
- ✨ **变更申请机制**：已生效内容修改需提交申请
- ✨ **版本历史追踪**：ContentVersion 模型记录变更历史

### 权限控制增强
- 🔒 只有草稿状态可编辑/删除
- 🔒 员工无法删除任务
- 🔒 分层审核权限

### 数据库变更
- 新增 `ChangeRequest` 模型
- 新增 `ContentVersion` 模型
- Strategy/Plan 新增审核相关字段

---

## v1.0.0 (2026-04-10)

### 初始发布
- 🎉 战略计划管理
- 🎉 任务管理系统
- 🎉 数据看板
- 🎉 考核评价
- 🎉 用户权限管理
