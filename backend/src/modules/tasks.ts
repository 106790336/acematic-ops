import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { CreateTaskSchema, UpdateTaskSchema } from '../types';

const router = Router();

router.use(authMiddleware);

// 获取任务列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { planId, status, assigneeId, search, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    
    if (planId) {
      where.planId = planId as string;
    }
    
    if (status) {
      where.status = status as string;
    }
    
    if (assigneeId) {
      where.assigneeId = assigneeId as string;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // 非CEO和高管只能看到分配给自己的任务
    if (req.user!.role === 'employee') {
      where.assigneeId = req.user!.id;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          assignee: {
            select: { id: true, name: true },
          },
          plan: {
            select: { id: true, title: true },
          },
        },
        orderBy: { dueDate: 'asc' },
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
    res.status(500).json({
      success: false,
      error: '获取任务列表失败',
    });
  }
});

// 获取任务详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, position: true },
        },
        plan: {
          select: { id: true, title: true, department: { select: { id: true, name: true } } },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在',
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: '获取任务信息失败',
    });
  }
});

// 创建任务
router.post('/', validateRequest(CreateTaskSchema), async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.create({
      data: req.body,
      include: {
        assignee: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, title: true },
        },
      },
    });

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: '创建任务失败',
    });
  }
});

// 更新任务
router.put('/:id', validateRequest(UpdateTaskSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.update({
      where: { id },
      data: req.body,
      include: {
        assignee: {
          select: { id: true, name: true },
        },
        plan: {
          select: { id: true, title: true },
        },
      },
    });

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: '更新任务失败',
    });
  }
});

// 删除任务
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '任务已删除',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: '删除任务失败',
    });
  }
});

export default router;
