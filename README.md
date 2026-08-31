# MARTIGUE 탈취제 디자인 투표 대시보드

기존 `dashboard.html`의 디자인을 유지하면서 Google Sheets 응답을 읽어 **60초마다 자동 갱신**하도록 만든 GitHub Pages용 파일 세트입니다.

## 연결된 Google Sheets

- Spreadsheet ID: `1sR1aDzK0dCqfCrYrir7LoCXTL206OsZe-abhzajzIig`
- Sheet GID: `426494944`
- 설정 파일: `config.js`

## 1. Google Sheets 공유 설정

GitHub Pages에서 데이터를 읽으려면 해당 시트가 브라우저에서 조회 가능해야 합니다.

1. Google Sheets 우측 상단 **공유** 클릭
2. **일반 액세스 → 링크가 있는 모든 사용자 → 뷰어**로 설정
3. 원본 응답에 이메일/이름 등 개인정보가 있다면, 원본을 공개하지 말고 `성별 / 연령대 / 디자인 선택`만 가져오는 별도 공개용 시트를 만든 뒤 `config.js`의 `sheetId`, `gid`를 그 시트로 변경하는 것을 권장합니다.

> 이 사이트는 API 키 없이 Google Visualization 응답을 사용합니다. 시트가 비공개면 화면 상단에 `연결 오류`가 표시되고 기존 정적 수치는 그대로 남습니다.

## 2. GitHub에 올리기

1. GitHub에서 새 저장소를 생성합니다. 예: `martigue-vote-dashboard`
2. 이 폴더의 파일을 **폴더째가 아니라 파일 자체를 저장소 최상위(root)** 에 업로드합니다.
   - `index.html`
   - `app.js`
   - `config.js`
   - `.nojekyll`
   - `README.md`
3. Commit 합니다.
4. 저장소 **Settings → Pages** 로 이동합니다.
5. **Build and deployment → Source: Deploy from a branch**
6. Branch를 `main`, Folder를 `/(root)`로 선택하고 Save 합니다.

보통 잠시 후 아래 형식의 주소가 생성됩니다.

`https://<GitHub아이디>.github.io/martigue-vote-dashboard/`

## 3. 데이터 인식 방식

`app.js`가 헤더를 자동 인식합니다.

- 성별: `성별`, `gender`, `sex` 포함 열
- 연령: `연령대`, `연령`, `나이`, `age` 포함 열
- 디자인: 각 행의 나머지 응답 값에서 `01`~`06`을 찾아 집계
- `01, 05`, `1번, 5번` 같은 Google Form 체크박스 응답을 지원
- 후보 번호가 열 제목이고 TRUE/1/체크값으로 저장되는 형태도 지원

## 4. 갱신 주기 변경

`config.js`의 아래 값을 수정합니다.

```js
refreshMs: 60000
```

`60000` = 60초입니다. 과도한 조회를 막기 위해 `app.js`에서 최소 30초로 제한했습니다.

## 파일 구조

```text
martigue-vote-dashboard/
├─ index.html     # 기존 대시보드 화면 + LIVE 상태 표시
├─ app.js         # Google Sheets 조회/집계/화면 갱신
├─ config.js      # Sheet ID, GID, 갱신주기
├─ .nojekyll      # GitHub Pages 정적 파일 처리
└─ README.md      # 배포 방법
```
