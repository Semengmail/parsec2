'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { RegistrationsItem } from '@/features/economy/api/economy-api';

export function RegistrationsChart({ data }: { data: RegistrationsItem[] }) {
  const categories = data.map((d) => d.month);

  const options: Highcharts.Options = {
    chart: { type: 'line', height: 300 },
    title: {
      text: '',
      align: 'left',
      style: { fontSize: '16px', fontWeight: '600' },
    },
    xAxis: { categories },
    yAxis: { title: { text: 'Регистрации' } },
    series: [
      {
        type: 'line',
        name: 'Регистрации',
        data: data.map((d) => d.registrations),
        color: '#00897b',
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
