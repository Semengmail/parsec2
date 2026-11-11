'use client';

import clsx from 'clsx';

import styles from './TgButton.module.scss';

interface TgButtonProps {
  text: string;
}

export const TgButton: React.FC<TgButtonProps> = ({ text }) => {
  return (
    <button className={clsx(styles.btn, styles.tgmeWidgetLoginButton)}>
      <i className={styles.tgme_widget_login_button_icon}></i>
      <span className={styles.tgme_widget_login_button_text}>{text}</span>
    </button>
  );
};
