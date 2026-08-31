// Google Sheets 연결 설정
window.DASHBOARD_CONFIG = {
  sheetId: '1sR1aDzK0dCqfCrYrir7LoCXTL206OsZe-abhzajzIig',
  gid: '426494944',
  refreshMs: 60000, // 60초마다 최신 응답 재조회
  candidateIds: ['01','02','03','04','05','06'],
  candidateColors: {
    '01':'#2f6bff','02':'#7aa0ff','03':'#00b8d4',
    '04':'#ffb020','05':'#ff5c7a','06':'#9b6dff'
  },
  // 아래 키워드로 성별/연령대 열을 자동 인식합니다.
  genderHeaderKeywords: ['성별','gender','sex'],
  ageHeaderKeywords: ['연령대','연령','나이','age'],
  // 투표 질문/후보 열만 읽도록 제한합니다. 타임스탬프 등 다른 숫자는 집계하지 않습니다.
  voteHeaderKeywords: ['디자인','선택','투표','선호','후보','마음에 드는']
};
