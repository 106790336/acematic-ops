import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { CreateUserSchema, UpdateUserSchema } from '../types';
import bcrypt from 'bcryptjs';

const router = Router();

// 所有路由需要认证
router.use(authMiddleware);

// 导出用户数据 - 必须在 /:id 之前
router.get('/export/all', roleMiddleware('ceo', 'executive'), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        name: true,
        role: true,
        position: true,
        email: true,
        phone: true,
        department: { select: { name: true } },
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      error: '导出用户数据失败',
    });
  }
});

// 修改密码 - 必须在 /:id 之前
router.put('/:id/password', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    console.log('Password change request for user:', id, 'by:', req.user!.id);

    // 只能修改自己的密码，或者管理员可以修改任何人
    if (req.user!.id !== id && req.user!.role !== 'ceo' && req.user!.role !== 'executive') {
      return res.status(403).json({
        success: false,
        error: '无权限修改他人密码',
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少6位',
      });
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('Hashed password generated');

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    console.log('Password updated successfully for user:', id);

    res.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      error: '修改密码失败',
    });
  }
});

// 重置用户密码（管理员权限）- 必须在 /:id 之前
router.post('/:id/reset-password', roleMiddleware('ceo', 'executive'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const defaultPassword = '123456';

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: `密码已重置为: ${defaultPassword}`,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: '重置密码失败',
    });
  }
});

// 获取用户列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { departmentId, role, search, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    
    if (departmentId) {
      where.departmentId = departmentId as string;
    }
    
    if (role) {
      where.role = role as string;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { username: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          roleId: true,
          roleInfo: { select: { id: true, name: true, label: true } },
          departmentId: true,
          department: {
            select: { id: true, name: true },
          },
          position: true,
          avatar: true,
          email: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: users,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户列表失败',
    });
  }
});

// 获取单个用户
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true },
        },
        roleInfo: { select: { id: true, name: true, label: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      });
    }

    const { password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败',
    });
  }
});

// 创建用户（需要管理员权限）
router.post('/', roleMiddleware('ceo', 'executive'), validateRequest(CreateUserSchema), async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, departmentId, position, email, phone } = req.body;

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '用户名已存在',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role,
        departmentId,
        position,
        email,
        phone,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: '创建用户失败',
    });
  }
});

// 更新用户
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // 如果更新用户名，检查是否已存在
    if (updateData.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: updateData.username,
          NOT: { id },
        },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: '用户名已存在',
        });
      }
    }

    // 如果更新密码，需要加密
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: '更新用户失败',
    });
  }
});

// 删除用户（需要CEO权限）
router.delete('/:id', roleMiddleware('ceo'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '用户已删除',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: '删除用户失败',
    });
  }
});

export default router;
