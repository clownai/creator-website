/**
 * Cloudflare Worker: AI Proxy for Hugging Face Inference API
 */

// --- Configuration ---
// Choose a Hugging Face model ID suitable for text generation
// Examples: "gpt2", "distilgpt2", "google/flan-t5-base" (flan-t5 needs different payload)
const HF_MODEL_ID = "gpt2"; // START WITH THIS ONE!
const ALLOWED_ORIGIN = "https://clownai.github.io"; // Your GitHub Pages URL
// --- End Configuration ---

export default {
  async fetch(request, env, ctx) {

    // Define CORS headers applicable to most responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight requests (OPTIONS)
    if (request.method === 'OPTIONS') {
      console.log("HF Proxy: Handling OPTIONS preflight request.");
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow POST requests for the actual API call
    if (request.method !== 'POST') {
       console.log(`HF Proxy: Method Not Allowed: ${request.method}`);
      return new Response(JSON.stringify({ error: 'Expected POST' }), { status: 405, headers: corsHeaders });
    }

    // --- Handle POST Request ---
    try {
      console.log("HF Proxy: Handling POST request.");
      // Get the Hugging Face API token from secrets
      // *** Use 'wrangler secret put HF_API_TOKEN' to set this ***
      const HF_TOKEN = env.HF_API_TOKEN;
      if (!HF_TOKEN) {
          console.error("Error: HF_API_TOKEN secret not found.");
          return new Response(JSON.stringify({error: 'API token not configured'}), { status: 500, headers: corsHeaders });
      }

      const apiUrl = `https://api-inference.huggingface.co/models/${HF_MODEL_ID}`;

      // Read the prompt from the incoming request body
      const requestBody = await request.json();
      const userPrompt = requestBody?.prompt;

      if (!userPrompt) {
        return new Response(JSON.stringify({error:'Missing prompt in request body'}), { status: 400, headers: corsHeaders });
      }

      // Prepare the request payload for Hugging Face Text Generation
      // Note: Different models might expect slightly different formats
      const hfPayload = {
        inputs: userPrompt,
         // Optional parameters can be added here:
         // parameters: {
         //   max_new_tokens: 100, // Limit response length
         //   temperature: 0.7,
         //   // return_full_text: false, // Useful for some models
         // }
      };

      // Make the actual call to the Hugging Face Inference API
      console.log(`Calling Hugging Face API for model: ${HF_MODEL_ID}...`);
      const hfResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_TOKEN}` // Use the secret token here
        },
        body: JSON.stringify(hfPayload),
      });

      const hfResponseBody = await hfResponse.text(); // Get raw text for logging
      console.log(`HF API response status: ${hfResponse.status}`);
       // console.log("HF Raw Response:", hfResponseBody); // Uncomment for deep debugging

      if (!hfResponse.ok) {
        console.error("Hugging Face API Error:", hfResponseBody);
        // Try to parse HF error message if possible
        let errorDetail = hfResponseBody;
        try { errorDetail = JSON.parse(hfResponseBody).error || hfResponseBody; } catch (e) { /* Ignore parse error */ }
        return new Response(JSON.stringify({ error: `Error from Hugging Face API: Status ${hfResponse.status} - ${errorDetail}` }), { status: hfResponse.status, headers: corsHeaders });
      }

      const hfData = JSON.parse(hfResponseBody); // Parse JSON

      // Extract the generated text - HF often returns an array
      // Access the 'generated_text' field of the first element
      const generatedText = hfData?.[0]?.generated_text || "Sorry, couldn't parse the response from Hugging Face.";
      console.log("Successfully generated text via Hugging Face.");

      // Return the generated text to the frontend with CORS headers
      const responsePayload = { generatedText: generatedText };
      const finalHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

      return new Response(JSON.stringify(responsePayload), { status: 200, headers: finalHeaders });

    } catch (error) {
      console.error("Worker Error:", error);
      return new Response(JSON.stringify({error:`Internal Server Error: ${error.message}`}), { status: 500, headers: corsHeaders });
    }
  },
};
