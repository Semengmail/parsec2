'use client';

import { Alert, Anchor, Modal } from '@mantine/core';
import { SUPPORT_CONTACT } from '@/shared/config/support';

interface BalanceModalProps {
  opened: boolean;
  onClose: () => void;
}

// Payment creation stays disabled independently of the cabinet STUB_MODE flag.
export const BalanceModal: React.FC<BalanceModalProps> = ({ opened, onClose }) => (
  <Modal opened={opened} onClose={onClose} lockScroll={false} title="Пополнение баланса">
    <Alert color="yellow" title="Пополнение временно недоступно">
      Сервис на техническом обслуживании. По вопросам баланса напишите в поддержку:{' '}
      <Anchor href={SUPPORT_CONTACT.url} target="_blank" rel="noopener noreferrer">
        {SUPPORT_CONTACT.handle}
      </Anchor>.
    </Alert>
  </Modal>
);
