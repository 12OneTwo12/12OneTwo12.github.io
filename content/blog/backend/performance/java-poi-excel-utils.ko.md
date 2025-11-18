---
title: 자바 POI를 이용한 엑셀다운로드 공용 Util 클래스 만들기
tags:
  - java
  - poi
  - excel
  - util
date: '2023-11-19'
---

거창한 내용은 아니지만 몇달전 회사에서 경험했던 것을 공유하고자 합니다.

시작은 사내 관리자들이 사용하는 백오피스에서의 end user, 즉 회사 동료분들에게서의
문의사항에서 시작됐습니다.

문의사항은 다음과 같았습니다.

> 특정 Row수가 넘어가면 Excel 다운로드가 안되거나 이상하게 돼요...!

현재 우리 회사에서는 제가 입사하기 이전부터 기존 PHP로 이루어져있던 여러 서버들을 Java로 변경하는 작업을 진행중에 있었습니다.

그 중에는 백오피스 서버도 존재했습니다.

해당 백오피스에서는 게시판구현의 편의성과 용이함을 위해 datatables 라이브러리를
선택해 사용해오고 있었습니다.

해당 게시판들의 내용을 엑셀로 다운로드 받을 수 있는 기능 또한 해당 라이브러리에서 제공해주는
엑셀 다운로드 기능을 사용해왔는데요.

해당 기능에서 발생한 문제였습니다.
문제는 다음과 같았습니다.

> 엑셀 다운로드 기능이 Row수가 특정 행 미만이라면 문제가 없음
Row가 많아지면 문제가 둘중 하나로 실현됨
1. 첫 페이지의 내용만 엑셀에 담긴다.
2. 다운로드 자체가 이루어지지 않는다.

얼핏봐도 문제가 좀 있어보였습니다.

해당 문제에 관한 비슷한 글이 존재했습니다. -> [( 해당 글 )](https://datatables.net/forums/discussion/56948/excel-export-of-huge-number-of-rows)

해결방법은 chunk 방법으로 해결할 수 있다고 하는데 이 방법으로 해결할까 했지만,
몇 가지 문제가 더 존재했습니다.
다음은 end user의 또 한가지 문의사항이였습니다.

> 엑셀 다운로드도 좀 느린거같아요...!

관련된 사항도 찾아봤지만 사실 라이브러리에서 제공해주는 통합 기능같은 경우는 직접 컨트롤 하기
어려운 부분들이 존재했습니다.

그렇기에 직접 자바에서 구현하는 방법으로 진행하기로 했죠.

다행이 POI라는 Apache에서 만든 라이브러리가 존재했기때문에 비교적 쉽게 만들 수 있도록 되어 있었습니다.

참고할 점
>1) HSSF : EXCEL 2007 이전 버전(.xls)에서 사용하는 방식
    2) XSSF : EXCEL 2007 이후 버전(2007포함 .xlsx)에서 사용하는 방식
    3) SXSSF : XSSF의 Streaming Version으로 메모리를 적게 사용하여 대용량 엑셀 다운로드에 주로 사용되는 방식
    [출처] [Java 대용량 엑셀 다운로드 기능 구현|작성자 티몬개발](https://blog.naver.com/tmondev/221388780914)

저는 SXSSF방식으로 진행했습니다.

이왕 만드는 거 공용으로 사용할 수 있도록 만들고 싶었습니다.
그래서 공용 Util 클래스로 만들어서 수많은 게시판에서도 간단하게 사용할 수 있도록 하고싶었습니다. 물론 지금 볼땐 많이 부족해보이긴 합니다 ㅎ...

```java
public class ExcelUtils {

    public static SXSSFWorkbook defaultStyleExcel(String sheetName, String[] columnNames, List<?> dataList){
        SXSSFWorkbook excel = new SXSSFWorkbook();

        // Cell style - 컬럼
        CellStyle columnHeaderStyle = ExcelStyle.getColumnHeaderStyle(excel);
        CellStyle defaultStyle = ExcelStyle.getDefaultStyle(excel);
        CellStyle defaultNumberStyle = ExcelStyle.getDefaultNumberStyle(excel);
        CellStyle defaultDecimalStyle = ExcelStyle.getDefaultDecimalStyle(excel);

        int rowNo = 0; // 행 번호

        Sheet columnSheet = excel.createSheet(sheetName);
        Row columnRow = columnSheet.createRow(rowNo++);

        int columnCellNum = 0;

        for (String columnName : columnNames) {
            ExcelCellUtils.createCellWithStyle(columnRow, columnCellNum++, columnName, columnHeaderStyle);

            ExcelCellUtils.resizeCell(columnSheet, columnCellNum);
        }

        Class<?> dataClass = dataList.get(0).getClass();
        Field[] fields = dataClass.getDeclaredFields();

        int rowCellNum = 0;

        for (Object data : dataList){
            Row row = columnSheet.createRow(rowNo);

            rowCellNum = 0;

            for (Field field : fields) {
                field.setAccessible(true); // 필드에 접근하기 위해 접근성을 변경

                Object fieldValue = null;

                try {
                    fieldValue = field.get(data);
                } catch (IllegalAccessException e) {
                    throw new BadRequestException("Excel 생성을 위해 항목의 Field 값을 가져오던 도중 문제가 발생했습니다.");
                }

                if (field.getType() == Integer.class || field.getType() == BigInteger.class || field.getType() == Long.class) {
                    long value = fieldValue == null ? 0 : Long.parseLong(fieldValue.toString());
                    ExcelCellUtils.createCellWithStyle(row, rowCellNum++, value, defaultNumberStyle);
                }
                else if (field.getType() == BigDecimal.class || field.getType() == Double.class) {
                    double value = fieldValue == null ? 0 : Double.parseDouble(fieldValue.toString());
                    ExcelCellUtils.createCellWithStyle(row, rowCellNum++, value, defaultDecimalStyle);
                }
                else ExcelCellUtils.createCellWithStyle(row, rowCellNum++, fieldValue == null ? GlobalStatus.EMPTY_STRING : fieldValue.toString(), defaultStyle);
            }

            if(rowNo % 10000 == 0){
                // 10000만행 마다 주기적인 flush 진행
                try {
                    ((SXSSFSheet) columnSheet).flushRows(rowNo-1);
                } catch (IOException e) {
                    throw new BadRequestException(e.getMessage());
                }
            }

            rowNo ++;
        }

        // cell 사이즈 맞추기
        for (int i = 0; i < rowCellNum - 1; i++){
            ExcelCellUtils.resizeCell(columnSheet, i);
        }

        return excel;
    }
}
```
```java
public class ExcelCellUtils {
    public static Cell createCellWithStyle(Row row, int cellNum, Double value, CellStyle style){
        Cell cell = row.createCell(cellNum);

        if (value == null) value = 0D;

        cell.setCellValue(value);
        cell.setCellStyle(style);
        return cell;
    }
    
    public static void resizeCell(Sheet sheet, int cellNum) {
        ((SXSSFSheet)sheet).trackColumnForAutoSizing(cellNum);
        sheet.autoSizeColumn(cellNum);
        sheet.setColumnWidth(cellNum, sheet.getColumnWidth(cellNum) + 1024);
    }
}
```

해당 유틸에는 현재 다른 코드들도 많지만 주요한 부분만 가져오자면 다음과 같습니다.

데이터가 자연수인지 실수인지에 문자열인지에 따라 해당 형식을 달리하고
1만행마다 Flush를 진행해 Out of memory도 방지해 줬습니다.

여기서 Flush란 뭘까요?

>메모리에 있는 데이터를 디스크(임시파일)로 옮기고 메모리를 비워내는 것입니다.

참고하실 점 엑셀이 다운로드든 뭐든 기능을 다 하고 나면 임시 파일을 지워줘야 합니다!!

```java
// 예시
try {
    excel.write(response.getOutputStream());

    excel.close();
} catch (Exception e){
    logger.debug("파일 Output중 실패했습니다.");
} finally {
    // 임시 파일 삭제
    excel.dispose();
}
```

처음에는 뭣도 모르고 만들었다가 테스트과정에서 자꾸 Out of memory이 발생했었습니다.. ㅎ ;;

[아 엑셀다운로드 개발,,, 쉽고 빠르게 하고 싶다 (feat. 엑셀 다운로드 모듈 개발기)](https://techblog.woowahan.com/2698/)

물론 위와같은 방식을 참조해 만들까도 했지만 저희 백오피스 서버에서는 형식이 어느정도 일정했고, 회사가 스타트업인지라 위 기능구현에 충분한 시간을 할애하기 어려웠기 때문에 이정도로 하기로 결정지었습니다.

해당 기능으로 변경이후 퍼포먼스 변화는 다음과 같았습니다.

```
4~5분(브라우저 다운 case 존재, 첫 페이지만 다운로드 되는 케이스 존재) -> 1분 미만 및 해당 케이스들 사라짐
```

서버 리소스 또한 문제가 없었습니다.
약 4만 5천행의 데이터를 대상으로 기능을 실행했을때, CPU 자원을 좀 잡아먹긴하는 것 같습니다만
메모리 자원은 잘 관리하는 모습을 확인 할 수 있었습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/2ce1baf4-86f2-42fc-aa27-6e739bd2c893/image.jpg)

결과적으로 기한내에 문제를 해결할 수 있었죠.

![](https://velog.velcdn.com/images/12onetwo12/post/a46e40f0-3b97-4513-954f-8fd414414d05/image.jpg)
```
해당 4만 5천행의 데이터
```

물론 아직은 여러모로 부족한 점이 많은 기능이라고 생각합니다.

위 엑셀 다운로드 모듈 개발기처럼 공용화도 더 해야할 부분들이 보이고
리플렉션을 사용했기때문에 컴파일 시점에 문제를 잡을 수 없다는 것도 문제죠.
성능또한 리플렉션에서 좀 걸리는것 같기도 하구요.
스타일도 다양하게 먹일 수 있도록 하기도 해야하는 부분들이 존재해서
아직은 부족한 점이 많은 공용 Util 클래스 만들기였었던 것 같습니다.

어디까지나 주니어 개발자의 몸부림이라 귀엽게 봐주시면 감사할 것 같습니다.

오늘도 역시 이 글이 누군가의 도움이 되길 바라며 이만 마치겠습니다. 감사합니다!

### Reference

https://datatables.net/
https://poi.apache.org/
https://techblog.woowahan.com/2698/
https://datatables.net/forums/discussion/56948/excel-export-of-huge-number-of-rows
https://blog.naver.com/tmondev/221388780914