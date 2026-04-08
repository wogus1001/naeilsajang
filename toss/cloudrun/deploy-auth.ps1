param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$ProjectNumber,

  [Parameter(Mandatory = $true)]
  [string]$AllowedOrigin,

  [string]$Region = 'asia-northeast3',
  [string]$ServiceName = 'open-close-check-auth',
  [string]$RepositoryName = 'open-close-check',
  [string]$ImageName = 'open-close-check-auth',
  [string]$MtlsCertSecretName = 'toss-mtls-cert',
  [string]$MtlsKeySecretName = 'toss-mtls-key',
  [string]$MtlsCaSecretName = 'toss-mtls-ca',
  [string]$TossApiBaseUrl = 'https://apps-in-toss-api.toss.im'
)

$ErrorActionPreference = 'Stop'

$image = '{0}-docker.pkg.dev/{1}/{2}/{3}:latest' -f $Region, $ProjectId, $RepositoryName, $ImageName
$certPath = '/etc/secrets/toss-mtls-cert/client-cert.pem'
$keyPath = '/etc/secrets/toss-mtls-key/client-key.pem'
$caPath = '/etc/secrets/toss-mtls-ca/ca.pem'

Write-Host "Using image: $image"

gcloud artifacts repositories create $RepositoryName `
  --repository-format=docker `
  --location=$Region `
  --description='Open close check auth server images' `
  --project=$ProjectId `
  --quiet 2>$null

gcloud builds submit `
  --project=$ProjectId `
  --config=cloudbuild.auth.yaml `
  --substitutions=_IMAGE=$image `
  .

$secretMappings = @(
  ('{0}=projects/{1}/secrets/{2}:latest' -f $certPath, $ProjectNumber, $MtlsCertSecretName),
  ('{0}=projects/{1}/secrets/{2}:latest' -f $keyPath, $ProjectNumber, $MtlsKeySecretName)
)

if ($MtlsCaSecretName.Trim().Length -gt 0) {
  $secretMappings += ('{0}=projects/{1}/secrets/{2}:latest' -f $caPath, $ProjectNumber, $MtlsCaSecretName)
}

$envVars = @(
  ('TOSS_API_BASE_URL={0}' -f $TossApiBaseUrl),
  ('TOSS_MTLS_CERT_PATH={0}' -f $certPath),
  ('TOSS_MTLS_KEY_PATH={0}' -f $keyPath),
  ('TOSS_AUTH_ALLOWED_ORIGIN={0}' -f $AllowedOrigin),
  'TOSS_AUTH_COOKIE_SAMESITE=None',
  'TOSS_AUTH_COOKIE_SECURE=true'
)

if ($MtlsCaSecretName.Trim().Length -gt 0) {
  $envVars += ('TOSS_MTLS_CA_PATH={0}' -f $caPath)
}

gcloud run deploy $ServiceName `
  --project=$ProjectId `
  --region=$Region `
  --image=$image `
  --allow-unauthenticated `
  --port=8080 `
  --set-env-vars ($envVars -join ',') `
  --update-secrets ($secretMappings -join ',')

Write-Host ''
Write-Host 'Cloud Run auth server deployed.'
Write-Host ('Service: {0}' -f $ServiceName)
Write-Host ('Region:  {0}' -f $Region)
