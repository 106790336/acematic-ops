import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// OKR编号系统
// O = Objective (战略目标)
// K = Key Result (工作计划)
// T = Task (任务)

async function main() {
  console.log('开始重置并导入数据...');

  // 清空现有数据
  await prisma.taskExecution.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.taskSource.deleteMany();
  await prisma.task.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  console.log('数据已清空');

  // ========== 创建角色 ==========
  const roles = await Promise.all([
    prisma.role.create({ data: { name: 'ceo', label: 'CEO', description: '首席执行官', isSystem: true, level: 0 } }),
    prisma.role.create({ data: { name: 'executive', label: '高管', description: '公司高管', isSystem: true, level: 1 } }),
    prisma.role.create({ data: { name: 'manager', label: '经理', description: '部门经理', isSystem: true, level: 2 } }),
    prisma.role.create({ data: { name: 'employee', label: '员工', description: '普通员工', isSystem: true, level: 3 } }),
  ]);
  const [roleCeo, roleExecutive, roleManager, roleEmployee] = roles;
  console.log(`创建 ${roles.length} 个角色`);

  // ========== 创建权限 ==========
  const permissions = await Promise.all([
    prisma.permission.create({ data: { code: 'dashboard:view', name: '查看看板', module: 'dashboard' } }),
    prisma.permission.create({ data: { code: 'strategy:view', name: '查看战略', module: 'strategy' } }),
    prisma.permission.create({ data: { code: 'strategy:edit', name: '编辑战略', module: 'strategy' } }),
    prisma.permission.create({ data: { code: 'plan:view', name: '查看计划', module: 'plan' } }),
    prisma.permission.create({ data: { code: 'plan:edit', name: '编辑计划', module: 'plan' } }),
    prisma.permission.create({ data: { code: 'task:view', name: '查看任务', module: 'task' } }),
    prisma.permission.create({ data: { code: 'task:edit', name: '编辑任务', module: 'task' } }),
    prisma.permission.create({ data: { code: 'execution:view', name: '查看日志', module: 'execution' } }),
    prisma.permission.create({ data: { code: 'execution:edit', name: '填写日志', module: 'execution' } }),
    prisma.permission.create({ data: { code: 'assessment:view', name: '查看考核', module: 'assessment' } }),
    prisma.permission.create({ data: { code: 'assessment:edit', name: '评分/计算', module: 'assessment' } }),
    prisma.permission.create({ data: { code: 'report:view', name: '查看报告', module: 'report' } }),
    prisma.permission.create({ data: { code: 'report:edit', name: '编辑报告', module: 'report' } }),
    prisma.permission.create({ data: { code: 'issue:view', name: '查看问题', module: 'issue' } }),
    prisma.permission.create({ data: { code: 'issue:edit', name: '编辑问题', module: 'issue' } }),
    prisma.permission.create({ data: { code: 'org:view', name: '查看组织', module: 'org' } }),
    prisma.permission.create({ data: { code: 'org:edit', name: '编辑组织', module: 'org' } }),
    prisma.permission.create({ data: { code: 'settings:view', name: '查看设置', module: 'settings' } }),
    prisma.permission.create({ data: { code: 'settings:edit', name: '编辑设置', module: 'settings' } }),
    prisma.permission.create({ data: { code: 'role:view', name: '查看角色', module: 'role' } }),
    prisma.permission.create({ data: { code: 'role:edit', name: '编辑角色', module: 'role' } }),
  ]);
  console.log(`创建 ${permissions.length} 个权限`);

  // ========== 分配角色权限 ==========
  // CEO 拥有所有权限
  for (const p of permissions) {
    await prisma.rolePermission.create({ data: { roleId: roleCeo.id, permissionId: p.id } });
  }
  // 高管权限（除系统设置编辑、角色管理编辑）
  for (const p of permissions.filter(x => !['settings:edit', 'role:view', 'role:edit'].includes(x.code))) {
    await prisma.rolePermission.create({ data: { roleId: roleExecutive.id, permissionId: p.id } });
  }
  // 经理权限
  const managerPerms = permissions.filter(x => ['dashboard:view', 'strategy:view', 'plan:view', 'plan:edit', 'task:view', 'task:edit', 'execution:view', 'execution:edit', 'assessment:view', 'report:view', 'report:edit', 'issue:view', 'issue:edit', 'org:view'].includes(x.code));
  for (const p of managerPerms) {
    await prisma.rolePermission.create({ data: { roleId: roleManager.id, permissionId: p.id } });
  }
  // 员工权限
  const employeePerms = permissions.filter(x => ['dashboard:view', 'task:view', 'execution:view', 'execution:edit', 'assessment:view'].includes(x.code));
  for (const p of employeePerms) {
    await prisma.rolePermission.create({ data: { roleId: roleEmployee.id, permissionId: p.id } });
  }
  console.log('角色权限分配完成');

  // ========== 创建三级组织架构 ==========
  // 一级部门
  const deptCEO = await prisma.department.create({ data: { name: '总经办', description: '公司最高管理层', memberCount: 2 } });
  const deptProduct = await prisma.department.create({ data: { name: '产品中心', description: '负责产品研发与创新', memberCount: 5 } });
  const deptOps = await prisma.department.create({ data: { name: '运营中心', description: '负责公司运营管理', memberCount: 3 } });
  const deptSales = await prisma.department.create({ data: { name: '营销中心', description: '负责市场营销与渠道', memberCount: 4 } });

  // 二级部门
  const deptTech = await prisma.department.create({ data: { name: '研发部', description: '负责产品技术研发', parentId: deptProduct.id, memberCount: 3 } });
  const deptProductMgmt = await prisma.department.create({ data: { name: '产品管理部', description: '负责产品规划与设计', parentId: deptProduct.id, memberCount: 2 } });
  const deptSolution = await prisma.department.create({ data: { name: '解决方案部', description: '负责行业解决方案', parentId: deptSales.id, memberCount: 2 } });
  const deptChannel = await prisma.department.create({ data: { name: '渠道发展部', description: '负责渠道建设与管理', parentId: deptSales.id, memberCount: 2 } });
  const deptAdmin = await prisma.department.create({ data: { name: '行政人事部', description: '负责人事行政', parentId: deptOps.id, memberCount: 1 } });
  const deptOpsMgmt = await prisma.department.create({ data: { name: '运营管理部', description: '负责业务流程优化', parentId: deptOps.id, memberCount: 1 } });

  // 三级部门
  const deptFirmware = await prisma.department.create({ data: { name: '固件开发组', description: '嵌入式固件开发', parentId: deptTech.id, memberCount: 2 } });
  const deptSoftware = await prisma.department.create({ data: { name: '软件开发组', description: '软件平台开发', parentId: deptTech.id, memberCount: 1 } });

  console.log(`创建 ${12} 个部门（三级架构）`);

  // ========== 创建用户 ==========
  const passwordHash = await bcrypt.hash('123456', 10);
  const users = await Promise.all([
    prisma.user.create({ data: { username: 'ceo', password: passwordHash, name: '张总', role: 'ceo', roleId: roleCeo.id, departmentId: deptCEO.id, position: 'CEO' } }),
    prisma.user.create({ data: { username: 'assistant', password: passwordHash, name: '李助理', role: 'executive', roleId: roleExecutive.id, departmentId: deptCEO.id, position: '总经理助理' } }),
    prisma.user.create({ data: { username: 'product_director', password: passwordHash, name: '王产品总监', role: 'executive', roleId: roleExecutive.id, departmentId: deptProduct.id, position: '产品总监' } }),
    prisma.user.create({ data: { username: 'pm1', password: passwordHash, name: '陈产品经理', role: 'manager', roleId: roleManager.id, departmentId: deptProductMgmt.id, position: '产品经理' } }),
    prisma.user.create({ data: { username: 'pm2', password: passwordHash, name: '刘产品经理', role: 'manager', roleId: roleManager.id, departmentId: deptProductMgmt.id, position: '产品经理' } }),
    prisma.user.create({ data: { username: 'ops_director', password: passwordHash, name: '赵运营总监', role: 'executive', roleId: roleExecutive.id, departmentId: deptOps.id, position: '运营总监' } }),
    prisma.user.create({ data: { username: 'ops_staff', password: passwordHash, name: '孙运营专员', role: 'employee', roleId: roleEmployee.id, departmentId: deptAdmin.id, position: '人事专员' } }),
    prisma.user.create({ data: { username: 'sales_director', password: passwordHash, name: '周营销总监', role: 'executive', roleId: roleExecutive.id, departmentId: deptSales.id, position: '营销总监' } }),
    prisma.user.create({ data: { username: 'sales_mgr', password: passwordHash, name: '吴销售经理', role: 'manager', roleId: roleManager.id, departmentId: deptChannel.id, position: '销售经理' } }),
    prisma.user.create({ data: { username: 'tech_director', password: passwordHash, name: '郑技术总监', role: 'executive', roleId: roleExecutive.id, departmentId: deptTech.id, position: '技术总监' } }),
    prisma.user.create({ data: { username: 'dev1', password: passwordHash, name: '钱工程师', role: 'employee', roleId: roleEmployee.id, departmentId: deptFirmware.id, position: '固件工程师' } }),
    prisma.user.create({ data: { username: 'dev2', password: passwordHash, name: '孙工程师', role: 'employee', roleId: roleEmployee.id, departmentId: deptFirmware.id, position: '固件工程师' } }),
    prisma.user.create({ data: { username: 'dev3', password: passwordHash, name: '李工程师', role: 'employee', roleId: roleEmployee.id, departmentId: deptSoftware.id, position: '软件工程师' } }),
    prisma.user.create({ data: { username: 'solution_mgr', password: passwordHash, name: '冯方案经理', role: 'manager', roleId: roleManager.id, departmentId: deptSolution.id, position: '方案经理' } }),
    prisma.user.create({ data: { username: 'solution_staff', password: passwordHash, name: '陈方案专员', role: 'employee', roleId: roleEmployee.id, departmentId: deptSolution.id, position: '方案专员' } }),
    prisma.user.create({ data: { username: 'sales_staff', password: passwordHash, name: '林渠道专员', role: 'employee', roleId: roleEmployee.id, departmentId: deptChannel.id, position: '渠道专员' } }),
  ]);

  const [ceo, assistant, productDirector, pm1, pm2, techDirector, dev1, dev2, dev3, opsDirector, opsStaff, salesDirector, solutionMgr, solutionStaff, salesMgr, salesStaff] = users;
  console.log(`创建 ${users.length} 个用户`);

  // ========== 创建战略目标 (O1-O4) ==========
  const O1 = await prisma.strategy.create({
    data: {
      title: '产品战略：锚定KNX+绿色节能，打造细分场景标杆产品',
      description: '智慧中控屏功能深度优化、府系产品迭代、智能面板传承更新、网关高性能升级、多模态传感器开发、能耗监测模块完善',
      year: 2026,
      status: 'active',
      progress: 15,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      createdById: ceo.id,
    }
  });

  const O2 = await prisma.strategy.create({
    data: {
      title: '解决方案战略：深耕大湾区，辐射核心城市群',
      description: '智慧康养、智能照明节能改造、智能家居、精品酒店智能等解决方案落地',
      year: 2026,
      status: 'active',
      progress: 20,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      createdById: ceo.id,
    }
  });

  const O3 = await prisma.strategy.create({
    data: {
      title: '市场战略：构建精准渠道网络，拓展行业垂直领域',
      description: '重点突破高端住宅、星级酒店、甲级写字楼；潜力市场养老机构智慧化改造',
      year: 2026,
      status: 'active',
      progress: 10,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      createdById: ceo.id,
    }
  });

  const O4 = await prisma.strategy.create({
    data: {
      title: '组织战略：优化架构，提升响应速度',
      description: '增设智慧社区事业部，建立铁三角团队，引入乐高式解决方案配置器',
      year: 2026,
      status: 'active',
      progress: 5,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      createdById: ceo.id,
    }
  });

  console.log('创建战略目标 O1-O4');

  // ========== 创建工作计划 (K1.1, K1.2...) ==========
  // O1 产品战略 的计划
  const K1_1 = await prisma.plan.create({
    data: {
      title: 'K1.1 智慧中控屏优化计划',
      description: 'AI语音交互、同步主机数据、多场景自定义UI',
      type: 'department',
      strategyId: O1.id,
      departmentId: deptProduct.id,
      ownerId: productDirector.id,
      status: 'in_progress',
      progress: 30,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    }
  });

  const K1_2 = await prisma.plan.create({
    data: {
      title: 'K1.2 府系产品迭代计划',
      description: 'RK3566平台、SIP支持自有系统、鸿蒙智慧屏预研',
      type: 'department',
      strategyId: O1.id,
      departmentId: deptTech.id,
      ownerId: techDirector.id,
      status: 'pending',
      progress: 10,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
    }
  });

  const K1_3 = await prisma.plan.create({
    data: {
      title: 'K1.3 智能面板开发计划',
      description: '传承面板更新、云河系列面板、屏的免编程',
      type: 'department',
      strategyId: O1.id,
      departmentId: deptProduct.id,
      ownerId: pm1.id,
      status: 'in_progress',
      progress: 25,
      priority: 'medium',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-06-30'),
    }
  });

  const K1_4 = await prisma.plan.create({
    data: {
      title: 'K1.4 网关升级计划',
      description: '高性能边缘AI主机、Homebridge对接、ETS数据导入、远程调试功能',
      type: 'department',
      strategyId: O1.id,
      departmentId: deptTech.id,
      ownerId: dev1.id,
      status: 'pending',
      progress: 5,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-09-30'),
    }
  });

  const K1_5 = await prisma.plan.create({
    data: {
      title: 'K1.5 多模态传感器开发',
      description: '毫米波雷达技术人体存在感应、跌倒监测算法、适老化面板',
      type: 'department',
      strategyId: O1.id,
      departmentId: deptTech.id,
      ownerId: dev2.id,
      status: 'pending',
      progress: 0,
      priority: 'medium',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-09-30'),
    }
  });

  const K1_6 = await prisma.plan.create({
    data: {
      title: 'K1.6 数字孪生能源管理系统',
      description: 'EMS系统完善、能耗分析、节能报表、移动端管理界面',
      type: 'department',
      strategyId: O1.id,
      departmentId: deptTech.id,
      ownerId: techDirector.id,
      status: 'pending',
      progress: 0,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    }
  });

  // O2 解决方案战略 的计划
  const K2_1 = await prisma.plan.create({
    data: {
      title: 'K2.1 智慧康养解决方案',
      description: '跌倒离床传感器、康养核心产品、医护对讲系统、空气质量监测',
      type: 'department',
      strategyId: O2.id,
      departmentId: deptSolution.id,
      ownerId: solutionMgr.id,
      status: 'in_progress',
      progress: 35,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
    }
  });

  const K2_2 = await prisma.plan.create({
    data: {
      title: 'K2.2 智能照明节能改造方案',
      description: '写字楼能源优化方案、屏展示能源计量信息、AI自适应环境照明系统',
      type: 'department',
      strategyId: O2.id,
      departmentId: deptSolution.id,
      ownerId: solutionStaff.id,
      status: 'pending',
      progress: 15,
      priority: 'medium',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-08-31'),
    }
  });

  const K2_3 = await prisma.plan.create({
    data: {
      title: 'K2.3 智能家居解决方案',
      description: '生态+轻量化落地、旧改方案、新建项目快速交付包',
      type: 'department',
      strategyId: O2.id,
      departmentId: deptSolution.id,
      ownerId: solutionMgr.id,
      status: 'pending',
      progress: 20,
      priority: 'medium',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    }
  });

  const K2_4 = await prisma.plan.create({
    data: {
      title: 'K2.4 精品酒店智能解决方案',
      description: '能耗管理、客房控制、服务呼叫一体化解决方案',
      type: 'department',
      strategyId: O2.id,
      departmentId: deptSolution.id,
      ownerId: solutionStaff.id,
      status: 'pending',
      progress: 10,
      priority: 'medium',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-09-30'),
    }
  });

  // O3 市场战略 的计划
  const K3_1 = await prisma.plan.create({
    data: {
      title: 'K3.1 大湾区渠道网络建设',
      description: '建立覆盖大湾区的集成商服务网络，完成智慧社区标杆项目签约',
      type: 'department',
      strategyId: O3.id,
      departmentId: deptSales.id,
      ownerId: salesDirector.id,
      status: 'in_progress',
      progress: 25,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
    }
  });

  const K3_2 = await prisma.plan.create({
    data: {
      title: 'K3.2 长三角市场拓展',
      description: '拓展上海、杭州高端市场',
      type: 'department',
      strategyId: O3.id,
      departmentId: deptSales.id,
      ownerId: salesMgr.id,
      status: 'pending',
      progress: 5,
      priority: 'medium',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-12-31'),
    }
  });

  const K3_3 = await prisma.plan.create({
    data: {
      title: 'K3.3 品牌传播计划',
      description: '智慧空间设计大赛、短视频内容运营、SpaaS模式推广',
      type: 'department',
      strategyId: O3.id,
      departmentId: deptSales.id,
      ownerId: salesMgr.id,
      status: 'pending',
      progress: 10,
      priority: 'medium',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-12-31'),
    }
  });

  // O4 组织战略 的计划
  const K4_1 = await prisma.plan.create({
    data: {
      title: 'K4.1 组织架构优化',
      description: '增设智慧社区事业部、建立铁三角团队模式',
      type: 'company',
      strategyId: O4.id,
      departmentId: deptCEO.id,
      ownerId: assistant.id,
      status: 'in_progress',
      progress: 40,
      priority: 'high',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    }
  });

  const K4_2 = await prisma.plan.create({
    data: {
      title: 'K4.2 人才队伍建设',
      description: '校企合作培养智能建筑系统工程师、申报专精特新专项补贴',
      type: 'company',
      strategyId: O4.id,
      departmentId: deptOps.id,
      ownerId: opsDirector.id,
      status: 'pending',
      progress: 15,
      priority: 'medium',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    }
  });

  const K4_3 = await prisma.plan.create({
    data: {
      title: 'K4.3 业务流程优化',
      description: '引入乐高式解决方案配置器、建立客户需求闭环系统',
      type: 'company',
      strategyId: O4.id,
      departmentId: deptOps.id,
      ownerId: opsStaff.id,
      status: 'pending',
      progress: 0,
      priority: 'medium',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-09-30'),
    }
  });

  console.log('创建工作计划 K1.1-K4.3');

  // ========== 创建任务 (T1.1.1, T1.1.2...) ==========
  // K1.1 智慧中控屏优化 的任务
  const T1_1_1 = await prisma.task.create({
    data: {
      title: 'T1.1.1 AI语音交互功能开发',
      description: '实现中控屏AI语音交互功能',
      taskNumber: 'T1.1.1',
      sourceType: 'plan_decomposition',
      planId: K1_1.id,
      assigneeId: dev1.id,
      assignerId: productDirector.id,
      dueDate: new Date('2026-02-28'),
      priority: 'high',
      status: 'in_progress',
      progress: 45,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  const T1_1_2 = await prisma.task.create({
    data: {
      title: 'T1.1.2 同步主机数据功能',
      description: '实现中控屏与主机数据同步',
      taskNumber: 'T1.1.2',
      sourceType: 'plan_decomposition',
      planId: K1_1.id,
      assigneeId: dev2.id,
      assignerId: productDirector.id,
      dueDate: new Date('2026-03-15'),
      priority: 'high',
      status: 'pending',
      progress: 0,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  const T1_1_3 = await prisma.task.create({
    data: {
      title: 'T1.1.3 多场景自定义UI开发',
      description: '实现多场景自定义UI界面',
      taskNumber: 'T1.1.3',
      sourceType: 'plan_decomposition',
      planId: K1_1.id,
      assigneeId: dev1.id,
      assignerId: productDirector.id,
      dueDate: new Date('2026-03-31'),
      priority: 'medium',
      status: 'pending',
      progress: 0,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  // T1.1.1 的子任务
  await prisma.task.create({
    data: {
      title: 'T1.1.1.1 AI语音唤醒词设计',
      description: '设计AI语音唤醒词',
      taskNumber: 'T1.1.1.1',
      sourceType: 'assigned',
      parentTaskId: T1_1_1.id,
      planId: K1_1.id,
      assigneeId: pm1.id,
      assignerId: productDirector.id,
      dueDate: new Date('2026-02-15'),
      priority: 'medium',
      status: 'completed',
      progress: 100,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  await prisma.task.create({
    data: {
      title: 'T1.1.1.2 语音识别引擎集成',
      description: '集成语音识别引擎',
      taskNumber: 'T1.1.1.2',
      sourceType: 'assigned',
      parentTaskId: T1_1_1.id,
      planId: K1_1.id,
      assigneeId: dev1.id,
      assignerId: productDirector.id,
      dueDate: new Date('2026-02-28'),
      priority: 'high',
      status: 'in_progress',
      progress: 65,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  // K1.4 网关升级 的任务
  await prisma.task.create({
    data: {
      title: 'T1.4.1 高性能边缘AI主机开发',
      description: '完成高性能边缘AI主机产品开发',
      taskNumber: 'T1.4.1',
      sourceType: 'plan_decomposition',
      planId: K1_4.id,
      assigneeId: dev1.id,
      assignerId: techDirector.id,
      dueDate: new Date('2026-06-30'),
      priority: 'high',
      status: 'pending',
      progress: 5,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  await prisma.task.create({
    data: {
      title: 'T1.4.2 ETS数据导入功能',
      description: '实现ETS数据导入功能',
      taskNumber: 'T1.4.2',
      sourceType: 'plan_decomposition',
      planId: K1_4.id,
      assigneeId: dev2.id,
      assignerId: techDirector.id,
      dueDate: new Date('2026-05-31'),
      priority: 'medium',
      status: 'pending',
      progress: 0,
      strategicAlignment: true,
      alignmentTarget: 'O1 产品战略',
    }
  });

  // K2.1 智慧康养 的任务
  await prisma.task.create({
    data: {
      title: 'T2.1.1 跌倒离床传感器产品化',
      description: '完成跌倒离床传感器产品设计开发',
      taskNumber: 'T2.1.1',
      sourceType: 'plan_decomposition',
      planId: K2_1.id,
      assigneeId: dev2.id,
      assignerId: solutionMgr.id,
      dueDate: new Date('2026-04-30'),
      priority: 'high',
      status: 'in_progress',
      progress: 60,
      strategicAlignment: true,
      alignmentTarget: 'O2 解决方案战略',
    }
  });

  await prisma.task.create({
    data: {
      title: 'T2.1.2 医护对讲系统本地化',
      description: '完成医护对讲系统本地化平台部署',
      taskNumber: 'T2.1.2',
      sourceType: 'plan_decomposition',
      planId: K2_1.id,
      assigneeId: dev1.id,
      assignerId: solutionMgr.id,
      dueDate: new Date('2026-05-31'),
      priority: 'high',
      status: 'in_progress',
      progress: 35,
      strategicAlignment: true,
      alignmentTarget: 'O2 解决方案战略',
    }
  });

  // K3.1 大湾区渠道建设 的任务
  await prisma.task.create({
    data: {
      title: 'T3.1.1 集成商服务网络搭建',
      description: '建立覆盖大湾区的集成商服务网络',
      taskNumber: 'T3.1.1',
      sourceType: 'plan_decomposition',
      planId: K3_1.id,
      assigneeId: salesMgr.id,
      assignerId: salesDirector.id,
      dueDate: new Date('2026-04-30'),
      priority: 'high',
      status: 'in_progress',
      progress: 50,
      strategicAlignment: true,
      alignmentTarget: 'O3 市场战略',
    }
  });

  await prisma.task.create({
    data: {
      title: 'T3.1.2 智慧社区标杆项目签约',
      description: '完成智慧社区标杆项目签约',
      taskNumber: 'T3.1.2',
      sourceType: 'plan_decomposition',
      planId: K3_1.id,
      assigneeId: salesMgr.id,
      assignerId: salesDirector.id,
      dueDate: new Date('2026-06-30'),
      priority: 'high',
      status: 'pending',
      progress: 20,
      strategicAlignment: true,
      alignmentTarget: 'O3 市场战略',
    }
  });

  // K4.1 组织架构优化 的任务
  await prisma.task.create({
    data: {
      title: 'T4.1.1 智慧社区事业部设立',
      description: '完成智慧社区事业部设立',
      taskNumber: 'T4.1.1',
      sourceType: 'assigned',
      planId: K4_1.id,
      assigneeId: assistant.id,
      assignerId: ceo.id,
      dueDate: new Date('2026-02-28'),
      priority: 'high',
      status: 'in_progress',
      progress: 70,
      strategicAlignment: true,
      alignmentTarget: 'O4 组织战略',
    }
  });

  await prisma.task.create({
    data: {
      title: 'T4.1.2 铁三角团队模式建立',
      description: '建立产品经理-系统工程师-客户代表铁三角团队',
      taskNumber: 'T4.1.2',
      sourceType: 'assigned',
      planId: K4_1.id,
      assigneeId: opsDirector.id,
      assignerId: ceo.id,
      dueDate: new Date('2026-03-31'),
      priority: 'high',
      status: 'in_progress',
      progress: 40,
      strategicAlignment: true,
      alignmentTarget: 'O4 组织战略',
    }
  });

  console.log('创建任务 T1.1.1-T4.1.2');

  // ========== 创建考核记录 ==========
  await prisma.assessment.create({
    data: {
      userId: dev1.id,
      assessorId: techDirector.id,
      type: 'monthly',
      period: '2026-03',
      score: 85,
      comment: 'AI语音交互开发进展顺利，技术能力强',
      planId: K1_1.id,
    }
  });

  await prisma.assessment.create({
    data: {
      userId: salesMgr.id,
      assessorId: salesDirector.id,
      type: 'monthly',
      period: '2026-03',
      score: 90,
      comment: '渠道拓展超额完成，客户关系维护良好',
      planId: K3_1.id,
    }
  });

  console.log('创建考核记录完成');

  // ========== 创建问题清单 ==========
  await prisma.issue.create({
    data: {
      issueNumber: 'I202604120001',
      source: '技术开发',
      discoveryDate: new Date('2026-04-05'),
      departmentId: deptTech.id,
      description: 'AI语音识别在噪音环境下准确率下降',
      issueType: '技术问题',
      severity: '中',
      status: '待处理',
      responsibleId: dev1.id,
      solution: '增加噪音抑制算法，优化麦克风阵列算法',
    }
  });

  await prisma.issue.create({
    data: {
      issueNumber: 'I202604120002',
      source: '市场反馈',
      discoveryDate: new Date('2026-04-08'),
      departmentId: deptSales.id,
      description: '部分集成商对产品价格敏感',
      issueType: '市场问题',
      severity: '中',
      status: '待处理',
      responsibleId: salesMgr.id,
      solution: '推出轻量化版本，优化成本',
    }
  });

  console.log('创建问题清单完成');

  // ========== 创建周报 ==========
  await prisma.weeklyReport.create({
    data: {
      weekDate: new Date('2026-04-07'),
      departmentId: deptProduct.id,
      submitterId: productDirector.id,
      completedTasks: 'AI语音交互功能开发进度65%；同步主机数据接口设计完成；多场景UI原型设计',
      keyData: '产品开发进度：30%',
      nextWeekPlan: '完成语音识别引擎集成；开始主机数据同步开发',
      selfEvaluation: '达成',
    }
  });

  await prisma.weeklyReport.create({
    data: {
      weekDate: new Date('2026-04-07'),
      departmentId: deptSales.id,
      submitterId: salesMgr.id,
      completedTasks: '签约3家新集成商；完成深圳标杆项目初步洽谈；大湾区市场调研',
      keyData: '渠道拓展进度：50%',
      nextWeekPlan: '推进深圳项目签约；启动广州市场拓展',
      selfEvaluation: '超预期',
    }
  });

  console.log('创建周报完成');

  console.log('\n=== 数据导入完成 ===');
  console.log('OKR编号体系：');
  console.log('  O1-O4: 战略目标 (Objective)');
  console.log('  K1.1-K4.3: 工作计划 (Key Result)');
  console.log('  T1.1.1-T4.1.2: 任务 (Task)');
  console.log('');
  console.log(`部门: 6 个`);
  console.log(`用户: 14 个`);
  console.log(`战略目标: 4 个 (O1-O4)`);
  console.log(`工作计划: 16 个 (K1.1-K4.3)`);
  console.log(`任务: 15+ 个 (含子任务)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
