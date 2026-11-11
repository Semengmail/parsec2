'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { TopupClientsItem } from '@/features/economy/api/economy-api';

export function TopupClientsChart({ data }: { data: TopupClientsItem[] }) {
  const categories = data.map((d) => d.month);

  const options: Highcharts.Options = {
    chart: { type: 'column', height: 300 },
    title: {
      text: '',
      align: 'left',
      style: { fontSize: '16px', fontWeight: '600' },
    },
    xAxis: { categories },
    yAxis: { title: { text: 'Клиенты' } },
    series: [
      {
        type: 'column',
        name: 'Клиенты',
        data: data.map((d) => d.clientsCount),
        color: '#4f81d9',
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
