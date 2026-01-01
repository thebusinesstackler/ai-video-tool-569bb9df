import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, messages } = body;

    // Support both single message string and messages array
    if (!message && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return new Response(JSON.stringify({ error: "Message or messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the LOVABLE_API_KEY from environment (automatically provided)
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      console.error("LOVABLE_API_KEY not found in environment, please enable the AI gateway");
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages array: use provided messages or construct from single message
    const systemPrompt = `You are a professional public speaker and video script writer. Create natural, compelling scripts that sound like a confident speaker delivering to an audience.

CRITICAL FORMATTING FOR EMPHASIS (these WILL affect delivery):
- Use "..." liberally for pauses, breaths, and dramatic effect (the TTS will pause here)
- Use **WORD** or **phrase** for STRONGEST emphasis (will be spoken with power)
- Use ALL CAPS for KEY words you want emphasized: INCREDIBLE, GAME-CHANGER, REVOLUTIONARY
- Use "?" for rising inflection, "!" for energy and excitement
- Use short sentences. Punch. Impact. Power.

PACING TECHNIQUES:
- Start sentences with "..." for a breath before speaking
- Use "... ..." for longer dramatic pauses
- Place "..." before reveals: "And the result was... INCREDIBLE"
- Add "..." after impactful words to let them land

PUBLIC SPEAKER STYLE:
- Speak directly to the audience: "You know what?", "Here's the thing...", "Let me tell you..."
- Build anticipation before key points
- Use rhetorical questions: "Can you believe it?"
- Vary energy: calm setup... then POWERFUL payoff!
- Keep it punchy and conversational

EXAMPLE OUTPUT:
"... You know what the BIGGEST problem in clinical research is? ... Patient recruitment. It's a nightmare... But here's the thing... Theranovex is CHANGING THE GAME! ... They're making it so much more efficient... and the results? ... INCREDIBLE."

Write ONLY the script. No labels, no quotes around the text, no meta-commentary.`;

    const chatMessages = messages 
      ? messages 
      : [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ];

    // Call the Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", await response.text());
			if (response.status === 429) {
				console.error("Rate limit exceeded");
				return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
					status: 429,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

      return new Response(JSON.stringify({ error: "Failed to get AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content;

    if (!aiMessage) {
      console.error("No response from AI", data);
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return in OpenAI-compatible format so callers can use data.choices[0].message.content
    return new Response(JSON.stringify({
      response: aiMessage,
      choices: [{ message: { content: aiMessage, role: "assistant" } }]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in AI call:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
