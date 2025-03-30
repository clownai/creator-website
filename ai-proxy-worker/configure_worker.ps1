<#
.SYNOPSIS
Configures the Cloudflare Worker by setting the GEMINI_API_KEY secret
and deploying the worker.

.DESCRIPTION
This script prompts the user securely for their Google Gemini API key,
sets it as a secret for the Cloudflare Worker using Wrangler, and then
deploys the worker using Wrangler. It should be run from within the
worker project directory (e.g., ai-proxy-worker).

.NOTES
Requires Wrangler CLI to be installed and logged in.
Requires the Google Gemini API key to be available.
#>

# --- Configuration ---
$SecretName = "GEMINI_API_KEY"
# --- End Configuration ---

Write-Host "Starting Cloudflare Worker Configuration..." -ForegroundColor Cyan
Write-Host "This script needs your Google Gemini API key." -ForegroundColor Yellow
Write-Host "It will be entered securely and will not be shown on screen." -ForegroundColor Yellow

# Prompt securely for the API Key
$apiKeySecure = Read-Host -Prompt "Paste your Google Gemini API Key here and press Enter" -AsSecureString

# Basic validation
if ($apiKeySecure -eq $null -or $apiKeySecure.Length -eq 0) {
    Write-Host "Error: No API key entered. Exiting." -ForegroundColor Red
    exit 1
}

# Convert SecureString to Plain Text *only* for piping to wrangler
# This is necessary because wrangler secret put expects plain text via stdin
$Ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKeySecure)
try {
    $apiKeyPlainText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($Ptr)
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr)
}

# Set the secret using Wrangler, piping the plain text key
Write-Host "Attempting to set secret '$SecretName'..." -ForegroundColor Cyan
try {
    # Pipe the plain text key directly to the command's standard input
    $apiKeyPlainText | wrangler secret put $SecretName
    # Check the exit code of the last command
    if ($LASTEXITCODE -ne 0) {
       throw "Wrangler secret put command failed with exit code $LASTEXITCODE."
    }
    Write-Host "Secret '$SecretName' set successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Error setting secret: $($_.Exception.Message)" -ForegroundColor Red
    # Optional: provide more details if needed
    # Write-Error $_
    exit 1 # Exit if secret setting failed
}
finally {
    # Clear the plain text key variable immediately after use
    Clear-Variable apiKeyPlainText -ErrorAction SilentlyContinue
}


# Deploy the worker
Write-Host "Attempting to deploy the worker..." -ForegroundColor Cyan
try {
    wrangler deploy
    if ($LASTEXITCODE -ne 0) {
       throw "Wrangler deploy command failed with exit code $LASTEXITCODE."
    }
    Write-Host "Worker deployed successfully!" -ForegroundColor Green
    Write-Host "---------------------------------------------" -ForegroundColor Green
    Write-Host "ACTION NEEDED:" -ForegroundColor Yellow
    Write-Host "Look above for the deployed Worker URL (ending in .workers.dev)." -ForegroundColor Yellow
    Write-Host "Copy that URL and update the 'WORKER_URL' variable in your website's 'script.js' file." -ForegroundColor Yellow
    Write-Host "Then, commit and push the updated 'script.js' to GitHub." -ForegroundColor Yellow

}
catch {
     Write-Host "Error deploying worker: $($_.Exception.Message)" -ForegroundColor Red
     # Write-Error $_ # Uncomment for more details if needed
     exit 1 # Exit if deploy failed
}

Write-Host "Configuration script finished."