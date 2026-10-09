import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative border border-gray-100 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          title={t("Закрыть")}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0284c7] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-medium text-gray-900">{t("Политика конфиденциальности")}</h3>
            <p className="text-xs text-gray-500 font-light">{t("TerenPhys • Условия и защита данных")}</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-gray-600 font-light leading-relaxed">
          <section className="space-y-1.5">
            <h4 className="font-medium text-gray-900 text-sm">{t("1. Общие положения")}</h4>
            <p>{t("Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей образовательной платформы TerenPhys. Регистрируясь или выполняя вход через Email или Google, пользователь выражает полное и безоговорочное согласие с условиями настоящей политики.")}</p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-medium text-gray-900 text-sm">{t("2. Собираемые данные")}</h4>
            <p>{t("Для обеспечения функционала платформы собираются следующие данные:")}</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600">
              <li>{t("Никнейм и описание профиля;")}</li>
              <li>{t("Адрес электронной почты (Email);")}</li>
              <li>{t("Аватар профиля (загруженное изображение);")}</li>
              <li>{t("История создания и обновления учетной записи.")}</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-medium text-gray-900 text-sm">{t("3. Хранение и безопасность данных")}</h4>
            <p>{t("Вход и пароли обрабатывает Supabase Auth. Никнейм и описание сохраняются в базе Supabase, фотография — в Supabase Storage. Почта не включается в публичную ленту, пароль не хранится в таблице профилей. Аватар может отображаться в публичных постах; изображение доступно по ссылке.")}</p>
          </section>

          <section className="space-y-1.5">
            <h4 className="font-medium text-gray-900 text-sm">{t("4. Управление профилем")}</h4>
            <p>{t("Пользователь может изменить никнейм, описание и аватар в личном кабинете, восстановить пароль по почте и запросить удаление учётной записи.")}</p>
          </section>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#0284c7] hover:bg-blue-600 text-white text-xs font-medium transition-colors cursor-pointer"
          >{t("Понятно")}</button>
        </div>
      </div>
    </div>
  );
};
