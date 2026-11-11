import { notifications } from '@mantine/notifications';

export const showNotification = (
  message: string,
  title = 'Уведомление',
  delay = 3000
) => {
  notifications.show({
    loading: false,
    title,
    color: 'green',
    message,
    autoClose: delay,
    position: 'top-right',
  });
};
