const getServerTimestamp = () => {
  return new Date();
};

const getServerNowMs = () => {
  return Date.now();
};

module.exports = {
  getServerTimestamp,
  getServerNowMs
};