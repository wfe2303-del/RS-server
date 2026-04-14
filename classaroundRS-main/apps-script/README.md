# Apps Script 백엔드 설정

이 백엔드는 광고 RS 정산용 집계 서버가 아니라, 기존 결제자 원본 구글시트의 시트 목록과 시트 데이터만 읽어주는 용도입니다.

## 하는 일

- 결제자 시트 목록 반환
- 선택한 시트의 `A:L` 범위 반환
- 토큰 검증

## 배포 전 확인

1. [Code.gs](/C:/Users/user/Desktop/classaroundRS-main/apps-script/Code.gs:1)를 새 Apps Script 프로젝트에 붙여넣기
2. `apiToken`에 긴 랜덤 문자열 넣기
3. 웹앱으로 배포

기본 `spreadsheetId`는 기존 결제자 원본 스프레드시트 ID가 들어 있습니다.

## 프런트와 연결

배포 후 나온 웹앱 URL을 Vercel 또는 로컬 환경변수 `APPS_SCRIPT_URL`에 넣고, 같은 토큰을 `APPS_SCRIPT_TOKEN`에 넣으면 됩니다.

무료강의 신청자 엑셀 파일은 Apps Script로 올리지 않고 브라우저에서 직접 업로드해서 처리합니다.
