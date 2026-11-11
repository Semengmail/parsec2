import { Paths } from '@/shared/config/paths';
import styles from './Logo.module.scss';

export const Logo: React.FC = () => {
  return (
    <a href={Paths.HOME} className={styles.logo}>
      Parsec
    </a>
  );
};
