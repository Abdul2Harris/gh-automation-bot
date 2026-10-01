import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";
const SIGNATURE_PATTERN = /^sha256=[0-9a-f]{64}$/i;

export function verifyGitHubWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
) {
  if (!secret || !SIGNATURE_PATTERN.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload, "utf8").digest();
  const received = Buffer.from(signature.slice(SIGNATURE_PREFIX.length), "hex");

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
