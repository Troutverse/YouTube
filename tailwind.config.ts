import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // 현재 사용 중인 app 폴더만 명시하여 더 정확하게 지정합니다.
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 기본 테마 확장 설정 (필요시 사용)
    },
  },
  plugins: [
    // 이전에 설치한 aspect-ratio 플러그인을 등록합니다.
    require('@tailwindcss/aspect-ratio'),
  ],
};
export default config;
