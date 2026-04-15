import { z } from 'zod';

// 用户角色枚举
export const UserRole = z.enum(['ceo', 'executive', 'manager', 'employee']);
export type UserRoleType = z.infer<typeof UserRole>;

// 计划类型枚举
export const PlanType = z.enum(['company', 'department', 'personal']);
export type PlanTypeType = z.infer<typeof PlanType>;

// 状态枚举
export const StrategyStatus = z.enum(['draft', 'pending', 'active', 'completed', 'archived']);
export const PlanStatus = z.enum(['draft', 'pending', 'active', 'completed', 'cancelled']);
export const TaskStatus = z.enum(['draft', 'pending', 'active', 'in_progress', 'completed', 'verified', 'cancelled']);

// 优先级枚举
export const Priority = z.enum(['high', 'medium', 'low']);
export type PriorityType = z.infer<typeof Priority>;

// 考核类型枚举
export const AssessmentType = z.enum(['monthly', 'quarterly', 'annual']);
export type AssessmentTypeType = z.infer<typeof AssessmentType>;

// 用户基础Schema
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  role: UserRole,
  departmentId: z.string().nullable(),
  position: z.string().nullable(),
  avatar: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  name: z.string().min(2).max(50),
  role: UserRole.default('employee'),
  departmentId: z.string().optional(),
  position: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ username: true });

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

// 部门Schema
export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  managerId: z.string().nullable(),
  description: z.string().nullable(),
  memberCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
  description: z.string().optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

// 战略Schema
export const StrategySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  year: z.number(),
  status: StrategyStatus,
  progress: z.number().min(0).max(100),
  startDate: z.date(),
  endDate: z.date(),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateStrategySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  year: z.number().int().min(2020).max(2050),
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
});

export const UpdateStrategySchema = CreateStrategySchema.partial().extend({
  status: StrategyStatus.optional(),
  progress: z.number().min(0).max(100).optional(),
});

// 计划Schema
export const PlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: PlanType,
  strategyId: z.string().nullable(),
  departmentId: z.string().nullable(),
  ownerId: z.string(),
  status: PlanStatus,
  progress: z.number().min(0).max(100),
  priority: Priority,
  startDate: z.date(),
  endDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePlanSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  type: PlanType.default('department'),
  strategyId: z.string().optional(),
  departmentId: z.string().optional(),
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  priority: Priority.default('medium'),
});

export const UpdatePlanSchema = CreatePlanSchema.partial().extend({
  status: PlanStatus.optional(),
  progress: z.number().min(0).max(100).optional(),
});

// 任务Schema
export const TaskSchema = z.object({
  id: z.string(),
  planId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assigneeId: z.string().nullable(),
  status: TaskStatus,
  progress: z.number().min(0).max(100),
  priority: Priority,
  dueDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(2, "任务标题至少2个字符").max(200),
  description: z.string().optional(),
  planId: z.string().optional(),  // 可选，不强制关联计划
  assigneeId: z.string().optional(),  // 可选，默认分配给自己
  dueDate: z.string().optional(),  // 可选
  priority: Priority.default('medium'),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: Priority.optional(),
  status: TaskStatus.optional(),
  progress: z.number().min(0).max(100).optional(),
});

// 考核Schema
export const AssessmentSchema = z.object({
  id: z.string(),
  planId: z.string().nullable(),
  userId: z.string(),
  assessorId: z.string(),
  score: z.number().min(0).max(100),
  comment: z.string().nullable(),
  type: AssessmentType,
  period: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateAssessmentSchema = z.object({
  planId: z.string().optional(),
  userId: z.string(),
  score: z.number().min(0).max(100),
  comment: z.string().optional(),
  type: AssessmentType.default('monthly'),
  period: z.string(),
});

export const UpdateAssessmentSchema = CreateAssessmentSchema.partial().omit({ userId: true });

// API响应类型
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponseType = z.infer<typeof ApiResponseSchema>;
