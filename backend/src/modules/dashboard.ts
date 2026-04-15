import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// 获取看板概览数据
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();

    // 并行获取各项统计数据
    const [
      totalStrategies,
      activeStrategies,
      totalPlans,
      inProgressPlans,
      completedPlans,
      totalTasks,
      pendingTasks,
      totalDepartments,
      totalUsers,
      recentPlans,
    ] = await Promise.all([
      // 战略统计
      prisma.strategy.count({ where: { year: currentYear } }),
      prisma.strategy.count({ where: { year: currentYear, status: 'active' } }),
      
      // 计划统计
      prisma.plan.count({ where: { type: { in: ['company', 'department'] } } }),
      prisma.plan.count({ where: { status: 'in_progress' } }),
      prisma.plan.count({ where: { status: 'completed' } }),
      
      // 任务统计
      prisma.task.count(),
      prisma.task.count({ where: { status: 'pending' } }),
      
      // 部门和用户统计
      prisma.department.count(),
      prisma.user.count({ where: { isActive: true } }),
      
      // 最近计划
      prisma.plan.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          department: { select: { name: true } },
          owner: { select: { name: true } },
        },
      }),
    ]);

    // 计算完成率
    const planCompletionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    res.json({
      success: true,
      data: {
        strategies: {
          total: totalStrategies,
          active: activeStrategies,
        },
        plans: {
          total: totalPlans,
          inProgress: inProgressPlans,
          completed: completedPlans,
          completionRate: planCompletionRate,
        },
        tasks: {
          total: totalTasks,
          pending: pendingTasks,
        },
        departments: totalDepartments,
        users: totalUsers,
        recentPlans,
      },
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({
      success: false,
      error: '获取概览数据失败',
    });
  }
});

// 获取战略进度
router.get('/strategy-progress', async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const strategies = await prisma.strategy.findMany({
      where: { year: currentYear },
      include: {
        _count: {
          select: { plans: true },
        },
      },
      orderBy: { progress: 'desc' },
    });

    res.json({
      success: true,
      data: strategies.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        progress: s.progress,
        planCount: s._count.plans,
      })),
    });
  } catch (error) {
    console.error('Get strategy progress error:', error);
    res.status(500).json({
      success: false,
      error: '获取战略进度失败',
    });
  }
});

// 获取部门绩效
router.get('/department-performance', async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { members: true, plans: true },
        },
        plans: {
          where: { status: 'completed' },
        },
      },
    });

    const performance = departments.map(dept => {
      const totalPlans = dept._count.plans;
      const completedPlans = dept.plans.length;
      const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
      
      return {
        id: dept.id,
        name: dept.name,
        memberCount: dept._count.members,
        totalPlans,
        completedPlans,
        completionRate,
      };
    });

    // 按完成率排序
    performance.sort((a, b) => b.completionRate - a.completionRate);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error('Get department performance error:', error);
    res.status(500).json({
      success: false,
      error: '获取部门绩效失败',
    });
  }
});

// 获取考核趋势
router.get('/assessment-trends', async (req: Request, res: Response) => {
  try {
    const { type = 'monthly' } = req.query;
    
    // 获取最近6个周期的考核数据
    const assessments = await prisma.assessment.findMany({
      where: { type: type as string },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 按周期分组统计平均分
    const periodStats: Record<string, { total: number; count: number }> = {};
    
    assessments.forEach(a => {
      if (!periodStats[a.period]) {
        periodStats[a.period] = { total: 0, count: 0 };
      }
      periodStats[a.period].total += a.score;
      periodStats[a.period].count += 1;
    });

    const trends = Object.entries(periodStats)
      .map(([period, stats]) => ({
        period,
        avgScore: Math.round(stats.total / stats.count),
        count: stats.count,
      }))
      .slice(0, 6);

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Get assessment trends error:', error);
    res.status(500).json({
      success: false,
      error: '获取考核趋势失败',
    });
  }
});

export default router;
