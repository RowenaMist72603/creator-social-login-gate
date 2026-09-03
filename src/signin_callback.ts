import { createServer } from "node:http";
import { CallbackBody, decideSignIn } from "./signin_decision.ts";
import { InfraiError, verifyCaptcha } from "./infrai_client.ts";

const SCORE_FLOOR = 0.3;

async function handleCallback(raw: unknown, ip: string) {
  const parsed = CallbackBody.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: { error: "invalid_body", issues: parsed.error.issues } };
  }
  const body = parsed.data;

  let score: number;
  try {
    const result = await verifyCaptcha({
      widget_record_id: body.widget_record_id,
      token: body.captcha_token,
      ip,
      action: `signin:${body.provider}`,
      score_threshold: SCORE_FLOOR,
    });
    score = typeof result.score === "number" ? result.score : 1;
  } catch (err) {
    if (err instanceof InfraiError) {
      // A scored rejection belongs to the visitor, so it stays a 4xx for our caller.
      const status = err.status >= 400 && err.status < 500 ? 403 : 502;
      return { status, body: { error: "sign_in_blocked", code: err.code } };
    }
    throw err;
  }

  const outcome = decideSignIn(score, body.first_sign_in);
  return {
    status: 200,
    body: {
      provider: body.provider,
      email: body.email,
      asset_slug: body.asset_slug,
      score,
      ...outcome,
    },
  };
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/auth/social/callback") {
    res.writeHead(404).end('{"error":"not_found"}');
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c as Buffer));
  req.on("end", async () => {
    const ip = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
    try {
      const raw = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const { status, body } = await handleCallback(raw, ip);
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: "internal", message: (err as Error).message }));
    }
  });
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => console.log(`sign-in callback listening on http://localhost:${port}`));

export { handleCallback };
