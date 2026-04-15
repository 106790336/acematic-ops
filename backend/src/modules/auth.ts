import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { LoginSchema, CreateUserSchema } from '../types';
import { env } from '../config/env';

const router = Router();

// 生成JWT Token
const generateToken = (user: { id: string; username: string; role: string; departmentId?: string | null }) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.departmentId,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 登录
router.post('/login', validateRequest(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // 查找用户（包含部门信息）
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        department: {
          select: { id: true, name: true },
        },
        roleInfo: {
          select: { id: true, name: true, label: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误',
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误',
      });
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 生成token
    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          roleId: user.roleId,
          roleInfo: user.roleInfo,
          departmentId: user.departmentId,
          department: user.department,
          position: user.position,
          avatar: user.avatar,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试',
    });
  }
});

// 获取当前用户信息
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        roleInfo: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleId: user.roleId,
        roleInfo: user.roleInfo,
        departmentId: user.departmentId,
        department: user.department,
        position: user.position,
        avatar: user.avatar,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败',
    });
  }
});

// 登出
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '登出成功',
  });
});

// 注册用户（仅用于初始化）
router.post('/register', validateRequest(CreateUserSchema), async (req: Request, res: Response) => {
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

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
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

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: '注册失败',
    });
  }
});

export default router;
