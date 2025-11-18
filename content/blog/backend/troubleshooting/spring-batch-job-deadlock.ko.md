---
title: Spring batch job 동시 등록 Deadlock 문제 직면 ( Deadlock accessing creating a job on sqlserver when multiple jobs start at once )
tags:
  - "deadlock"
  - "spring batch"
  - "batch"
  - "java"
date: '2023-11-20'
---

이번에 제가 회사에서 직면했던 Spring batch 관련 문제에 대해 공유하고자 글을 남깁니다.

--------------------------------------

## 문제 발생

해당 문제는 에러 Slack 메세지로부터 시작됩니다.
회사 Batch 서버에서 Deadlock이 발생했다는 Stack trace였습니다.

당연하게도 Deadlock은 서비스에 심각한 영향을 줄 수 있었기 때문에 지체없이
문제를 파악하기 시작했고 로그를 까보게 됐습니다.

![](https://velog.velcdn.com/images/12onetwo12/post/20624ee0-53a1-4021-b7c4-38d1dd59cec5/image.png)

> **해당 Stack trace 중 일부**
com.mysql.cj.jdbc.exceptions.MySQLTransactionRollbackException: Deadlock found when trying to get lock; try restarting transaction

Deadlock이 발생한 시점에 실행된 Job은 총 3개 였습니다.

실행되지 않은 Job은 하나였고, 다른 2개의 Job은 문제없이 실행됐음을 확인할 수 있었습니다.

게다가 더 다행이였던 점은 실행되지 않은 Job은 운영 환경에서의 테스트를 충분히 거치기 위해 서비스에 영향이 가지 않는 선에서 실 데이터로 테스트를 하던 Job이 였기에 데이터나 서비스에 영향이 없었다는 점이였습니다.

서비스에 영향이 없다는 것을 파악하며 한시름 놓고 이제는 원인을 파악하기 시작했습니다.

-----------------------------------------------------

## 원인 분석

해당 Deadlock이 발생한 테이블은 **BATCH_JOB_INSTANCE**라는 테이블로 해당 테이블에 대해 이해하려면 Spring batch에 대한 지식이 조금 필요합니다.

저희 회사의 Batch 서버는 Spring batch로 개발돼 있습니다.

> ( 기존 PHP와 Crontab으로 이루어져 있던 batch기능들을 Spring batch로 옮기며 추가적인 개발을 하는 중 입니다. )

`Spring`에서는 `Spring batch framework`를 통해 배치작업을 위한 다양한 기능들을 간편하게 사용 할 수 있도록 제공 해 주고 있습니다.

그 중, Spring batch가 제공하는 가장 기본적인 기능으로 배치 작업 하는동안 사용되는 모든 메타정보들 (작업 시간, 파라미터, 정상수행 여부 …)을 기록하여 작업 중에 사용하거나 모니터링 용도로 사용 할 수 있게 해줍니다.

![](https://t1.daumcdn.net/cfile/tistory/99E033405B66D86909)

이러한 테이블들을 `Metadata tables`라고 하는데 **BATCH_JOB_INSTANCE**는 이러한 메타 테이블 중 하나입니다.

이게 Deadlock이 걸릴 정도로 트래픽이 많은 테이블도 아니였기 때문에 이상하다는 생각이 들었습니다.

이대로 둘 수는 없었기 때문에 당연하게도 관련 레퍼런스를 찾게됐습니다만,
아쉽게도 한글로 돼있는 관련된 글은 찾지 못했습니다.

> ( 물론 존재하지만 제가 못찾은 걸 수 있습니다 )

이는 제게는 너무 슬픈 사실이였습니다.
제 부족한 영어실력때문인지 한글을 찾게 되는 본능이 항상 남아있었기에
영어로 돼있는 글들을 읽어야한다는게 슬프게 다가왔습니다....

그러나 문제는 해결해야하기때문에 관련 사항을 찾아보다 같은 문제를 직면한 이슈를 찾게 됐습니다.

https://github.com/spring-projects/spring-batch/issues/1448

본 이슈 내용은 대략 제 상황과 비슷했습니다.

해당 이슈는 2013년 11월 22일 처음 발행됐습니다.
비슷한 내용의 글이 [stack overflow](https://stackoverflow.com/questions/70563630/spring-batch-deadlock-could-not-increment-identity-nested-exception-is-com-mi)에도 올라와 있었죠.

해당 이슈에서 말하는 원인은 다음과 같았습니다.

> In the SimpleJobRepository when creating a job it first SELECTs for the first job, then if it doesn't find one, INSERTs a new one. Unfortunately that first select (even at serializable) just takes out shared locks. So two concurrent processes both get shared (reader) locks, then both try to acquire exclusive (writer) locks -- leading to a deadlock.
##### 번역
SimpleJobRepository에서 작업을 만들 때 먼저 첫 번째 작업을 선택한 다음, 작업을 찾지 못하면 새로운 작업을 삽입합니다. 불행히도 첫 번째 SELECT 문은 공유 락(리더 락)만 획득하게 됩니다. 그래서 두 개의 동시 프로세스가 모두 공유(리더) 락을 획득한 다음, 모두 배타적(라이터) 락을 획득하려고 하면 데드락이 발생합니다

------------------------------------------------

## 문제 해결

먼저 가장 간단한 해결방법은 이랬습니다.

**1. 여러개의 Job을 동시에 실행시키지 않는다**

그러나 이는 절대 좋은 방법이 아니라는 생각이 들었습니다.
읽는과 동시에 거부감이 든 해결방법이였습니다. 이유는 많겠지만 이렇게 해결했을 때
문제는 해결되지 않은 상태이기때문에 여러 스케줄들 중 겹치는게 많아지는 시점이 존재해진다면
문제는 다시 발생하게 될 것 입니다.

그리고 이는 문제를 해결하는 것이 아닌 회피하는 방법이라는 생각이 제 개인적인 견해입니다.

이슈에서 첫번째로 제안한 해결방법은 다음과 같았습니다.

**2. Batch 관련 설정 정보 Bean 등록**

```java
@Configuration
@EnableBatchProcessing
public class BatchConfiguration {

  private static final String ISOLATION_REPEATABLE_READ = "ISOLATION_REPEATABLE_READ";

  @Autowired
  private DataSource dataSource;
  @Autowired
  private PlatformTransactionManager platformTransactionManager;

  @Bean
  public JobRepository jobRepository() throws Exception {
    JobRepositoryFactoryBean factory = new JobRepositoryFactoryBean();
    factory.setDataSource(dataSource);
    factory.setTransactionManager(platformTransactionManager);
    factory.setValidateTransactionState(true);
    factory.setIsolationLevelForCreate(ISOLATION_REPEATABLE_READ);
    factory.setIncrementerFactory(customIncrementerFactory());
    factory.afterPropertiesSet();
    return factory.getObject();
  }

  @Bean
  public SimpleJobLauncher jobLauncher(JobRepository jobRepository) {
    SimpleJobLauncher simpleJobLauncher = new SimpleJobLauncher();
    simpleJobLauncher.setJobRepository(jobRepository);
    return simpleJobLauncher;
  }

  private DataFieldMaxValueIncrementerFactory customIncrementerFactory() {
    return new CustomDataFieldMaxValueIncrementerFactory(dataSource);
  }

  private class CustomDataFieldMaxValueIncrementerFactory extends DefaultDataFieldMaxValueIncrementerFactory {

    CustomDataFieldMaxValueIncrementerFactory(DataSource dataSource) {
      super(dataSource);
    }

    @Override
    public DataFieldMaxValueIncrementer getIncrementer(String incrementerType, String incrementerName) {
      DataFieldMaxValueIncrementer incrementer = super.getIncrementer(incrementerType, incrementerName);
      if (incrementer instanceof SqlServerMaxValueIncrementer) {
        ((SqlServerMaxValueIncrementer) incrementer).setCacheSize(20);
      }
      return incrementer;
    }
  }
}
```

job repository의 Isolation level을 별도로 설정해주고 직접 Bean으로 등록하여 해결하는 방법이였습니다.

> 해당 이슈에서는 REPEATABLE_READ단계로 설정해주어 ``could not increment identity``
문제를 직면했기 때문에 Isolation level을 ``READ_COMMITTED``로 변경했다고 합니다.
##### 본문
Different jobs were now trying to insert into the DB at the same time, causing a deadlock. We now set IsolationLevel to "ISOLATION_READ_COMMITTED". To prevent executing the same job in parallel on a cluster we've been using Hazelcast-locks all along.

>한가지 참고하셔야할 사항은
Spring boot 2.1 부터는 bean definition overriding이 기본이 false이기때문에 bean을 수동으로 등록하여 overriding 하기 위해서는 ``application.yml``에 ``spring.main.allow-bean-definition-overriding: true``옵션을 추가하셔야합니다.

상당히 괜찮은 방법으로 보입니다.
그래도 다른 방법이 존재하는지 찾아봅시다.

**3. 관련 Class Override**
다른 방법으로는 관련 클래스들을 override하는 방법입니다.
이하 본문과 같습니다.

Make the following fields of type IDENTITY:

```
BATCH_JOB_INSTANCE.JOB_INSTANCE_ID
BATCH_JOB_EXECUTION.JOB_EXECUTION_ID
BATCH_STEP_EXECUTION.STEP_EXECUTION_ID
```

Change or copy JdbcJobInstanceDao (SqlServerJdbcJobInstanceDao) and change the CREATE_JOB_INSTANCE sql constant and createJobInstance method to:

```java
private static final String CREATE_JOB_INSTANCE = "INSERT into %PREFIX%JOB_INSTANCE(JOB_NAME, JOB_KEY, VERSION)"
		+ " values (?, ?, ?)";
		
@Override
public JobInstance createJobInstance(String jobName, JobParameters jobParameters) {

	Assert.notNull(jobName, "Job name must not be null.");
	Assert.notNull(jobParameters, "JobParameters must not be null.");

	Assert.state(getJobInstance(jobName, jobParameters) == null, "JobInstance must not already exist");

	JobInstance jobInstance = new JobInstance(null, jobName);
	jobInstance.incrementVersion();

	KeyHolder generatedKeyHolder = new GeneratedKeyHolder();

	getJdbcTemplate().update(connection -> {
		final PreparedStatement ps = connection.prepareStatement(getQuery(CREATE_JOB_INSTANCE), Statement.RETURN_GENERATED_KEYS);
		ps.setString(1, jobName);
		ps.setString(2, jobKeyGenerator.generateKey(jobParameters));
		ps.setInt   (3, jobInstance.getVersion());
		return ps;
	}, generatedKeyHolder);

	jobInstance.setId(generatedKeyHolder.getKey().longValue());

	return jobInstance;
}
```
Change or copy JdbcJobExecutionDao (SqlServerJdbcJobExecutionDao) and change SAVE_JOB_EXECUTION sql constant and saveJobExecution method:

```java
private static final String SAVE_JOB_EXECUTION = "INSERT into %PREFIX%JOB_EXECUTION(JOB_INSTANCE_ID, START_TIME, "
		+ "END_TIME, STATUS, EXIT_CODE, EXIT_MESSAGE, VERSION, CREATE_TIME, LAST_UPDATED, JOB_CONFIGURATION_LOCATION) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
	
@Override
public void saveJobExecution(JobExecution jobExecution) {

	validateJobExecution(jobExecution);

	jobExecution.incrementVersion();

	KeyHolder generatedKeyHolder = new GeneratedKeyHolder();

	getJdbcTemplate().update(connection -> {
		PreparedStatement ps = connection.prepareStatement(getQuery(SAVE_JOB_EXECUTION), Statement.RETURN_GENERATED_KEYS);
		ps.setLong  ( 1, jobExecution.getJobId());
		ps.setDate  ( 2, jobExecution.getStartTime() != null ? new java.sql.Date(jobExecution.getStartTime().getTime()) : null);
		ps.setDate  ( 3, jobExecution.getEndTime() != null ? new java.sql.Date(jobExecution.getEndTime().getTime()) : null);
		ps.setString( 4, jobExecution.getStatus().toString());
		ps.setString( 5, jobExecution.getExitStatus().getExitCode());
		ps.setString( 6, jobExecution.getExitStatus().getExitDescription());
		ps.setInt   ( 7, jobExecution.getVersion());
		ps.setDate  ( 8, jobExecution.getCreateTime() != null ? new java.sql.Date(jobExecution.getCreateTime().getTime()) : null);
		ps.setDate  ( 9, jobExecution.getLastUpdated() != null ? new java.sql.Date(jobExecution.getLastUpdated().getTime()) : null);
		ps.setString(10, jobExecution.getJobConfigurationName());
		return ps;
	}, generatedKeyHolder);

	jobExecution.setId(generatedKeyHolder.getKey().longValue());

	insertJobParameters(jobExecution.getId(), jobExecution.getJobParameters());
}
```
Change or copy JdbcStepExecutionDao (SqlServerJdbcStepExecutionDao) and change the SAVE_STEP_EXECUTION sql constant and saveStepExecution/saveStepExecutions methods:

```java
private static final String SAVE_STEP_EXECUTION = "INSERT into %PREFIX%STEP_EXECUTION(VERSION, STEP_NAME, JOB_EXECUTION_ID, START_TIME, "
		+ "END_TIME, STATUS, COMMIT_COUNT, READ_COUNT, FILTER_COUNT, WRITE_COUNT, EXIT_CODE, EXIT_MESSAGE, READ_SKIP_COUNT, WRITE_SKIP_COUNT, PROCESS_SKIP_COUNT, ROLLBACK_COUNT, LAST_UPDATED) "
		+ "values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

@Override
public void saveStepExecution(StepExecution stepExecution) {

	stepExecution.incrementVersion();

	final KeyHolder generatedKeyHolder = new GeneratedKeyHolder();

	getJdbcTemplate().update(connection -> {
		PreparedStatement ps = connection.prepareStatement(getQuery(SAVE_STEP_EXECUTION), Statement.RETURN_GENERATED_KEYS);
		ps.setInt   ( 1, stepExecution.getVersion());
		ps.setString( 2, stepExecution.getStepName());
		ps.setLong  ( 3, stepExecution.getJobExecutionId());
		ps.setDate  ( 4, stepExecution.getStartTime() != null ? new Date(stepExecution.getStartTime().getTime()) : null);
		ps.setDate  ( 5, stepExecution.getEndTime() != null ? new Date(stepExecution.getEndTime().getTime()) : null);
		ps.setString( 6, stepExecution.getStatus().toString());
		ps.setInt   ( 7, stepExecution.getCommitCount());
		ps.setInt   ( 8, stepExecution.getReadCount());
		ps.setInt   ( 9, stepExecution.getFilterCount());
		ps.setInt   (10, stepExecution.getWriteCount());
		ps.setString(11, stepExecution.getExitStatus().getExitCode());
		ps.setString(12, truncateExitDescription(stepExecution.getExitStatus().getExitDescription()));
		ps.setInt   (13, stepExecution.getReadSkipCount());
		ps.setInt   (14, stepExecution.getWriteSkipCount());
		ps.setInt   (15, stepExecution.getProcessSkipCount());
		ps.setInt   (16, stepExecution.getRollbackCount());
		ps.setDate  (17, stepExecution.getLastUpdated() != null ? new Date(stepExecution.getLastUpdated().getTime()) : null);
		return ps;
	}, generatedKeyHolder);

	stepExecution.setId(generatedKeyHolder.getKey().longValue());
}

@Override
public void saveStepExecutions(final Collection<StepExecution> stepExecutions) {
	Assert.notNull(stepExecutions, "Attempt to save a null collection of step executions");
	for (StepExecution stepExecution : stepExecutions) {
		saveStepExecution(stepExecution);
	}
}
Change or create copy of JobRepositoryFactoryBean (SqlServerJobRepositoryFactoryBean) with the following changes:

@Override
protected JobInstanceDao createJobInstanceDao() throws Exception {
	SqlServerJdbcJobInstanceDao dao = new SqlServerJdbcJobInstanceDao();
	dao.setJdbcTemplate(jdbcOperations);
	dao.setJobIncrementer(incrementerFactory.getIncrementer(databaseType, tablePrefix + "JOB_SEQ"));
	dao.setTablePrefix(tablePrefix);
	dao.afterPropertiesSet();
	return dao;
}

@Override
protected JobExecutionDao createJobExecutionDao() throws Exception {
	SqlServerJdbcJobExecutionDao dao = new SqlServerJdbcJobExecutionDao();
	dao.setJdbcTemplate(jdbcOperations);
	dao.setJobExecutionIncrementer(incrementerFactory.getIncrementer(databaseType, tablePrefix
			+ "JOB_EXECUTION_SEQ"));
	dao.setTablePrefix(tablePrefix);
	dao.setClobTypeToUse(determineClobTypeToUse(this.databaseType));
	dao.setExitMessageLength(maxVarCharLength);
	dao.afterPropertiesSet();
	return dao;
}

@Override
protected StepExecutionDao createStepExecutionDao() throws Exception {
	SqlServerJdbcStepExecutionDao dao = new SqlServerJdbcStepExecutionDao();
	dao.setJdbcTemplate(jdbcOperations);
	dao.setStepExecutionIncrementer(incrementerFactory.getIncrementer(databaseType, tablePrefix
			+ "STEP_EXECUTION_SEQ"));
	dao.setTablePrefix(tablePrefix);
	dao.setClobTypeToUse(determineClobTypeToUse(this.databaseType));
	dao.setExitMessageLength(maxVarCharLength);
	dao.afterPropertiesSet();
	return dao;
}
Create a batch configuration to use new SqlServerBatchConfigurer that uses the new SqlServerJobRepositoryFactoryBean:

@Configuration
public class BatchConfiguration {

    @Bean
    public SqlServerBatchConfigurer basicBatchConfigurer(BatchProperties properties, DataSource dataSource) {
        return new SqlServerBatchConfigurer(properties, dataSource);
    }

    class SqlServerBatchConfigurer extends BasicBatchConfigurer {

        private final DataSource dataSource;
        private final BatchProperties properties;

        SqlServerBatchConfigurer(final BatchProperties properties, final DataSource dataSource) {
            super(properties, dataSource);
            this.properties = properties;
            this.dataSource = dataSource;
        }

        @Override
        protected JobRepository createJobRepository() throws Exception {
            SqlServerJobRepositoryFactoryBean factory = new SqlServerJobRepositoryFactoryBean();

            // this is required to avoid deadlocks
            factory.setIsolationLevelForCreate("ISOLATION_REPEATABLE_READ");

            factory.setDataSource(this.dataSource);
            String tablePrefix = this.properties.getTablePrefix();
            if (StringUtils.hasText(tablePrefix)) {
                factory.setTablePrefix(tablePrefix);
            }
            factory.setTransactionManager(getTransactionManager());
            factory.afterPropertiesSet();
            return factory.getObject();
        }
    }
}
```
조금 번거로워 보입니다.
유지보수에도 용이할 것 같진 않았습니다.

**4. Version Up**

해당문제는 ``spring-batch 4.x`` 버전에서 발생한다고 [StackOverflow](https://stackoverflow.com/questions/70563630/spring-batch-deadlock-could-not-increment-identity-nested-exception-is-com-mi)에서는 설명하고 있습니다.
Github에서도 Batch 버전이 v5.0.0이 돼서야 해당 이슈에 대한 Bug fix가 이루어 진 모습을 확인 할 수 있죠.
[(해당 버전 Release note)](https://github.com/spring-projects/spring-batch/releases/tag/v5.0.0) -> 이슈 번호 #1448를 보시면 됩니다.

물론 장단점이 있겠지만 Version up도 좋은 방법이 될 듯 합니다.
하지만 Version up을 고민하실때 **고려하셔야만 하는 사항**이 존재합니다.

>``Spring Batch5``는 ``Spring framework 6 (Spring boot를 사용중이라면 Spring boot 3)``을 의존하고 있습니다.
또한 ``Spring framework 6 ( Spring boot 3 )``는 최소 ``Java 17``을 사용해야만 합니다.
한줄로 정리하자면 ``Spring Batch5``는 최소 ``Spring framework 6 ( Srping boot 3 )``와 최소 ``Java 17``이 필요합니다.

그렇기 때문에 해당 문제만을 해결하기 위해 ``Spring``, ``Java``, ``Spring Batch``
위 3가지 모두의 버전업을 해야 하는 것인지 충분한 고민과 논의가 거쳐진 후에
결정하셔야 한다고 생각합니다.
아시다시피 위 3가지 모두 각각 따로 버전업을 하는 이슈가 생긴다고 해도 신경써야할 게 굉장히 많으실겁니다.
3가지 모두를 한번에 버전업을 하시게 된다면... **( 야근하실지도...? )**

물론 3가지중 하나만 버전업 하셔도 된다면 좀 더 낫긴 하겠습니다만..

>문제 직면시 저희 회사 서버의 기술 스택은 이러했습니다.
Spring boot : 2.7.3
해당 Boot의 spring batch dependency 버전은 4.3.6입니다 [( 참고 )](https://docs.spring.io/spring-boot/docs/2.7.3/reference/html/dependency-versions.html#appendix.dependency-versions)
JDK : 11

그래서 결국 저는(회사 Batch Server는) 어떻게 해결했냐
버전업을 택한다면 보시다시피 저희 회사의 기술 스택이 위 3가지 버전을 모두 업해야하기때문에
굉장히 신경쓸게 많아지는 케이스인지라 버전업으로 해결하기를 결정하진 않았습니다.

3번도 썩 제 마음에 들지는 않았구요.

결국 **2번 Batch 관련 설정 정보 Bean 등록**을 선택했습니다.
적용후에 해당 사항과 관련된 이슈가 나온다면 다시금 업데이트 하도록 하겠습니다.

긴 글 읽어주셔서 감사합니다.
마지막으로 이 글이 누군가에게 도움이 되길 바라며 이만 마치겠습니다
>위 본문 내용중 정확하지 않은 내용이 포함돼 있을 수 있습니다.
저는 1년차 백엔드 개발자로 스스로 굉장히 부족한 사람이라는 점을 인지하고 있는지라
제가 적은 정보가 정확하지 않을까 걱정하고 있습니다.
혹여 제 정보가 잘못 됐을 수 있으니 단지 참고용으로만 봐주시고 관련된 내용을 한번 직접 알아보시는 걸 추천합니다.
혹여 잘못된 내용이 있거나 말씀해주시고 싶은 부분이 있으시다면 부담없이 적어주세요!
수용하고 개선하기 위해 노력하겠습니다!!!


### Reference
https://github.com/spring-projects/spring-batch/issues/1448
https://stackoverflow.com/questions/29493484/primary-key-violation-in-spring-batchs-batch-job-instance-table-while-running-j?noredirect=1#comment47186282_29493484
https://github.com/spring-projects/spring-batch/releases/tag/v5.0.0
https://stackoverflow.com/questions/70563630/spring-batch-deadlock-could-not-increment-identity-nested-exception-is-com-mi
https://jojoldu.tistory.com/326
https://taes-k.github.io/2021/03/01/spring-batch-table/
https://docs.spring.io/spring-batch/docs/current/reference/html/schema-appendix.html
