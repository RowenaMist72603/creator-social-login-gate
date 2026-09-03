import { z } from "zod";

export const CallbackBody = z.object({
  provider: z.enum(["google", "github"]),
  provider_account_id: z.string().min(1),
  email: z.string().email(),
  widget_record_id: z.string().min(1),
  captcha_token: z.string().min(1),
  /** true the first time we see this provider account on the storefront */
  first_sign_in: z.boolean(),
  /** the asset the buyer was heading for before we bounced them to the provider */
  asset_slug: z.string().min(1),
});

export type CallbackBody = z.infer<typeof CallbackBody>;

export type SignInOutcome =
  | { action: "grant_session"; deliver_asset: true; reason: string }
  | { action: "email_step_up"; deliver_asset: false; reason: string };

export const TRUSTED_SCORE = 0.8;

/**
 * The one decision this service exists to make: a returning subscriber walks
 * straight through, a brand-new provider account with a middling score has to
 * confirm by email before the download is released.
 */
export function decideSignIn(score: number, firstSignIn: boolean): SignInOutcome {
  if (score >= TRUSTED_SCORE) {
    return { action: "grant_session", deliver_asset: true, reason: "trusted_score" };
  }
  if (!firstSignIn) {
    return { action: "grant_session", deliver_asset: true, reason: "returning_subscriber" };
  }
  return { action: "email_step_up", deliver_asset: false, reason: "new_account_low_score" };
}
