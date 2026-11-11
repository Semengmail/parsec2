import { Suspense } from 'react';
import { RegisterForm } from './RegisterForm';

function Fallback() {
  return <div style={{ maxWidth: 420, margin: '2rem auto' }}>Загрузка…</div>;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <RegisterForm />
    </Suspense>
  );
}
