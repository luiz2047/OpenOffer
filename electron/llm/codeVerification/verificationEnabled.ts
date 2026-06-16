// electron/llm/codeVerification/verificationEnabled.ts
//
// Single kill-switch for verified code execution. Default ON, but disableable
// WITHOUT a redeploy so production can turn it off if it ever misbehaves:
//   - env  NATIVELY_CODE_VERIFY = 'off' | 'false' | '0'   → disabled
//   - settings  codeVerificationEnabled === false          → disabled
// Reads defensively (never throws); any uncertainty resolves to the default ON,
// EXCEPT an explicit env/settings "off" which always wins.

let cachedEnv: boolean | null = null;

const envDisabled = (): boolean => {
  if (cachedEnv !== null) return cachedEnv;
  let off = false;
  try {
    const v = (process.env.NATIVELY_CODE_VERIFY || '').trim().toLowerCase();
    off = v === 'off' || v === 'false' || v === '0' || v === 'disabled';
  } catch { off = false; }
  cachedEnv = off;
  return off;
};

/**
 * True when verified code execution should run. Default ON; an explicit env or
 * settings "off" disables it at runtime (no redeploy). Pure-ish + safe to call
 * on the hot path (settings read is a cheap cached SettingsManager get).
 */
export const isCodeVerificationEnabled = (): boolean => {
  if (envDisabled()) return false;
  try {
    const { SettingsManager } = require('../../services/SettingsManager');
    const v = SettingsManager.getInstance().get('codeVerificationEnabled');
    if (v === false) return false; // explicit opt-out only; undefined → default ON
  } catch { /* settings unavailable → fall through to default ON */ }
  return true;
};
