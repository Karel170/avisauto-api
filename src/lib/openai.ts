import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

export type Tone = "chaleureux" | "professionnel" | "direct";
export type Length = "court" | "moyen" | "long";
export type Style = "remerciement" | "excuse" | "resolution" | "neutre";
export type Sentiment = "positif" | "neutre" | "negatif";

export async function detectSentiment(text: string): Promise<Sentiment> {
  if (!text || text.trim().length === 0) return "neutre";
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un analyseur de sentiment. Reponds UNIQUEMENT avec un seul mot: 'positif', 'neutre', ou 'negatif'." },
        { role: "user", content: `Quel est le sentiment de cet avis Google: "${text}"` },
      ],
      max_tokens: 10,
    });
    const sentiment = response.choices[0]?.message?.content?.trim().toLowerCase();
    if (sentiment === "positif" || sentiment === "negatif" || sentiment === "neutre") {
      return sentiment as Sentiment;
    }
    return "neutre";
  } catch {
    return "neutre";
  }
}

export async function generateAiResponse(params: {
  reviewText: string;
  authorName: string;
  rating: number;
  sentiment: Sentiment;
  companyName: string;
  signature: string;
  tone: Tone;
  length: Length;
  style: Style;
}): Promise<string> {
  const { reviewText, authorName, rating, sentiment, companyName, signature, tone, length, style } = params;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `Tu es un expert en relation client pour ${companyName}. Redige des reponses professionnelles aux avis Google EN FRANCAIS. Termine par la signature: "${signature}"` },
      { role: "user", content: `Redige une reponse a cet avis Google:\nClient: ${authorName}\nNote: ${rating}/5\nAvis: "${reviewText || "(Pas de commentaire)"}"` },
    ],
    max_tokens: 400,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export async function reformulateResponse(params: {
  reviewText: string;
  currentResponse: string;
  instructions: string;
  companyName: string;
  signature: string;
  tone?: Tone;
  length?: Length;
}): Promise<string[]> {
  const { reviewText, currentResponse, instructions, companyName, signature } = params;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `Tu es un expert en relation client pour ${companyName}. Genere 3 VARIANTES differentes EN FRANCAIS. Separe les 3 variantes par "---VARIANTE---". Termine par la signature: "${signature}"` },
      { role: "user", content: `Avis: "${reviewText || "(pas de texte)"}"\nReponse actuelle: "${currentResponse}"\nInstructions: "${instructions}"\n\nGenere 3 variantes.` },
    ],
    max_tokens: 800,
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content?.trim() || "";
  const variants = content.split("---VARIANTE---").map((v) => v.trim()).filter(Boolean);
  while (variants.length < 3) variants.push(content);
  return variants.slice(0, 3);
}