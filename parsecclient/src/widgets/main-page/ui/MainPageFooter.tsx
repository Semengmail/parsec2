import { Paths } from '@/shared/config/paths';
import { Logo } from '@/shared/ui';
import cx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MainPageFooter.module.scss';
import { MAIL } from '@/shared/config/env';

const year = new Date().toISOString().slice(0, 4);

const PaymentsBlock: React.FC<{ device: 'mobile' | 'desktop' }> = ({
  device,
}) => (
  <div className={cx(styles.payments, styles[device])}>
    <Image
      src={'/img/payments/tinkoff.svg'}
      alt={'Банк Тиньков'}
      width={120}
      height={42}
    />
    <Image
      src={'/img/payments/mir.svg'}
      alt={'Карта мир'}
      width={79}
      height={42}
    />
    <Image src={'/img/payments/spb.svg'} alt={'СПБ'} width={79} height={42} />
    {/* <Image src={'/img/payments/mastercard.svg'} alt={'Мастер карт'} width={79} height={42} /> */}
    <Image
      src={'/img/payments/visa.svg'}
      alt={'Карта Виза'}
      width={79}
      height={42}
    />
    {/* <Image src={'/img/payments/urlitca.svg'} alt={'Юр лица'} width={120} height={42} /> */}
  </div>
);

export const MainPageFooter: React.FC = () => {
  return (
    <footer className={styles.footerWrapper}>
      <div className={styles.footer}>
        <div className={styles.credits}>
          <Logo />
          <p>{year} @ - Parsec все права защищены</p>
        </div>
        <PaymentsBlock device={'desktop'} />
        <div className={styles.info}>
          <p>Дни работы поддержки:</p>
          <p>ПН-ВС. Каждый день</p>
          <p>7:00-20:00 по Москве</p>
        </div>
        <div className={styles.info}>
          <p>Контакты</p>
          <p>
            <a href={`mailto:${MAIL}`}>{MAIL}</a>
          </p>
          <p>
            <a href={`tel:+79609969576`}>+7 (960) 996-95-76</a>
          </p>
        </div>
        <div className={styles.info} style={{ maxWidth: '145px' }}>
          <Link className={styles.terms} href={Paths.PC_OFERTA}>
            Пользовательское соглашение
          </Link>
          <Link className={styles.terms} href={Paths.POLICY}>
            Политика оплаты и возврата
          </Link>
          <Link className={styles.terms} href={`${Paths.HOME}#tariffs`}>
            Тарифы
          </Link>
        </div>
        <div className={styles.info}>
          <Link className={styles.terms} href={Paths.PRIVACY_POLICY}>
            Обработка персональных данных
          </Link>
          <Link className={styles.terms} href={Paths.CONSENT}>
            Согласие на обработку персональных данных
          </Link>
          <Link className={styles.terms} href={Paths.COOKIE_POLICY}>
            Политика использования Cookie
          </Link>
        </div>
        <PaymentsBlock device={'mobile'} />
      </div>
    </footer>
  );
};
