import { GoogleGenAI } from "@google/genai";

// We do not initialize the client at the top level anymore to prevent
// "Uncaught Error: An API Key must be set" from crashing the whole app on load.

export const generatePromoDescription = async (venueName: string, eventDetails: string): Promise<string> => {
    const apiKey = process.env.API_KEY;
    
    // Fallback if API Key is not configured in deployment (Vercel)
    if (!apiKey) {
        console.warn("API Key mungon. Përdorimi i AI u anashkalua.");
        return `Eja në ${venueName} për një natë të paharrueshme! ${eventDetails}. Mos mungo! 🔥`;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Shkruaj një përshkrim të shkurtër, tërheqës dhe "hype" për Instagram për një event tek ${venueName}. Detajet: ${eventDetails}. Përdor emoji dhe zhargonin e të rinjve në Tiranë. Përgjigju vetëm me përshkrimin, pa kllapa apo tekst shtesë.`
        });
        return response.text || "";
    } catch (e) {
        console.error("Gemini API Error:", e);
        return `Parti e çmendur në ${venueName}! ${eventDetails}. Atmosferë super, muzikë e mirë dhe pije pafund. Shihemi atje! 🥂`;
    }
}