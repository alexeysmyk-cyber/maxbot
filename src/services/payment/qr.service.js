import QRCode from 'qrcode';

const BASE_QR_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';

const BASE_PARAMS = {
  type: '01',
  bank: '100000000111',
  sum: '0',
  cur: 'RUB',
  crc: '2ddf'
};

export function generateQrData(amount) {
  const params = {
    ...BASE_PARAMS,
    sum: Math.round(amount * 100).toString()
  };

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const link = `${BASE_QR_URL}?${query}`;

  const qrUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

  return { link, qrUrl };
}