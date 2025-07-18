import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { message, action, customization, crazynessLevel, gameType, players, roomCode } = await req.json();

    console.log('AI Chat request:', { message, action, customization, crazynessLevel, gameType, players, roomCode });

    let systemPrompt = '';
    let userPrompt = message;

    if (action === 'chat') {
      systemPrompt = `You are a helpful AI assistant for a party games app. You help users customize their gaming experience and provide fun suggestions. Keep responses conversational, friendly, and brief. If users mention preferences like "we are nerdy" or "we love sci-fi", remember these for future interactions.`;
    } else if (action === 'generate_would_you_rather') {
      systemPrompt = `Generate 5 "Would You Rather" questions based HEAVILY on the customization theme: "${customization}".
      
      CRITICAL: DO NOT include "Would you rather" in the options themselves. Only provide the choice content.
      
      IMPORTANT: The questions MUST be directly related to and inspired by the theme/interests mentioned in the customization. If they mention "Star Wars", include Star Wars elements. If they mention "nerdy", include nerdy/geeky scenarios.
      
      Make the questions:
      1. HEAVILY themed around the customization (this is the most important requirement)
      2. General scenarios (NOT personalized to specific players)
      3. Fun and engaging for party games
      4. Creative and thought-provoking
      5. Appropriate for the group dynamic
      
      Format the options as simple choices without "Would you rather" prefix.
      
      Example format:
      Good: {"option_a": "have superpowers", "option_b": "have unlimited money"}
      Bad: {"option_a": "Would you rather have superpowers", "option_b": "Would you rather have unlimited money"}
      
      You MUST return ONLY valid JSON with this exact structure (no markdown, no code blocks, no explanations):
      {
        "questions": [
          {"option_a": "...", "option_b": "..."},
          {"option_a": "...", "option_b": "..."},
          {"option_a": "...", "option_b": "..."},
          {"option_a": "...", "option_b": "..."},
          {"option_a": "...", "option_b": "..."}
        ]
      }`;
      userPrompt = `Generate 5 "Would You Rather" questions that are HEAVILY themed around: ${customization}. Make sure every question incorporates elements from this theme. Do NOT include "Would you rather" in the options - just provide the choice content.`;
    } else if (action === 'generate_all_questions') {
      const crazynessDescription = crazynessLevel <= 20 ? "very mild and safe" :
                                  crazynessLevel <= 40 ? "mild with some fun edge" :
                                  crazynessLevel <= 60 ? "moderately spicy and entertaining" :
                                  crazynessLevel <= 80 ? "quite dramatic and bold" :
                                  "extremely wild, dramatic, and outrageous";
      
      systemPrompt = `Generate questions for ALL three party games based HEAVILY on the customization theme: "${customization}". 
      
      CRITICAL: ALL questions must be directly related to and inspired by the theme/interests mentioned. If they mention "Star Wars", include Star Wars elements throughout. If they mention "nerdy", include nerdy/geeky scenarios. The theme should be evident in EVERY question.
      
      CRAZINESS LEVEL: ${crazynessLevel}% (${crazynessDescription})
      
      Adjust the intensity and dramatization of questions based on the craziness level:
      - 0-20%: Keep questions very mild, safe, and family-friendly
      - 21-40%: Add some fun elements but stay mostly tame
      - 41-60%: Make questions more entertaining with moderate spice
      - 61-80%: Create dramatic, bold questions that push boundaries
      - 81-100%: Go wild with outrageous, extreme, and highly dramatic scenarios
      
      Generate 20 Would You Rather questions and 15 Paranoia questions.
      
      You MUST return ONLY valid JSON with this exact structure (no markdown, no code blocks, no explanations):
      {
        "would_you_rather": [
          {"option_a": "...", "option_b": "..."},
          {"option_a": "...", "option_b": "..."}
        ],
        "paranoia": [
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."}
        ]
      }
      
      Make sure ALL questions are HEAVILY themed around the customization AND match the specified craziness level. Return ONLY the JSON object, nothing else.`;
      userPrompt = `Generate 20 Would You Rather questions and 15 Paranoia questions that are HEAVILY themed around: ${customization}. Every single question must incorporate elements from this theme. Craziness level: ${crazynessLevel}%`;
    } else if (action === 'generate_paranoia_questions') {
      const playerNames = players && players.length > 0 ? players.map(p => p.player_name).join(', ') : '';
      const playerInfo = playerNames ? `The players are: ${playerNames}.` : '';
      
      systemPrompt = `Generate 10 personalized Paranoia questions based on the customization and players. ${playerInfo}
      
      Paranoia questions should:
      1. Start with "Who is most likely to..." or similar format
      2. Be personalized to the group when player names are provided
      3. Create fun suspense and mystery
      4. Be appropriate for party games
      5. Make players curious about who was chosen
      
      You MUST return ONLY valid JSON with this exact structure (no markdown, no code blocks, no explanations):
      {
        "questions": [
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."},
          {"question": "Who is most likely to..."}
        ]
      }`;
      userPrompt = `Generate 10 Paranoia questions for: ${customization}. ${playerInfo}`;
    }

    console.log('Sending request to OpenAI:', {
      action,
      userPrompt,
      systemPrompt
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: action === 'chat' ? 0.8 : 0.9,
        max_tokens: action === 'chat' ? 200 : 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error
      });
      throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('OpenAI response:', generatedText);

    return new Response(JSON.stringify({ 
      response: generatedText,
      action: action 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});