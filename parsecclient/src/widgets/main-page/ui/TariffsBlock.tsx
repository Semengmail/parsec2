import { Paths } from '@/shared/config/paths';
import cx from 'clsx';
import Image from 'next/image';
import { MainPageButton } from './MainPageButton';
import styles from './TariffsBlock.module.scss';

const tariffs = [
  {
    id: 'null',
    name: 'Без тарифа',
    price: ' ',
    discount: null,
    // yandexLiveAndWebmaster: '0,10 ₽',
    // yandexLive: '0,09 ₽',
    // xmlAndWebmaster: '0,10 ₽',
    xml: '0,02₽/стр',
    // frequency: '0,02 ₽',
    // competitor: '0,01 ₽',
    // snapshot: '0,02 ₽',
    // webMaster: '0,03 ₽',
    image: '/img/tariffs/null.svg',
  },
  // {
  //   id: 'light',
  //   name: 'Лайт',
  //   price: '990 ₽',
  //   discount: '5%',
  //   yandexLiveAndWebmaster: '0,085 ₽',
  //   yandexLive: '0,081 ₽',
  //   xmlAndWebmaster: '0,085 ₽',
  //   xml: '0,042 ₽',
  //   frequency: '0,019 ₽',
  //   competitor: '0,01 ₽',
  //   snapshot: '0,019 ₽',
  //   webMaster: '0,029 ₽',
  //   image: '/img/tariffs/june.svg',
  // },
  // {
  //   id: 'shik',
  //   name: 'Шик',
  //   price: '2 990 ₽',
  //   discount: '10%',
  //   yandexLiveAndWebmaster: '0,08 ₽',
  //   yandexLive: '0,077 ₽',
  //   xmlAndWebmaster: '0,08 ₽',
  //   xml: '0,045 ₽',
  //   frequency: '0,018 ₽',
  //   competitor: '0,01 ₽',
  //   snapshot: '0,018 ₽',
  //   webMaster: '0,027 ₽',
  //   image: '/img/tariffs/middle.svg',
  // },
  // // {
  // //   id: 'may',
  // //   name: 'Мяу',
  // //   price: '9 990 ₽',
  // //   yandexLiveAndWebmaster: '0,077 ₽',
  // //   yandexLive: '0,072 ₽',
  // //   xmlAndWebmaster: '0,077 ₽',
  // //   xml: '0,072 ₽',
  // //   frequency: '0,016 ₽',
  // //   competitor: '0,008 ₽',
  // //   snapshot: '0,016 ₽',
  // //   webMaster: '0,072 ₽',
  // //   image: '/img/tariffs/senior.svg',
  // // },
  // {
  //   id: 'wau',
  //   name: 'Вау',
  //   price: '9 990 ₽',
  //   discount: '15%',
  //   yandexLiveAndWebmaster: '0,077 ₽',
  //   yandexLive: '0,072 ₽',
  //   xmlAndWebmaster: '0,077 ₽',
  //   xml: '0,043 ₽',
  //   frequency: '0,017 ₽',
  //   competitor: '0,01 ₽',
  //   snapshot: '0,017 ₽',
  //   webMaster: '0,026 ₽',
  //   image: '/img/tariffs/mario.svg',
  // },
  // {
  //   id: 'top',
  //   name: 'Топ',
  //   price: '29 990 ₽',
  //   discount: '20%',
  //   yandexLiveAndWebmaster: '0,072 ₽',
  //   yandexLive: '0,063 ₽',
  //   xmlAndWebmaster: '0,072 ₽',
  //   xml: '0,04 ₽',
  //   frequency: '0,016 ₽',
  //   competitor: '0,01 ₽',
  //   snapshot: '0,016 ₽',
  //   webMaster: '0,024 ₽',
  //   image: '/img/tariffs/prince.svg',
  // },
];

export const TariffsBlock: React.FC = () => {
  const cabinetUrl = '';
  // const cabinetUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  return (
    <section className={styles.tariffs}>
      <div id="tariffs" className={styles.tariffsWrapper}>
        <h2>Тарифы</h2>
        <div className={styles.tariffsItems}>
          <div
            className={cx(styles.tariffBlock, styles.legend)}
            style={{ display: 'none' }}
          >
            <div className={styles.tariffDetails}>
              <div className={cx(styles.tariffRow)}>
                <span>Цена тарифа</span>
              </div>
              <div className={styles.tariffRow}>
                <strong>Яндекс, Гугл</strong>
              </div>
              <div className={styles.tariffRow}>
                <strong>Вебмастер</strong>
              </div>
              <div className={styles.tariffRow}>
                <strong>Сбор частоты</strong>
              </div>
              <div className={cx(styles.tariffRow, styles.noWrap)}>
                <strong>Сбор конкурента</strong>
                <span>{`(до 3 бесплатно)`}</span>
              </div>
              <div className={styles.tariffRow}>
                <strong>Снимок выдачи</strong>
              </div>
            </div>
          </div>
          {tariffs.map((tariff) => {
            return (
              <div key={tariff.id} className={styles.tariffBlock}>
                <Image
                  src={tariff.image}
                  // src={`/img/tariffs/${tariff.id}.svg`}
                  alt={tariff.name}
                  width={45}
                  height={45}
                />
                <h3 className={cx(styles.tariffTitle, styles.noWrap)}>
                  {/* <span>{tariff.name}</span>
                  <span className={styles.discount}>
                    {tariff?.discount
                      ? `Скидка ${tariff.discount}`
                      : 'Без скидки'}
                  </span> */}
                </h3>
                <div className={styles.tariffDetails}>
                  {/* <div className={cx(styles.tariffRow)}>
                    <span className={styles.itemTariffPriceTitle}>
                      Цена тарифа
                    </span>
                    <span>{tariff.price}</span>
                  </div> */}
                  <div className={styles.tariffRow}>
                    <span className={styles.itemLimitPriceTitle}>
                      Яндекс, Гугл
                    </span>
                    <strong>{tariff.xml}</strong>
                  </div>
                  {/* <div className={styles.tariffRow}>
                    <span className={styles.itemLimitPriceTitle}>
                      Вебмастер
                    </span>
                    <strong>{tariff.webMaster}</strong>
                  </div>
                  <div className={styles.tariffRow}>
                    <span className={styles.itemLimitPriceTitle}>
                      Сбор частоты
                    </span>
                    <strong>{tariff.frequency}</strong>
                  </div>
                  <div className={cx(styles.tariffRow, styles.noWrap)}>
                    <span
                      className={cx(styles.itemLimitPriceTitle, styles.noWrap)}
                    >
                      Сбор конкурента
                      <br />
                      {`(до 3 бесплатно)`}
                    </span>
                    <strong>{tariff.competitor}</strong>
                  </div>
                  <div className={styles.tariffRow}>
                    <span className={styles.itemLimitPriceTitle}>
                      Снимок выдачи
                    </span>
                    <strong>{tariff.snapshot}</strong>
                  </div> */}
                </div>
              </div>
            );
          })}
        </div>
        {/* <div className={styles.offer}>
          Успейте зафиксировать цену 0,03₽ — она изменится после марта.
        </div> */}
        <div className={styles.buttonBlock}>
          <MainPageButton
            variant={'blue'}
            href={`${cabinetUrl}${Paths.REGISTER}`}
          >
            Попробовать бесплатно
          </MainPageButton>
          <p>
            При регистрации — <br />
            <span>300 страниц</span> бесплатно!
          </p>
        </div>
      </div>
    </section>
  );
};
