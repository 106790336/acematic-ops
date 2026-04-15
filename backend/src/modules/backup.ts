import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 获取所有数据（备份）
router.get('/export', roleMiddleware('ceo', 'executive'), async (req: Request, res: Response) => {
  try {
    const [users, departments, strategies, plans, tasks, assessments, roles, permissions, brand] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, username: true, name: true, role: true, roleId: true,
          departmentId: true, position: true, email: true, phone: true, isActive: true,
        },
      }),
      prisma.department.findMany(),
      prisma.strategy.findMany(),
      prisma.plan.findMany(),
      prisma.task.findMany({
        select: {
          id: true, taskNumber: true, title: true, description: true, status: true,
          progress: true, priority: true, sourceType: true, assigneeId: true,
          assignerId: true, planId: true, dueDate: true, createdAt: true,
        },
      }),
      prisma.assessment.findMany(),
      prisma.role.findMany({
        include: { permissions: { include: { permission: true } } },
      }),
      prisma.permission.findMany(),
      prisma.brandConfig.findFirst(),
    ]);

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        users,
        departments,
        strategies,
        plans,
        tasks,
        assessments,
        roles,
        permissions,
        brand,
      },
    };

    res.json({
      success: true,
      data: backup,
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, error: '数据备份失败' });
  }
});

// 导入数据（还原）
router.post('/import', roleMiddleware('ceo'), async (req: Request, res: Response) => {
  try {
    const { data, options } = req.body;
    
    if (!data) {
      return res.status(400).json({ success: false, error: '无效的备份数据' });
    }

    const results: any = {};
    const skipExisting = options?.skipExisting || false;

    // 导入部门
    if (data.departments && options?.departments !== false) {
      let count = 0;
      for (const dept of data.departments) {
        try {
          if (skipExisting) {
            const existing = await prisma.department.findUnique({ where: { id: dept.id } });
            if (existing) continue;
          }
          await prisma.department.upsert({
            where: { id: dept.id },
            update: { name: dept.name, parentId: dept.parentId },
            create: dept,
          });
          count++;
        } catch (e) { /* skip */ }
      }
      results.departments = count;
    }

    // 导入角色
    if (data.roles && options?.roles !== false) {
      let count = 0;
      for (const role of data.roles) {
        try {
          await prisma.role.upsert({
            where: { id: role.id },
            update: { name: role.name, label: role.label, description: role.description, level: role.level },
            create: {
              id: role.id,
              name: role.name,
              label: role.label,
              description: role.description,
              level: role.level,
              isSystem: role.isSystem || false,
            },
          });
          count++;
        } catch (e) { /* skip */ }
      }
      results.roles = count;
    }

    // 导入用户
    if (data.users && options?.users !== false) {
      let count = 0;
      for (const user of data.users) {
        try {
          if (skipExisting) {
            const existing = await prisma.user.findUnique({ where: { id: user.id } });
            if (existing) continue;
          }
          // 使用默认密码
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash('123456', 10);
          await prisma.user.upsert({
            where: { id: user.id },
            update: { name: user.name, role: user.role, departmentId: user.departmentId, position: user.position },
            create: {
              id: user.id,
              username: user.username,
              password: hashedPassword,
              name: user.name,
              role: user.role,
              departmentId: user.departmentId,
              position: user.position,
              email: user.email,
              phone: user.phone,
              isActive: user.isActive,
            },
          });
          count++;
        } catch (e) { /* skip */ }
      }
      results.users = count;
    }

    // 导入战略
    if (data.strategies && options?.strategies !== false) {
      let count = 0;
      for (const strategy of data.strategies) {
        try {
          await prisma.strategy.upsert({
            where: { id: strategy.id },
            update: { title: strategy.title, description: strategy.description, status: strategy.status },
            create: strategy,
          });
          count++;
        } catch (e) { /* skip */ }
      }
      results.strategies = count;
    }

    // 导入计划
    if (data.plans && options?.plans !== false) {
      let count = 0;
      for (const plan of data.plans) {
        try {
          await prisma.plan.upsert({
            where: { id: plan.id },
            update: { title: plan.title, progress: plan.progress, status: plan.status },
            create: plan,
          });
          count++;
        } catch (e) { /* skip */ }
      }
      results.plans = count;
    }

    // 导入任务
    if (data.tasks && options?.tasks !== false) {
      let count = 0;
      for (const task of data.tasks) {
        try {
          await prisma.task.upsert({
            where: { id: task.id },
            update: { title: task.title, progress: task.progress, status: task.status },
            create: task,
          });
          count++;
        } catch (e) { /* skip */ }
      }
      results.tasks = count;
    }

    // 导入品牌配置
    if (data.brand && options?.brand !== false) {
      try {
        await prisma.brandConfig.upsert({
          where: { id: data.brand.id },
          update: data.brand,
          create: data.brand,
        });
        results.brand = 1;
      } catch (e) { /* skip */ }
    }

    res.json({
      success: true,
      message: '数据还原完成',
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, error: '数据还原失败' });
  }
});

// 重置数据库（危险操作）
router.post('/reset', roleMiddleware('ceo'), async (req: Request, res: Response) => {
  try {
    // 仅保留 CEO 用户
    const ceo = await prisma.user.findFirst({ where: { role: 'ceo' } });
    
    // 删除大部分数据
    await prisma.task.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.strategy.deleteMany({});
    await prisma.department.deleteMany({});
    
    res.json({
      success: true,
      message: '数据库已重置',
    });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ success: false, error: '重置失败' });
  }
});

export default router;
