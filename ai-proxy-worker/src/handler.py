import os
import json
import sys
# Using http.client for standard library HTTP requests
import http.client
from urllib.parse import urlparse

# Import necessary types for type hinting if using a framework like Starlette/FastAPI
# from starlette.requests import Request
# from starlette.responses import JSONResponse, Response
# If using a simpler template, direct response construction might be needed.
# This example assumes direct construction might be needed, but adjust if using a framework.

# --- Configuration ---
MODEL_NAME = "gemini-pro"
# Replace with your actual GitHub Pages URL for CORS
ALLOWED_ORIGIN = "https://clownai.github.io"
# ---------------------

# Placeholder simple Response class if not provided by a framework
class Response:
    def __init__(self, content, status_code=200, headers=None):
        self.content = content
        self.status_code = status_code
        self.headers = headers if headers is not None else {}

async def on_fetch(request, env):
    """
    Handles incoming fetch requests.
    Args:
        request: The incoming request object (structure depends on runtime/framework).
        env: An object containing environment variables and secrets.
    Returns:
        A Response object.
    """
    # Set CORS headers for OPTIONS preflight requests and actual requests
    cors_headers = {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return Response("", status_code=204, headers=cors_headers)

    # Only allow POST requests for the actual API call
    if request.method != 'POST':
        return Response(json.dumps({"error": "Expected POST request"}), status_code=405, headers=cors_headers)

    # Get Gemini API Key from secrets
    try:
        api_key = env.GEMINI_API_KEY
        # In some environments, secrets might be directly in os.environ
        # if not api_key:
        #     api_key = os.environ.get('GEMINI_API_KEY')

        if not api_key:
            print("Error: GEMINI_API_KEY secret not found.", file=sys.stderr)
            return Response(json.dumps({"error": "API key not configured"}), status_code=500, headers=cors_headers)
    except AttributeError:
         print("Error: Could not access environment secrets (env object missing GEMINI_API_KEY).", file=sys.stderr)
         # Fallback attempt for standard OS env var - might not work in all worker runtimes
         api_key = os.environ.get('GEMINI_API_KEY')
         if not api_key:
             return Response(json.dumps({"error": "API key environment variable not found."}), status_code=500, headers=cors_headers)


    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={api_key}"

    try:
        # Get prompt from request body
        try:
             # Accessing request body might differ based on runtime/framework
             # Common patterns: await request.json(), json.loads(await request.body())
             request_body = await request.json()
             user_prompt = request_body.get("prompt")
        except Exception as parse_err:
             print(f"Error parsing request JSON: {parse_err}", file=sys.stderr)
             return Response(json.dumps({"error": "Invalid JSON in request body"}), status_code=400, headers=cors_headers)


        if not user_prompt:
            return Response(json.dumps({"error": "Missing 'prompt' in request body"}), status_code=400, headers=cors_headers)

        # Prepare Gemini API payload
        gemini_payload = {
            "contents": [{"parts": [{"text": user_prompt}]}],
            # Optional: Add generationConfig if needed
            # "generationConfig": {
            #     "temperature": 0.7,
            #     "maxOutputTokens": 256,
            # },
        }
        payload_bytes = json.dumps(gemini_payload).encode('utf-8')

        # Make the API call using http.client
        parsed_url = urlparse(api_url)
        connection = http.client.HTTPSConnection(parsed_url.netloc)

        headers = {'Content-Type': 'application/json'}

        connection.request("POST", parsed_url.path + "?" + parsed_url.query, body=payload_bytes, headers=headers)
        gemini_http_response = connection.getresponse()

        response_status = gemini_http_response.status
        response_body_bytes = gemini_http_response.read()
        connection.close()

        if response_status != 200:
            error_text = response_body_bytes.decode('utf-8', errors='ignore')
            print(f"Gemini API Error ({response_status}): {error_text}", file=sys.stderr)
            return Response(json.dumps({"error": f"Error from Gemini API: Status {response_status}"}), status_code=response_status, headers=cors_headers)

        # Parse Gemini response
        gemini_data = json.loads(response_body_bytes.decode('utf-8'))

        # Extract generated text (use .get for safety)
        try:
            generated_text = gemini_data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', "Sorry, couldn't parse the response.")
        except (IndexError, KeyError, TypeError) as parse_err:
            print(f"Error parsing Gemini response structure: {parse_err}", file=sys.stderr)
            print(f"Received data: {gemini_data}", file=sys.stderr)
            generated_text = "Sorry, failed to parse the AI response."

        # Prepare response for the frontend
        response_payload = {"generatedText": generated_text}

        # Return response with CORS headers
        final_headers = cors_headers.copy()
        final_headers['Content-Type'] = 'application/json'

        return Response(json.dumps(response_payload), status_code=200, headers=final_headers)

    except Exception as e:
        print(f"Worker Error: {e}", file=sys.stderr)
        # Add traceback for debugging if possible/needed
        # import traceback
        # print(traceback.format_exc(), file=sys.stderr)
        return Response(json.dumps({"error": f"Internal Server Error: {str(e)}"}), status_code=500, headers=cors_headers)

# Note: The exact way to expose 'on_fetch' depends on the Python worker runtime.
# If using a framework like Starlette/FastAPI, you'd define routes instead.
# If using Pyodide, the setup might be different.
# This basic structure assumes a simple request handler model. Check wrangler.toml
# or generated files for the expected entry point.