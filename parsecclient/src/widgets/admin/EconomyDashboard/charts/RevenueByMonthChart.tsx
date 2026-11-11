'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { RevenueServicesItem } from '@/features/economy/api/economy-api';

function formatRub(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

export function RevenueByMonthChart({ data }: { data: RevenueServicesItem[] }) {
  const categories = data.map((d) => d.month);

  const toRub = (s: string) => Number(s) / 1000;

  const options: Highcharts.Options = {
    chart: {
      type: 'column',
      height: 420,
    },

    title: {
      text: '',
      align: 'left',
      style: { fontSize: '16px', fontWeight: '600' },
    },

    xAxis: {
      categories,
      title: { text: 'Месяц' },
    },

    yAxis: {
      min: 0,
      title: { text: 'Доход (₽)' },
      stackLabels: {
        enabled: true,
        formatter: function () {
          return formatRub(this.total || 0);
        },
        style: {
          color: '#444',
          fontWeight: 'bold',
          textOutline: 'none',
          fontSize: '11px',
        },
      },
    },

    tooltip: {
      shared: true,
      formatter: function () {
        const points = this.points ?? [];
        let total = 0;

        let html = `<b>${this.x}</b><br/>`;

        for (const p of points) {
          const val = p.y ?? 0;
          total += val;
          html += `<span style="color:${p.color}">\u25CF</span> ${
            p.series.name
          }: <b>${formatRub(val)}</b><br/>`;
        }

        html += `<br/><b>Итого: ${formatRub(total)}</b>`;
        return html;
      },
    },

    plotOptions: {
      column: {
        stacking: 'normal',
        borderWidth: 0,
        pointPadding: 0.1,
        groupPadding: 0.1,
        dataLabels: {
          enabled: false,
        },
      },
    },

    series: [
      {
        type: 'column',
        name: 'Yandex Live',
        data: data.map((d) => toRub(d.yandexLive)),
        color: '#e53935',
      },
      {
        type: 'column',
        name: 'Google Live',
        data: data.map((d) => toRub(d.googleLive)),
        color: '#1e88e5',
      },
      {
        type: 'column',
        name: 'Frequency',
        data: data.map((d) => toRub(d.frequency)),
        color: '#43a047',
      },
    ],
  };

  return (
    <section>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </section>
  );
}
