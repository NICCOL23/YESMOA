# YESMOA 관리자 문자 알림

현재 기본값은 알림 꺼짐, 수신 번호 없음, 실제 발송 준비 안 됨입니다.
관리자는 웹사이트 하단의 ‘문자 알림 설정’에서 번호와 켜기/끄기를 저장합니다.
live_ready=false이면 신규 접수는 모의 발송 기록만 만들며 외부 발송은 하지 않습니다.
번호는 접수 시점에 저장되므로 변경은 이후 신규 신청에 적용됩니다.
알림을 끄는 설정 역시 신규 신청에 적용됩니다. 이미 처리 중인 문자를 취소하지 않습니다.

## 활성화 준비

1. SOLAPI 가입 및 발신번호 인증, 발송 잔액 준비. 가입/충전/시험 발송은 사용자 확인 후 진행합니다.
2. Supabase Edge Function sms-notifications를 배포합니다.
3. Supabase Secrets에 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER,
   SMS_WORKER_TOKEN(충분히 긴 임의 비밀값), SMS_LIVE_ENABLED=false를 설정합니다.
   비밀값을 공개 저장소, SQL 쿼리 이력, 프런트엔드 또는 채팅에 붙여넣지 않습니다.
4. sms-schedule.sql로 설치한 Supabase Cron은 1분 간격으로 확인합니다.
   live_ready=false일 때는 외부 호출 없이 종료합니다.
   POST URL: 프로젝트 /functions/v1/sms-notifications
   x-sms-worker-token 헤더: Vault의 yesmoa_sms_worker_token에 SMS_WORKER_TOKEN과 동일한 값을 저장합니다.
   Vault의 yesmoa_sms_gateway_jwt에 플랫폼 검증을 통과하는 서버용 legacy JWT를 저장합니다.
   Authorization Bearer 헤더는 이 Vault 값을 사용합니다.
   함수는 플랫폼 JWT 검증과 별도로 이 비밀 헤더를 검증합니다. 토큰 없이 호출하면 401입니다.
   pg_cron / pg_net과 Vault 사용: https://supabase.com/docs/guides/functions/schedule-functions
5. 사용자 확인 후 SMS_LIVE_ENABLED=true를 설정하고 sms_settings.live_ready=true를
   서버 관리자가 적용합니다. 일반 관리자 웹 UI에는 실제 발송 준비 값을 바꾸는 기능이 없습니다.
6. 승인받은 수신 번호로 시험 접수 1건을 발송하고 SOLAPI 발송 내역 및 실제 수신을 확인합니다.

## 처리 보장과 기록

- AFTER INSERT 트리거만 사용합니다. 수정/삭제/복구는 문자 알림을 만들지 않습니다.
- request_id UNIQUE 및 SKIP LOCKED claim으로 접수 1건당 단일 발송 시도를 보장합니다.
- 신청 저장과 알림 외부 전송을 분리했습니다. 큐 오류는 SQLSTATE만 경고로 기록하고 신청을 막지 않습니다.
- accepted는 문자 서비스 접수 완료이며 휴대폰 최종 수신 완료를 의미하지 않습니다.
- 타임아웃/5xx/worker 중단은 unknown으로 기록하며 자동 재발송하지 않습니다.
  중복 과금을 방지하기 위해 SOLAPI 내역을 확인한 후 운영자가 판단해야 합니다.
- 외부 전송 후 결과 저장 실패 역시 재발송하지 않습니다. 5분 후 unknown으로 기록됩니다.
- 알림 제목과 수신 번호는 비공개 테이블에 저장됩니다. 목록 UI에는 시각/상태/오류 코드만 표시합니다.
- 로그에는 API 응답 원문, 고객 본문, 비밀번호, 연락처, 계좌번호를 저장하지 않습니다.

## 비용

2026-10-07 기준 SOLAPI 표준 단가: SMS 18원 / LMS 45원 (VAT 별도).
현재 메시지는 제목과 링크를 포함하므로 LMS로 고정합니다. 100건 약 4,950원(VAT 포함).
실제 요금은 계정 계약 및 https://solapi.com/pricing 을 확인하세요.

## 배포 파일

- sms-notifications.sql: 테이블, 권한, 설정 RPC, 접수 트리거, worker RPC
- sms-notifications-server.ts: 서버 발송 worker
- board.js / board.css / index.html: 관리자 설정 화면
