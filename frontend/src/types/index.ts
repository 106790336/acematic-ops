// 用户类型
export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  roleId?: string;
  roleInfo?: Role;
  departmentId?: string;
  department?: Department;
  position?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

// 角色类型
export interface Role {
  id: string;
  name: string;
  label: string;
  description?: string;
  isSystem?: boolean;
  level?: number;
  permissionCount?: number;
  userCount?: number;
}

// 权限类型
export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
}

// 部门类型
export interface Department {
  id: string;
  name: string;
  parentId?: string;
  managerId?: string;
  manager?: User;
  description?: string;
  memberCount: number;
  children?: Department[];
  members?: User[];
  parent?: Department;
}

// 战略类型
export interface Strategy {
  id: string;
  title: string;
  description?: string;
  year: number;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'archived';
  progress: number;
  startDate: string;
  endDate: string;
  createdById: string;
  createdBy?: User;
  submittedById?: string;
  submittedBy?: User;
  reviewedById?: string;
  reviewedBy?: User;
  reviewComment?: string;
  plans?: Plan[];
  planCount?: number;
  createdAt: string;
  updatedAt: string;
}

// 计划类型
export interface Plan {
  id: string;
  title: string;
  description?: string;
  type: 'company' | 'department' | 'personal';
  strategyId?: string;
  strategy?: Strategy;
  departmentId?: string;
  department?: Department;
  ownerId: string;
  owner?: User;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'cancelled';
  progress: number;
  priority: 'high' | 'medium' | 'low';
  startDate: string;
  endDate: string;
  tasks?: Task[];
  taskCount?: number;
  assessments?: Assessment[];
  createdAt: string;
  updatedAt: string;
}

// 任务类型
export interface Task {
  id: string;
  planId: string;
  plan?: Plan;
  title: string;
  description?: string;
  assigneeId?: string;
  assignee?: User;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'pending_approval' | 'approved' | 'rejected' | 'verified' | 'cancelled';
  progress: number;
  priority: 'high' | 'medium' | 'low' | 'urgent';
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

// 考核类型
export interface Assessment {
  id: string;
  planId?: string;
  plan?: Plan;
  userId: string;
  user?: User;
  assessorId: string;
  assessor?: User;
  score: number;
  comment?: string;
  type: 'monthly' | 'quarterly' | 'annual';
  period: string;
  createdAt: string;
  updatedAt: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API请求类型
export interface CreatePlanData {
  title: string;
  description?: string;
  type: 'company' | 'department' | 'personal';
  strategyId?: string;
  departmentId?: string;
  ownerId: string;
  priority: 'high' | 'medium' | 'low';
  startDate: string;
  endDate: string;
}

export interface UpdatePlanData extends Partial<CreatePlanData> {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress?: number;
}

export interface CreateStrategyData {
  title: string;
  description?: string;
  year: number;
  startDate: string;
  endDate: string;
}

export interface UpdateStrategyData extends Partial<CreateStrategyData> {
  status?: 'draft' | 'active' | 'completed' | 'archived';
  progress?: number;
}

// 登录请求
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: User;
}

// 看板数据
export interface DashboardData {
  strategies: {
    total: number;
    active: number;
  };
  plans: {
    total: number;
    inProgress: number;
    completed: number;
    completionRate: number;
  };
  tasks: {
    total: number;
    pending: number;
  };
  departments: number;
  users: number;
  recentPlans: Plan[];
}

// 部门绩效
export interface DepartmentPerformance {
  id: string;
  name: string;
  memberCount: number;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
}

// 考核趋势
export interface AssessmentTrend {
  period: string;
  avgScore: number;
  count: number;
}

// 每日日志类型
export interface DailyLog {
  id: string;
  logDate: string;
  weeklyPlanId?: string;
  userId: string;
  user?: User;
  departmentId: string;
  department?: Department;
  workContent: string;
  achievements?: string;
  workHours: number;
  progress: number;
  problems?: string;
  nextDayPlan?: string;
  submitTime: string;
  createdAt: string;
  updatedAt: string;
  tasks?: TaskExecution[];
}

// 任务执行记录
export interface TaskExecution {
  id: string;
  dailyLogId: string;
  taskName: string;
  description?: string;
  planHours?: number;
  actualHours?: number;
  status: string;
  completion: number;
  result?: string;
  createdAt: string;
  updatedAt: string;
}

// 导出执行相关类型
export type { WeeklyReport, Issue, Meeting, MonthlyData, ImprovementMeasure, CreateWeeklyReportRequest, CreateIssueRequest, UpdateIssueRequest, CreateMeetingRequest, CreateMonthlyDataRequest } from './execution';
