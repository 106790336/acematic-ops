import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// 获取当前用户的任务列表（用于日志关联选择）
router.get('/my-tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { assigneeId: req.user!.id },
          { assignerId: req.user!.id },
        ],
        status: { in: ['pending', 'confirmed', 'in_progress'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        priority: true,
        dueDate: true,
        plan: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ success: false, error: '获取任务列表失败' });
  }
});

// 生成成果编号
const generateAchievementNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `A${year}${month}`;
  
  const last = await prisma.achievement.findFirst({
    where: { achievementNumber: { startsWith: prefix } },
    orderBy: { achievementNumber: 'desc' },
  });

  if (!last) return `${prefix}0001`;
  const lastNum = parseInt(last.achievementNumber.slice(-4));
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
};

// 创建每日日志
const CreateDailyLogSchema = z.object({
  logDate: z.string(),
  weeklyPlanId: z.string().optional(),
  workContent: z.string(),
  achievements: z.string().optional(),
  workHours: z.number().default(8),
  progress: z.number().default(0),
  problems: z.string().optional(),
  nextDayPlan: z.string().optional(),
  tasks: z.array(z.object({
    taskId: z.string().optional(), // 关联的任务ID
    taskName: z.string(),
    description: z.string().optional(),
    planHours: z.number().optional(),
    actualHours: z.number().optional(),
    status: z.string().default('进行中'),
    completion: z.number().default(0),
    result: z.string().optional(),
  })).optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { tasks, ...data } = CreateDailyLogSchema.parse(req.body);
    
    const log = await prisma.dailyLog.create({
      data: {
        ...data,
        logDate: new Date(data.logDate),
        userId: req.user!.id,
        departmentId: req.user!.departmentId || '',
      },
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // 创建任务执行记录
    if (tasks && tasks.length > 0) {
      await prisma.taskExecution.createMany({
        data: tasks.map(t => ({
          dailyLogId: log.id,
          taskId: t.taskId || null,
          taskName: t.taskName,
          description: t.description,
          planHours: t.planHours,
          actualHours: t.actualHours,
          status: t.status,
          completion: t.completion,
          result: t.result,
        })),
      });
    }

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Create daily log error:', error);
    res.status(500).json({ success: false, error: '创建日志失败' });
  }
});

// 获取每日日志列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, departmentId, startDate, endDate, page = 1, limit = 30 } = req.query;
    
    const where: any = {};
    
    if (userId) where.userId = userId;
    if (departmentId) where.departmentId = departmentId;
    
    if (startDate || endDate) {
      where.logDate = {};
      if (startDate) where.logDate.gte = new Date(startDate as string);
      if (endDate) where.logDate.lte = new Date(endDate as string);
    }

    // 非CEO只能看自己的日志
    if (req.user!.role === 'employee' || req.user!.role === 'manager') {
      where.userId = req.user!.id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [logs, total] = await Promise.all([
      prisma.dailyLog.findMany({
        where,
        skip,
        take: Number(limit),
      include: {
        user: { select: { id: true, name: true, position: true } },
        department: { select: { id: true, name: true } },
        tasks: {
          include: {
            task: { select: { id: true, title: true, status: true, progress: true } }
          }
        },
      },
        orderBy: { logDate: 'desc' },
      }),
      prisma.dailyLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: logs,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get daily logs error:', error);
    res.status(500).json({ success: false, error: '获取日志列表失败' });
  }
});

// 获取今日日志
router.get('/today', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const log = await prisma.dailyLog.findFirst({
      where: {
        userId: req.user!.id,
        logDate: today,
      },
      include: {
        tasks: {
          include: {
            task: { select: { id: true, title: true, status: true, progress: true } }
          }
        },
      },
    });

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get today log error:', error);
    res.status(500).json({ success: false, error: '获取今日日志失败' });
  }
});

// 获取单个日志详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const log = await prisma.dailyLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, position: true } },
        department: { select: { id: true, name: true } },
        tasks: {
          include: {
            task: { select: { id: true, title: true, status: true, progress: true } }
          }
        },
        weeklyPlan: {
          include: {
            monthlyPlan: true,
          },
        },
      },
    });

    if (!log) {
      return res.status(404).json({ success: false, error: '日志不存在' });
    }

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get daily log error:', error);
    res.status(500).json({ success: false, error: '获取日志详情失败' });
  }
});

// 更新日志
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tasks, ...data } = req.body;
    
    const log = await prisma.dailyLog.update({
      where: { id },
      data: {
        ...data,
        logDate: data.logDate ? new Date(data.logDate) : undefined,
      },
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // 更新任务
    if (tasks) {
      await prisma.taskExecution.deleteMany({ where: { dailyLogId: id } });
      if (tasks.length > 0) {
        await prisma.taskExecution.createMany({
          data: tasks.map((t: any) => ({
            dailyLogId: id,
            taskId: t.taskId || null,
            taskName: t.taskName,
            description: t.description,
            planHours: t.planHours,
            actualHours: t.actualHours,
            status: t.status,
            completion: t.completion,
            result: t.result,
          })),
        });
      }
    }

    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Update daily log error:', error);
    res.status(500).json({ success: false, error: '更新日志失败' });
  }
});

// ===== 成果管理 =====

// 创建成果
router.post('/achievements', async (req: Request, res: Response) => {
  try {
    const achievementNumber = await generateAchievementNumber();
    
    const achievement = await prisma.achievement.create({
      data: {
        ...req.body,
        achievementNumber,
        achievementDate: new Date(req.body.achievementDate),
        userId: req.user!.id,
        departmentId: req.user!.departmentId || '',
      },
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: achievement });
  } catch (error) {
    console.error('Create achievement error:', error);
    res.status(500).json({ success: false, error: '创建成果失败' });
  }
});

// 获取成果列表
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const { userId, departmentId, status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    
    const [achievements, total] = await Promise.all([
      prisma.achievement.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.achievement.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: achievements,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ success: false, error: '获取成果列表失败' });
  }
});

// 审核成果
router.put('/achievements/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewComment } = req.body;
    
    const achievement = await prisma.achievement.update({
      where: { id },
      data: {
        status,
        reviewComment,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    res.json({ success: true, data: achievement });
  } catch (error) {
    console.error('Review achievement error:', error);
    res.status(500).json({ success: false, error: '审核成果失败' });
  }
});

export default router;
