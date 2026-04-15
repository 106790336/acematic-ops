import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

export interface BrandConfig {
  systemName: string;
  shortName: string;
  logoUrl?: string;
  faviconUrl?: string;
  pageTitle?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName?: string;
  welcomeText?: string;
}

const defaultBrand: BrandConfig = {
  systemName: '企业管理系统',
  shortName: '系统',
  primaryColor: '#7c3aed',
  secondaryColor: '#3b82f6',
  welcomeText: '欢迎使用企业管理系统',
};

interface BrandContextType {
  brand: BrandConfig;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType>({
  brand: defaultBrand,
  loading: true,
  refresh: async () => {},
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      // 用独立的 axios 实例，不经过 auth 拦截器，避免 401 循环
      const res = await axios.get('/api/settings/brand', {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.data?.success && res.data?.data) {
        setBrand({ ...defaultBrand, ...res.data.data });
      }
    } catch (e) {
      // 静默失败，使用默认品牌配置，不触发任何跳转
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // 更新页面标题和图标
  useEffect(() => {
    if (brand.pageTitle) {
      document.title = brand.pageTitle;
    } else if (brand.systemName) {
      document.title = brand.systemName;
    }
    if (brand.faviconUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = brand.faviconUrl;
      }
    }
  }, [brand]);

  return (
    <BrandContext.Provider value={{ brand, loading, refresh }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
