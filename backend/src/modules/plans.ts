import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 获取计划列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status, departmentId, strategyId, search, page = 1, limit = 10 } = req.query;
    
    const where: any = {};
    if (type) where.type = type as string;
    if (status) where.status = status as string;
    if (departmentId) where.departmentId = departmentId as string;
    if (strategyId) where.strategyId = strategyId as string;
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // 非高管只能看到自己的计划、部门计划、已生效的计划
    if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      where.OR = [
        { ownerId: req.user!.id },
        { departmentId: req.user!.departmentId },
        { status: 'active' },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where, skip, take: Number(limit),
        include: {
          department: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          submittedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          strategy: { select: { id: true, title: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.plan.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: plans.map(p => ({ ...p, taskCount: p._count.tasks })),
        total, page: Number(page), limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ success: false, error: '获取计划列表失败' });
  }
});

// 获取计划详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, position: true } },
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        strategy: { select: { id: true, title: true } },
        tasks: { include: { assignee: { select: { id: true, name: true } } } },
      },
    });
    if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ success: false, error: '获取计划信息失败' });
  }
});

// 创建计划（草稿）
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, type, strategyId, departmentId, startDate, endDate, priority } = req.body;
    
    // 检查权限：公司计划只有高管可创建，部门计划经理可创建，个人计划所有人可创建
    if (type === 'company' && req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.status(403).json({ success: false, error: '只有高管可以创建公司计划' });
    }
    
    const plan = await prisma.plan.create({
      data: {
        title, description,
        type: type || 'personal',
        strategyId: strategyId || null,
        departmentId: departmentId || null,
        ownerId: req.user!.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        priority: priority || 'medium',
        status: 'draft',
        progress: 0,
      },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ success: false, error: '创建计划失败' });
  }
});

// 更新计划（仅草稿可编辑）
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, type, strategyId, departmentId, startDate, endDate, priority } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });

    // 检查权限
    if (plan.ownerId !== req.user!.id && req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.status(403).json({ success: false, error: '无权限编辑此计划' });
    }

    // 只有草稿可编辑
    if (plan.status !== 'draft') {
      return res.status(400).json({ success: false, error: '当前状态不允许直接编辑，请提交变更申请' });
    }
    
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (strategyId !== undefined) updateData.strategyId = strategyId || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (priority !== undefined) updateData.priority = priority;
    
    const updated = await prisma.plan.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ success: false, error: '更新计划失败' });
  }
});

// 提交审核
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });
    if (plan.status !== 'draft') return res.status(400).json({ success: false, error: '只有草稿状态可以提交审核' });
    if (plan.ownerId !== req.user!.id && req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.status(403).json({ success: false, error: '无权限提交此计划' });
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: { status: 'pending', submittedAt: new Date(), submittedById: req.user!.id },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Submit plan error:', error);
    res.status(500).json({ success: false, error: '提交审核失败' });
  }
});

// 撤回审核
router.post('/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });
    if (plan.status !== 'pending') return res.status(400).json({ success: false, error: '只有待审核状态可以撤回' });
    if (plan.submittedById !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限撤回此计划' });
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: { status: 'draft', submittedAt: null, submittedById: null },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Withdraw plan error:', error);
    res.status(500).json({ success: false, error: '撤回失败' });
  }
});

// 审核计划
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });
    if (plan.status !== 'pending') return res.status(400).json({ success: false, error: '只有待审核状态可以审核' });

    // 审核权限：公司计划CEO审核，部门计划高管审核，个人计划经理审核
    let canReview = false;
    if (plan.type === 'company' && req.user!.role === 'ceo') canReview = true;
    if (plan.type === 'department' && (req.user!.role === 'ceo' || req.user!.role === 'executive')) canReview = true;
    if (plan.type === 'personal' && (req.user!.role === 'ceo' || req.user!.role === 'executive' || req.user!.role === 'manager')) canReview = true;

    if (!canReview) return res.status(403).json({ success: false, error: '无权限审核此计划' });

    const updated = await prisma.plan.update({
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
    console.error('Review plan error:', error);
    res.status(500).json({ success: false, error: '审核失败' });
  }
});

// 删除计划（仅草稿可删除）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });
    if (plan.status !== 'draft') return res.status(400).json({ success: false, error: '只有草稿状态可以删除' });
    if (plan.ownerId !== req.user!.id && req.user!.role !== 'ceo') {
      return res.status(403).json({ success: false, error: '无权限删除此计划' });
    }

    // 检查是否有关联任务
    const taskCount = await prisma.task.count({ where: { planId: id } });
    if (taskCount > 0) return res.status(400).json({ success: false, error: '该计划下存在关联任务，无法删除' });

    await prisma.plan.delete({ where: { id } });
    res.json({ success: true, message: '计划已删除' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ success: false, error: '删除计划失败' });
  }
});

// 导出计划数据
router.get('/export/all', roleMiddleware('ceo', 'executive'), async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        strategy: { select: { title: true } },
        department: { select: { name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Export plans error:', error);
    res.status(500).json({ success: false, error: '导出计划数据失败' });
  }
});

export default router;
