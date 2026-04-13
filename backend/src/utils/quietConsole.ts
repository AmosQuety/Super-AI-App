const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const noop = () => {};

  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
  console.error = noop;
}
