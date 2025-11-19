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

### RBAC (Role-Based Access Control)

Example of granting read-only access to developers for a specific namespace.

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

Network Policy example that allows access only from specific namespaces.

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
