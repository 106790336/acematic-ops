import { useAuth } from './use-auth';

// 权限定义映射
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ceo: ['*'], // CEO 拥有所有权限
  executive: [
    // 高管权限
    'strategy:*', 'plan:*', 'task:*', 'issue:*', 'assessment:*',
    'department:view', 'department:create', 'department:edit',
    'user:view', 'user:create', 'user:edit',
    'report:*', 'dashboard:*', 'change-request:*',
  ],
  manager: [
    // 经理权限
    'strategy:view',
    'plan:view', 'plan:create', 'plan:edit',  // 不能删除计划
    'task:view', 'task:create', 'task:edit',  // 不能删除任务
    'issue:view', 'issue:create', 'issue:edit',
    'assessment:view',
    'department:view',
    'user:view',
  ],
  employee: [
    // 员工权限 - 只能查看，创建和编辑自己的任务，不能删除任何东西
    'strategy:view',
    'plan:view',  // 只能查看计划，不能创建/编辑/删除
    'task:view', 'task:create', 'task:edit',  // 不能删除任务
    'issue:view',
    'assessment:view',
    'department:view',
  ],
};

export function usePermission() {
  const { user } = useAuth();

  // 检查是否有权限
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // CEO 有所有权限
    if (user.role === 'ceo') return true;
    
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    
    // 检查精确匹配
    if (permissions.includes(permission)) return true;
    
    // 检查通配符匹配 (如 'task:*' 匹配 'task:create', 'task:edit' 等)
    for (const p of permissions) {
      if (p.endsWith(':*')) {
        const prefix = p.slice(0, -1); // 移除 '*'
        if (permission.startsWith(prefix)) return true;
      }
      if (p === '*') return true;
    }
    
    return false;
  };

  // 检查是否是管理员
  const isAdmin = (): boolean => {
    return user?.role === 'ceo' || user?.role === 'executive';
  };

  // 检查是否是CEO
  const isCEO = (): boolean => {
    return user?.role === 'ceo';
  };

  // 检查是否可以编辑内容（需要同时满足权限和所有权条件）
  const canEditContent = (creatorId: string, module: string = ''): boolean => {
    // CEO可以编辑所有内容
    if (user?.role === 'ceo') return true;
    
    // 高管可以编辑大部分内容
    if (user?.role === 'executive') return true;
    
    // 创建者可以编辑自己的内容，但必须有该模块的编辑权限
    if (user?.id === creatorId) {
      // 对于计划、战略，创建者也需要有编辑权限
      if (module && !hasPermission(`${module}:edit`)) {
        return false;
      }
      return true;
    }
    
    return false;
  };

  // 检查是否可以删除内容
  const canDeleteContent = (creatorId: string, module: string = ''): boolean => {
    // 只有CEO可以删除他人内容
    if (user?.role === 'ceo') return true;
    
    // 创建者可以删除自己的内容，但必须有删除权限
    if (user?.id === creatorId) {
      if (module && !hasPermission(`${module}:delete`)) {
        return false;
      }
      return true;
    }
    
    return false;
  };

  return {
    hasPermission,
    isAdmin,
    isCEO,
    canEditContent,
    canDeleteContent,
    user,
  };
}
