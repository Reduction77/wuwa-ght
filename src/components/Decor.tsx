/** 静态共鸣线纹背景：只使用合成友好的渐变，不运行常驻动画。 */
export default function Decor() {
  return (
    <div className="site-atmosphere pointer-events-none fixed inset-0 -z-10" aria-hidden />
  );
}
