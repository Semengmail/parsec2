import { HeroBlock } from './HeroBlock';
import { HowItWork } from './HowItWork';
import { MainPageFooter } from './MainPageFooter';
import { MainPageHeader } from './MainPageHeader';
import { TariffsBlock } from './TariffsBlock';
import styles from './main.module.scss';

export const MainPage: React.FC = () => {
  return (
    <>
      <div className={styles.mainWrapper}>
        <MainPageHeader slogan={'выгодно'} />
        <HeroBlock />
        <HowItWork />
        <TariffsBlock />
        <MainPageFooter />
      </div>
    </>
  );
};
