'use client';

import { Button, Image } from '@mantine/core';
import { useEffect, useState } from 'react';

import styles from './ErrorPlate.module.scss';

interface ErrorPlateProps {
  newsItem?: {
    id: number;
    title: string;
    content: string;
    createdAt: string;
  };
}

export const ErrorPlate: React.FC<ErrorPlateProps> = ({ newsItem }) => {
  const err = newsItem || {
    id: 1,
    title: 'Внимание',
    content:
      'Роскомнадзор блокирует зарубежные соединения. API запросы осуществляйте с РФ или через ВПН.',
    createdAt: new Date().toISOString(),
  };

  const storageKey = `error-plate-closed:${err.id}`;

  const [opened, setOpened] = useState(false);

  // читаем localStorage ТОЛЬКО на клиенте
  useEffect(() => {
    try {
      const closed = localStorage.getItem(storageKey);
      setOpened(!closed);
    } catch {
      // на всякий случай — показываем
      setOpened(true);
    }
  }, [storageKey]);

  const handleClose = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // игнор
    }
    setOpened(false);
  };

  if (!opened) return null;

  return (
    <div className={styles.plateWrapper}>
      <div key={err.id} className={styles.plateContent}>
        <Image
          className={styles.errorIcon}
          src="/img/warning-sign.svg"
          width={30}
          height={30}
          alt="Внимание!"
        />

        <div className={styles.errorText} title={err.content}>
          {err.content}
        </div>

        <Button
          className={styles.closeButton}
          onClick={handleClose}
          variant="filled"
          color="blue"
        >
          Закрыть
        </Button>
      </div>
    </div>
  );
};
