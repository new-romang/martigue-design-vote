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
  ageHeaderKeywords: ['연령대','연령','나이','age']
};
