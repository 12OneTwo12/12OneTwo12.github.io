---
title: Kubernetes 설정
weight: 1
---

## 클러스터 구성

Kubernetes 클러스터는 다양한 환경에서 구성할 수 있습니다:

- **GKE** (Google Kubernetes Engine)
- **EKS** (Amazon Elastic Kubernetes Service)
- **AKS** (Azure Kubernetes Service)
- **온프레미스** (kubeadm, Rancher 등)
- **로컬 개발** (Minikube, Kind, k3s)

### 환경별 클러스터 구성 예시

```
development  → 2 nodes  (2 CPU, 8GB RAM per node)
staging      → 3 nodes  (4 CPU, 16GB RAM per node)
production   → 5+ nodes (8 CPU, 32GB RAM per node)
```

*노드 수와 스펙은 애플리케이션 요구사항에 따라 조정합니다.*

## 네임스페이스 구조

마이크로서비스 아키텍처에서는 서비스별로 네임스페이스를 분리하는 것이 일반적입니다.

```bash
# 네임스페이스 구성 예시
- default              # 기본 네임스페이스
- service-a            # 마이크로서비스 A
- service-b            # 마이크로서비스 B
- infrastructure       # Redis, Kafka 등 공통 인프라
- monitoring           # Prometheus, Grafana
- logging              # ELK Stack
```

네임스페이스 확인:
```bash
kubectl get namespaces
```

## Deployment 매니페스트

### 기본 Deployment

Spring Boot 애플리케이션을 위한 기본 Deployment 구성 예시입니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: my-namespace
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-service
  template:
    metadata:
      labels:
        app: my-service
        version: v1.0.0
    spec:
      containers:
      - name: my-service
        image: your-registry/my-service:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: my-service-secret
              key: database-url
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        startupProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 24
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: my-namespace
spec:
  selector:
    app: my-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-service-config
  namespace: my-namespace
data:
  application.yaml: |
    server:
      port: 8080
    spring:
      datasource:
        hikari:
          maximum-pool-size: 10
      jpa:
        hibernate:
          ddl-auto: validate
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-service-secret
  namespace: my-namespace
type: Opaque
stringData:
  database-url: jdbc:postgresql://postgres:5432/mydb
  database-username: admin
  database-password: supersecret
```

## HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-service-hpa
  namespace: my-namespace
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Ingress

외부에서 클러스터 내부 서비스에 접근하기 위한 Ingress 설정 예시입니다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: my-namespace
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api/v1
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

## 주요 명령어

```bash
# Pod 확인
kubectl get pods -n my-namespace

# Pod 로그 확인
kubectl logs -f POD_NAME -n my-namespace

# Pod 재시작
kubectl rollout restart deployment/my-service -n my-namespace

# 설정 적용
kubectl apply -f deployment.yaml

# Pod 접속
kubectl exec -it POD_NAME -n my-namespace -- /bin/bash

# 리소스 사용량 확인
kubectl top pods -n my-namespace
kubectl top nodes

# 이벤트 확인
kubectl get events -n my-namespace --sort-by='.lastTimestamp'
```

## 배포 전략

### Rolling Update (기본)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 동시에 생성할 수 있는 추가 Pod 수
      maxUnavailable: 0  # 동시에 삭제할 수 있는 Pod 수
```

### Blue-Green Deployment

```bash
# Blue 버전 배포 (기존)
kubectl apply -f blue-deployment.yaml

# Green 버전 배포 (신규)
kubectl apply -f green-deployment.yaml

# Service를 Green으로 전환
kubectl patch service my-service -p '{"spec":{"selector":{"version":"green"}}}'

# 문제 발생 시 Blue로 롤백
kubectl patch service my-service -p '{"spec":{"selector":{"version":"blue"}}}'
```

## JVM Warm-up 설정

Cold start 문제 해결을 위한 설정:

```yaml
startupProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 24  # 최대 2분 대기
```

자세한 내용은 [블로그 포스트]({{< relref "/blog/backend/performance/k8s-jvm-warm-up" >}})를 참고하세요.

## 리소스 최적화

### CPU/Memory Requests vs Limits

```yaml
resources:
  requests:
    cpu: 500m      # 최소 보장 리소스
    memory: 1Gi
  limits:
    cpu: 2000m     # 최대 사용 가능 리소스
    memory: 2Gi
```

**권장 사항**:
- requests는 실제 사용량의 80-90% 수준
- limits는 피크 사용량 기준
- CPU limits는 throttling 발생 가능하므로 신중히 설정

## 트러블슈팅

### Pod가 시작하지 않는 경우

```bash
# Pod 상태 확인
kubectl describe pod POD_NAME -n my-namespace

# 이벤트 확인
kubectl get events -n my-namespace

# 로그 확인
kubectl logs POD_NAME -n my-namespace
```

### OOMKilled 발생 시

메모리 부족으로 Pod가 종료된 경우:

```bash
# 메모리 사용량 확인
kubectl top pod POD_NAME -n my-namespace

# Deployment 메모리 증가
kubectl set resources deployment/my-service \
  --limits=memory=4Gi \
  --requests=memory=2Gi \
  -n my-namespace
```

## 보안 (Security)

### 1. RBAC (Role-Based Access Control)

**최소 권한 원칙 적용:**

```yaml
# ❌ BAD: 너무 넓은 권한
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: developer
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]  # 모든 권한 부여

---
# ✅ GOOD: 필요한 최소 권한만 부여
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: my-namespace
rules:
# Pod 읽기 전용
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

# Deployment 조회만 가능
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]

# Service 조회만 가능
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: my-namespace
subjects:
- kind: User
  name: developer@example.com
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

### 2. Pod Security Standards

**Pod 보안 정책 적용:**

```yaml
# namespace 레벨 Pod Security Standards 적용
apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

---
# ✅ GOOD: 보안 강화된 Pod 설정
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: my-namespace
spec:
  template:
    spec:
      # 비-root 사용자 강제
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 3000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault

      containers:
      - name: my-service
        image: my-service:v1.0.0
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
          runAsNonRoot: true
          runAsUser: 1000

        # 읽기 전용 루트 파일 시스템 사용 시 임시 볼륨 필요
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/cache

      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
```

### 3. Secret 암호화 및 관리

```yaml
# ❌ BAD: 평문으로 Secret 저장
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  password: bXlwYXNzd29yZDEyMw==  # base64는 암호화가 아님!

---
# ✅ GOOD: External Secrets Operator 사용
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-secret
  namespace: my-namespace
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: db-secret
    creationPolicy: Owner
  data:
  - secretKey: password
    remoteRef:
      key: database/prod/password
  - secretKey: username
    remoteRef:
      key: database/prod/username
```

### 4. Network Policy

**기본 거부 + 명시적 허용:**

```yaml
# 1. 기본적으로 모든 트래픽 거부
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: my-namespace
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# 2. 필요한 트래픽만 명시적으로 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-service-netpol
  namespace: my-namespace
spec:
  podSelector:
    matchLabels:
      app: my-service
  policyTypes:
  - Ingress
  - Egress

  # Ingress: API Gateway에서만 접근 허용
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: api-gateway
      podSelector:
        matchLabels:
          app: gateway
    ports:
    - protocol: TCP
      port: 8080

  # Egress: 필요한 서비스로만 나가는 트래픽 허용
  egress:
  # DNS 허용
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53

  # Database 접근 허용
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
      podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

### 5. Image Pull Policy 및 검증

```yaml
# ✅ GOOD: 이미지 보안 설정
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      # 특정 레지스트리만 허용
      imagePullSecrets:
      - name: my-registry-secret

      containers:
      - name: my-service
        # 태그 대신 SHA256 다이제스트 사용 (불변성 보장)
        image: gcr.io/my-project/my-service@sha256:abc123...
        imagePullPolicy: Always  # 항상 최신 이미지 검증

        # 환경변수로 민감정보 주입 금지
        env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
```

## 성능 (Performance)

### 1. Resource Requests/Limits 최적화

```yaml
# ❌ BAD: Resource 설정 없음 (노드 리소스 고갈 위험)
spec:
  containers:
  - name: my-service
    image: my-service:v1.0.0

---
# ❌ BAD: Request와 Limit 차이가 너무 큼
spec:
  containers:
  - name: my-service
    image: my-service:v1.0.0
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 8000m      # 80배 차이
        memory: 16Gi    # 128배 차이

---
# ✅ GOOD: 적절한 Resource 설정
spec:
  containers:
  - name: my-service
    image: my-service:v1.0.0
    resources:
      requests:
        cpu: 500m        # 최소 보장 CPU
        memory: 1Gi      # 최소 보장 메모리
      limits:
        cpu: 2000m       # 최대 4배 (버스트 허용)
        memory: 2Gi      # 최대 2배

# 권장 비율:
# - CPU: requests의 2-4배
# - Memory: requests의 1.5-2배 (OOM 방지)
```

### 2. HPA (Horizontal Pod Autoscaler) 설정

```yaml
# ✅ GOOD: CPU와 메모리 기반 자동 스케일링
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-service-hpa
  namespace: my-namespace
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-service

  minReplicas: 3    # 최소 Pod 수 (고가용성)
  maxReplicas: 10   # 최대 Pod 수 (비용 제어)

  metrics:
  # CPU 기반 스케일링
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # CPU 70% 도달 시 스케일 아웃

  # 메모리 기반 스케일링
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Memory 80% 도달 시 스케일 아웃

  # 커스텀 메트릭 (RPS)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 동안 안정화 후 스케일 다운
      policies:
      - type: Percent
        value: 50  # 한 번에 50%씩만 축소
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0  # 즉시 스케일 업
      policies:
      - type: Percent
        value: 100  # 한 번에 100%까지 확장
        periodSeconds: 15
      - type: Pods
        value: 4  # 또는 최대 4개 Pod씩 추가
        periodSeconds: 15
      selectPolicy: Max  # 더 공격적인 정책 선택
```

### 3. Node Affinity 및 Pod Topology

```yaml
# ✅ GOOD: Node Affinity로 성능 최적화
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      # 특정 노드 그룹에만 배포
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              # 고성능 노드에만 배포
              - key: node-type
                operator: In
                values:
                - high-performance
              # 특정 존에만 배포 (데이터 지역성)
              - key: topology.kubernetes.io/zone
                operator: In
                values:
                - asia-northeast3-a
                - asia-northeast3-b

        # Pod Anti-Affinity: 동일 노드에 배포 금지 (고가용성)
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  app: my-service
              topologyKey: kubernetes.io/hostname

      # Topology Spread Constraints: 존별 균등 분산
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: my-service
```

### 4. 효율적인 Probe 설정

```yaml
spec:
  containers:
  - name: my-service
    # ✅ GOOD: 적절한 Probe 설정
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3        # 30초 후 재시작

    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5            # 더 자주 체크
      timeoutSeconds: 3
      successThreshold: 1         # 1번 성공하면 트래픽 전달
      failureThreshold: 2         # 10초 후 트래픽 차단

    startupProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 30        # 최대 150초 대기 (느린 시작 허용)
```

## 안정성 (Reliability)

### 1. PDB (Pod Disruption Budget)

```yaml
# ✅ GOOD: 자발적 중단 시 최소 가용성 보장
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-service-pdb
  namespace: my-namespace
spec:
  minAvailable: 2  # 최소 2개 Pod는 항상 가용
  # 또는
  # maxUnavailable: 1  # 최대 1개까지만 중단 허용
  selector:
    matchLabels:
      app: my-service
```

### 2. Rolling Update 전략

```yaml
# ✅ GOOD: 점진적 롤아웃
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 추가로 1개 Pod 생성 가능
      maxUnavailable: 0   # 중단되는 Pod 없음 (무중단 배포)

  minReadySeconds: 10     # 10초 대기 후 다음 Pod 업데이트
  progressDeadlineSeconds: 600  # 10분 내 완료 못하면 실패

  revisionHistoryLimit: 5 # 최근 5개 버전 유지 (롤백용)
```

### 3. 모니터링 및 알림

```yaml
# Prometheus ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-service
  namespace: my-namespace
spec:
  selector:
    matchLabels:
      app: my-service
  endpoints:
  - port: metrics
    interval: 30s
    path: /actuator/prometheus

---
# PrometheusRule: 알림 규칙
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-service-alerts
  namespace: my-namespace
spec:
  groups:
  - name: my-service
    interval: 30s
    rules:
    # Pod가 2개 미만일 때 알림
    - alert: LowPodCount
      expr: count(kube_pod_status_phase{namespace="my-namespace",phase="Running"}) < 2
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod count is below minimum"

    # 에러율 5% 이상 시 알림
    - alert: HighErrorRate
      expr: |
        sum(rate(http_requests_total{status=~"5..",namespace="my-namespace"}[5m])) /
        sum(rate(http_requests_total{namespace="my-namespace"}[5m])) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Error rate is above 5%"
```

## 체크리스트

### 보안
- [ ] RBAC로 최소 권한만 부여했는가?
- [ ] Pod Security Standards가 적용되어 있는가?
- [ ] Secret을 External Secret Manager로 관리하는가?
- [ ] Network Policy로 트래픽을 제한하는가?
- [ ] 비-root 사용자로 컨테이너를 실행하는가?
- [ ] 이미지 다이제스트를 사용하는가?

### 성능
- [ ] Resource Requests/Limits가 적절히 설정되어 있는가?
- [ ] HPA가 설정되어 있는가?
- [ ] Node Affinity가 적절히 구성되어 있는가?
- [ ] Probe 설정이 최적화되어 있는가?

### 안정성
- [ ] PDB가 설정되어 있는가?
- [ ] Rolling Update 전략이 적절한가?
- [ ] Replica가 최소 3개 이상인가?
- [ ] 모니터링 및 알림이 설정되어 있는가?
- [ ] Revision History를 유지하는가?
