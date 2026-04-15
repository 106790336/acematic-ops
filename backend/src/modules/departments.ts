import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { CreateDepartmentSchema, UpdateDepartmentSchema } from '../types';

const router = Router();

router.use(authMiddleware);

// 获取部门列表（树形结构）
router.get('/', async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 获取所有部门负责人的信息
    const managerIds = departments.filter(d => d.managerId).map(d => d.managerId);
    const managers = await prisma.user.findMany({
      where: { id: { in: managerIds as string[] } },
      select: { id: true, name: true },
    });
    const managerMap = new Map(managers.map(m => [m.id, m]));

    // 添加manager信息
    const departmentsWithManager = departments.map(d => ({
      ...d,
      memberCount: d._count.members,
      manager: d.managerId ? managerMap.get(d.managerId) || null : null,
    }));

    // 转换为树形结构
    const buildTree = (items: any[], parentId: string | null = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id),
        }));
    };

    const tree = buildTree(departmentsWithManager);

    res.json({
      success: true,
      data: tree,
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      error: '获取部门列表失败',
    });
  }
});

// 获取部门列表（扁平结构）
router.get('/list', async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 获取所有部门负责人的信息
    const managerIds = departments.filter(d => d.managerId).map(d => d.managerId);
    const managers = await prisma.user.findMany({
      where: { id: { in: managerIds as string[] } },
      select: { id: true, name: true },
    });
    const managerMap = new Map(managers.map(m => [m.id, m]));

    res.json({
      success: true,
      data: departments.map(d => ({
        ...d,
        memberCount: d._count.members,
        manager: d.managerId ? managerMap.get(d.managerId) || null : null,
      })),
    });
  } catch (error) {
    console.error('Get departments list error:', error);
    res.status(500).json({
      success: false,
      error: '获取部门列表失败',
    });
  }
});

// 获取单个部门
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            position: true,
            role: true,
          },
        },
        parent: {
          select: { id: true, name: true },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: '部门不存在',
      });
    }

    // 获取负责人信息
    let manager = null;
    if (department.managerId) {
      manager = await prisma.user.findUnique({
        where: { id: department.managerId },
        select: { id: true, name: true },
      });
    }

    res.json({
      success: true,
      data: {
        ...department,
        manager,
      },
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      success: false,
      error: '获取部门信息失败',
    });
  }
});

// 创建部门
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, parentId, managerId, description } = req.body;
    
    const department = await prisma.department.create({
      data: {
        name,
        parentId: parentId || null,
        managerId: managerId || null,
        description: description || null,
      },
    });

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      error: '创建部门失败',
    });
  }
});

// 更新部门
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, parentId, managerId, description } = req.body;
    
    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        parentId: parentId || null,
        managerId: managerId || null,
        description: description || null,
      },
    });

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      error: '更新部门失败',
    });
  }
});

// 删除部门
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查是否有子部门
    const children = await prisma.department.count({
      where: { parentId: id },
    });

    if (children > 0) {
      return res.status(400).json({
        success: false,
        error: '该部门下存在子部门，无法删除',
      });
    }

    // 检查是否有成员
    const members = await prisma.user.count({
      where: { departmentId: id },
    });

    if (members > 0) {
      return res.status(400).json({
        success: false,
        error: '该部门下存在成员，无法删除',
      });
    }

    await prisma.department.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '部门已删除',
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      error: '删除部门失败',
    });
  }
});

export default router;
