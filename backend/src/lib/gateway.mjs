export const DEFAULT_GATEWAY_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway';
export const DEFAULT_MODEL = 'google/gemma-4-31B-it';

export function gatewayEndpoint(baseUrl = DEFAULT_GATEWAY_URL) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('BAZE_BASE_URL에는 인증 정보 없는 HTTPS 기본 주소를 입력해 주세요.');
  return `${url.href.replace(/\/+$/, '')}/chat/completions/`;
}

const boxSchema = { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 };
export const analysisSchema = {
  type: 'object', additionalProperties: false,
  required: ['stage', 'kind', 'store', 'message', 'candidates', 'choices'],
  properties: {
    stage: { type: 'string', enum: ['place', 'menu', 'payment', 'complete'] },
    kind: { type: 'string', enum: ['guide', 'retake', 'wrong', 'ask', 'complete'] },
    store: { type: 'string' }, message: { type: 'string' },
    candidates: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'box'], properties: { label: { type: 'string' }, box: boxSchema } } },
    choices: { type: 'array', items: { type: 'string' } }
  }
};

export function gatewayRequest(input, prompt, model = DEFAULT_MODEL) {
  return {
    model, stream: false,
    messages: [{ role: 'user', content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.image}` } }
    ] }],
    response_format: { type: 'json_schema', json_schema: { name: 'kiosk_guidance', strict: true, schema: analysisSchema } }
  };
}

export function parseGatewayResponse(result) {
  const choice = result?.choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal) throw new Error('Incomplete or refused analysis');
  const content = choice.message?.content;
  const output = typeof content === 'string' ? content
    : Array.isArray(content) ? content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join('') : '';
  // Permit a single Markdown fence; never extract an arbitrary JSON fragment from prose.
  const clean = output.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
  return JSON.parse(clean);
}
