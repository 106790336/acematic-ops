import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

// 生成问题编号
const generateIssueNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `P${year}${month}`;
  
  const lastIssue = await prisma.issue.findFirst({
    where: { issueNumber: { startsWith: prefix } },
    orderBy: { issueNumber: 'desc' },
  });

  if (!lastIssue) {
    return `${prefix}0001`;
  }

  const lastNum = parseInt(lastIssue.issueNumber.slice(-4));
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
};

// 创建问题
const CreateIssueSchema = z.object({
  source: z.string(),
  discoveryDate: z.string(),
  departmentId: z.string(),
  description: z.string(),
  issueType: z.string(),
  severity: z.enum(['高', '中', '低']).default('中'),
  responsibleId: z.string().optional(),
  planCompleteDate: z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateIssueSchema.parse(req.body);
    
    const issueNumber = await generateIssueNumber();
    
    const issue = await prisma.issue.create({
      data: {
        ...data,
        issueNumber,
        discoveryDate: new Date(data.discoveryDate),
        planCompleteDate: data.planCompleteDate ? new Date(data.planCompleteDate) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: issue });
  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({ success: false, error: '创建问题失败' });
  }
});

// 获取问题列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { departmentId, status, severity, search, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    
    if (search) {
      where.OR = [
        { description: { contains: search as string, mode: 'insensitive' } },
        { issueNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // 非CEO只能看自己部门的问题
    if (req.user!.role === 'employee' || req.user!.role === 'manager') {
      where.OR = [
        { departmentId: req.user!.departmentId },
        { responsibleId: req.user!.id },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          department: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true } },
          _count: { select: { measures: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.issue.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: issues.map(i => ({ ...i, measureCount: i._count.measures })),
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ success: false, error: '获取问题列表失败' });
  }
});

// 获取预警问题
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const issues = await prisma.issue.findMany({
      where: {
        status: { in: ['待处理', '处理中'] },
        severity: '高',
      },
      include: {
        department: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
      orderBy: { discoveryDate: 'asc' },
      take: 10,
    });

    res.json({ success: true, data: issues });
  } catch (error) {
    console.error('Get issue alerts error:', error);
    res.status(500).json({ success: false, error: '获取预警问题失败' });
  }
});

// 获取单个问题
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        measures: {
          include: {
            responsible: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!issue) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    res.json({ success: true, data: issue });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ success: false, error: '获取问题详情失败' });
  }
});

// 更新问题
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const issue = await prisma.issue.update({
      where: { id },
      data: {
        ...data,
        discoveryDate: data.discoveryDate ? new Date(data.discoveryDate) : undefined,
        planCompleteDate: data.planCompleteDate ? new Date(data.planCompleteDate) : undefined,
        actualCompleteDate: data.actualCompleteDate ? new Date(data.actualCompleteDate) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: issue });
  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({ success: false, error: '更新问题失败' });
  }
});

// 删除问题
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.issue.delete({ where: { id } });
    res.json({ success: true, message: '问题已删除' });
  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({ success: false, error: '删除问题失败' });
  }
});

export default router;
