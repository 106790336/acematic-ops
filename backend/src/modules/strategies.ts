import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// 获取战略列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { year, status, search, page = 1, limit = 10 } = req.query;
    
    const where: any = {};
    
    if (year) {
      where.year = Number(year);
    }
    
    if (status) {
      where.status = status as string;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // 非高管只能看自己创建的草稿和已生效的战略
    if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      where.OR = [
        { status: 'active' },
        { status: 'completed' },
        { createdById: req.user!.id },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [strategies, total] = await Promise.all([
      prisma.strategy.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          submittedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          _count: {
            select: { plans: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.strategy.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: strategies.map(s => ({ ...s, planCount: s._count.plans })),
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get strategies error:', error);
    res.status(500).json({
      success: false,
      error: '获取战略列表失败',
    });
  }
});

// 获取战略详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        plans: {
          include: {
            department: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: '战略不存在',
      });
    }

    res.json({
      success: true,
      data: strategy,
    });
  } catch (error) {
    console.error('Get strategy error:', error);
    res.status(500).json({
      success: false,
      error: '获取战略信息失败',
    });
  }
});

// 创建战略（草稿）
router.post('/', async (req: Request, res: Response) => {
  try {
    // 只有CEO和高管可以创建战略
    if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.status(403).json({ success: false, error: '无权限创建战略' });
    }

    const { title, description, year, startDate, endDate } = req.body;
    
    const strategy = await prisma.strategy.create({
      data: {
        title,
        description,
        year: Number(year),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdById: req.user!.id,
        status: 'draft',
        progress: 0,
      },
    });

    res.json({
      success: true,
      data: strategy,
    });
  } catch (error) {
    console.error('Create strategy error:', error);
    res.status(500).json({
      success: false,
      error: '创建战略失败',
    });
  }
});

// 更新战略（仅草稿状态可编辑）
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, year, startDate, endDate } = req.body;

    const strategy = await prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      return res.status(404).json({ success: false, error: '战略不存在' });
    }

    // 检查权限：只有创建者可以编辑草稿
    if (strategy.createdById !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限编辑此战略' });
    }

    // 只有草稿状态可以直接编辑
    if (strategy.status !== 'draft') {
      return res.status(400).json({ success: false, error: '当前状态不允许直接编辑，请提交变更申请' });
    }
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (year !== undefined) updateData.year = year;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    
    const updated = await prisma.strategy.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update strategy error:', error);
    res.status(500).json({
      success: false,
      error: '更新战略失败',
    });
  }
});

// 提交审核
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const strategy = await prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      return res.status(404).json({ success: false, error: '战略不存在' });
    }

    if (strategy.status !== 'draft') {
      return res.status(400).json({ success: false, error: '只有草稿状态可以提交审核' });
    }

    // 检查权限：只有创建者可以提交
    if (strategy.createdById !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限提交此战略' });
    }

    const updated = await prisma.strategy.update({
      where: { id },
      data: {
        status: 'pending',
        submittedAt: new Date(),
        submittedById: req.user!.id,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Submit strategy error:', error);
    res.status(500).json({ success: false, error: '提交审核失败' });
  }
});

// 撤回审核
router.post('/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const strategy = await prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      return res.status(404).json({ success: false, error: '战略不存在' });
    }

    if (strategy.status !== 'pending') {
      return res.status(400).json({ success: false, error: '只有待审核状态可以撤回' });
    }

    if (strategy.submittedById !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限撤回此战略' });
    }

    const updated = await prisma.strategy.update({
      where: { id },
      data: {
        status: 'draft',
        submittedAt: null,
        submittedById: null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Withdraw strategy error:', error);
    res.status(500).json({ success: false, error: '撤回失败' });
  }
});

// 审核战略
router.post('/:id/review', roleMiddleware('ceo'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const strategy = await prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      return res.status(404).json({ success: false, error: '战略不存在' });
    }

    if (strategy.status !== 'pending') {
      return res.status(400).json({ success: false, error: '只有待审核状态可以审核' });
    }

    const updated = await prisma.strategy.update({
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
    console.error('Review strategy error:', error);
    res.status(500).json({ success: false, error: '审核失败' });
  }
});

// 删除战略（仅草稿可删除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const strategy = await prisma.strategy.findUnique({ where: { id } });
    if (!strategy) {
      return res.status(404).json({ success: false, error: '战略不存在' });
    }

    // 只有草稿状态可以删除
    if (strategy.status !== 'draft') {
      return res.status(400).json({ success: false, error: '只有草稿状态可以删除' });
    }

    // 检查权限：只有创建者或CEO可以删除
    if (strategy.createdById !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限删除此战略' });
    }

    // 检查是否有关联计划
    const plans = await prisma.plan.count({
      where: { strategyId: id },
    });

    if (plans > 0) {
      return res.status(400).json({
        success: false,
        error: '该战略下存在关联计划，无法删除',
      });
    }

    await prisma.strategy.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '战略已删除',
    });
  } catch (error) {
    console.error('Delete strategy error:', error);
    res.status(500).json({
      success: false,
      error: '删除战略失败',
    });
  }
});

// 导出战略数据
router.get('/export/all', async (req: Request, res: Response) => {
  try {
    const strategies = await prisma.strategy.findMany({
      include: {
        plans: {
          include: {
            department: { select: { name: true } },
            owner: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: strategies,
    });
  } catch (error) {
    console.error('Export strategies error:', error);
    res.status(500).json({
      success: false,
      error: '导出战略数据失败',
    });
  }
});

// 批量导入战略数据
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { strategies } = req.body;
    
    if (!Array.isArray(strategies)) {
      return res.status(400).json({
        success: false,
        error: '数据格式错误',
      });
    }

    let imported = 0;
    let failed = 0;

    for (const item of strategies) {
      try {
        await prisma.strategy.create({
          data: {
            title: item.title,
            description: item.description || '',
            year: item.year || new Date().getFullYear(),
            startDate: new Date(item.startDate || new Date()),
            endDate: new Date(item.endDate || new Date()),
            status: item.status || 'draft',
            progress: item.progress || 0,
            createdById: req.user!.id,
          },
        });
        imported++;
      } catch (e) {
        failed++;
      }
    }

    res.json({
      success: true,
      message: `导入完成: 成功 ${imported} 条, 失败 ${failed} 条`,
      data: { imported, failed },
    });
  } catch (error) {
    console.error('Import strategies error:', error);
    res.status(500).json({
      success: false,
      error: '导入战略数据失败',
    });
  }
});

export default router;
