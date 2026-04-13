const isProduction = import.meta.env.MODE === 'production';

if (isProduction) {
  const noop = () => {};

  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
}
