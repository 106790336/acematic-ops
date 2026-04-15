import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  const toggleLanguage = () => {
    const nextIndex = (languages.findIndex(l => l.code === i18n.language) + 1) % languages.length;
    i18n.changeLanguage(languages[nextIndex].code);
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-1.5 h-8 px-2">
      <Globe className="w-4 h-4" />
      <span className="text-xs">{currentLang.flag} {currentLang.label}</span>
    </Button>
  );
}
