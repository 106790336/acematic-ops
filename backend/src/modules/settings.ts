import { Router, Request, Response } from 'express';
import express from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// 文件上传配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'favicon' ? 'favicon' : 'logo';
    cb(null, `${prefix}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持 PNG/JPG/SVG/ICO/WebP 格式'));
  },
});

// 品牌配置 - 公开访问（登录页也需要）
router.get('/brand', async (req: Request, res: Response) => {
  try {
    let brand = await prisma.brandConfig.findFirst();
    if (!brand) {
      brand = await prisma.brandConfig.create({ data: {} });
    }
    res.json({ success: true, data: brand });
  } catch (error) {
    console.error('Get brand error:', error);
    res.status(500).json({ success: false, error: '获取品牌配置失败' });
  }
});

// 静态文件服务 - 上传的Logo/Favicon（公开访问）
router.use('/files', express.static(path.join(process.cwd(), 'uploads')));

// 以下需要认证
router.use(authMiddleware);

// ========== 角色管理 ==========

// 获取所有角色
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { permissions: true, users: true } },
      },
      orderBy: { level: 'asc' },
    });
    res.json({ success: true, data: roles.map(r => ({ ...r, permissionCount: r._count.permissions, userCount: r._count.users })) });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, error: '获取角色列表失败' });
  }
});

// 创建角色
router.post('/roles', async (req: Request, res: Response) => {
  try {
    const { name, label, description, level } = req.body;
    if (!name || !label) {
      return res.status(400).json({ success: false, error: '角色名称和显示名称必填' });
    }
    const role = await prisma.role.create({
      data: { name, label, description, level: level || 99, isSystem: false },
    });
    res.json({ success: true, data: role });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: '角色名称已存在' });
    } else {
      res.status(500).json({ success: false, error: '创建角色失败' });
    }
  }
});

// 更新角色
router.put('/roles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, label, description, level } = req.body;
    const role = await prisma.role.update({
      where: { id },
      data: { name, label, description, level },
    });
    res.json({ success: true, data: role });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: '角色名称已存在' });
    } else {
      res.status(500).json({ success: false, error: '更新角色失败' });
    }
  }
});

// 删除角色
router.delete('/roles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return res.status(404).json({ success: false, error: '角色不存在' });
    if (role.isSystem) return res.status(400).json({ success: false, error: '系统内置角色不可删除' });
    
    // 检查是否有用户使用该角色
    const userCount = await prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      return res.status(400).json({ success: false, error: `该角色下有 ${userCount} 个用户，无法删除` });
    }
    
    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: '角色已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: '删除角色失败' });
  }
});

// 获取角色的权限
router.get('/roles/:id/permissions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: id },
      include: { permission: true },
    });
    res.json({ success: true, data: rolePerms.map(rp => rp.permission) });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取角色权限失败' });
  }
});

// 设置角色权限
router.post('/roles/:id/permissions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    // 删除旧权限
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });

    // 添加新权限
    if (permissionIds && permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((pid: string) => ({ roleId: id, permissionId: pid })),
      });
    }

    res.json({ success: true, message: '权限设置成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: '设置角色权限失败' });
  }
});

// ========== 权限管理 ==========

// 获取所有权限
router.get('/permissions', async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { name: 'asc' }] });
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, error: '获取权限列表失败' });
  }
});

// 创建权限
router.post('/permissions', async (req: Request, res: Response) => {
  try {
    const { code, name, module, description } = req.body;
    const perm = await prisma.permission.create({
      data: { code, name, module, description },
    });
    res.json({ success: true, data: perm });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.json({ success: true, message: '权限已存在' });
    } else {
      res.status(500).json({ success: false, error: '创建权限失败' });
    }
  }
});

// 获取角色权限（旧API兼容）
router.get('/role-permissions/:roleId', async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    res.json({ success: true, data: rolePerms.map(rp => rp.permission) });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ success: false, error: '获取角色权限失败' });
  }
});

// 设置角色权限（旧API兼容）
router.post('/role-permissions/:roleId', async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body; // string[]

    // 删除旧权限
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    // 添加新权限
    if (permissionIds && permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((pid: string) => ({ roleId, permissionId: pid })),
      });
    }

    res.json({ success: true, message: '权限设置成功' });
  } catch (error) {
    console.error('Set role permissions error:', error);
    res.status(500).json({ success: false, error: '设置角色权限失败' });
  }
});

// 获取当前用户的权限
router.get('/my-permissions', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { roleInfo: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user?.roleInfo) {
      return res.json({ success: true, data: [] });
    }
    const permissions = user.roleInfo.permissions.map(rp => rp.permission.code);
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ success: false, error: '获取权限失败' });
  }
});

// ========== 品牌配置 ==========

// 更新品牌配置（需要管理员权限）
router.put('/brand', async (req: Request, res: Response) => {
  try {
    const userRole = req.user!.role;
    if (userRole !== 'ceo' && userRole !== 'executive') {
      return res.status(403).json({ success: false, error: '无权限修改品牌配置' });
    }

    let brand = await prisma.brandConfig.findFirst();
    if (!brand) {
      brand = await prisma.brandConfig.create({ data: req.body });
    } else {
      brand = await prisma.brandConfig.update({
        where: { id: brand.id },
        data: req.body,
      });
    }
    res.json({ success: true, data: brand });
  } catch (error) {
    console.error('Update brand error:', error);
    res.status(500).json({ success: false, error: '更新品牌配置失败' });
  }
});

// 上传Logo
router.post('/upload/logo', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请选择文件' });
    const url = `/api/settings/files/${req.file.filename}`;
    res.json({ success: true, data: { url, filename: req.file.filename } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '上传失败' });
  }
});

// 上传Favicon
router.post('/upload/favicon', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '请选择文件' });
    const url = `/api/settings/files/${req.file.filename}`;
    res.json({ success: true, data: { url, filename: req.file.filename } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || '上传失败' });
  }
});

// ========== 系统配置 ==========

router.get('/config/:key', async (req: Request, res: Response) => {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: req.params.key } });
    res.json({ success: true, data: config?.value || null });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ success: false, error: '获取配置失败' });
  }
});

router.put('/config/:key', async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    const config = await prisma.systemConfig.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value },
    });
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Set config error:', error);
    res.status(500).json({ success: false, error: '设置配置失败' });
  }
});

export default router;
