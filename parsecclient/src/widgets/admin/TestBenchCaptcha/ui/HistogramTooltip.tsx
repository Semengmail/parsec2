import { Text } from '@mantine/core';

export function HistogramTooltip({
  histogram,
}: {
  histogram: Record<string, number>;
}) {
  return (
    <div>
      {Object.entries(histogram)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([key, value]) => (
          <Text key={key} size="xs">
            {key}: {value}
          </Text>
        ))}
    </div>
  );
}
