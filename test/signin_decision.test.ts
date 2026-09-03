import test from "node:test";
import assert from "node:assert/strict";
import { CallbackBody, decideSignIn } from "../src/signin_decision.ts";

test("a new provider account with a middling score has to confirm by email", () => {
  assert.deepEqual(decideSignIn(0.55, true), {
    action: "email_step_up",
    deliver_asset: false,
    reason: "new_account_low_score",
  });
});

test("the same score lets a returning subscriber through to the download", () => {
  const outcome = decideSignIn(0.55, false);
  assert.equal(outcome.action, "grant_session");
  assert.equal(outcome.deliver_asset, true);
});

test("a trusted score delivers on the first sign-in too", () => {
  assert.equal(decideSignIn(0.93, true).action, "grant_session");
});

test("the callback body rejects an unknown provider", () => {
  const result = CallbackBody.safeParse({
    provider: "twitter",
    provider_account_id: "42",
    email: "buyer@example.com",
    widget_record_id: "widget_123",
    captcha_token: "tok",
    first_sign_in: true,
    asset_slug: "lightroom-presets-vol2",
  });
  assert.equal(result.success, false);
});

test("the callback body requires the captcha widget record", () => {
  const result = CallbackBody.safeParse({
    provider: "github",
    provider_account_id: "42",
    email: "buyer@example.com",
    captcha_token: "tok",
    first_sign_in: true,
    asset_slug: "lightroom-presets-vol2",
  });
  assert.equal(result.success, false);
});
