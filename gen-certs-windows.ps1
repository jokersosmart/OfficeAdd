# Generate SSL Certificate Script (Windows)
Write-Host "Generating SSL certificates..." -ForegroundColor Cyan

if (-not (Test-Path "certs/localhost.conf")) {
    Write-Host "Error: certs/localhost.conf not found" -ForegroundColor Red
    exit 1
}

Push-Location certs
try {
    if (Test-Path "localhost.pem") { Remove-Item "localhost.pem" -Force }
    if (Test-Path "localhost-key.pem") { Remove-Item "localhost-key.pem" -Force }

    & openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout localhost-key.pem `
        -out localhost.pem `
        -config localhost.conf

    if (Test-Path "localhost.pem") {
        Write-Host "Success: Certificates generated!" -ForegroundColor Green
    } else {
        Write-Host "Error: Failed to generate certificates" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}