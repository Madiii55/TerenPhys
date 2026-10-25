import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useDialogFocus } from '../utils/useDialogFocus.ts';
import '../styles/auth-dialogs.css';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(dialogRef, isOpen, onClose);
  if (!isOpen) return null;

  const content = (
    <div className="privacy-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="privacy-dialog">
        <div className="privacy-dialog-heading">
          <div className="privacy-dialog-symbol" aria-hidden="true">
            <ShieldCheck />
          </div>
          <div>
            <h2 id={titleId}>{t("Политика конфиденциальности")}</h2>
            <p>{t("TerenPhys • Условия и защита данных")}</p>
          </div>
          <button type="button" onClick={onClose} className="privacy-dialog-close" aria-label={t("Закрыть")} data-dialog-initial-focus>
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="privacy-dialog-content">
          <section>
            <h3>{t("1. Общие положения")}</h3>
            <p>{t("Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей образовательной платформы TerenPhys. Регистрируясь или выполняя вход через Email или Google, пользователь выражает полное и безоговорочное согласие с условиями настоящей политики.")}</p>
          </section>

          <section>
            <h3>{t("2. Собираемые данные")}</h3>
            <p>{t("Для обеспечения функционала платформы собираются следующие данные:")}</p>
            <ul>
              <li>{t("Никнейм и описание профиля;")}</li>
              <li>{t("Адрес электронной почты (Email);")}</li>
              <li>{t("Аватар профиля (загруженное изображение);")}</li>
              <li>{t("История создания и обновления учетной записи.")}</li>
            </ul>
          </section>

          <section>
            <h3>{t("3. Хранение и безопасность данных")}</h3>
            <p>{t("Вход и пароли обрабатывает Supabase Auth. Никнейм и описание сохраняются в базе Supabase, фотография — в Supabase Storage. Почта не включается в публичную ленту, пароль не хранится в таблице профилей. Аватар может отображаться в публичных постах; изображение доступно по ссылке.")}</p>
          </section>

          <section>
            <h3>{t("4. Управление профилем")}</h3>
            <p>{t("Пользователь может изменить никнейм, описание и аватар в личном кабинете, восстановить пароль по почте и запросить удаление учётной записи.")}</p>
          </section>
          <section>
            <h3>{t("5. Помощник Эйнштейн")}</h3>
            <p>{t("При отправке вопроса сервису Gemini передаются текст беседы, текущая учебная тема и ограниченный фрагмент открытого нативного конспекта. Почта, профиль и черновики ответов не передаются. Переписка остаётся только в памяти открытой страницы; на сервере TerenPhys сохраняются только счётчики запросов без текста переписки. На бесплатном тарифе Google может использовать вопросы и ответы для улучшения своих продуктов.")}</p>
          </section>
        </div>

        <div className="privacy-dialog-footer">
          <button
            type="button"
            onClick={onClose}
          >{t("Понятно")}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
