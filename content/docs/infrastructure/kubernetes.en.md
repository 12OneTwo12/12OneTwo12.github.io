---
title: Kubernetes Configuration
weight: 1
---

## Cluster Setup

Kubernetes clusters can be configured in various environments:

- **GKE** (Google Kubernetes Engine)
- **EKS** (Amazon Elastic Kubernetes Service)
- **AKS** (Azure Kubernetes Service)
- **On-Premises** (kubeadm, Rancher, etc.)
- **Local Development** (Minikube, Kind, k3s)

### Cluster Configuration by Environment

```
development  → 2 nodes  (2 CPU, 8GB RAM per node)
staging      → 3 nodes  (4 CPU, 16GB RAM per node)
production   → 5+ nodes (8 CPU, 32GB RAM per node)
```

*Node count and specs should be adjusted based on application requirements.*

## Namespace Structure

In microservice architecture, it's common to separate namespaces by service.

```bash
# Namespace configuration example
- default              # Default namespace
- service-a            # Microservice A
- service-b            # Microservice B
- infrastructure       # Common infrastructure like Redis, Kafka
- monitoring           # Prometheus, Grafana
- logging              # ELK Stack
```

Check namespaces:
```bash
kubectl get namespaces
```

## Deployment Manifests

### Basic Deployment

Basic Deployment configuration example for Spring Boot applications.

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

Ingress configuration example for accessing internal cluster services from outside.

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

## Essential Commands

```bash
# Check pods
kubectl get pods -n my-namespace

# Check pod logs
kubectl logs -f POD_NAME -n my-namespace

# Restart pods
kubectl rollout restart deployment/my-service -n my-namespace

# Apply configuration
kubectl apply -f deployment.yaml

# Access pod
kubectl exec -it POD_NAME -n my-namespace -- /bin/bash

# Check resource usage
kubectl top pods -n my-namespace
kubectl top nodes

# Check events
kubectl get events -n my-namespace --sort-by='.lastTimestamp'
```

## Deployment Strategies

### Rolling Update (Default)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Number of additional Pods that can be created simultaneously
      maxUnavailable: 0  # Number of Pods that can be deleted simultaneously
```

### Blue-Green Deployment

```bash
# Deploy Blue version (existing)
kubectl apply -f blue-deployment.yaml

# Deploy Green version (new)
kubectl apply -f green-deployment.yaml

# Switch Service to Green
kubectl patch service my-service -p '{"spec":{"selector":{"version":"green"}}}'

# Rollback to Blue if issues occur
kubectl patch service my-service -p '{"spec":{"selector":{"version":"blue"}}}'
```

## JVM Warm-up Configuration

Configuration to resolve cold start issues:

```yaml
startupProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 24  # Wait up to 2 minutes
```

For more details, see the [blog post]({{< relref "/blog/backend/performance/k8s-jvm-warm-up" >}}).

## Resource Optimization

### CPU/Memory Requests vs Limits

```yaml
resources:
  requests:
    cpu: 500m      # Minimum guaranteed resources
    memory: 1Gi
  limits:
    cpu: 2000m     # Maximum available resources
    memory: 2Gi
```

**Recommendations**:
- requests should be 80-90% of actual usage
- limits should be based on peak usage
- CPU limits should be set carefully as they can cause throttling

## Troubleshooting

### Pod Won't Start

```bash
# Check pod status
kubectl describe pod POD_NAME -n my-namespace

# Check events
kubectl get events -n my-namespace

# Check logs
kubectl logs POD_NAME -n my-namespace
```

### OOMKilled Occurs

When Pod is terminated due to memory shortage:

```bash
# Check memory usage
kubectl top pod POD_NAME -n my-namespace

# Increase Deployment memory
kubectl set resources deployment/my-service \
  --limits=memory=4Gi \
  --requests=memory=2Gi \
  -n my-namespace
```

## Security

### 1. RBAC (Role-Based Access Control)

**Apply principle of least privilege:**

```yaml
# ❌ BAD: Too broad permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: developer
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]  # Grant all permissions

---
# ✅ GOOD: Grant only minimum necessary permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: my-namespace
rules:
# Pod read-only
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

# Deployment view only
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]

# Service view only
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

**Apply Pod security policies:**

```yaml
# Apply Pod Security Standards at namespace level
apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

---
# ✅ GOOD: Security-hardened Pod configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: my-namespace
spec:
  template:
    spec:
      # Enforce non-root user
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

        # Temporary volumes needed when using read-only root filesystem
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

### 3. Secret Encryption and Management

```yaml
# ❌ BAD: Storing secrets in plaintext
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  password: bXlwYXNzd29yZDEyMw==  # base64 is not encryption!

---
# ✅ GOOD: Using External Secrets Operator
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

**Default deny + explicit allow:**

```yaml
# 1. Deny all traffic by default
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
# 2. Explicitly allow only necessary traffic
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

  # Ingress: Allow access only from API Gateway
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

  # Egress: Allow outgoing traffic only to necessary services
  egress:
  # Allow DNS
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

  # Allow Database access
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

### 5. Image Pull Policy and Verification

```yaml
# ✅ GOOD: Image security configuration
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      # Allow only specific registry
      imagePullSecrets:
      - name: my-registry-secret

      containers:
      - name: my-service
        # Use SHA256 digest instead of tag (guarantees immutability)
        image: gcr.io/my-project/my-service@sha256:abc123...
        imagePullPolicy: Always  # Always verify latest image

        # Don't inject sensitive info via environment variables
        env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
```

## Performance

### 1. Resource Requests/Limits Optimization

```yaml
# ❌ BAD: No resource settings (risk of node resource exhaustion)
spec:
  containers:
  - name: my-service
    image: my-service:v1.0.0

---
# ❌ BAD: Too large gap between Request and Limit
spec:
  containers:
  - name: my-service
    image: my-service:v1.0.0
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 8000m      # 80x difference
        memory: 16Gi    # 128x difference

---
# ✅ GOOD: Appropriate Resource settings
spec:
  containers:
  - name: my-service
    image: my-service:v1.0.0
    resources:
      requests:
        cpu: 500m        # Minimum guaranteed CPU
        memory: 1Gi      # Minimum guaranteed memory
      limits:
        cpu: 2000m       # Maximum 4x (allow burst)
        memory: 2Gi      # Maximum 2x

# Recommended ratios:
# - CPU: 2-4x of requests
# - Memory: 1.5-2x of requests (prevent OOM)
```

### 2. HPA (Horizontal Pod Autoscaler) Configuration

```yaml
# ✅ GOOD: Auto scaling based on CPU and memory
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

  minReplicas: 3    # Minimum Pod count (high availability)
  maxReplicas: 10   # Maximum Pod count (cost control)

  metrics:
  # CPU-based scaling
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # Scale out when CPU reaches 70%

  # Memory-based scaling
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Scale out when Memory reaches 80%

  # Custom metric (RPS)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Stabilize for 5 min before scaling down
      policies:
      - type: Percent
        value: 50  # Reduce by 50% at a time
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0  # Scale up immediately
      policies:
      - type: Percent
        value: 100  # Expand up to 100% at once
        periodSeconds: 15
      - type: Pods
        value: 4  # Or add maximum 4 Pods at once
        periodSeconds: 15
      selectPolicy: Max  # Select more aggressive policy
```

### 3. Node Affinity and Pod Topology

```yaml
# ✅ GOOD: Performance optimization with Node Affinity
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      # Deploy only to specific node groups
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              # Deploy only to high-performance nodes
              - key: node-type
                operator: In
                values:
                - high-performance
              # Deploy only to specific zones (data locality)
              - key: topology.kubernetes.io/zone
                operator: In
                values:
                - asia-northeast3-a
                - asia-northeast3-b

        # Pod Anti-Affinity: Prevent deployment on same node (high availability)
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  app: my-service
              topologyKey: kubernetes.io/hostname

      # Topology Spread Constraints: Even distribution across zones
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: my-service
```

### 4. Efficient Probe Configuration

```yaml
spec:
  containers:
  - name: my-service
    # ✅ GOOD: Appropriate Probe settings
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3        # Restart after 30 seconds

    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5            # Check more frequently
      timeoutSeconds: 3
      successThreshold: 1         # Forward traffic after 1 success
      failureThreshold: 2         # Block traffic after 10 seconds

    startupProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 30        # Wait up to 150 seconds (allow slow start)
```

## Reliability

### 1. PDB (Pod Disruption Budget)

```yaml
# ✅ GOOD: Guarantee minimum availability during voluntary disruptions
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-service-pdb
  namespace: my-namespace
spec:
  minAvailable: 2  # Always keep at least 2 Pods available
  # Or
  # maxUnavailable: 1  # Allow maximum 1 Pod disruption
  selector:
    matchLabels:
      app: my-service
```

### 2. Rolling Update Strategy

```yaml
# ✅ GOOD: Progressive rollout
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # Can create 1 additional Pod
      maxUnavailable: 0   # No Pod disruption (zero-downtime deployment)

  minReadySeconds: 10     # Wait 10 seconds before updating next Pod
  progressDeadlineSeconds: 600  # Fail if not completed within 10 minutes

  revisionHistoryLimit: 5 # Keep last 5 versions (for rollback)
```

### 3. Monitoring and Alerts

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
# PrometheusRule: Alert rules
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
    # Alert when Pod count is below 2
    - alert: LowPodCount
      expr: count(kube_pod_status_phase{namespace="my-namespace",phase="Running"}) < 2
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod count is below minimum"

    # Alert when error rate is above 5%
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

## Checklist

### Security
- [ ] Are minimum necessary permissions granted with RBAC?
- [ ] Are Pod Security Standards applied?
- [ ] Are Secrets managed with External Secret Manager?
- [ ] Is traffic restricted with Network Policy?
- [ ] Are containers running as non-root user?
- [ ] Are image digests being used?

### Performance
- [ ] Are Resource Requests/Limits properly configured?
- [ ] Is HPA configured?
- [ ] Is Node Affinity properly configured?
- [ ] Are Probe settings optimized?

### Reliability
- [ ] Is PDB configured?
- [ ] Is Rolling Update strategy appropriate?
- [ ] Are there at least 3 replicas?
- [ ] Are monitoring and alerts configured?
- [ ] Is Revision History maintained?
