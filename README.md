# POSSESS v0.1.0 - com.woojik01.possess
## PWA + Google Play 겸용 빌드

횡스크롤 기생 플랫포머. 프로토타입 탑다운에서 완전 장르 변경된 v0.1.0

### v0.1.0 스펙 요약
- 플레이어블: 작은 검은 벌레 기생충 (THE WORM) - 약한 침식탄
- 일반 적 4종: CRAWL, SPITTER, HOPPER, CHARGER - 침식탄 맞으면 즉시 기생
- 희귀 적 3종: PHANTOM(위상 대시 벽관통), BLIGHT(부패 오라), WRAITH(벽/천장 매달리기) - 처치 후 잔류핵 접촉 기생
- 중간 보스 랜덤: GORGER, SEER / 최종 보스: MOTHER
- 맵: 네모네모 기반 랜덤 타일 생성 (20x15 룸 12개)
- 가로형, 픽셀 아트, 설정에서 오토에임 ON/OFF
- 광고: 3데스마다 전면 광고 + 리워드 광고 부활

### PWA 빌드 (이번 변경 사항)
이번 버전은 PWA로 변경됨.
- `www/manifest.json` - 설치 가능한 웹앱, landscape, standalone
- `www/sw.js` - 오프라인 캐시, Service Worker
- `www/icons/icon-192.png, icon-512.png` - PWA 아이콘 (기생충 스프라이트 기반)
- `www/index.html`에 manifest + apple-touch-icon + SW 등록 추가

#### PWA 테스트 방법
1. 로컬 서버 필수 (file:// 로는 SW 안됨)
```bash
cd POSSESS_v0.1.0/www
npx serve .
# 또는 python -m http.server 8000
```
2. Chrome에서 https:// 또는 localhost로 접속
3. 주소창에 [설치] 버튼 또는 DevTools > Application > Manifest 확인
4. 오프라인 체크: DevTools > Application > Service Workers > Offline 체크 후 새로고침해도 동작

#### PWA -> Google Play (TWA) 배포
PWA 빌드를 그대로 Google Play에 올릴 수 있음:
- Bubblewrap 사용:
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-domain.com/manifest.json
bubblewrap build
```
- 또는 기존 Capacitor 방식 유지: `npx cap add android` 하면 PWA 파일 그대로 WebView로 감싸져서 `com.woojik01.possess`로 AAB 생성 가능. manifest의 start_url이 그대로 사용됨.

### Google Play (Capacitor) 빌드 유지
- `capacitor.config.json` 그대로 유지. appId: com.woojik01.possess
- `npm install && npx cap sync && npx cap open android`

### AdMob
- 전면 ID: ca-app-pub-3940256099942544/1033173712 (테스트)
- 리워드 ID: ca-app-pub-3940256099942544/5224354917 (테스트)
- 실제 배포 시 admob.com에서 발급받아 교체

### 파일 구조
```
www/
  index.html (PWA manifest + SW 등록)
  manifest.json
  sw.js
  style.css
  js/game.js (횡스크롤 엔진)
  js/admob.js
  icons/
  assets/sprites/parasite.png
```

### 다음 버전
- 전체 스프라이트 시트 교체, 사운드, PWA 푸시 알림
