---
title: Spring Batch Job Concurrent Registration Deadlock Issue (Deadlock accessing creating a job on sqlserver when multiple jobs start at once)
tags:
  - "deadlock"
  - "spring batch"
  - "batch"
  - "java"
date: '2023-11-20'
---

I'd like to share a Spring Batch-related issue I encountered at work.

--------------------------------------

## Problem Occurrence

The issue started with an error message in Slack.
It was a stack trace indicating that a Deadlock had occurred on our company's Batch server.

Naturally, since Deadlock could severely impact the service, I immediately
started investigating the problem and dug into the logs.

![](https://velog.velcdn.com/images/12onetwo12/post/20624ee0-53a1-4021-b7c4-38d1dd59cec5/image.png)

> **Part of the Stack trace**
com.mysql.cj.jdbc.exceptions.MySQLTransactionRollbackException: Deadlock found when trying to get lock; try restarting transaction

There were 3 jobs running at the time the Deadlock occurred.

One job didn't execute, while the other 2 jobs ran without issues.

Fortunately, the job that didn't execute was being tested with real data for production validation without affecting the service, so there was no impact on data or service.

After confirming there was no service impact, I relaxed a bit and started investigating the cause.

-----------------------------------------------------

## Root Cause Analysis

The table where the Deadlock occurred was **BATCH_JOB_INSTANCE**, and understanding this table requires some knowledge of Spring Batch.

Our company's Batch server is developed with Spring Batch.

> (We're migrating batch functions that were originally built with PHP and Crontab to Spring Batch while adding additional development.)

`Spring` provides various features for batch processing through the `Spring Batch framework` in a convenient way.

Among these, one of the most basic features Spring Batch provides is recording all metadata (execution time, parameters, completion status...) used during batch operations, which can be used during execution or for monitoring purposes.

![](https://t1.daumcdn.net/cfile/tistory/99E033405B66D86909)

These tables are called `Metadata tables`, and **BATCH_JOB_INSTANCE** is one of these metadata tables.

It wasn't a table with enough traffic to cause a Deadlock, so I thought it was strange.

I couldn't just leave it as is, so naturally, I searched for related references,
but unfortunately, I couldn't find any related articles in Korean.

> (Of course, they might exist, but I might have just missed them)

This was a sad reality for me.
Due to my poor English skills or some instinct that always makes me search in Korean,
I was sad that I had to read articles in English...

However, since the problem needed to be solved, I searched for related information and found an issue with the same problem.

https://github.com/spring-projects/spring-batch/issues/1448

The issue content was roughly similar to my situation.

This issue was first raised on November 22, 2013.
A similar article was also posted on [stack overflow](https://stackoverflow.com/questions/70563630/spring-batch-deadlock-could-not-increment-identity-nested-exception-is-com-mi).

The cause mentioned in this issue was as follows:

> In the SimpleJobRepository when creating a job it first SELECTs for the first job, then if it doesn't find one, INSERTs a new one. Unfortunately that first select (even at serializable) just takes out shared locks. So two concurrent processes both get shared (reader) locks, then both try to acquire exclusive (writer) locks -- leading to a deadlock.
##### Translation
When creating a job in SimpleJobRepository, it first SELECTs for the job, and if not found, INSERTs a new one. Unfortunately, the first SELECT statement only acquires shared locks (reader locks). So when two concurrent processes both acquire shared (reader) locks and then both try to acquire exclusive (writer) locks, a deadlock occurs.

------------------------------------------------

## Problem Resolution

First, the simplest solution was:

**1. Don't run multiple Jobs simultaneously**

However, I felt this was absolutely not a good approach.
I had an immediate aversion to this solution. There are many reasons, but when resolved this way,
the problem remains unsolved, so if there comes a time when many schedules overlap,
the problem will occur again.

And I personally think this is avoiding the problem rather than solving it.

The first solution suggested in the issue was:

**2. Register Batch-related configuration as a Bean**

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

This approach involved setting the isolation level of the job repository separately and registering it directly as a Bean.

> In this issue, they set the Isolation level to ``REPEATABLE_READ`` but encountered ``could not increment identity``
issue, so they changed the Isolation level to ``READ_COMMITTED``.
##### Original text
Different jobs were now trying to insert into the DB at the same time, causing a deadlock. We now set IsolationLevel to "ISOLATION_READ_COMMITTED". To prevent executing the same job in parallel on a cluster we've been using Hazelcast-locks all along.

>One thing to note is that
Starting from Spring boot 2.1, bean definition overriding is false by default, so to manually register and override beans, you need to add the ``spring.main.allow-bean-definition-overriding: true`` option in ``application.yml``.

This seems like a pretty good approach.
Let's still look for other methods.

**3. Override related Classes**
Another approach is to override related classes.
As described below.

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
It looks a bit cumbersome.
It doesn't seem to be maintenance-friendly either.

**4. Version Up**

According to [StackOverflow](https://stackoverflow.com/questions/70563630/spring-batch-deadlock-could-not-increment-identity-nested-exception-is-com-mi), this issue occurs in ``spring-batch 4.x`` version.
On GitHub, you can also see that a bug fix for this issue was made in Batch version v5.0.0.
[(Release note for that version)](https://github.com/spring-projects/spring-batch/releases/tag/v5.0.0) -> Look for issue number #1448.

Of course, there are pros and cons, but version upgrade seems like a good approach.
However, there are **considerations to keep in mind** when thinking about version upgrade.

>``Spring Batch 5`` depends on ``Spring framework 6 (Spring boot 3 if you're using Spring boot)``.
Also, ``Spring framework 6 (Spring boot 3)`` requires at least ``Java 17``.
To summarize in one line, ``Spring Batch 5`` requires at least ``Spring framework 6 (Spring boot 3)`` and at least ``Java 17``.

Therefore, you need to carefully consider and discuss whether upgrading all three - ``Spring``, ``Java``, and ``Spring Batch`` - is worth it just to solve this problem.
As you know, even if you need to upgrade each of these individually, there would be a lot to consider.
If you upgrade all three at once... **(You might be working late...?)**

Of course, it would be better if you only need to upgrade one of the three...

>At the time we encountered the problem, our company server's tech stack was:
Spring boot: 2.7.3
The spring batch dependency version for this Boot is 4.3.6 [(reference)](https://docs.spring.io/spring-boot/docs/2.7.3/reference/html/dependency-versions.html#appendix.dependency-versions)
JDK: 11

So what did I (our company's Batch Server) end up doing?
If we chose version upgrade, as you can see, our company's tech stack would require upgrading all three versions,
which would be a case with a lot of things to worry about, so we didn't decide to resolve it with version upgrade.

Option 3 didn't quite appeal to me either.

Ultimately, we chose **option 2: Register Batch-related configuration as a Bean**.
If any issues related to this arise after implementation, I'll update again.

Thank you for reading this long article.
Finally, I hope this article helps someone.
>The above content may contain inaccurate information.
As a first-year backend developer, I'm aware that I'm quite lacking,
so I'm worried that the information I've written may not be accurate.
My information may be incorrect, so please use it for reference only and I recommend looking into the related content yourself.
If there's any incorrect information or if you'd like to comment on anything, please feel free to write!
I'll accept it and strive to improve!!!


### Reference
https://github.com/spring-projects/spring-batch/issues/1448
https://stackoverflow.com/questions/29493484/primary-key-violation-in-spring-batchs-batch-job-instance-table-while-running-j?noredirect=1#comment47186282_29493484
https://github.com/spring-projects/spring-batch/releases/tag/v5.0.0
https://stackoverflow.com/questions/70563630/spring-batch-deadlock-could-not-increment-identity-nested-exception-is-com-mi
https://jojoldu.tistory.com/326
https://taes-k.github.io/2021/03/01/spring-batch-table/
https://docs.spring.io/spring-batch/docs/current/reference/html/schema-appendix.html
