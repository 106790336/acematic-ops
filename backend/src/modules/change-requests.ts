import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// 创建变更申请
const CreateChangeRequestSchema = z.object({
  entityType: z.enum(['strategy', 'plan', 'task']),
  entityId: z.string(),
  requestType: z.enum(['modify', 'cancel']),
  reason: z.string(),
  newData: z.record(z.any()), // 变更后的数据
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateChangeRequestSchema.parse(req.body);
    
    // 获取原数据
    let oldData: any = null;
    if (data.entityType === 'strategy') {
      oldData = await prisma.strategy.findUnique({ where: { id: data.entityId } });
    } else if (data.entityType === 'plan') {
      oldData = await prisma.plan.findUnique({ where: { id: data.entityId } });
    } else if (data.entityType === 'task') {
      oldData = await prisma.task.findUnique({ where: { id: data.entityId } });
    }

    if (!oldData) {
      return res.status(404).json({ success: false, error: '内容不存在' });
    }

    // 检查状态（只有active状态才能申请变更）
    if (oldData.status !== 'active' && oldData.status !== 'in_progress') {
      return res.status(400).json({ success: false, error: '当前状态不允许申请变更' });
    }

    const changeRequest = await prisma.changeRequest.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        requestType: data.requestType,
        requesterId: req.user!.id,
        reason: data.reason,
        oldData: JSON.stringify(oldData),
        newData: JSON.stringify(data.newData),
        status: 'pending',
      },
    });

    res.json({ success: true, data: changeRequest });
  } catch (error) {
    console.error('Create change request error:', error);
    res.status(500).json({ success: false, error: '创建变更申请失败' });
  }
});

// 获取变更申请列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, entityType, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;

    // 非高管只能看自己的申请
    if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      where.requesterId = req.user!.id;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      prisma.changeRequest.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          requester: { select: { id: true, name: true, department: { select: { name: true } } } },
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.changeRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    console.error('Get change requests error:', error);
    res.status(500).json({ success: false, error: '获取变更申请列表失败' });
  }
});

// 获取待审核的变更申请数量
router.get('/pending-count', async (req: Request, res: Response) => {
  try {
    // 只有高管以上可以审核
    if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.json({ success: true, data: 0 });
    }

    const count = await prisma.changeRequest.count({
      where: { status: 'pending' },
    });

    res.json({ success: true, data: count });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ success: false, error: '获取待审核数量失败' });
  }
});

// 审核变更申请
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    // 只有高管以上可以审核
    if (req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.status(403).json({ success: false, error: '无权限审核变更申请' });
    }

    const changeRequest = await prisma.changeRequest.findUnique({ where: { id } });
    if (!changeRequest) {
      return res.status(404).json({ success: false, error: '变更申请不存在' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ success: false, error: '该申请已处理' });
    }

    // 更新变更申请状态
    const updated = await prisma.changeRequest.update({
      where: { id },
      data: {
        status: approved ? 'approved' : 'rejected',
        reviewerId: req.user!.id,
        reviewComment: comment,
        reviewedAt: new Date(),
      },
    });

    // 如果通过，应用变更
    if (approved) {
      const newData = JSON.parse(changeRequest.newData);
      const entityType = changeRequest.entityType;
      const entityId = changeRequest.entityId;

      // 获取当前版本号
      const lastVersion = await prisma.contentVersion.findFirst({
        where: { entityType, entityId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (lastVersion?.version || 0) + 1;

      // 保存版本历史
      if (entityType === 'strategy') {
        const current = await prisma.strategy.findUnique({ where: { id: entityId } });
        if (current) {
          await prisma.contentVersion.create({
            data: {
              entityType,
              entityId,
              version: nextVersion,
              data: JSON.stringify(current),
              changedBy: req.user!.id,
              changeReason: changeRequest.reason,
              changeRequestId: id,
            },
          });
        }
        await prisma.strategy.update({
          where: { id: entityId },
          data: { ...newData, updatedAt: new Date() },
        });
      } else if (entityType === 'plan') {
        const current = await prisma.plan.findUnique({ where: { id: entityId } });
        if (current) {
          await prisma.contentVersion.create({
            data: {
              entityType,
              entityId,
              version: nextVersion,
              data: JSON.stringify(current),
              changedBy: req.user!.id,
              changeReason: changeRequest.reason,
              changeRequestId: id,
            },
          });
        }
        await prisma.plan.update({
          where: { id: entityId },
          data: { ...newData, updatedAt: new Date() },
        });
      } else if (entityType === 'task') {
        const current = await prisma.task.findUnique({ where: { id: entityId } });
        if (current) {
          await prisma.contentVersion.create({
            data: {
              entityType,
              entityId,
              version: nextVersion,
              data: JSON.stringify(current),
              changedBy: req.user!.id,
              changeReason: changeRequest.reason,
              changeRequestId: id,
            },
          });
        }
        await prisma.task.update({
          where: { id: entityId },
          data: { ...newData, updatedAt: new Date() },
        });
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Review change request error:', error);
    res.status(500).json({ success: false, error: '审核失败' });
  }
});

// 撤回变更申请
router.post('/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const changeRequest = await prisma.changeRequest.findUnique({ where: { id } });
    if (!changeRequest) {
      return res.status(404).json({ success: false, error: '变更申请不存在' });
    }

    if (changeRequest.requesterId !== req.user!.id) {
      return res.status(403).json({ success: false, error: '只能撤回自己的申请' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ success: false, error: '该申请已处理，无法撤回' });
    }

    await prisma.changeRequest.delete({ where: { id } });

    res.json({ success: true, message: '已撤回' });
  } catch (error) {
    console.error('Withdraw change request error:', error);
    res.status(500).json({ success: false, error: '撤回失败' });
  }
});

// 获取实体的版本历史
router.get('/versions/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    const versions = await prisma.contentVersion.findMany({
      where: { entityType, entityId },
      include: {
        changer: { select: { id: true, name: true } },
      },
      orderBy: { version: 'desc' },
      take: 10,
    });

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ success: false, error: '获取版本历史失败' });
  }
});

export default router;
