import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface CaptchaChartProps {
  data: {
    date: string;
    yandexDesktop: number;
    yandexMobile: number;
    googleDesktop: number;
    googleMobile: number;
  }[];
}

export function CaptchaChart({ data }: CaptchaChartProps) {
  return (
    <LineChart width={900} height={360} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Legend />

      <Line dataKey="yandexDesktop" name="Яндекс Desktop" stroke="#ff3548" />
      <Line dataKey="yandexMobile" name="Яндекс Mobile" stroke="#ff8c9a" />

      <Line dataKey="googleDesktop" name="Google Desktop" stroke="#1c7ed6" />
      <Line dataKey="googleMobile" name="Google Mobile" stroke="#74c0fc" />
    </LineChart>
  );
}
