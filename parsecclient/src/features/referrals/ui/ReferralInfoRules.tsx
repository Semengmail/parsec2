import styles from './ReferralInfo.module.scss';
import { SUPPORT_CONTACT } from '@/shared/config/support';

export const ReferralInfoRules: React.FC = () => {
  return (
    <div className={styles.referralInfoRulesContainer}>
      <h2 className={styles.referralInfoHeader}>
        Правила реферальной программы
      </h2>

      <ul className={styles.referralInfoList}>
        <li>
          Вознаграждение за&nbsp;рефералов автоматически переводится на&nbsp;ваш&nbsp;баланс
        </li>
        <li>
          Вывод средств доступен для&nbsp;тех&nbsp;у&nbsp;кого есть&nbsp;постоянный источник
          с&nbsp;аудиторией (есть&nbsp;блог в&nbsp;текстовой или&nbsp;видео форме или зарабатываете
          на партнерках). Пришлите в чат поддержки{' '}
          <a href={SUPPORT_CONTACT.url} target="_blank" rel="noreferrer">
            {SUPPORT_CONTACT.handle}
          </a>{' '}
          ссылку на&nbsp;страницу или&nbsp;видео с&nbsp;рекламой о&nbsp;сервисе, мы&nbsp;с&nbsp;радостью
          в&nbsp;течении 1&nbsp;дня&nbsp;активируем вывод средств
        </li>
        <li>Вывод возможен 1&nbsp;раз&nbsp;в&nbsp;неделю</li>
        <li>Нет&nbsp;ограничений по&nbsp;сумме вывода</li>
      </ul>

      <h2 className={styles.referralInfoHeader}>При пополнении</h2>
      <div className={styles.referralInfoDiscountsContainer}>
        <div className={styles.referralInfoDiscountsContainerInfo}>
          <span className={styles.referralInfoDiscountsContainerInfoLabel}>
            до 500 ₽
          </span>
          <span>вам обоим</span>
          <span className={styles.referralInfoDiscountsContainerInfoLabel}>
            X2 от суммы 
          </span>
        </div>
        <div className={styles.referralInfoDiscountsContainerInfo}>
          <span className={styles.referralInfoDiscountsContainerInfoLabel}>
            до 1000 ₽
          </span>
          <span>вам обоим</span>
          <span className={styles.referralInfoDiscountsContainerInfoLabel}>
            по 750 ₽
          </span>
        </div>
        <div className={styles.referralInfoDiscountsContainerInfo}>
          <span className={styles.referralInfoDiscountsContainerInfoLabel}>
            от 1001 ₽
          </span>
          <span>вам обоим</span>
          <span className={styles.referralInfoDiscountsContainerInfoLabel}>
            по 1000 ₽
          </span>
        </div>
      </div>
    </div>
  );
};
