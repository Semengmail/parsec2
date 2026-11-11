import { notifications } from '@mantine/notifications';

export const showError = (message: string, title = 'Ошибка', delay = 3000) => {
  notifications.show({
    loading: false,
    title: title,
    color: 'red',
    message,
    autoClose: delay,
    position: 'top-right',
  });
};
