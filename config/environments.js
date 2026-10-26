import { cleanEnv } from '../modules/common/utils.js';

/**
 * Resolves API and UI target base URLs dynamically based on execution parameters.
 */
export function getEnvironmentConfig() {
  const envType = cleanEnv(__ENV.ENVIRONMENT_TYPE, 'Demo_Sandbox');
  const testServerId = cleanEnv(__ENV.TEST_SERVER_ID, 'test1').toLowerCase();
  const deviceType = cleanEnv(__ENV.DEVICE_TYPE, 'desktop').toLowerCase();
  const fullUrlOverride = cleanEnv(__ENV.FULL_URL_OVERRIDE, '');

  if (fullUrlOverride !== '') {
    const baseHost = fullUrlOverride.substring(0, fullUrlOverride.indexOf('/', 8));
    return {
      type: 'OVERRIDE',
      isSandbox: false,
      device: deviceType,
      baseHost: baseHost,
      uiUrl: fullUrlOverride,
      apiBaseUrl: `${baseHost}/api/v1`,
    };
  }

  if (envType === 'Demo_Sandbox' || envType === 'Safe_Sandbox_Mock') {
    return {
      type: 'DEMO_SANDBOX',
      isSandbox: true,
      device: deviceType,
      baseHost: 'https://reqres.in',
      uiUrl: 'https://reqres.in/api/users?page=2',
      apiBaseUrl: 'https://reqres.in/api',
    };
  }

  // Internal test servers (e.g. test1.app.editage.com)
  const cleanId = testServerId.startsWith('test') ? testServerId : `test${testServerId}`;
  const baseHost = `https://${cleanId}.app.editage.com`;

  return {
    type: 'TEST_SERVER',
    isSandbox: false,
    device: deviceType,
    baseHost: baseHost,
    uiUrl: deviceType === 'mobile' ? `${baseHost}/m/order/ncf` : `${baseHost}/order/ncf`,
    apiBaseUrl: `${baseHost}/api/v1`,
  };
}