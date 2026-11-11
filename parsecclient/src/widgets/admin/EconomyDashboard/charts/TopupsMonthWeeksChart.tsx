'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { TopupsMonthWeeksItem } from '@/features/economy/api/economy-api';

export function TopupsMonthWeeksChart({
  data,
}: {
  data: TopupsMonthWeeksItem[];
}) {
  const categories = data.map((d) => d.month);

  // thousandths → рубли
  const toRub = (s: string) => Number(s) / 1000;

  const options: Highcharts.Options = {
    chart: { type: 'column', height: 350 },
    title: {
      text: '',
      align: 'left',
      style: { fontSize: '16px', fontWeight: '600' },
    },
    xAxis: { categories },
    yAxis: {
      title: { text: 'Пополнения (₽)' },
    },
    tooltip: {
      shared: true,
      formatter: function () {
        const points = this.points ?? [];
        let total = 0;
        let html = `<b>${this.x}</b><br/>`;

        for (const p of points) {
          const val = p.y ?? 0;
          html += `${p.series.name}: ${val.toFixed(2)} ₽<br/>`;
          total += val;
        }
        html += `<b>Итого: ${total.toFixed(2)} ₽</b>`;
        return html;
      },
    },
    plotOptions: {
      column: {
        // НИЧЕГО не стекаем — просто группы столбцов
        borderWidth: 0,
        pointPadding: 0.1,
        groupPadding: 0.1,
      },
    },
    series: [
      {
        type: 'column',
        name: 'Месяц (всего)',
        data: data.map((d) => toRub(d.total)),
        color: '#d32f2f',
      },
      ...([0, 1, 2, 3] as const).map((week) => ({
        type: 'column' as const,
        name: `Неделя ${week + 1}`,
        data: data.map((d) => toRub(d.weeks[week])),
        color: '#64b5f6',
      })),
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
