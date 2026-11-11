'use client';

import { MainPageFooter, MainPageHeader } from '@/widgets/main-page';
import templateStyles from '../main.module.scss';
import styles from './policy.module.scss';
import Link from 'next/link';

const CookiePolicy: React.FC = () => {
  return (
    <div className={templateStyles.mainWrapper}>
      <MainPageHeader />
      <section className={styles.wrapper}>
        <div className={styles.subcontent}>
          <h1>Политика в отношении cookie-файлов</h1>
        </div>
        <h2>Что такое cookie?</h2>
        <span className={styles.text}>
          Cookie – это небольшой файл данных, который тот или иной сайт просит
          ваш браузер сохранить на компьютере или мобильном устройстве. Когда
          пользователь повторно посещает сайт, браузер обращается к базе
          cookies. Cookie-файлы позволяют сайту «запоминать» ваши действия или
          предпочтения в течение длительного времени. В рамках этого сайта
          используются два главных вида файлов Cookie: «сессионные» (session
          cookies) и «постоянные» (persistent cookies). «Сессионные» Cookies –
          это файлы, ограниченные по времени, которые сохраняются на ПК
          пользователя до момента его выхода с сайта или отключения браузера.
          «Постоянные» файлы cookies сохраняются на ПК пользователя определенный
          период времени, указанный в параметрах файлов Cookies или до срока их
          удаления пользователем.
        </span>
        <span className={styles.text}>
          Файлы сookie могут быть установлены веб-сайтом, который вы посещаете
          («основные файлы сookie»), или они могут быть установлены другими
          сайтами, которые запускают содержимое на странице, которую вы
          просматриваете («сторонние файлы сookie»).
        </span>
        <h2>Для чего используются файлы cookie</h2>
        <span className={styles.text}>
          Мы используем cookie-файлы с целью обеспечения максимального удобства
          пользования сайтом, например, запоминая предыдущие посещения и
          предпочитаемые пользователями настройки и обеспечивая, таким образом,
          эффективную навигацию между страницами нашего сайта.
        </span>
        <h2>Типы файлов сookie и как мы используем их</h2>
        <span className={styles.text}>
          На этом сайте используются следующие типы файлов сookie:
        </span>
        <span className={styles.text}>
          <strong>1. Строго необходимые файлы cookie</strong>
        </span>
        <span className={styles.text}>
          Эти файлы cookie необходимы для навигации на сайте, для предоставления
          ряда базовых услуг, и для использования некоторых его функций,
          например, доступа в безопасные зоны или для регистрации аккаунта.
          Данные файлы cookie могут быть как сессионными, так и постоянными. Без
          этих файлов cookie мы не можем гарантировать бесперебойное
          функционирование сайта.
        </span>
        <span className={styles.text}>
          <strong>2. Функциональные файлы cookie</strong>
        </span>
        <span className={styles.text}>
          Фнукциональные файлы cookie позволяют запоминать информацию,
          предоставленную пользователем (имя пользователя, кодировка, временная
          зона и т.д.) и отображать сайт с сохраненными настройками. Более того,
          эти cookie-файлы используются для предоставления ряда услуг. Например,
          они позволяют оставлять комментарии.
        </span>
        <span className={styles.text}>
          Информация, предоставляемая такими файлами cookie, не предназначена
          для отслеживания вашей работы на сторонних сайтах. Данные файлы cookie
          могут быть как сессионными, так и постоянными. Кроме того, они могут
          быть как основными, так и сторонними. Файлы этого типа используются
          для улучшения функциональности нашего сайта.
        </span>
        <span className={styles.text}>
          <strong>3. Аналитические файлы сookie</strong>
        </span>
        <span className={styles.text}>
          Эти файлы cookie позволяют собирать информацию, которая в совокупности
          помогает нам понять, как используется сайт, и измерять эффективность
          маркетинговых кампаний. Также эти файлы помогают адаптировать сайт и
          приложения к потребностям пользователя и улучшать взаимодействие между
          пользователем и сайтами. Например, мы можем отслеживать ошибки или
          проверять, что пользователи получают доступ к контенту, который они
          ищут. Как правило, такие файлы-cookie являются постоянными.
        </span>
        <h2>Управление и удаление файлов cookie</h2>
        <span className={styles.text}>
          Вы можете регулировать использование файлов cookie: принимать,
          отключать или удалять их, — через настройки вашего браузера. Вы можете
          найти информацию о том, как отключить файлы cookie или изменить
          настройки файлов cookie для браузера, перейдя по следующим ссылкам.
        </span>
        <span className={styles.text}>
          <strong>Google Chrome</strong>{' '}
          <Link
            className={styles.link}
            target="_blank"
            href={'https://support.google.com/chrome/answer/95647?hl=en'}
          >
            https://support.google.com/chrome/answer/95647?hl=en
          </Link>{' '}
          <br />
          <strong>Firefox</strong>{' '}
          <Link
            className={styles.link}
            target="_blank"
            href={
              'https://support.mozilla.org/en-US/kb/delete-cookies-remove-info-websites-stored'
            }
          >
            https://support.mozilla.org/en-US/kb/delete-cookies-remove-info-websites-stored
          </Link>
          <br />
          <strong>Safari</strong>{' '}
          <Link
            className={styles.link}
            target="_blank"
            href={'https://support.apple.com/kb/PH21411'}
          >
            https://support.apple.com/kb/PH21411
          </Link>
          <br />
          <strong>Safari iOS</strong> (iPhone, iPad, iPod touch){' '}
          <Link
            className={styles.link}
            target="_blank"
            href={'https://support.apple.com/en-us/HT201265'}
          >
            https://support.apple.com/en-us/HT201265
          </Link>
        </span>
        <span className={styles.text}>
          Если вы не нашли ваш браузер в списке, пожалуйста, проверьте
          справочное меню в вашем браузере. Дополнительную информацию о том, как
          управлять и как удалять файлы cookie, можно найти, перейдя по ссылке:{' '}
          <Link
            className={styles.link}
            target="_blank"
            href={'http://www.aboutcookies.org'}
          >
            http://www.aboutcookies.org
          </Link>
          .
        </span>
        <span className={styles.text}>
          Обратите внимание, если вы решите отключить файлы cookie, то все равно
          сможете использовать наш сайт, но некоторые разделы и функции нашего
          сайта не будут работать.
        </span>
      </section>
      <MainPageFooter />
    </div>
  );
};

export default CookiePolicy;
