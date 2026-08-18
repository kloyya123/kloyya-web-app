import { AiError, resolveAiProvider } from './ai-provider';

// Example: the API route / handler that calls the AI provider.
// This is the boundary where errors must be sanitized before
// they reach the client.

export async function handleAskRequest(/* ...ctx, params */) {
  const provider = resolveAiProvider(/* config */ {} as any);

  if (!provider) {
    // Config-level failure — safe to be specific, no secrets or
    // internals leak here.
    return jsonError(503, 'AI is not configured for this workspace.');
  }

  try {
    const result = await provider.complete({
      system: '...',
      messages: [],
    });

    return jsonOk({ text: result.text });
  } catch (err) {
    if (err instanceof AiError) {
      // Log the real detail server-side only (status code, provider
      // name, etc). Never forward err.message to the client — it can
      // reveal upstream provider identity, HTTP status, and other
      // internal implementation detail.
      console.error('[ask] AI provider error', {
        provider: provider.name,
        model: provider.model,
        message: err.message, // server-side log only
      });

      return jsonError(
        502,
        'We could not get an answer right now. Please try again.',
      );
    }

    // Unexpected error shape — log full detail, still return generic.
    console.error('[ask] unexpected error', err);
    return jsonError(500, 'Something went wrong. Please try again.');
  }
}

// Stand-ins for whatever response helpers your framework uses.
function jsonOk(body: unknown) {
  return { status: 200, body };
}
function jsonError(status: number, message: string) {
  return { status, body: { error: message } };
}