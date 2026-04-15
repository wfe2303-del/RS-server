# 무료강의 결제 매칭 보드

고정된 결제자 원본 구글시트를 Apps Script 백엔드로 읽고, 외부에서 업로드한 무료강의 신청자 엑셀 파일과 전화번호로 매칭해서 어떤 광고매체가 결제로 이어졌는지 보는 웹앱입니다.

## 현재 동작 구조

- 결제자 원본
  - Apps Script가 고정 스프레드시트의 시트 목록과 시트 데이터를 읽음
- 무료강의 신청자
  - 사용자가 브라우저에서 `.xlsx`, `.xls`, `.csv` 파일 업로드
- 매칭
  - 브라우저에서 전화번호 정규화 후 매체별 결제 성과 계산
- 배포
  - 프런트는 Vercel
  - 백엔드 역할은 Apps Script

## 기존 결제자 원본 규칙

자세한 메모는 [legacy-payer-source.md](/C:/Users/user/Desktop/classaroundRS-main/legacy-payer-source.md)에 정리해뒀습니다.

- Spreadsheet ID: `1qclrbo3_VG-sSNIqMW4j1juzwP3nq_ZaT-y1z6WLafc`
- 이름: `C열`
- 전화번호: `D열`
- 결제금액: `L열`
- 시작 행: `2행`
- `0원` 결제는 제외

## 무료강의 신청자 파일 규칙

현재 프런트 파서는 아래 열 기준으로 읽습니다.

- 광고매체: `D열`
- 이름: `F열`
- 전화번호: `G열`
- 시작 행: `2행`

필요하면 [src/js/config.js](/C:/Users/user/Desktop/classaroundRS-main/src/js/config.js:1)의 `APPLICANTS_RULES`만 바꾸면 됩니다.

## Apps Script 설정

1. 새 Apps Script 프로젝트 생성
2. [apps-script/Code.gs](/C:/Users/user/Desktop/classaroundRS-main/apps-script/Code.gs:1) 전체 붙여넣기
3. `apiToken`만 실제 랜덤 문자열로 변경
4. `Deploy > New deployment > Web app`
5. 배포 URL 확보

기본 `spreadsheetId`와 `defaultSheetId`는 기존 원본 결제자 시트 기준으로 이미 들어 있습니다.

## Vercel 환경변수

- `APPS_SCRIPT_URL`
- `APPS_SCRIPT_TOKEN`

형식은 [.env.example](/C:/Users/user/Desktop/classaroundRS-main/.env.example:1)에 있습니다.

## 로컬 실행

PowerShell:

```powershell
$env:APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
$env:APPS_SCRIPT_TOKEN="same-token-as-code-gs"
node server.js
```

기본 주소는 `http://localhost:8080` 입니다.

## 모의 백엔드 테스트

Apps Script 없이 응답 형식만 테스트할 때는 아래처럼 실행할 수 있습니다.

```powershell
$env:MOCK_SETTLEMENTS_FILE="fixtures/mock-payers.json"
node server.js
```

모의 파일은 [fixtures/mock-payers.json](/C:/Users/user/Desktop/classaroundRS-main/fixtures/mock-payers.json:1) 입니다.
