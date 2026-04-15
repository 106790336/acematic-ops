import { Department, User } from './index';

// 周报类型
export interface WeeklyReport {
  id: string;
  weekDate: string;
  departmentId: string;
  department?: Department;
  submitterId: string;
  submitter?: User;
  completedTasks: string;
  keyData: string;
  nextWeekPlan: string;
  coordinationNeed?: string;
  selfEvaluation: string;
  submitTime: string;
  createdAt: string;
  updatedAt: string;
}

// 问题类型
export interface Issue {
  id: string;
  issueNumber: string;
  source: string;
  discoveryDate: string;
  departmentId: string;
  department?: Department;
  description: string;
  issueType: string;
  severity: string;
  responsibleId?: string;
  responsible?: User;
  planCompleteDate?: string;
  actualCompleteDate?: string;
  status: string;
  solution?: string;
  verifyResult?: string;
  createdAt: string;
  updatedAt: string;
  measures?: ImprovementMeasure[];
}

// 会议纪要类型
export interface Meeting {
  id: string;
  meetingName: string;
  meetingType: string;
  meetingTime: string;
  location: string;
  hostId: string;
  host?: User;
  recorderId: string;
  recorder?: User;
  content: string;
  resolutions: string;
  nextMeetingDate?: string;
  createdAt: string;
  updatedAt: string;
  attendees?: User[];
}

// 月度经营数据类型
export interface MonthlyData {
  id: string;
  yearMonth: string;
  departmentId: string;
  department?: Department;
  indicatorName: string;
  targetValue: number;
  actualValue: number;
  achievement: number;
  lastYearValue?: number;
  lastMonthValue?: number;
  yearOverYear?: number;
  monthOverMonth?: number;
  deviation?: string;
  improvement?: string;
  createdAt: string;
  updatedAt: string;
}

// 改进措施类型
export interface ImprovementMeasure {
  id: string;
  measureNumber: string;
  issueId?: string;
  issue?: Issue;
  description: string;
  responsibleId: string;
  responsible?: User;
  planCompleteDate: string;
  progress: number;
  effectVerify?: string;
  isEffective: string;
  createdAt: string;
  updatedAt: string;
}

// API请求类型
export interface CreateWeeklyReportRequest {
  weekDate: string;
  departmentId: string;
  completedTasks: string;
  keyData: string;
  nextWeekPlan: string;
  coordinationNeed?: string;
  selfEvaluation?: string;
}

export interface CreateIssueRequest {
  source: string;
  discoveryDate: string;
  departmentId: string;
  description: string;
  issueType: string;
  severity?: string;
  responsibleId?: string;
  planCompleteDate?: string;
}

export interface UpdateIssueRequest extends Partial<CreateIssueRequest> {
  status?: string;
  solution?: string;
  verifyResult?: string;
  actualCompleteDate?: string;
}

export interface CreateMeetingRequest {
  meetingName: string;
  meetingType: string;
  meetingTime: string;
  location: string;
  hostId: string;
  recorderId: string;
  content: string;
  resolutions: string;
  attendeeIds?: string[];
  nextMeetingDate?: string;
}

export interface CreateMonthlyDataRequest {
  yearMonth: string;
  departmentId: string;
  indicatorName: string;
  targetValue: number;
  actualValue: number;
  lastYearValue?: number;
  lastMonthValue?: number;
  deviation?: string;
  improvement?: string;
}
