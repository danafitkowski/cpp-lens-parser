export function parseHeader(xerText) {
  const firstLine = xerText.split(/\r?\n/, 1)[0];
  if (!firstLine || !firstLine.startsWith('ERMHDR\t')) return null;
  const parts = firstLine.split('\t');
  return {
    version: parts[1] || '',
    exportDate: parts[2] || '',
    exportType: parts[3] || '',
    userLogin: parts[4] || '',
    userName: parts[5] || '',
    databaseName: parts[6] || '',
    currencyCode: parts[7] || '',
    language: parts[8] || '',
    encoding: parts[9] || ''
  };
}
