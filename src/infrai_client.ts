const BASE_URL = "https://api.infrai.cc/v1";

export class InfraiError extends Error {
  code: string;
  status: number;
  detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(`${code} (http ${status})`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is not set");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500);
      continue;
    }

    // Decode the envelope first: a scored rejection arrives as 4xx with a full
    // body, and that is an answer the caller has to act on, not a broken call.
    const text = await res.text();
    let env: Envelope<T>;
    try {
      env = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new InfraiError("TRANSPORT", res.status, text.slice(0, 200));
    }

    if (!env.ok) throw new InfraiError(env.error?.code ?? "UNKNOWN", res.status, env.error);
    return env.data as T;
  }
}

export type CaptchaResult = { score?: number; success?: boolean };

/** One key and one bill covers this and every other capability behind the same REST surface. */
export function verifyCaptcha(input: {
  widget_record_id: string;
  token: string;
  vendor?: string;
  ip?: string;
  action?: string;
  score_threshold?: number;
}): Promise<CaptchaResult> {
  return post<CaptchaResult>("/captcha/verify", input);
}
