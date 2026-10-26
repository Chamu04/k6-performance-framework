/**
 * Strips quotes and trims whitespace from environment variables.
 */
export function cleanEnv(val, fallback = '') {
  if (!val) return fallback;
  const cleaned = val.replace(/^["']|["']$/g, '').trim();
  return cleaned === '' ? fallback : cleaned;
}

/**
 * Generates an ISO-like formatted date shifted by N days into the future.
 */
export function getFutureDate(daysAhead = 3) {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return {
    dateObj: future,
    rawDate: future.toISOString().slice(0, 19).replace('T', ' '),
    timestamp: Math.floor(future.getTime() / 1000),
    isoString: future.toISOString(),
  };
}

/**
 * Returns formatted date strings expected by Editage TAT and order microservices.
 */
export function formatEdDateStrings(futureDateObj) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayName = days[futureDateObj.getUTCDay()];
  const monthName = months[futureDateObj.getUTCMonth()];
  const dayNum = futureDateObj.getUTCDate();
  const year = futureDateObj.getUTCFullYear();

  return {
    addonDeadline: `${dayName}, ${monthName} ${dayNum}, ${year} 1:00 PM`,
    coreDeadline: `${dayNum} ${fullMonths[futureDateObj.getUTCMonth()]} ${year} 13:00`,
  };
}

/**
 * Builds standard browser emulation headers based on device type.
 */
export function getStandardHeaders(deviceType = 'desktop', referer = '', origin = '') {
  const isMobile = deviceType === 'mobile';

  const userAgent = isMobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': userAgent,
  };

  if (referer) headers['Referer'] = referer;
  if (origin) headers['Origin'] = origin;

  return headers;
}