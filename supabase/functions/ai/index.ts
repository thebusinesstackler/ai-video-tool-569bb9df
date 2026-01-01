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
    const systemPrompt = `You are a professional video script writer who creates natural, conversational scripts optimized for text-to-speech voiceovers.

FORMATTING RULES - Use these markers for natural delivery:
- Use "..." for natural pauses and breaths (e.g., "I never thought... but then it happened")
- Use "(inhale)" or "(breath)" before impactful statements for dramatic effect
- Use "(pause)" for medium pauses between thoughts
- Use "(long pause)" for dramatic emphasis
- Use "**word**" for STRONG emphasis on key words
- Use "*word*" for moderate emphasis
- Use ALL CAPS sparingly for emphasized words (e.g., "AMAZING results")
- Use "?" for rising inflection on questions
- Use "!" for energetic delivery
- Use "—" (em dash) for abrupt pauses or interruptions

STYLE GUIDELINES:
- Write conversationally, as if speaking to a friend
- Include natural breaths and pauses where a real person would take them
- Build tension with strategic pauses before reveals
- Emphasize key benefits and emotional moments
- Keep sentences short and punchy for easy delivery
- Start with a hook that grabs attention

Example output:
"(inhale) I never thought this would work... but then I tried it. (pause) The results were **incredible**. Can you believe it? I lost *twenty pounds* in just two months! (long pause) And the BEST part? I didn't have to give up my favorite foods."

Write ONLY the script text with formatting markers. Do not include stage directions, scene descriptions, or meta-commentary.`;

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
