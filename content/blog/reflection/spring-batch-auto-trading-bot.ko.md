---
title: Spring Batch를 이용한 직접만든 자동매매 시스템 후기
tags:
  - "batch"
  - "spring batch"
  - "java"
date: '2023-10-24'
---

거창한 내용은 아니지만 몇달전 진행했던 개인적인 경험을 공유하고자 합니다.

https://github.com/12OneTwo12/auto-trading

>해당 글에서는 어떻게 구현하는지 적어놓지 않습니다. 코드를 보실분들은 위 github 링크에 들어가서 봐주세요. 또한 제가만든 자동매매 시스템은 Spring batch의 대용량 일괄처리의 편의를 위해 설계된 목적과는 일치하지 않다고 생각합니다. 그저 학습을 위한 목적이 강하니 혹여 자동매매 시스템을 개인적으로 만들고 싶으시다면 다른 방법을 찾으시는 걸 추천드립니다.

많은 사람들이 꿈꾸는 경제적 자유를 이룰 수 있다면 얼마나 좋을까요
저또한 항상 그런 생각을 합니다.
경제적 자유를 얼른 이루어서 먹고싶은거 마음껏 먹고
하고싶은거 마음껏하며 살고 싶다는 생각은 언제나 가지고 있었습니다.

자는 도중에도 돈이 들어온다면 얼마나 좋을까를 생각하던 일상에
재밌는 생각이 떠올랐었죠.

때는 5월 제가 일을 시작한지 약 2달정도 됐을땝니다.

회사에는 Batch 서버가 돌아가고있었고, 제가 소속돼있는 개발팀이 담당하고 있는 서버중 하나였죠.
여느때와 다름없이 통장잔고를 보며 울적해하던 저는

**Batch 서버로 코인 자동매매 프로그램을 만들면 어떨까...!!!**

**자는 사이에 돈이 복사가 된다...?!**

라는 생각을 하게됩니다.

되게 재미있겠다는 생각에 바로 시작하게 됩니다.
꿈과 희망에 부푼상태로  해당 프로젝트는 시작됩니다.

물론 Batch가 아닌 단순한 scheduler로도 구현할 수 있습니다.
파이썬 쪽에는 잘돼있는 라이브러리도 많더군요.
코인 회사에서 제공해주는 라이브러리도 잘돼있더라구요.

하지만 저는 두가지 이유에서 Spring batch로 구현하기로 결정합니다.

1. 확장 가능성 ( ex. 차후 해당 시스템이 잘 돌아갔을때 동적으로 스케줄링을 하며
   코인 모델도 동적으로 선택할 수 있으면 좋겠다 )
2. Spring batch에 대한 학습 목적 ( 팀에서 담당하게 된 Spring batch 서버가 어떤 식으로 돌아가는 지 직접 만들어봐서 더 잘 이해하고 싶다 )

이렇듯 사실 거창한 이유가 있었던 건 아닙니다.

자 여기까지 제가 Spring batch를 선택한 이유였고, 거래소로는 binance를 선택했습니다.
Binance를 선택한 가장 거대한 코인 거래소 였기때문에 망할까 걱정은 안해도 된다는 이유가 컸습니다. ( ex. FTX )

구현은 크게 어렵지 않았습니다.
Batch를 어떻게 구성해야하고 Job, Step 뭐 이런 부분들은 별도로 Spring Batch를 공부하시는 걸 추천드립니다.

해당 로직의 가장 중요하다고 볼 수 있는 로직은 다음과 같습니다.
```java
    @Override
    public void process(){
        AccountInfoDto accountInfoDto = binanceService.getMyAccountPosition();
        // 계정에 있는 정보들을 가지고 와서

        if (accountInfoDto.isHasPosition()){ // 이미 Position 잡아놓은게 있다면
            if (isNeedToSell(accountInfoDto)) // 수익률을 확인해서 Positon을 종료 해야하는지 확인 
            	binanceService.sellIt(accountInfoDto); // 포지션 종료
        } else { // 포지션이 없다면
            LongOrShotAndBuyOrNot longOrShotAndBuyOrNot = longOrShotAndTheseINeedToBuy(); 
            // 지금 Position을 잡을지 또한 잡는다면 Long Position을 잡을지 Shot 포지션을 잡을지

            if (longOrShotAndBuyOrNot.isNeedToBuy() && accountInfoDto.getAvailableBalance().compareTo(BigDecimal.ZERO) > 0)
            // 포지션을 잡아야하고 돈이 있다면
                binanceService.buyIt(longOrShotAndBuyOrNot, accountInfoDto); // 질러버리기!!
        }
    }
```

계정에 있는 정보나 살지 말지 수익률 같은 경우는 binance에서 제공해주는 api들로 정보를 요청하여 확인합니다. [( Binance API 문서 )](https://www.binance.com/en/binance-api)

>사실 이 API문서 보는 일이 가장 힘들었던 일 중 하나입니다.. ㅎ ;;

이때까지만 해도 저는 꿈과 희망에 부풀어 있었죠.
곧있으면 나 부자가 되버릴지도...? ㅎㅎ
완성 후에 바로 docker 이미지로 말아서 EC2에 올려 돌렸습니다.
24시간 돌면 24시간 돈이 복사가 될테니까요!

심지어는 Github action으로 간단하게나마 CD마저 구현해뒀었습니다.

```yml
name: Java CD with Gradle

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

permissions:
  contents: read

jobs:
  build:

    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'

    - name: make properties
      run: |
        ## create application-secret.yml
        cd ./src/main/resources/config/properties
        # binance-properties.yml 파일 생성
        touch ./binance-properties.yml
        echo "${{ secrets.BINANCE }}" >> ./binance-properties.yml
        # slack-properties.yml 파일 생성
        touch ./slack-properties.yml
        echo "${{ secrets.SLACK }}" >> ./slack-properties.yml
      shell: bash

    - name: Change wrapper permissions
      run: chmod +x ./gradlew

    - name: Build with Gradle
      run: ./gradlew build -x test

    - name: web docker login
      run: docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }}
    - name: web docker build
      run: docker build --platform amd64 --build-arg DEPENDENCY=build/dependency -t ${{secrets.DOCKER_USERNAME}}/auto-trading .
    - name: web docker tag 
      run: docker tag ${{secrets.DOCKER_USERNAME}}/auto-trading ${{secrets.DOCKER_USERNAME}}/auto-trading:latest
    - name: web docker push
      run: docker push ${{secrets.DOCKER_USERNAME}}/auto-trading:latest

    - name: executing remote ssh commands using password
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ubuntu
        key: ${{ secrets.KEY }}
        port: 22
        script: |
          docker stop auto-trading
          docker rm auto-trading
          docker pull ${{secrets.DOCKER_USERNAME}}/auto-trading:latest
          docker run --name auto-trading -d -p 8080:8080 -v /etc/localtime:/etc/localtime:ro -e TZ=Asia/Seoul ${{secrets.DOCKER_USERNAME}}/auto-trading:latest
```

그렇다면 결과는 어땠을까요?? 바로 알아보시죠!

![](https://velog.velcdn.com/images/12onetwo12/post/564a7e84-0e9a-4045-9cb4-2e1c07410fc6/image.png)

**자는 사이 돈이 복사가 아닌 삭제가 되고 있던것이였다...!**

``그만알아보시죠...``

``결과는 청산엔딩이였고...``

물론 수익에서 가장 중요한건 어떤 기준으로 Position을 잡을지
Long과 Shot 기준을 잡을지 다양한 부분들이 있겠지만
제가만든 일명 ``화상갈끄니까-Auto-Tradingg-Bot``은 제 소중한 20만원을 삼키고는
두 가지 교훈을 줬습니다.

1. 뭣모르고 코인하지마라..
2. 그래도 배치는 직접 끝까지 구현해봤으니 감은 잡히지?

라는 교훈을 줬죠..

지금은 구동을 멈춘 ``화상갈끄니까-Auto-Tradingg-Bot``은 언제든 제가
번뜩이는 구매와 판매 뭐 그런 Trading 기준이 생각나면 구동을 다시 시작할겁니다.

물론 지금 약 5개월이 지난 10월이 돼서 보니 제가 적은 코드들을 보니 여기저기 다 뜯어 고치고 싶은 안좋은 코드로 보이고,
해당 자동매매 시스템은 대용량 레코드 처리에 적합한 Batch의 목적에는 맞지 않는다는 문제들이 있습니다만.

그때쯤 되면 미래의 제가 다시 고심하고 고치고 바꾸고 하지 않을까 싶습니다.
미래의 나 잘해봐라.