export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { base64, filename } = req.body;
    if (!base64) return res.status(400).json({ error: 'No PDF data provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: `You are a brand identity expert. Extract brand data from PDFs and return ONLY valid JSON, no markdown, no preamble, no explanation:
{
  "brandName": "string",
  "description": "one sentence tagline or description",
  "colors": [{ "hex": "#RRGGBB", "name": "Color name", "usage": "Primary / Secondary / Accent / Background / Text", "pantone": "optional Pantone code" }],
  "fonts": [{ "name": "Font name", "usage": "Headings / Body / Accent", "weight": "Bold / Regular / Light" }],
  "tone": "2-3 sentences describing brand tone, values and personality"
}
Extract ALL colors — convert Pantone, CMYK, RGB to HEX. Return only the JSON object.`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 }
            },
            {
              type: 'text',
              text: `Extract all brand data from this PDF brand guidelines document${filename ? ` (${filename})` : ''}.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message, full: data.error });

    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Could not parse brand data' });

    const brandData = JSON.parse(match[0]);
    return res.status(200).json(brandData);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
