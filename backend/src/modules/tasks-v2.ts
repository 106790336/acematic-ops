import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// 生成任务编号
const generateTaskNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `T${year}${month}${day}`;
  
  const last = await prisma.task.findFirst({
    where: { taskNumber: { startsWith: prefix } },
    orderBy: { taskNumber: 'desc' },
  });

  if (!last) return `${prefix}0001`;
  const lastNum = parseInt(last.taskNumber.slice(-4));
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
};

// ===== 任务管理 =====

const CreateTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sourceType: z.enum(['assigned', 'self_initiated', 'plan_decomposition']).default('assigned'),
  sourceId: z.string().optional(),
  sourceRef: z.string().optional(),
  assigneeId: z.string().optional(),
  parentTaskId: z.string().optional(),
  planId: z.string().optional(),
  goalId: z.string().optional(),
  quarterlyPlanId: z.string().optional(),
  monthlyPlanId: z.string().optional(),
  weeklyPlanId: z.string().optional(),
  strategicAlignment: z.boolean().default(false),
  alignmentTarget: z.string().optional(),
  dueDate: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

// 创建任务
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateTaskSchema.parse(req.body);
    const taskNumber = await generateTaskNumber();
    
    // 如果有planId，自动设置sourceType为plan_decomposition
    const sourceType = data.planId ? 'plan_decomposition' : data.sourceType;
    
    const task = await prisma.task.create({
      data: {
        ...data,
        sourceType,
        taskNumber,
        dueDate: new Date(data.dueDate),
        assignerId: req.user!.id,
        status: data.sourceType === 'self_initiated' ? 'pending' : 'pending',
      },
      include: {
        assignee: { select: { id: true, name: true, position: true } },
        assigner: { select: { id: true, name: true } },
        plan: {
          include: {
            strategy: { select: { id: true, title: true } }
          }
        },
      },
    });

    // 创建任务来源记录
    await prisma.taskSource.create({
      data: {
        taskId: task.id,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        sourcePlanId: data.planId,
        sourceGoalId: data.goalId,
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: '创建任务失败' });
  }
});

// 获取任务列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      sourceType, 
      status, 
      priority, 
      assigneeId, 
      departmentId,
      strategicAlignment,
      startDate,
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const where: any = {};
    
    if (sourceType) where.sourceType = sourceType;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (strategicAlignment !== undefined) where.strategicAlignment = strategicAlignment === 'true';
    
    if (assigneeId) {
      where.assigneeId = assigneeId;
    } else if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      // 非高管只能看分配给自己的任务和自己分配的任务
      where.OR = [
        { assigneeId: req.user!.id },
        { assignerId: req.user!.id },
      ];
    }
    
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate as string);
      if (endDate) where.dueDate.lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          assignee: { select: { id: true, name: true, position: true, departmentId: true } },
          assigner: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
          parentTask: { select: { id: true, taskNumber: true, title: true } },
          sources: true,
          plan: {
            include: {
              strategy: { select: { id: true, title: true } }
            }
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: tasks,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: '获取任务列表失败' });
  }
});

// 获取我的任务
router.get('/my', async (req: Request, res: Response) => {
  try {
    const { status, type = 'assigned' } = req.query;
    
    const where: any = {};
    
    if (type === 'assigned') {
      where.assigneeId = req.user!.id;
    } else if (type === 'created') {
      where.assignerId = req.user!.id;
    } else {
      where.OR = [
        { assigneeId: req.user!.id },
        { assignerId: req.user!.id },
      ];
    }
    
    if (status) where.status = status;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, position: true } },
        assigner: { select: { id: true, name: true } },
        parentTask: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ success: false, error: '获取我的任务失败' });
  }
});

// 获取单个任务详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, position: true, department: true } },
        assigner: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        parentTask: { select: { id: true, taskNumber: true, title: true } },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
        },
        sources: true,
        executions: {
          orderBy: { executionDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, error: '获取任务详情失败' });
  }
});

// 确认接收任务（被分配人确认）
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedById: req.user!.id,
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Confirm task error:', error);
    res.status(500).json({ success: false, error: '确认任务失败' });
  }
});

// 开始执行任务
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'in_progress',
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ success: false, error: '开始任务失败' });
  }
});

// 审批任务（针对主动提交的任务或完成审核）
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;
    
    const task = await prisma.task.update({
      where: { id },
      data: {
        status: approved ? 'approved' : 'rejected',
        approvedAt: new Date(),
        approvalComment: comment,
        approverId: req.user!.id,
        // 如果通过，同时设置验收时间
        ...(approved && { verifiedAt: new Date(), verifiedById: req.user!.id }),
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Approve task error:', error);
    res.status(500).json({ success: false, error: '审批任务失败' });
  }
});

// 更新任务进度
router.put('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { progress, status, result } = req.body;
    
    const updateData: any = {
      progress,
      status: status || undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
      completedById: status === 'completed' ? req.user!.id : undefined,
    };
    
    // If progress is 100, auto-complete
    if (progress >= 100) {
      updateData.status = updateData.status || 'completed';
      updateData.completedAt = updateData.completedAt || new Date();
      updateData.completedById = updateData.completedById || req.user!.id;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    // Save execution record if result is provided
    if (result && req.user) {
      await prisma.taskExecutionRecord.create({
        data: {
          taskId: id,
          executionDate: new Date(),
          workContent: result,
          progress: progress || 0,
        },
      });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Update task progress error:', error);
    res.status(500).json({ success: false, error: '更新任务进度失败' });
  }
});

// 提交任务执行记录
router.post('/:id/executions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { executionDate, workContent, hoursSpent, progress, result, problems } = req.body;
    
    const execution = await prisma.taskExecutionRecord.create({
      data: {
        taskId: id,
        executionDate: new Date(executionDate),
        workContent,
        hoursSpent,
        progress,
        result,
        problems,
      },
    });

    // 更新任务进度
    if (progress !== undefined) {
      await prisma.task.update({
        where: { id },
        data: { progress },
      });
    }

    res.json({ success: true, data: execution });
  } catch (error) {
    console.error('Create task execution error:', error);
    res.status(500).json({ success: false, error: '提交执行记录失败' });
  }
});

// 验收任务
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { passed, verifyResult } = req.body;
    
    const task = await prisma.task.update({
      where: { id },
      data: {
        status: passed ? 'verified' : 'completed',
        verifyResult,
        verifiedAt: new Date(),
        verifiedById: req.user!.id,
      },
    });

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Verify task error:', error);
    res.status(500).json({ success: false, error: '验收任务失败' });
  }
});

// 更新任务
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      },
    });
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: '更新任务失败' });
  }
});

// 删除任务
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // 先删除关联的执行记录和来源记录
    await prisma.taskExecutionRecord.deleteMany({ where: { taskId: id } });
    await prisma.taskSource.deleteMany({ where: { taskId: id } });
    // 清除子任务的父引用
    await prisma.task.updateMany({ where: { parentTaskId: id }, data: { parentTaskId: null } });
    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: '删除任务失败' });
  }
});

// ===== 战略对齐度统计 =====

// 计算战略对齐度
router.get('/stats/alignment', async (req: Request, res: Response) => {
  try {
    const { period, departmentId, userId } = req.query;
    
    const where: any = {};
    if (userId) where.assigneeId = userId;
    
    // 获取所有任务，包含部门信息
    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        strategicAlignment: true,
        assignee: { 
          select: { 
            departmentId: true,
            department: { select: { id: true, name: true } }
          } 
        },
      },
    });

    // 按部门统计
    const departmentStats = new Map<string, { total: number; aligned: number; name: string }>();
    let totalTasks = 0;
    let alignedTasks = 0;

    for (const task of tasks) {
      totalTasks++;
      if (task.strategicAlignment) alignedTasks++;

      const deptId = task.assignee?.departmentId || 'unknown';
      const deptName = task.assignee?.department?.name || '未分配部门';
      const stats = departmentStats.get(deptId) || { total: 0, aligned: 0, name: deptName };
      stats.total++;
      if (task.strategicAlignment) stats.aligned++;
      departmentStats.set(deptId, stats);
    }

    // 计算各部门对齐度
    const departmentAlignment = Array.from(departmentStats.entries()).map(([deptId, stats]) => ({
      departmentId: deptId,
      departmentName: stats.name,
      total: stats.total,
      aligned: stats.aligned,
      rate: stats.total > 0 ? Math.round((stats.aligned / stats.total) * 100) : 0,
    }));

    const overallRate = totalTasks > 0 ? Math.round((alignedTasks / totalTasks) * 100) : 0;

    // 预警判断
    const warnings = departmentAlignment
      .filter(d => d.rate < 70)
      .map(d => ({ departmentId: d.departmentId, rate: d.rate, level: 'danger' }));

    const reminders = departmentAlignment
      .filter(d => d.rate >= 70 && d.rate < 90)
      .map(d => ({ departmentId: d.departmentId, rate: d.rate, level: 'warning' }));

    res.json({
      success: true,
      data: {
        totalTasks,
        alignedTasks,
        overallRate,
        departmentAlignment,
        warnings,
        reminders,
      },
    });
  } catch (error) {
    console.error('Get alignment stats error:', error);
    res.status(500).json({ success: false, error: '获取对齐度统计失败' });
  }
});

// 获取待确认任务
router.get('/pending/confirmation', async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: req.user!.id,
        status: 'pending',
        sourceType: 'assigned',
      },
      include: {
        assigner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get pending tasks error:', error);
    res.status(500).json({ success: false, error: '获取待确认任务失败' });
  }
});

// 获取待审批任务
router.get('/pending/approval', async (req: Request, res: Response) => {
  try {
    // 获取需要审批的任务（主动提交的任务）
    const tasks = await prisma.task.findMany({
      where: {
        sourceType: 'self_initiated',
        status: 'pending',
        assigner: {
          departmentId: req.user!.departmentId,
        },
      },
      include: {
        assignee: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get approval tasks error:', error);
    res.status(500).json({ success: false, error: '获取待审批任务失败' });
  }
});

export default router;
