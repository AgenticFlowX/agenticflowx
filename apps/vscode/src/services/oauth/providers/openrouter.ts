/**
 * OpenRouter OAuth descriptor with dynamic PKCE callback handling.
 */
import { type Server, type ServerResponse, createServer } from "node:http";

import { createRandomState, generatePKCE } from "./pkce";
import type { OAuthProviderDescriptor, OAuthRecord, OAuthSignInContext } from "./types";

const AUTHORIZE_URL = "https://openrouter.ai/auth";
const TOKEN_URL = "https://openrouter.ai/api/v1/auth/keys";
const CALLBACK_HOST = "127.0.0.1";
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_EXCHANGE_TIMEOUT_MS = 30_000;

interface CallbackCapture {
  code: string;
  state: string;
}

interface OpenRouterCallbackServer {
  callbackUrl: string;
  capture: Promise<CallbackCapture>;
  close: () => void;
}

function sendHtml(response: ServerResponse, status: number, html: string): void {
  response.statusCode = status;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(html);
}

function renderServerError(message: string): string {
  return `<!doctype html><meta charset="utf-8"><h1>Sign-in failed</h1><p>${message}</p>`;
}

function renderServerSuccess(): string {
  return '<!doctype html><meta charset="utf-8"><h1>Signed in</h1><p>You may close this window.</p>';
}

function combineSignals(signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const alive = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (alive.length === 0) {
    // Fallback when caller does not supply a signal.
    return new AbortController().signal;
  }
  if (alive.length === 1) {
    return alive[0]!;
  }

  const controller = new AbortController();
  const onAbort = (signal: AbortSignal): void => {
    controller.abort(signal.reason);
  };
  for (const signal of alive) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => onAbort(signal), { once: true });
  }

  return controller.signal;
}

function startCallbackServer(
  callbackPath: string,
  expectedState: string,
  signal: AbortSignal | undefined,
): Promise<OpenRouterCallbackServer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let readySettled = false;

    let resolveCapture: (value: CallbackCapture) => void = () => {};
    let rejectCapture: (error: Error) => void = () => {};
    const capture = new Promise<CallbackCapture>((resolveCaptureFn, rejectCaptureFn) => {
      resolveCapture = resolveCaptureFn;
      rejectCapture = rejectCaptureFn;
    });

    const server: Server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", `http://${CALLBACK_HOST}`);
      if (request.method !== "GET" || requestUrl.pathname !== callbackPath) {
        sendHtml(response, 404, renderServerError("OAuth callback route not found."));
        return;
      }

      const error = requestUrl.searchParams.get("error");
      if (error) {
        const message = requestUrl.searchParams.get("error_description") ?? error;
        sendHtml(
          response,
          400,
          renderServerError(`OpenRouter authorization was denied. ${message}`),
        );
        finish(new Error(`OpenRouter authorization failed: ${message}`));
        return;
      }

      const code = requestUrl.searchParams.get("code");
      const returnedState = requestUrl.searchParams.get("state");
      if (!code || !returnedState) {
        sendHtml(response, 400, renderServerError("OpenRouter returned no authorization code."));
        return;
      }
      if (!timingSafeEqualString(returnedState, expectedState)) {
        sendHtml(response, 400, renderServerError("OpenRouter callback state mismatch."));
        finish(new Error("OpenRouter callback state mismatch"));
        return;
      }

      sendHtml(response, 200, renderServerSuccess());
      finish({ code, state: returnedState });
    });

    server.on("error", (serverError) => {
      const error = serverError instanceof Error ? serverError : new Error(String(serverError));
      if (!readySettled) {
        reject(error);
      }
      finish(error);
    });

    function finish(result: CallbackCapture | Error): void {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      try {
        server.close();
      } catch {
        // ignore
      }
      if ("code" in result) {
        resolveCapture(result);
      } else {
        rejectCapture(result);
      }
    }

    const onAbort = () => finish(new Error("Login cancelled"));
    signal?.addEventListener("abort", onAbort, { once: true });

    server.listen(0, CALLBACK_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        const error = new Error("Could not determine OpenRouter OAuth callback port");
        reject(error);
        finish(error);
        return;
      }
      const callbackUrl = `http://${CALLBACK_HOST}:${address.port}${callbackPath}`;
      readySettled = true;
      resolve({
        callbackUrl,
        capture,
        close: () => finish(new Error("Login cancelled")),
      });
    });

    const timeout = setTimeout(
      () => finish(new Error("OpenRouter OAuth login timed out")),
      LOGIN_TIMEOUT_MS,
    );
  });
}

function errorDetail(body: Record<string, unknown>): string | undefined {
  if (typeof body["error_description"] === "string") return body["error_description"];
  if (typeof body["message"] === "string") return body["message"];
  if (typeof body["error"] === "string") return body["error"];
  if (
    typeof body["error"] === "object" &&
    body["error"] !== null &&
    !Array.isArray(body["error"])
  ) {
    const message = (body["error"] as Record<string, unknown>)["message"];
    if (typeof message === "string") {
      return message;
    }
  }
  return undefined;
}

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = await response.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function exchangeForApiKey(input: {
  code: string;
  verifier: string;
  signal: AbortSignal | undefined;
}): Promise<OAuthRecord> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      code: input.code,
      code_verifier: input.verifier,
      code_challenge_method: "S256",
    }),
    signal: input.signal,
  });

  const body = await readBody(response);
  if (!response.ok) {
    const safeBody = body ?? {};
    const error =
      typeof safeBody["error"] === "string"
        ? safeBody["error"]
        : typeof safeBody["message"] === "string"
          ? safeBody["message"]
          : (errorDetail(safeBody) ?? `HTTP ${response.status}`);
    throw new Error(`OpenRouter key exchange failed (${error})`);
  }

  if (!body || typeof body["key"] !== "string" || !body["key"]) {
    throw new Error('OpenRouter token response missing "key"');
  }
  const key = body["key"];

  return {
    access: key,
    refresh: "",
    expires: Number.MAX_SAFE_INTEGER,
  };
}

async function begin(context: OAuthSignInContext): Promise<OAuthRecord> {
  const pkce = await generatePKCE();
  const state = createRandomState();
  const callbackPath = `/oauth/callback/${crypto.randomUUID()}`;
  const callback = await startCallbackServer(callbackPath, state, context.signal);

  try {
    const authorizeUrl = new URL(AUTHORIZE_URL);
    authorizeUrl.search = new URLSearchParams({
      callback_url: callback.callbackUrl,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state,
    }).toString();

    context.callbacks.onAuthUrl?.({ url: authorizeUrl.toString(), proactivePaste: false });
    context.callbacks.onProgress?.("OpenRouter: waiting for sign-in in your browser");

    const payload = await callback.capture;
    const signal = combineSignals([context.signal, AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS)]);
    return exchangeForApiKey({
      code: payload.code,
      verifier: pkce.verifier,
      signal,
    });
  } finally {
    callback.close();
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export const openRouterOAuthProvider: OAuthProviderDescriptor = {
  id: "openrouter",
  displayName: "OpenRouter",
  flow: "pkce-loopback",
  dualMethod: true,
  authorizeUrl: AUTHORIZE_URL,
  tokenUrl: TOKEN_URL,
  scopes: "",
  clientId: "",
  begin,

  refresh(record: OAuthRecord): Promise<OAuthRecord> {
    return Promise.resolve({
      access: record.access,
      refresh: "",
      expires: Number.MAX_SAFE_INTEGER,
    });
  },

  credToKey(record: OAuthRecord): string {
    return record.access;
  },
};
