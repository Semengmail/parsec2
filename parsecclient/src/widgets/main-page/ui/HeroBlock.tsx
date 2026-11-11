import Image from 'next/image';
import cx from 'clsx';
// import Link from 'next/link';

import { Paths } from '@/shared/config/paths';
import styles from './HeroBlock.module.scss';
import { MainPageButton } from './MainPageButton';

export const HeroBlock: React.FC = () => {
  const cabinetUrl = '';
  // const cabinetUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  return (
    <section className={cx(styles.heroWrapper)}>
      <div className={styles.hero}>
        <div className={styles.content}>
          <h1 className={styles.title}>
            <span className={styles.noWrap}>
              <span className={styles.color}>Быстрый</span> парсинг
            </span>
            <br />
            <span className={styles.noWrap}>Яндекс и Гугл</span>
          </h1>

          <p className={cx(styles.description, styles.afterPoint)}>
            <span className={styles.color}>0,02</span>₽ за страницу
          </p>
          {/* <p className={cx(styles.description, styles.afterPoint)}>
            <span className={styles.color}>40+</span> функций
          </p> */}

          {/* <p className={styles.description}>
            Отличное соотношение цены и функциональности
          </p> */}
          {/* <Link
            className={cx(styles.button, styles.orange)}
            href={`${cabinetUrl}${Paths.SIGN_UP}${cid ? `?cid=${cid}` : ''}`}
          >
            Зарегистрироваться
          </Link> */}
          {/* <p className={cx(styles.usersInfo)}>
            Отличное соотношение цены и функциональности
          </p> */}
          <p className={styles.description}> </p>
          <div className={styles.buttonBlock}>
            <MainPageButton
              variant={'orange'}
              href={`${cabinetUrl}${Paths.REGISTER}`}
            >
              Попробовать бесплатно
            </MainPageButton>
            <p className={styles.remark}>
              При&nbsp;регистрации&nbsp;— <br />
              <span>300 страниц</span> бесплатно!
            </p>
          </div>
        </div>
        <Image
          src={'/img/octopus.svg'}
          alt={'Осьминог Toolzar'}
          width={536}
          height={332}
        />
      </div>
      {/* <div className={cx(styles.banner, styles.inline)}>
        <div className={styles.bannerContent}>
          Успейте зафиксировать цену 0,03₽ — она изменится после марта.
        </div>
        <div className={styles.bannerContent}>
          Открытый Бета-тест — цены снижены 0,03₽ за фразу{' '}
          <IcoRoundArrow className={styles.arrow} />
          <a
            className={cx(styles.button, styles.white)}
            href={`${cabinetUrl}${Paths.SIGN_UP}?${urlPrams}`}
          >
            Участвовать
          </a>
        </div>
        <div className={styles.slaveContent}>
          кроме xml лимитов 0,02 ₽ за запрос
        </div>
      </div> */}
      {/* <div className={styles.development}>
        <p>Успейте зафиксировать цену 0,03₽ — она изменится после марта.</p>
        <p>
          Улучшаем сервис постоянно, нужны ваши советы на период тестирования.
        </p>
        <p>
          Функционал сервиса - бесплатный. Оплачиваете только xml лимиты 0,02 ₽.
          за фразу. <br />
          *станет платным в апреле - 0,03 ₽ за запрос.
        </p>
      </div> */}
    </section>
  );
};
