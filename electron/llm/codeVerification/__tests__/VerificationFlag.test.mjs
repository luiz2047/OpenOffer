// electron/llm/codeVerification/__tests__/VerificationFlag.test.mjs
//
// Kill-switch for verified code execution: default ON, disableable at runtime
// (no redeploy) via env NATIVELY_CODE_VERIFY=off. When off, the hidden
// <verification_spec> instruction is also omitted from the coding prompt so the
// model wastes no tokens on a spec nothing will run.
//
// NOTE: env is read once and cached per-process, so we test the env branch in a
// child process to get a clean cache. The settings branch defaults ON here.

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { execFileSync } from 'node:child_process';
import { isCodeVerificationEnabled } from '../../../../dist-electron/electron/llm/codeVerification/verificationEnabled.js';
import { planAnswer, formatAnswerPlanForPrompt } from '../../../../dist-electron/electron/llm/index.js';

describe('isCodeVerificationEnabled', () => {
  test('defaults ON when no env / settings override', () => {
    assert.equal(isCodeVerificationEnabled(), true);
  });

  for (const off of ['off', 'false', '0', 'disabled']) {
    test(`env NATIVELY_CODE_VERIFY=${off} disables it (child process for clean cache)`, () => {
      const out = execFileSync(process.execPath, [
        '--input-type=module', '-e',
        `import { isCodeVerificationEnabled } from './dist-electron/electron/llm/codeVerification/verificationEnabled.js'; process.stdout.write(String(isCodeVerificationEnabled()));`,
      ], { cwd: process.cwd(), env: { ...process.env, NATIVELY_CODE_VERIFY: off } }).toString();
      assert.equal(out, 'false');
    });
  }

  test('env=on (or unset) keeps it enabled', () => {
    const out = execFileSync(process.execPath, [
      '--input-type=module', '-e',
      `import { isCodeVerificationEnabled } from './dist-electron/electron/llm/codeVerification/verificationEnabled.js'; process.stdout.write(String(isCodeVerificationEnabled()));`,
    ], { cwd: process.cwd(), env: { ...process.env, NATIVELY_CODE_VERIFY: 'on' } }).toString();
    assert.equal(out, 'true');
  });
});

describe('formatAnswerPlanForPrompt — spec emission gated by the flag', () => {
  const codingPlan = planAnswer({ question: 'reverse a linked list', source: 'manual_input' });

  test('coding plan WITH includeVerificationSpec=true includes the spec instruction', () => {
    const s = formatAnswerPlanForPrompt(codingPlan, true);
    assert.match(s, /verification_spec/);
  });
  test('coding plan WITH includeVerificationSpec=false (or default) omits it', () => {
    assert.doesNotMatch(formatAnswerPlanForPrompt(codingPlan, false), /verification_spec/);
    assert.doesNotMatch(formatAnswerPlanForPrompt(codingPlan), /verification_spec/); // default false
  });
  test('NON-coding plan never gets the spec instruction even when enabled', () => {
    const general = planAnswer({ question: 'what is my name?', source: 'manual_input' });
    assert.doesNotMatch(formatAnswerPlanForPrompt(general, true), /verification_spec/);
  });
});
