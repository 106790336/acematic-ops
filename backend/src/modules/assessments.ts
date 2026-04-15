import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { CreateAssessmentSchema, UpdateAssessmentSchema } from '../types';

const router = Router();

router.use(authMiddleware);

// 获取考核列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, type, period, page = 1, limit = 10 } = req.query;
    
    const where: any = {};
    
    if (userId) {
      where.userId = userId as string;
    }
    
    if (type) {
      where.type = type as string;
    }
    
    if (period) {
      where.period = period as string;
    }

    // 员工只能看到自己的考核
    if (req.user!.role === 'employee') {
      where.userId = req.user!.id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: { id: true, name: true, department: { select: { id: true, name: true } } },
          },
          assessor: {
            select: { id: true, name: true },
          },
          plan: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assessment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: assessments,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({
      success: false,
      error: '获取考核列表失败',
    });
  }
});

// 获取考核详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, position: true, department: { select: { id: true, name: true } } },
        },
        assessor: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, title: true },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        error: '考核记录不存在',
      });
    }

    res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({
      success: false,
      error: '获取考核信息失败',
    });
  }
});

// 创建考核
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, score, comment, type, period, planId } = req.body;
    
    const assessment = await prisma.assessment.create({
      data: {
        userId,
        score: Number(score),
        comment: comment || null,
        type: type || 'monthly',
        period,
        planId: planId || null,
        assessorId: req.user!.id,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        assessor: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({
      success: false,
      error: '创建考核失败',
    });
  }
});

// 更新考核
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { score, comment, type, period } = req.body;
    
    const updateData: any = {};
    if (score !== undefined) updateData.score = Number(score);
    if (comment !== undefined) updateData.comment = comment;
    if (type !== undefined) updateData.type = type;
    if (period !== undefined) updateData.period = period;
    
    const assessment = await prisma.assessment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true },
        },
        assessor: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({
      success: false,
      error: '更新考核失败',
    });
  }
});

// 删除考核
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.assessment.delete({ where: { id } });
    res.json({ success: true, message: '考核记录已删除' });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ success: false, error: '删除考核失败' });
  }
});

// 根据任务数据自动计算绩效
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { userId, period } = req.body;
    if (!userId || !period) {
      return res.status(400).json({ success: false, error: '缺少 userId 或 period' });
    }

    // 1. 获取该用户分配的所有任务（排除子任务，只看父任务）
    const assignedTasks = await prisma.task.findMany({
      where: { assigneeId: userId, parentTaskId: null },
    });

    const taskTotal = assignedTasks.length;
    const taskCompleted = assignedTasks.filter(t => t.status === 'completed').length;
    const taskCompletionRate = taskTotal > 0 ? (taskCompleted / taskTotal) * 100 : 0;

    // 2. 获取该期间的任务执行记录（日志中的任务执行）
    const periodStart = period.includes('-') ? period : `${period}-01`;
    const monthEnd = new Date(periodStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1, 0);

    const executions = await prisma.taskExecution.findMany({
      where: {
        taskId: { in: assignedTasks.map(t => t.id) },
        dailyLog: {
          logDate: { gte: new Date(periodStart), lte: monthEnd },
          userId,
        },
      },
    });

    // 3. 计算工时达成率
    const workHoursActual = executions.reduce((sum, e) => sum + (e.actualHours || 0), 0);
    const workHoursPlan = executions.reduce((sum, e) => sum + (e.planHours || 0), 0);
    const hoursRate = workHoursPlan > 0 ? Math.min((workHoursActual / workHoursPlan) * 100, 100) : 0;

    // 4. 计算进度贡献
    const progressContrib = taskTotal > 0
      ? assignedTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / taskTotal
      : 0;

    // 5. 综合绩效分 = 任务完成率(40%) + 工时达成率(30%) + 进度贡献(30%)
    const autoScore = Math.round(taskCompletionRate * 0.4 + hoursRate * 0.3 + progressContrib * 0.3);

    // 6. 查找或创建该期间的考核记录
    let assessment = await prisma.assessment.findFirst({
      where: { userId, period },
    });

    if (assessment) {
      assessment = await prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          autoScore,
          taskCompleted,
          taskTotal,
          workHoursActual: Math.round(workHoursActual * 10) / 10,
          workHoursPlan: Math.round(workHoursPlan * 10) / 10,
          progressContrib: Math.round(progressContrib * 10) / 10,
          calculatedAt: new Date(),
        },
      });
    } else {
      assessment = await prisma.assessment.create({
        data: {
          userId,
          period,
          type: 'monthly',
          score: autoScore,
          assessorId: req.user!.id,
          autoScore,
          taskCompleted,
          taskTotal,
          workHoursActual: Math.round(workHoursActual * 10) / 10,
          workHoursPlan: Math.round(workHoursPlan * 10) / 10,
          progressContrib: Math.round(progressContrib * 10) / 10,
          calculatedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...assessment,
        breakdown: {
          taskCompletionRate: Math.round(taskCompletionRate),
          hoursRate: Math.round(hoursRate),
          progressContrib: Math.round(progressContrib),
        },
      },
    });
  } catch (error) {
    console.error('Calculate assessment error:', error);
    res.status(500).json({ success: false, error: '计算绩效失败' });
  }
});

// 批量计算部门绩效
router.post('/calculate-dept', async (req: Request, res: Response) => {
  try {
    const { departmentId, period } = req.body;
    if (!departmentId || !period) {
      return res.status(400).json({ success: false, error: '缺少 departmentId 或 period' });
    }

    const users = await prisma.user.findMany({
      where: { departmentId },
      select: { id: true, name: true },
    });

    const results = [];
    for (const u of users) {
      const calcRes = await prisma.assessment.findFirst({
        where: { userId: u.id, period },
      });

      // 内联计算
      const assignedTasks = await prisma.task.findMany({ where: { assigneeId: u.id, parentTaskId: null } });
      const taskTotal = assignedTasks.length;
      const taskCompleted = assignedTasks.filter(t => t.status === 'completed').length;
      const taskCompletionRate = taskTotal > 0 ? (taskCompleted / taskTotal) * 100 : 0;

      const periodStart = period.includes('-') ? period : `${period}-01`;
      const monthEnd = new Date(periodStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1, 0);

      const executions = await prisma.taskExecution.findMany({
        where: {
          taskId: { in: assignedTasks.map(t => t.id) },
          dailyLog: { logDate: { gte: new Date(periodStart), lte: monthEnd }, userId: u.id },
        },
      });

      const workHoursActual = executions.reduce((sum, e) => sum + (e.actualHours || 0), 0);
      const workHoursPlan = executions.reduce((sum, e) => sum + (e.planHours || 0), 0);
      const hoursRate = workHoursPlan > 0 ? Math.min((workHoursActual / workHoursPlan) * 100, 100) : 0;
      const progressContrib = taskTotal > 0 ? assignedTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / taskTotal : 0;
      const autoScore = Math.round(taskCompletionRate * 0.4 + hoursRate * 0.3 + progressContrib * 0.3);

      if (calcRes) {
        await prisma.assessment.update({
          where: { id: calcRes.id },
          data: { autoScore, taskCompleted, taskTotal, workHoursActual: Math.round(workHoursActual * 10) / 10, workHoursPlan: Math.round(workHoursPlan * 10) / 10, progressContrib: Math.round(progressContrib * 10) / 10, calculatedAt: new Date() },
        });
      } else {
        await prisma.assessment.create({
          data: { userId: u.id, period, type: 'monthly', score: autoScore, assessorId: req.user!.id, autoScore, taskCompleted, taskTotal, workHoursActual: Math.round(workHoursActual * 10) / 10, workHoursPlan: Math.round(workHoursPlan * 10) / 10, progressContrib: Math.round(progressContrib * 10) / 10, calculatedAt: new Date() },
        });
      }

      results.push({ userId: u.id, name: u.name, autoScore, taskCompleted, taskTotal });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Batch calculate error:', error);
    res.status(500).json({ success: false, error: '批量计算失败' });
  }
});

export default router;
