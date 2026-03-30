Todo App

React + TypeScript + Supabase(prisma 이용시 query는 ORM이 아닌 native sql 사용)+ 필요시 백엔드 nestjs 로 만든 골프 스크린 및 라운딩, 파3 기록을 만들어야함
필요한 계정이나 키값은 .env에서 설정하고 필요시 나에게 물어보고 만들어봐


인증 (Authentication)
* 이메일/비밀번호 로그인 및 회원가입
* Google OAuth 로그인 (리디렉션 방식)
* 하이웍스 SSO 인증
* 세션 자동 유지 (새로고침해도 로그인 상태 보존)
* 오류 메시지 한국어 번역

골프 기록 관리 (CRUD)
* 추가: 파3, 필드, 스크린, CC명 골프등 기록 
* 수정: 기록 내용등 수정
* 삭제: × 버튼으로 항목 삭제
* 낙관적 업데이트(Optimistic Update)로 빠른 UI 반응


* 간단한 골프 필드나 파3, 스크린 예정되어 있다고 공지 게시판 만드는것도 좋을듯 누구나 예약 가능함 (추가 삭제 수정기능)

* 라이트 ↔ 다크 모드 토글 버튼
* 로그인 전/후 모두 사용 가능 (우측 상단 고정 버튼)
* 로그인 상태: 선택한 테마를 DB에 저장 (기기 간 동기화)
* 비로그인 상태: localStorage에 저장 + OS 다크모드 자동 감지


슬랙 명령	설명
일반 텍스트 입력	자동으로 추가 삭제 
/glist	최근 골프 기록 리스트
/gsave [번호] [-1,0,1,2,3,4]	기록 이미 기록되어 있다면 업데이트


배포 (Railway)
* 이 레포는 루트 `Dockerfile` 기준으로 Railway에 바로 배포 가능
* Railway Variables에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 넣으면 됨
* GitHub 저장소 연결 후 Deploy 하면 `frontend`를 빌드해서 정적 서버로 공개됨
* 배포 후 발급된 Railway 도메인을 Supabase Auth의 `Site URL`과 `Redirect URLs`에 추가해야 Google 로그인 정상 동작
* 헬스체크 경로는 `/health`
