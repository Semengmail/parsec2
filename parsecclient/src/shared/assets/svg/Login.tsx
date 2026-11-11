import { rem } from '@mantine/core';
import IconProps from './props';

const Login = ({ size, style, ...others }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      style={{ width: rem(size), height: rem(size), ...style }}
      viewBox="0 0 23 22"
      {...others}
    >
      <path
        d="M14.5882 1L19.5294 1C20.8939 1 22 2.10612 22 3.47059V18.2941C22 19.6586 20.8939 20.7647 19.5294 20.7647H14.5882M15.8235 10.8824L1 10.8824M15.8235 10.8824L10.8824 15.8235M15.8235 10.8824L10.8824 5.94118"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Login;
