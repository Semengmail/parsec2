import cx from 'clsx';
import Link, { LinkProps } from 'next/link';
import styles from './MainPageButton.module.scss';
import { ReactNode } from 'react';

interface MainPageButtonProps extends LinkProps {
  variant?: 'blue' | 'white' | 'orange' | 'green' | 'tgblue' | 'vkblue';
  children: ReactNode;
  className?: string;
  newTab?: boolean;
}

export const MainPageButton: React.FC<MainPageButtonProps> = ({
  variant = 'blue',
  children,
  className,
  newTab = false,
  ...linkProps
}) => {
  return (
    <Link
      className={cx(styles.button, styles[variant], className)}
      {...linkProps}
      passHref
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
    >
      {children}
    </Link>
  );
};
