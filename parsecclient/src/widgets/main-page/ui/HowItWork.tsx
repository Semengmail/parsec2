import Image from 'next/image';
import styles from './HowItWork.module.scss';

export const HowItWork: React.FC = () => {
  return (
    <section id="how-is-work" className={styles.howItWorkWrapper}>
      <h2>Как работает</h2>
      <ul className={styles.steps}>
        <li>
          <Image
            src="/img/octopus-step1.svg"
            alt={'Указываете параметры парсинга'}
            width={210}
            height={210}
          />
          <h3>Указываете параметры парсинга</h3>
        </li>
        <li>
          <Image
            src="/img/octopus-step2.svg"
            alt={'Отправляйте запрос через API'}
            width={210}
            height={210}
          />
          <h3>Отправляйте запрос через API</h3>
          {/* <p>Быстро списком или импорт через Эксель</p> */}
        </li>
        <li>
          <Image
            src="/img/octopus-step3.svg"
            alt={'Получаете ответ с результатами выдачи'}
            width={210}
            height={210}
          />
          <h3>Получаете ответ с результатами выдачи</h3>
          {/* <p>За 1-3 секунды</p> */}
        </li>
      </ul>
    </section>
  );
};
