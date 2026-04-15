import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
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
  title: z.string().min(2, "任务标题至少2个字符"),
  description: z.string().optional(),
  sourceType: z.enum(['assigned', 'self_initiated', 'plan_decomposition']).default('self_initiated'),
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
  dueDate: z.string().optional(),  // 改为可选
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

// 创建任务（草稿）
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateTaskSchema.parse(req.body);
    const taskNumber = await generateTaskNumber();
    
    // 默认分配给自己
    const assigneeId = data.assigneeId || req.user!.id;
    
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description || '',
        taskNumber,
        sourceType: data.sourceType || 'self_initiated',
        sourceId: data.sourceId,
        sourceRef: data.sourceRef,
        assigneeId,
        assignerId: req.user!.id,
        parentTaskId: data.parentTaskId,
        planId: data.planId,
        goalId: data.goalId,
        quarterlyPlanId: data.quarterlyPlanId,
        monthlyPlanId: data.monthlyPlanId,
        weeklyPlanId: data.weeklyPlanId,
        strategicAlignment: data.strategicAlignment,
        alignmentTarget: data.alignmentTarget,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority,
        status: 'draft',
        progress: 0,
        createdById: req.user!.id,
      },
      include: {
        assignee: { select: { id: true, name: true, position: true } },
        plan: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // 创建任务来源记录
    await prisma.taskSource.create({
      data: {
        taskId: task.id,
        sourceType: data.sourceType || 'self_initiated',
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
      sourceType, status, priority, assigneeId, 
      search, page = 1, limit = 200 
    } = req.query;
    
    const where: any = {};
    
    if (sourceType) where.sourceType = sourceType;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // 权限控制
    if (req.user!.role === 'employee') {
      // 员工只能看自己创建和分配给自己的任务
      where.OR = [
        { createdById: req.user!.id },
        { assigneeId: req.user!.id },
      ];
    } else if (req.user!.role === 'manager') {
      // 经理可以看到本部门的所有任务
      const deptUsers = await prisma.user.findMany({
        where: { departmentId: req.user!.departmentId },
        select: { id: true }
      });
      const deptUserIds = deptUsers.map(u => u.id);
      where.OR = [
        { createdById: { in: deptUserIds } },
        { assigneeId: { in: deptUserIds } },
      ];
    }
    // CEO和高管可以看到所有任务

    if (assigneeId) where.assigneeId = assigneeId;

    const skip = (Number(page) - 1) * Number(limit);
    
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          assignee: { select: { id: true, name: true, position: true, departmentId: true } },
          plan: { select: { id: true, title: true } },
          parentTask: { select: { id: true, taskNumber: true, title: true } },
          createdBy: { select: { id: true, name: true } },
          submittedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
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

// 获取单个任务详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, position: true, department: true } },
        plan: { select: { id: true, title: true } },
        parentTask: { select: { id: true, taskNumber: true, title: true } },
        subTasks: {
          include: { assignee: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
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

// 提交审核
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    if (task.status !== 'draft') return res.status(400).json({ success: false, error: '只有草稿状态可以提交审核' });
    if (task.createdById !== req.user!.id) return res.status(403).json({ success: false, error: '只能提交自己创建的任务' });

    const updated = await prisma.task.update({
      where: { id },
      data: { 
        status: 'pending',
        submittedAt: new Date(),
        submittedById: req.user!.id,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ success: false, error: '提交审核失败' });
  }
});

// 撤回审核
router.post('/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    if (task.status !== 'pending') return res.status(400).json({ success: false, error: '只有待审核状态可以撤回' });
    if (task.submittedById !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限撤回此任务' });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { status: 'draft', submittedAt: null, submittedById: null },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Withdraw task error:', error);
    res.status(500).json({ success: false, error: '撤回失败' });
  }
});

// 审核任务（经理及以上）
router.post('/:id/review', roleMiddleware('manager', 'executive', 'ceo'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    if (task.status !== 'pending') return res.status(400).json({ success: false, error: '只有待审核状态可以审核' });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: approved ? 'active' : 'draft',
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
        reviewComment: comment,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Review task error:', error);
    res.status(500).json({ success: false, error: '审核失败' });
  }
});

// 确认接收任务（被分配人确认）
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    if (task.assigneeId !== req.user!.id) return res.status(403).json({ success: false, error: '只能确认分配给自己的任务' });
    
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedById: req.user!.id,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Confirm task error:', error);
    res.status(500).json({ success: false, error: '确认任务失败' });
  }
});

// 开始执行任务
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    if (task.assigneeId !== req.user!.id) return res.status(403).json({ success: false, error: '只能执行分配给自己的任务' });
    
    const updated = await prisma.task.update({
      where: { id },
      data: { status: 'in_progress' },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ success: false, error: '开始任务失败' });
  }
});

// 更新任务进度
router.put('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { progress, result } = req.body;
    
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    
    // 权限检查
    if (task.assigneeId !== req.user!.id && 
        task.createdById !== req.user!.id && 
        !['ceo', 'executive', 'manager'].includes(req.user!.role!)) {
      return res.status(403).json({ success: false, error: '无权限更新此任务' });
    }

    const updateData: any = { progress };
    
    // 进度100%自动完成
    if (progress >= 100) {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
      updateData.completedById = req.user!.id;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    // 保存执行记录
    if (result) {
      await prisma.taskExecutionRecord.create({
        data: {
          taskId: id,
          executionDate: new Date(),
          workContent: result,
          progress: progress || 0,
        },
      });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update task progress error:', error);
    res.status(500).json({ success: false, error: '更新任务进度失败' });
  }
});

// 审批任务完成（针对主动提交的任务或完成审核）
router.post('/:id/approve', roleMiddleware('manager', 'executive', 'ceo'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;
    
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: approved ? 'verified' : 'in_progress',
        approvedAt: new Date(),
        approvalComment: comment,
        approverId: req.user!.id,
        ...(approved && { verifiedAt: new Date(), verifiedById: req.user!.id }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Approve task error:', error);
    res.status(500).json({ success: false, error: '审批任务失败' });
  }
});

// 验收任务
router.post('/:id/verify', roleMiddleware('manager', 'executive', 'ceo'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { passed, verifyResult } = req.body;
    
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: passed ? 'verified' : 'in_progress',
        verifyResult,
        verifiedAt: new Date(),
        verifiedById: req.user!.id,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Verify task error:', error);
    res.status(500).json({ success: false, error: '验收任务失败' });
  }
});

// 更新任务（仅草稿可编辑）
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    
    // 草稿状态：创建者可编辑所有字段
    if (task.status === 'draft') {
      if (task.createdById !== req.user!.id && !['ceo', 'executive', 'manager'].includes(req.user!.role!)) {
        return res.status(403).json({ success: false, error: '无权限编辑此任务' });
      }
    }
    // 进行中状态：执行者只能更新进度
    else if (task.status === 'active' || task.status === 'in_progress') {
      const allowedFields = ['progress', 'status'];
      const requestedFields = Object.keys(req.body);
      const hasDisallowedFields = requestedFields.some(f => !allowedFields.includes(f));
      
      if (hasDisallowedFields && !['ceo', 'executive', 'manager'].includes(req.user!.role!)) {
        return res.status(403).json({ success: false, error: '执行者只能更新进度' });
      }
    }
    // 其他状态不能编辑
    else {
      return res.status(400).json({ success: false, error: '当前状态不允许编辑' });
    }

    const updateData: any = { ...req.body };
    if (req.body.dueDate) updateData.dueDate = new Date(req.body.dueDate);

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
    });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: '更新任务失败' });
  }
});

// 删除任务（仅草稿可删除，员工不能删除）
router.delete('/:id', roleMiddleware('manager', 'executive', 'ceo'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
    if (task.status !== 'draft') return res.status(400).json({ success: false, error: '只有草稿状态可以删除' });

    // 记录删除日志
    await prisma.contentVersion.create({
      data: {
        entityType: 'task',
        entityId: id,
        version: 1,
        data: JSON.stringify(task),
        changedBy: req.user!.id,
        changeReason: '删除任务',
      },
    });

    // 删除关联数据
    await prisma.taskExecutionRecord.deleteMany({ where: { taskId: id } });
    await prisma.taskSource.deleteMany({ where: { taskId: id } });
    await prisma.task.updateMany({ where: { parentTaskId: id }, data: { parentTaskId: null } });
    await prisma.task.delete({ where: { id } });
    
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: '删除任务失败' });
  }
});

// ===== 战略对齐度统计 =====

router.get('/stats/alignment', async (req: Request, res: Response) => {
  try {
    const { period, departmentId, userId } = req.query;
    
    const where: any = {};
    if (userId) where.assigneeId = userId;
    
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

    const departmentAlignment = Array.from(departmentStats.entries()).map(([deptId, stats]) => ({
      departmentId: deptId,
      departmentName: stats.name,
      total: stats.total,
      aligned: stats.aligned,
      rate: stats.total > 0 ? Math.round((stats.aligned / stats.total) * 100) : 0,
    }));

    const overallRate = totalTasks > 0 ? Math.round((alignedTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalTasks,
        alignedTasks,
        overallRate,
        departmentAlignment,
      },
    });
  } catch (error) {
    console.error('Get alignment stats error:', error);
    res.status(500).json({ success: false, error: '获取对齐度统计失败' });
  }
});

export default router;
