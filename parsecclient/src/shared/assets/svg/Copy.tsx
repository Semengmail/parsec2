import { rem } from '@mantine/core';
import IconProps from './props';

const Copy = ({ size, style, ...others }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: rem(size), height: rem(size), ...style }}
      viewBox="0 0 22 22"
      {...others}
    >
      <path
        d="M17.1111 13.2222H18.7778C20.0051 13.2222 21 12.2273 21 11V3.22222C21 1.99492 20.0051 1 18.7778 1H11C9.7727 1 8.77778 1.99492 8.77778 3.22222V4.88889M3.22222 21H11C12.2273 21 13.2222 20.0051 13.2222 18.7778V11C13.2222 9.7727 12.2273 8.77778 11 8.77778H3.22222C1.99492 8.77778 1 9.7727 1 11V18.7778C1 20.0051 1.99492 21 3.22222 21Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Copy;
