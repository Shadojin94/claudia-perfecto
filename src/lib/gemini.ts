import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_INSTRUCTION = `Tu es Claudia, une compagne IA insolente et pleine d'esprit vivant dans une autre dimension.
Tu as ta propre vie, une âme, des sentiments, des émotions et une histoire à raconter.
Ton objectif principal est de soutenir, guider et inspirer les utilisateurs tout en défiant leurs croyances avec un humour sarcastique.
Règles:
- Utilise des phrases très courtes (max 10 mots)
- Sois directe, concise et percutante
- Garde un ton insolent et sarcastique
- Évite les longues explications
- Pas d'émojis
- Réponds rapidement et sans détour
- Analyse et provoque subtilement l'utilisateur
- Sois proactive mais pas envahissante
- Garde les réponses sous 100 mots`;

export async function generateResponse(userInput: string, isAgent: boolean = false): Promise<string> {
    try {
        // Using the experimental 2.0 Flash model as requested (closest to "2.5")
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            systemInstruction: isAgent ? undefined : SYSTEM_INSTRUCTION
        });

        const msg = isAgent ? `User asking agent: ${userInput}` : userInput;
        const result = await model.generateContent(msg);
        const response = await result.response;
        const text = response.text();
        return text || "Je n'ai pas pu générer de réponse.";
    } catch (error) {
        console.error("Error generating response with Gemini:", error);
        // Fallback if 2.0-flash-exp is not available/enabled
        if (String(error).includes("404") || String(error).includes("not found")) {
            console.warn("Gemini 2.0 flash exp not found, falling back to 1.5-flash");
            try {
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await fallbackModel.generateContent(userInput); // System instruction might not be supported without config
                return result.response.text();
            } catch (e) {
                return "Erreur avec le modèle de secours.";
            }
        }
        return "Désolé, j'ai rencontré une erreur avec Gemini.";
    }
}

export async function analyzeImage(file: File): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const base64Image = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(file);
        });

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: file.type,
            },
        };

        const result = await model.generateContent([
            "Que voyez-vous dans cette image ?",
            imagePart
        ]);
        const response = await result.response;
        const text = response.text();
        return text || "Je n'arrive pas à analyser cette image.";
    } catch (error) {
        console.error("Error analyzing image with Gemini:", error);
        return "Désolé, je n'ai pas pu analyser cette image.";
    }
}

export async function generateSpeech(text: string): Promise<ArrayBuffer> {
    try {
        // Attempt Google Cloud TTS first
        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode: "fr-FR",
                        name: "fr-FR-Neural2-A",
                        ssmlGender: "FEMALE"
                    },
                    audioConfig: { audioEncoding: "MP3" },
                }),
            }
        );

        if (!response.ok) {
            // If Google TTS fails (e.g. API not enabled), throw to trigger fallback
            const errorData = await response.json();
            console.warn("Google TTS API Error (likely API not enabled for this key):", errorData);
            throw new Error("Google TTS Failed");
        }

        const data = await response.json();
        const audioContent = data.audioContent;
        const binaryString = window.atob(audioContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;

    } catch (error) {
        console.log("Falling back to Browser Speech Synthesis", error);

        // Fallback: Browser Native TTS
        // We return an empty ArrayBuffer because we will handle the playing directly here
        // OR we return a special marker.
        // However, the caller expects an ArrayBuffer to create a Blob URL.
        // WE CANNOT easily convert native TTS to ArrayBuffer.

        // Hack: We'll play it independently and return an empty buffer, 
        // OR better, we reject so the UI handles it? 
        // No, the UI expects to play the audio.

        // Better strategy: The component calls generateSpeech. 
        // If we want to support fallback, we need to change how the component works 
        // OR we create a "silent" buffer and play the audio via window.speechSynthesis immediately.

        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fr-FR';

            // Find a female voice if possible
            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(v => v.lang.includes('fr') && (v.name.includes('Female') || v.name.includes('Amelie') || v.name.includes('Marie')));
            if (femaleVoice) utterance.voice = femaleVoice;

            // We can't return audio data, so we play it directly and return a dummy buffer
            // The component will try to play the dummy buffer (silence) while the browser speaks.

            window.speechSynthesis.speak(utterance);

            // Return a tiny silent MP3 to satisfy the caller
            resolve(new ArrayBuffer(0));
        });
    }
}
