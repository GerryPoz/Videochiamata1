import { GoogleGenAI } from "@google/genai";

export const getMeetingAssistantResponse = async (chatHistory: string, userQuery: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    Sei un assistente professionale per riunioni chiamato "Gemini Connect AI".
    Il tuo compito è aiutare i partecipanti riassumendo le discussioni, chiarendo punti o generare punti d'azione basandoti sulla trascrizione della chat fornita.
    Sii conciso, utile e professionale. Rispondi sempre in italiano.
  `;

  const prompt = `
    Cronologia Chat della Riunione:
    ${chatHistory}

    Domanda/Comando dell'utente:
    ${userQuery}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "Non sono riuscito a elaborare la richiesta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Scusa, ho problemi a connettermi al mio cervello AI in questo momento.";
  }
};