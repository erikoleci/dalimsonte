import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Only keeping the Promo Generator as per new requirements 
// (Search is now internal/local only)

export const generatePromoDescription = async (venueName: string, eventDetails: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Shkruaj një përshkrim të shkurtër, tërheqës dhe "hype" për Instagram për një event tek ${venueName}. Detajet: ${eventDetails}. Përdor emoji dhe zhargonin e të rinjve në Tiranë. Përgjigju vetëm me përshkrimin, pa kllapa apo tekst shtesë.`
        });
        return response.text || "";
    } catch (e) {
        return "Ejani të festoni me ne! Muzikë e mirë dhe atmosferë fantastike.";
    }
}