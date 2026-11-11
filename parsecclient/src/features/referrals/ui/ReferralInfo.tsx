import styles from './ReferralInfo.module.scss';
import { ReferralInfoLinks } from './ReferralInfoLinks';
import { ReferralInfoRules } from './ReferralInfoRules';

export const ReferralInfo: React.FC = () => {
  return (
    <div className={styles.referralInfoContainer}>
      <ReferralInfoLinks />
      <ReferralInfoRules />
    </div>
  );
};
