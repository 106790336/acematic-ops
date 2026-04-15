import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// 创建周报
const CreateWeeklyReportSchema = z.object({
  weekDate: z.string(),
  departmentId: z.string(),
  completedTasks: z.string(),
  keyData: z.string(),
  nextWeekPlan: z.string(),
  coordinationNeed: z.string().optional(),
  selfEvaluation: z.enum(['超预期', '达成', '未达成']).default('达成'),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateWeeklyReportSchema.parse(req.body);
    
    const report = await prisma.weeklyReport.create({
      data: {
        ...data,
        weekDate: new Date(data.weekDate),
        submitterId: req.user!.id,
      },
      include: {
        department: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Create weekly report error:', error);
    res.status(500).json({ success: false, error: '创建周报失败' });
  }
});

// 获取周报列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { departmentId, weekDate, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (weekDate) {
      const week = new Date(weekDate as string);
      where.weekDate = week;
    }

    // 非CEO只能看自己部门的周报
    if (req.user!.role === 'employee' || req.user!.role === 'manager') {
      where.departmentId = req.user!.departmentId;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [reports, total] = await Promise.all([
      prisma.weeklyReport.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          department: { select: { id: true, name: true } },
          submitter: { select: { id: true, name: true } },
        },
        orderBy: { submitTime: 'desc' },
      }),
      prisma.weeklyReport.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: reports,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get weekly reports error:', error);
    res.status(500).json({ success: false, error: '获取周报列表失败' });
  }
});

// 获取单个周报
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const report = await prisma.weeklyReport.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true, position: true } },
      },
    });

    if (!report) {
      return res.status(404).json({ success: false, error: '周报不存在' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({ success: false, error: '获取周报详情失败' });
  }
});

// 更新周报
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = CreateWeeklyReportSchema.partial().parse(req.body);
    
    const report = await prisma.weeklyReport.update({
      where: { id },
      data: {
        ...data,
        weekDate: data.weekDate ? new Date(data.weekDate) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Update weekly report error:', error);
    res.status(500).json({ success: false, error: '更新周报失败' });
  }
});

// 删除周报
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.weeklyReport.delete({ where: { id } });
    res.json({ success: true, message: '周报已删除' });
  } catch (error) {
    console.error('Delete weekly report error:', error);
    res.status(500).json({ success: false, error: '删除周报失败' });
  }
});

export default router;
