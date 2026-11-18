# 오르빗 게이트

한국 초등학교 6학년 실과 「인공지능이 만들어지는 과정」과 연결한 1인용 3D 우주항 검문 디펜스입니다.

- [학생 게임](https://207studio-founder.github.io/orbit-gate-academy/)
- [교사용 HTML 슬라이드](https://207studio-founder.github.io/orbit-gate-academy/teacher.html)
- [학생 입장 QR 크게 보기](https://207studio-founder.github.io/orbit-gate-academy/#teacher) · [QR 이미지](assets/join.png)

## 수업에서

40분 수업이라면 AI 기초와 조작 안내에 5분, 트럭 검사와 사례 수집에 12분, 학습·프로그래밍·평가에 15분, 생활 속 사례와 결과표에 8분을 쓸 수 있습니다. 학생용 첫 입장에도 같은 8장의 안내가 나옵니다.

레인저는 WASD 또는 방향키로 걷고 Shift로 달립니다. Space로 점프하며 드래그나 Z·C로 시점을 돌립니다. 운전석에서 E로 통행증을 받고 Q로 하차를 요청합니다. 화물칸으로 걸어가 덮개를 걷고 실물을 확인한 뒤 통과·보류 레버를 조작합니다. 도주·월담·괴물 경보가 울리면 가까이에서 F로 그물을 펼칩니다. 한 근무는 보호막 3개로 시작합니다.

두 건을 판정하면 학생이 직접 붙인 통과·보류 사례로 첫 모델을 학습할 수 있습니다. 날짜, 얼굴, 화물 등 어떤 단서를 학습에 쓸지 고르고 예측을 게이트 동작에 연결합니다. 같은 새 수송대를 최대 네 모델에 동시에 보내고 잘못 통과시킨 건수와 잘못 보류한 건수를 따로 살핍니다. 데려온 사례를 다시 판정하고 재학습할 수 있습니다.

검문소에서 번 크레딧으로 그물총, 펄스 펜스, 자동 그물 포탑, 부츠를 강화합니다. 담당 레일을 확장하면 훈련한 AI가 새 운송건을 판정해 수입을 더합니다. 항로 방어에 한 번 성공하고 레일을 두 개 이상 확보하면 우주 콘도 회원권에 도전할 수 있습니다.

결과표에 이름 또는 닉네임과 소감을 입력하고 PNG 또는 PDF로 저장해 교사가 지정한 과제함에 제출합니다. 학생 계정은 필요하지 않습니다. 판정·학습·장비는 해당 기기 브라우저의 로컬 저장소에 남습니다.

## 실행과 빌드

루트에서 `python -m http.server`를 실행한 뒤 브라우저에서 로컬 서버를 엽니다. GitHub Pages에는 완성된 정적 파일과 게임 엔진이 포함돼 있습니다.

3D 메시, 이동·충돌, 이벤트, 포획, 장비·경제를 Rust로 구현하고 WebAssembly로 배포합니다. WebGL에서 배경과 움직이는 물체를 두 묶음으로 그립니다. WebGL을 사용할 수 없으면 같은 3D 장면을 Rust에서 직접 그립니다. 브라우저는 입력, 화면, 파일 저장을 담당합니다. 모델 학습에는 학생의 판정과 선택한 특징을 사용하는 이진 결정 트리가 쓰입니다.

```sh
rustup target add wasm32-unknown-unknown
cargo build --release --manifest-path engine/Cargo.toml --target wasm32-unknown-unknown
```

생성한 `engine/target/wasm32-unknown-unknown/release/orbit_port.wasm`을 `assets/port.wasm`에 복사한 뒤 `node --test engine/field.test.cjs`로 출입 검사, 그물·자동 방어, 목숨, 뇌물 정산, 레일 구매를 확인할 수 있습니다.

## 제작 자료

3D 인물·물건·시설과 인터페이스는 이 게임을 위해 제작했습니다. 표지 일러스트는 이미지 생성 도구로 제작했습니다. 도감 이미지 렌더링에 사용한 Three.js의 MIT 라이선스와 Black Han Sans의 SIL Open Font License는 `vendor/`에 있습니다.

