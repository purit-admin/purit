let guardConfig = null;

export const navigationGuard = {
  register(config) { guardConfig = config; },
  unregister()     { guardConfig = null; },
  // 이탈 시도. 차단됐으면 true(Sidebar는 navigate 생략), 통과됐으면 false.
  intercept(path)  {
    if (guardConfig) { guardConfig.onAttempt(path); return true; }
    return false;
  },
};
