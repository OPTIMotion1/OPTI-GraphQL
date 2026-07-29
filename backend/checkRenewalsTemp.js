require('dotenv').config();
const { fetchRenewals } = require('./src/services/renewals.service');
(async () => {
  try {
    const data = await fetchRenewals();
    console.log('RESULT_TYPE', typeof data);
    console.log('HAS_DATA_PROP', data && data.data ? true : false);
    if (data && data.data) console.log('DATA_KEYS', Object.keys(data.data));
    if (data && data.data && Array.isArray(data.data)) {
      console.log('DATA_LENGTH', data.data.length);
      console.log('FIRST_ITEM', JSON.stringify(data.data[0], null, 2));
    } else {
      console.log('RAW_RESPONSE', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('ERROR', err.message);
    if (err.response) {
      console.error('ERROR_STATUS', err.response.status);
      console.error('ERROR_DATA', JSON.stringify(err.response.data, null, 2));
    }
  }
})();