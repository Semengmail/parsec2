export const resetPasswordTemplate = ({
  resetUrl,
  supportEmail,
}: {
  resetUrl: string;
  supportEmail: string;
}) => `
  <h2>Восстановление пароля</h2>
  <p>Вы запросили сброс пароля.</p>
  <p>
    <a href="${resetUrl}" style="font-size:16px;">
      Сбросить пароль
    </a>
  </p>
  <p>Если это были не вы — просто проигнорируйте письмо.</p>
  <hr />
  <small>Поддержка: ${supportEmail}</small>
`;
