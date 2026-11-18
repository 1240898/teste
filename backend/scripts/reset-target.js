export function resetConfirmation(options, nodeEnv, dei = false) {
  if (nodeEnv === 'production') {
    throw new Error('Reset is not allowed in production.');
  }
  if (dei) {
    if (
      options.host !== 'vs398.dei.isep.ipp.pt' ||
      options.port !== 5432 ||
      options.database !== 'laprizza'
    ) {
      throw new Error(
        'DEI reset requires vs398.dei.isep.ipp.pt:5432/laprizza.',
      );
    }
    return `${options.host}:${options.port}/${options.database}`;
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(options.host)) {
    throw new Error(
      'Remote reset requires the dedicated db:reset:dei command.',
    );
  }
  return options.database;
}
