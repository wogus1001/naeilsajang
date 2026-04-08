# Cloud Run Auth Server

이 디렉터리는 토스 로그인 auth 서버를 Cloud Run에 배포하기 위한 파일을 담고 있습니다.

## 준비물

- Google Cloud 프로젝트
- Artifact Registry 사용 가능 상태
- Cloud Run 사용 가능 상태
- Secret Manager에 저장된 mTLS 인증서
  - `toss-mtls-cert`
  - `toss-mtls-key`
  - 선택: `toss-mtls-ca`

## 배포 흐름

1. Artifact Registry 저장소 생성 또는 확인
2. `cloudbuild.auth.yaml` 로 auth 서버 이미지 빌드
3. `gcloud run deploy` 로 Cloud Run 서비스 배포
4. Secret Manager 비밀을 파일로 마운트

## PowerShell 배포 예시

```powershell
.\cloudrun\deploy-auth.ps1 `
  -ProjectId 'my-gcp-project' `
  -ProjectNumber '123456789012' `
  -AllowedOrigin 'https://my-frontend.example.com'
```

## 중요한 환경값

- `AllowedOrigin`
  - 프런트엔드가 auth 서버를 직접 호출할 오리진
- `TOSS_AUTH_COOKIE_SAMESITE=None`
- `TOSS_AUTH_COOKIE_SECURE=true`

위 설정은 Cloud Run auth 서버가 다른 오리진의 프런트엔드와 쿠키를 주고받을 때 필요합니다.
