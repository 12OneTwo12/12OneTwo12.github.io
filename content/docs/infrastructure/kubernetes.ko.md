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

## 보안

### RBAC (Role-Based Access Control)

개발자에게 특정 네임스페이스의 읽기 권한만 부여하는 예시입니다.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: my-namespace
rules:
- apiGroups: ["", "apps"]
  resources: ["pods", "deployments", "services"]
  verbs: ["get", "list", "watch"]
```

### Network Policy

특정 네임스페이스에서만 접근을 허용하는 Network Policy 예시입니다.

```yaml
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
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: gateway-namespace
    ports:
    - protocol: TCP
      port: 8080
```
