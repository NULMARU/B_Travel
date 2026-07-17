# sample-vault — B_Travel 테스트용 vault

> B_Travel 웹앱(https://nulmaru.github.io/B_Travel/) 에서 "vault 폴더 선택" 시
> **이 폴더(`sample-vault`)를 선택**하세요. (그 안의 `rides/` 가 아니라 한 단계 위)

## 폰에서 쓰는 법

1. 이 zip 을 **카톡 나에게 전송** 등으로 폰에 보내기
2. 폰의 파일 관리자에서 **다운로드** 또는 **Documents** 폴더에 압축 풀기
   → `sample-vault/` 폴더가 생김
3. 삼성 인터넷에서 `https://nulmaru.github.io/B_Travel/` 열기
4. "🗂 vault 폴더 선택" → 파일 선택기에서 방금 푼 `sample-vault/` 폴더 선택
5. 권한 허용 → 자동으로 `/rides` 화면 이동 → "한강-잠실여의도" 라이딩 1건 표시
6. 카드 탭 → 본문 / 현장메모 / 사실 / meta 4탭 확인

## 폴더 구조

```
sample-vault/
└── rides/
    └── 2026-05-18_한강-잠실여의도/
        ├── index.md
        ├── field-notes.md
        ├── geo-fact.md
        ├── geo-fact.en.md
        ├── meta.yaml
        ├── README.md
        ├── gpx/ride.gpx
        ├── photos/
        └── tts/
```
