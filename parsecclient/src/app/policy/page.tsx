'use client';

import { Paths } from '@/shared/config/paths';
import { MainPageFooter, MainPageHeader } from '@/widgets/main-page';
import Link from 'next/link';
import templateStyles from '../main.module.scss';
import { MAIL } from '@/shared/config/env';
import styles from './policy.module.scss';

const Policy: React.FC = () => {
  return (
    <div className={templateStyles.mainWrapper}>
      <MainPageHeader />
      <section className={styles.wrapper}>
        <h1 className={styles.title}>Условия оказания услуг</h1>
        <div className={styles.content}>
          <div className={styles.block}>
            <h2 className={styles.subtitle}>
              Политика оплаты, доставки и возврата
            </h2>
            <div className={styles.subcontent}>
              <span className={styles.paragraph}>Особенности оплаты</span>
              <span className={styles.text}>
                Оплата товара производится любым из представленных на сайте
                методов. Оплата проводится онлайн. В случае возникновения
                вопросов, связанных с оплатой товара, необходимо обращаться по
                электронной почте{' '}
                <a className={styles.link} href={`mailto:${MAIL}`}>
                  {MAIL}
                </a>
              </span>
            </div>
            <div className={styles.subcontent}>
              <span className={styles.paragraph}>Правила доставки</span>
              <span className={styles.text}>
                Доставка товаров отсутствует, фактически оплачивается право
                доступа для аккаунта Пользователя к системе. Активирование
                аккаунта производится автоматически, при получении информации об
                оплате товара от системы приема платежей или же при получении
                оплаты по безналичному платежу на наш расчетный счет. При этом
                отправка уведомлений от сервиса остается не обязательной, но
                возможной.
              </span>
            </div>
          </div>
          <div className={styles.block}>
            <h2 className={styles.subtitle}>Возврат</h2>
            <span className={styles.text}>
              В случае, если пользователь считает качество работы Сервиса
              неудовлетворительным, он может аннулировать свой аккаунт. Если
              аннулирование произошло в течение двух суток с момента оплаты
              подписки и при условии получения не более чем 30 отчетов в системе
              - мы гарантируем полный возврат денежных средств. Для
              аннулирования аккаунта необходимо отправить письмо на адрес{' '}
              <a className={styles.link} href={`mailto:${MAIL}`}>
                {MAIL}
              </a>{' '}
              с указанием своего логина и описанием ситуации.
            </span>
            <span className={styles.text}>
              Возврат средств возможен только на те же реквизиты, с которых
              средства были перечислены в качестве оплаты.
            </span>
            <span className={styles.text}>
              Удостоверьтесь, что вы ознакомились с{' '}
              <Link className={styles.link} href={Paths.PC_OFERTA}>
                Пользовательским соглашением
              </Link>
            </span>
          </div>
        </div>
      </section>
      <MainPageFooter />
    </div>
  );
};

export default Policy;
