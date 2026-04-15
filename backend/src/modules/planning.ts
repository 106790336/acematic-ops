import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// ===== 年度目标管理 =====

const CreateAnnualGoalSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  strategyId: z.string().optional(),
  departmentId: z.string().optional(),
  year: z.number(),
  targetValue: z.number().optional(),
  currentValue: z.number().default(0),
  unit: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  ownerId: z.string().optional(),
});

// 创建年度目标
router.post('/annual-goals', async (req: Request, res: Response) => {
  try {
    const data = CreateAnnualGoalSchema.parse(req.body);
    
    const goal = await prisma.annualGoal.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        ownerId: data.ownerId || req.user!.id,
        status: '进行中',
      },
      include: {
        strategy: true,
        department: true,
        owner: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Create annual goal error:', error);
    res.status(500).json({ success: false, error: '创建年度目标失败' });
  }
});

// 获取年度目标列表
router.get('/annual-goals', async (req: Request, res: Response) => {
  try {
    const { year, departmentId, status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (year) where.year = Number(year);
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    
    const [goals, total] = await Promise.all([
      prisma.annualGoal.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          strategy: true,
          department: true,
          owner: { select: { id: true, name: true } },
          monthlyPlans: {
            include: {
              _count: { select: { weeklyPlans: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.annualGoal.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items: goals, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Get annual goals error:', error);
    res.status(500).json({ success: false, error: '获取年度目标失败' });
  }
});

// 更新年度目标
router.put('/annual-goals/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const goal = await prisma.annualGoal.update({
      where: { id },
      data: {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      },
    });
    res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Update annual goal error:', error);
    res.status(500).json({ success: false, error: '更新年度目标失败' });
  }
});

// ===== 月度计划管理 =====

const CreateMonthlyPlanSchema = z.object({
  annualGoalId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  month: z.number(), // 1-12
  year: z.number(),
  targetValue: z.number().optional(),
  currentValue: z.number().default(0),
  keyResults: z.array(z.string()).optional(),
});

// 创建月度计划
router.post('/monthly-plans', async (req: Request, res: Response) => {
  try {
    const data = CreateMonthlyPlanSchema.parse(req.body);
    
    const plan = await prisma.monthlyPlan.create({
      data: {
        ...data,
        keyResults: data.keyResults || [],
        status: '进行中',
        ownerId: req.user!.id,
      },
      include: {
        annualGoal: true,
        owner: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Create monthly plan error:', error);
    res.status(500).json({ success: false, error: '创建月度计划失败' });
  }
});

// 获取月度计划列表
router.get('/monthly-plans', async (req: Request, res: Response) => {
  try {
    const { year, month, annualGoalId, departmentId, status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (year) where.year = Number(year);
    if (month) where.month = Number(month);
    if (annualGoalId) where.annualGoalId = annualGoalId;
    if (status) where.status = status;
    
    if (departmentId) {
      where.annualGoal = { departmentId };
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [plans, total] = await Promise.all([
      prisma.monthlyPlan.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          annualGoal: {
            include: { department: true, strategy: true },
          },
          owner: { select: { id: true, name: true } },
          weeklyPlans: {
            include: {
              _count: { select: { dailyLogs: true } },
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      prisma.monthlyPlan.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items: plans, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Get monthly plans error:', error);
    res.status(500).json({ success: false, error: '获取月度计划失败' });
  }
});

// 更新月度计划
router.put('/monthly-plans/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.monthlyPlan.update({
      where: { id },
      data: req.body,
    });
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Update monthly plan error:', error);
    res.status(500).json({ success: false, error: '更新月度计划失败' });
  }
});

// ===== 周计划管理 =====

const CreateWeeklyPlanSchema = z.object({
  monthlyPlanId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  weekNumber: z.number(), // 第几周
  startDate: z.string(),
  endDate: z.string(),
  targetValue: z.number().optional(),
  currentValue: z.number().default(0),
  keyTasks: z.array(z.string()).optional(),
});

// 创建周计划
router.post('/weekly-plans', async (req: Request, res: Response) => {
  try {
    const data = CreateWeeklyPlanSchema.parse(req.body);
    
    const plan = await prisma.weeklyPlan.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        keyTasks: data.keyTasks || [],
        status: '进行中',
        ownerId: req.user!.id,
      },
      include: {
        monthlyPlan: {
          include: { annualGoal: true },
        },
        owner: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Create weekly plan error:', error);
    res.status(500).json({ success: false, error: '创建周计划失败' });
  }
});

// 获取周计划列表
router.get('/weekly-plans', async (req: Request, res: Response) => {
  try {
    const { year, month, weekNumber, monthlyPlanId, userId, status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (weekNumber) where.weekNumber = Number(weekNumber);
    if (monthlyPlanId) where.monthlyPlanId = monthlyPlanId;
    if (userId) where.ownerId = userId;
    if (status) where.status = status;
    
    if (year || month) {
      where.monthlyPlan = {};
      if (year) where.monthlyPlan.year = Number(year);
      if (month) where.monthlyPlan.month = Number(month);
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [plans, total] = await Promise.all([
      prisma.weeklyPlan.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          monthlyPlan: {
            include: {
              annualGoal: { include: { department: true, strategy: true } },
            },
          },
          owner: { select: { id: true, name: true, position: true } },
          dailyLogs: {
            include: {
              _count: { select: { tasks: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.weeklyPlan.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items: plans, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Get weekly plans error:', error);
    res.status(500).json({ success: false, error: '获取周计划失败' });
  }
});

// 获取当前用户的周计划
router.get('/weekly-plans/my', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    
    const plans = await prisma.weeklyPlan.findMany({
      where: {
        ownerId: req.user!.id,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        monthlyPlan: {
          include: {
            annualGoal: true,
          },
        },
        dailyLogs: {
          where: {
            logDate: {
              gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
            },
          },
          include: { tasks: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get my weekly plans error:', error);
    res.status(500).json({ success: false, error: '获取我的周计划失败' });
  }
});

// 更新周计划
router.put('/weekly-plans/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.weeklyPlan.update({
      where: { id },
      data: {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      },
    });
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Update weekly plan error:', error);
    res.status(500).json({ success: false, error: '更新周计划失败' });
  }
});

// ===== 执行统计 =====

// 获取执行统计概览
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { year, month, departmentId } = req.query;
    const currentYear = year ? Number(year) : new Date().getFullYear();
    const currentMonth = month ? Number(month) : new Date().getMonth() + 1;

    const where: any = {};
    if (departmentId) where.departmentId = departmentId;

    // 年度目标统计
    const annualGoals = await prisma.annualGoal.count({
      where: { year: currentYear, ...where },
    });

    const completedAnnualGoals = await prisma.annualGoal.count({
      where: { year: currentYear, status: '已完成', ...where },
    });

    // 月度计划统计
    const monthlyPlans = await prisma.monthlyPlan.count({
      where: { year: currentYear, month: currentMonth },
    });

    const completedMonthlyPlans = await prisma.monthlyPlan.count({
      where: { year: currentYear, month: currentMonth, status: '已完成' },
    });

    // 周计划统计
    const weeklyPlans = await prisma.weeklyPlan.count({
      where: {
        monthlyPlan: { year: currentYear, month: currentMonth },
      },
    });

    // 每日日志统计
    const dailyLogs = await prisma.dailyLog.count({
      where: {
        logDate: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
        ...where,
      },
    });

    // 成果统计
    const achievements = await prisma.achievement.count({
      where: {
        achievementDate: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
        ...where,
      },
    });

    res.json({
      success: true,
      data: {
        year: currentYear,
        month: currentMonth,
        annualGoals,
        completedAnnualGoals,
        annualGoalProgress: annualGoals > 0 ? Math.round((completedAnnualGoals / annualGoals) * 100) : 0,
        monthlyPlans,
        completedMonthlyPlans,
        monthlyPlanProgress: monthlyPlans > 0 ? Math.round((completedMonthlyPlans / monthlyPlans) * 100) : 0,
        weeklyPlans,
        dailyLogs,
        achievements,
      },
    });
  } catch (error) {
    console.error('Get stats overview error:', error);
    res.status(500).json({ success: false, error: '获取统计概览失败' });
  }
});

export default router;
