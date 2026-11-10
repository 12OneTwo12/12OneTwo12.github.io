---
title: "[EKS Upgrade 2/2] From Node Rollouts to 1.37: Moving from ingress-nginx to Gateway API"
tags:
  - "aws"
  - "eks"
  - "kubernetes"
  - "gateway-api"
  - "istio"
  - "ingress-nginx"
date: '2026-11-05'
description: "How we rolled the deferred EKS nodes while counting failed requests, moved from ingress-nginx to Gateway API (Istio), and upgraded to 1.37"
images:
  - "https://www.dropbox.com/scl/fi/ga1wn614tl7sn7zm9m9nb/eks-upgrade-cover-part2.png?rlkey=8fht2r1sg9qsc8qu25jxl75or&raw=1"
---

![EKS Upgrade 2/2 cover](https://www.dropbox.com/scl/fi/ga1wn614tl7sn7zm9m9nb/eks-upgrade-cover-part2.png?rlkey=8fht2r1sg9qsc8qu25jxl75or&raw=1)

Previous: [[EKS Upgrade 1/2] EKS and MySQL After End of Standard Support: Stopping the Extended Support Charges]({{< relref "/blog/infrastructure/eks-mysql-end-of-standard-support-upgrade" >}})

Hello, I'm Jeong Jeong-il, a backend developer working at a PropTech platform.

This post continues from the previous one. It covers upgrading the EKS nodes I had deferred back then, and taking the cluster all the way to 1.37.

Back in September, extended support charges were being billed for EKS and MySQL versions whose AWS standard support had ended. Stopping those charges came first, so I upgraded only the EKS control plane to 1.35 and left the nodes at 1.33. This round of work started with bringing those nodes up to date, but along the way it grew into moving our ingress controller to Gateway API as well.

In this post, I'll go over why the nodes had to be upgraded, how I rolled them without interrupting the service, and why the ingress controller had to be replaced along with what I ran into while migrating it.

---

## Why the Nodes Had to Be Upgraded

After the work in the previous post, the cluster was at control plane 1.35 and nodes 1.33. The charge had stopped, but there were two reasons it couldn't stay that way.

One was that the node AMI was still the one built in March. Managed node groups don't replace the AMI on their own within the same Kubernetes version, so as long as the nodes aren't replaced, none of the OS, kernel, or containerd security patches released in the meantime get in.

The other was the version gap. It was already 2, and upgrading the control plane to 1.36 would make it 3. Kubernetes only allows a gap of up to 3, so from there, the control plane can't go any further unless the nodes are upgraded first. To do the next upgrade before standard support for 1.35 ends on March 27, 2027, the nodes had to catch up first.

## Settings Blocking a Node Rollout

A managed node group upgrade launches nodes on the new version first, then cordons (stops scheduling new pods on), drains (evicts pods from), and terminates the old nodes one by one. In other words, every pod on every node goes down and comes back up on another node. So what I had to check before upgrading the nodes was whether the service could stay up while its pods were going down during this process.

Our cluster wasn't set up that way, so the nodes couldn't be rolled right away. Looking into it, there were three places where the rollout could cause problems.

- **Ingress controller with a single pod**: The ingress controller that receives all external traffic ran as a single pod with no PDB. Once the node running that pod was drained, every external request would fail until a new pod came up on another node.
- **Services whose pods could share a node**: They had two pods, so they looked fine, but there was no anti-affinity to keep them on different nodes, and no PDB. At upgrade time they might happen to be on different nodes, but if both landed on the same node, requests would go unhandled for a moment when that node was drained.

- **Single-pod services with `minAvailable: 1`**: These ran as a single pod with a PDB of `minAvailable: 1`. Requiring at least one of a single pod to stay up is effectively saying "never take this down," so a node group update would fail because the drain couldn't evict these pods.
None of these had caused problems while there was no reason to replace nodes. Of course, as with the single ingress pod, some of them could stop the service the moment a pod or node had trouble, upgrade or not. So each had to be fixed in its own way before upgrading the nodes.

## Handling Each Service

Before fixing anything, I set a standard. Services that receive user requests must not have downtime. On the other hand, services that can fall back to the database when they briefly stop, like a cache, and resources used only internally, like monitoring tools, could tolerate short interruptions. With that standard, I handled the three cases one by one.

- **Ingress controller with a single pod**: I ran two pods and added node-level anti-affinity and a PDB so the two pods wouldn't land on the same node.
- **Services whose pods could share a node**: Same as the ingress controller, I added node-level anti-affinity and a PDB.
- **Single-pod services with `minAvailable: 1`**: The easiest fix would be to run two pods, but some of these were batch-style services that must run as a single instance to avoid processing the same job twice. Adding a pod could cause duplicate processing, so they needed a different approach.

For the batch-style services, I kept a single pod and only changed the PDB to `maxUnavailable: 1`. Eviction during a drain deletes the old pod first, and then the ReplicaSet creates a new one, so there's never a moment when two pods run at the same time. I accepted the roughly one-minute pause until the new pod came up.

Thinking this through, I learned one more thing. These services used the default `RollingUpdate` strategy (maxSurge 25%, maxUnavailable 25%). With one pod, maxSurge rounds up to 1 and maxUnavailable rounds down to 0. That means the old pod keeps running until the new one is Ready, so on every deployment, two pods could briefly overlap. So I changed the strategy to `Recreate`. The requirement that only one instance runs at a time had to be enforced by the deployment strategy, not by the PDB.

## Upgrading the Nodes to 1.35 and What I Measured

Changing the settings didn't tell me whether the service would actually stay up. So from here on, every time I rolled anything, I kept sending requests from outside and counted the failures. When failures showed up, I found the cause, fixed it, and measured again.

### Ingress Shutdown Handling

With two ingress pods, I expected zero downtime. But when I measured while rolling the ingress, 1 out of 89 requests failed with a 3-second timeout. Matching the failure time against events, it was the moment the old ingress pod received its termination signal.

```mermaid
sequenceDiagram
    participant K as Kubernetes
    participant P as Terminating ingress pod
    participant N as kube-proxy on each node
    participant C as External request
    K->>P: Termination signal (SIGTERM)
    K->>N: Remove pod from endpoints
    Note over P: nginx stops right away
    C->>N: Request
    N->>P: Forwarded to the terminated pod (not yet updated)
    P--xC: Connection fails
    Note over N: Endpoint change applied a moment later
```

When Kubernetes deletes a pod, it starts sending the termination signal and removing the pod from the endpoints at the same time. It takes a little while for the endpoint change to reach every node, and if nginx stops first during that window, connections still headed to that pod fail.

ingress-nginx has a `--shutdown-grace-period` option that keeps accepting requests for a set time after receiving the termination signal. I set it to 15 seconds and measured again.

| Measurement | Pods terminated | Failures |
|---|---|---|
| Rollout that applies the option | 2 pods without the option | 2 of 78 |
| `rollout restart` after applying | 2 pods with the option | 0 of 102 |

There was a reason for splitting the measurement in two. Shutdown behavior follows the settings of the pod being terminated. In the rollout that applies the option, the pods going down don't have the option yet, so if I had measured only that rollout, I think I would have concluded the option had no effect. This experience helped once more later when fixing the Gateway.

### Rehearsal on the Development Node Group

The development node group lives in the same cluster as production, separated by taints, so I could rehearse on the same control plane and add-ons. I hadn't confirmed whether a node group could go from 1.33 to 1.35 in one step, so I followed the common recommendation and upgraded one minor version at a time. I left the node group defaults as they were and set 1.34 only on the development node group first.

```hcl
eks_managed_node_group_defaults = {
  cluster_version = "1.33"   # production node groups unchanged
}

eks_managed_node_groups = {
  dev = {
    cluster_version = "1.34" # development node group first
  }
}
```

One thing came up in the rehearsal. In the development environment, the server that hands out configuration to other services was a single pod. That server and the services waiting on it were moved at the same time, so some services couldn't get their configuration and kept restarting. A node group update evicts pods while respecting PDBs, but it doesn't take care of the startup order between services. For production, I confirmed that the configuration server had two pods and a PDB, so one would remain during the drain, and moved on.

The rehearsal was also where I checked the node-side changes in 1.35. In 1.35, the kubelet no longer starts on cgroup v1 nodes with default settings, kube-proxy IPVS mode is deprecated, and it's the last release to support containerd 1.x. On our nodes, `/sys/fs/cgroup` was mounted as `cgroup2`, kube-proxy was in `iptables` mode, and containerd was 2.x, so none of the three affected us.

### Production Node Groups

Production has a spot node group for stateless services and an on-demand node group for services that use volumes. During the rollout, I kept sending requests to one path answered directly by the ingress and to two paths that go through the ingress to an app. Measuring only the ingress response wouldn't show failures while app pods were being moved.

| Step | Time | Ingress path failures | App path failures |
|---|---|---|---|
| spot 1.33 → 1.34 | 17 min 27 s | 0 of 999 | 1 of 1,998 |
| on-demand 1.33 → 1.34 | 7 min 49 s | 0 of 455 | 0 of 910 |
| production all at once 1.34 → 1.35 | about 12 min | 0 of 676 | 4 of 1,352 |

The access logs showed that the failures on the app path were 503s returned by the app itself, not by the ingress. Spring Boot switches readiness to `REFUSING_TRAFFIC` and returns 503 when it starts shutting down, and I believe requests reached the terminating pod before it was removed from the endpoints. It meant the same propagation delay I saw at the ingress also existed for app pods.

With that, all nodes were on 1.35, and the version gap with the control plane was 0. This finished the node upgrade I had put off in the previous post.

## Components Blocking 1.37

With the nodes aligned, I wanted to go straight to 1.37. Standard support for 1.37 runs until December 2027, eight months more than 1.35, and it also included security-related patches.

So first I had to check what changes between 1.35 and 1.37. As with 1.35, I went through the 1.36 and 1.37 release notes and picked out the items that might apply to our cluster.

| Version | Change | Our cluster |
|---|---|---|
| 1.36 | No GA or beta API removals | Not affected |
| 1.36 | Service `externalIPs` field deprecated (removal planned for 1.43) | No Service uses `externalIPs` |
| 1.37 | No GA or beta API removals | Not affected |
| 1.37 | Some cAdvisor metrics removed (`container_cpu_load_average_10s`, etc.) | Not used in any dashboard or manifest |
| 1.37 | kube-proxy IPVS mode logs a deprecation warning (off by default from 1.40, removal planned for 1.43) | We use `iptables` mode |

Unlike 1.35, there was no change big enough to keep nodes from starting, and nothing applied to us. EKS upgrade insights also showed no use of APIs removed in 1.37, and the five EKS add-ons were compatible with 1.37 at their current versions, as long as kube-proxy was bumped at each step. Nothing on the Kubernetes side was in the way.

What got in the way were the components we had installed ourselves.

| Component | State |
|---|---|
| ingress-nginx | The version in use was officially supported only up to versions well below 1.35. The project reached end of support in March 2026 |
| Argo CD | A major upgrade from 2.x to 3.6 was needed for 1.37 to be in its tested range |
| Node Termination Handler | Even the latest version was only tested up to 1.32 |

For EKS add-ons, AWS provides the compatibility list per version through its API, but for controllers installed with Helm, you have to look up the supported range for each project separately. When I upgraded the control plane to 1.35 in the previous post, I had only checked the changes in each EKS version and the EKS add-on compatibility, not the supported ranges of components we had installed ourselves. I knew the ingress-nginx project had been retired, but this was when I learned the version we were running was already far outside its official support range.

### Why ingress-nginx Was Retired

The biggest of the three was ingress-nginx. The retirement announcement on the official Kubernetes blog explains why.

![The ingress-nginx retirement announcement on the official Kubernetes blog, stating best-effort maintenance until March 2026 and no security fixes afterward](https://www.dropbox.com/scl/fi/d3u3zn7r2tjaeuuk9gwbf/eks-upgrade-k8s-ingress-nginx-retirement.png?rlkey=l2l4a64jt81d3lbyw7ajntxz3&raw=1)

*The [retirement announcement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) on the official Kubernetes blog (November 11, 2025)*

> For years, the project has had only one or two people doing development work, on their own time, after work hours and on weekends.
>
> What were once considered helpful options have sometimes come to be considered serious security flaws, such as the ability to add arbitrary NGINX configuration directives via the "snippets" annotations.

An ingress controller used by many clusters had been maintained by one or two people in their spare time, and convenient features like snippets had turned into security problems. The successor project that was being prepared also stopped because not enough people joined.

The announcement also has this sentence.

> Existing deployments will continue to work, so unless you proactively check, you may not know you are affected until you are compromised.

Reading it reminded me of what happened in the previous post. Back then, too, the cluster was running without any problems, so I didn't know EKS standard support had ended until I saw our AWS costs go up.

ingress-nginx didn't even have that. Nothing changes in cost when support ends, and the service keeps running fine. To be honest, I knew about the retirement, but since nothing was broken, I kept putting it off. Reviewing the 1.37 upgrade is what finally made it impossible to put off any longer.

## Choosing a Replacement

Next, I had to decide what to replace ingress-nginx with. The announcement says there's no drop-in replacement and recommends either moving to Gateway API or using another Ingress controller. So I compared two broad paths: keep the Ingress resources and swap only the controller, or move from Ingress to Gateway API.

> What is Gateway API?
> It's a standard API that defines how external traffic is connected to services inside a Kubernetes cluster. Where Ingress put all the configuration in one resource and left detailed features to controller-specific annotations, Gateway API separates the entry point that receives traffic (Gateway) from the routing rules (HTTPRoute), and defines features like path rewriting as standard fields. The implementations that actually handle traffic are provided separately by projects such as Istio, Envoy Gateway, and NGINX Gateway Fabric.

The criterion was how much of our current configuration could carry over as is. Our Ingresses used regex paths and rewrites, CORS with multiple allowed origins, per-path body size limits and timeouts, and per-IP request rate limits.

| Candidate | Approach | Strength | Drawback |
|---|---|---|---|
| Traefik | Swap the controller | Reads most ingress-nginx annotations as is | Would need another migration later to reach Gateway API |
| F5 NGINX Ingress Controller | Swap the controller | Built on nginx, so behavior is closest to what we had | Different annotation names mean rewriting manifests, and another migration later |
| AWS ALB | Swap the controller | Managed by AWS, so less to operate | CORS would move into app code, rate limits need WAF (extra cost), and timeouts can only be set per ALB |
| Gateway API | Replace the API itself | The direction Kubernetes recommends, with features defined as standard fields | Every Ingress has to be rewritten as an HTTPRoute |

At first I leaned toward Traefik. It could take our manifests almost unchanged, so the migration looked like the least work. But looking again, two things bothered me.

First, rewriting manifests wasn't as big a deal as I thought. With only a dozen or so Ingresses, rewriting them would take a few hours. What really takes time is matching the behavioral differences between controllers one by one, and that cost was the same whichever candidate we chose.

Second, I had assumed our rewrites would be hard to express in Gateway API. But when I pulled out every rewrite we actually used, all of them just stripped a prefix from the path, which Gateway API can express with a standard feature (more on this in the migration section below). The reason not to go straight to Gateway API was gone.

Still, moving to Traefik wouldn't have been the end of it. The Ingress API itself isn't going away, but its standard covers very little, so features like rewrites and CORS have to be configured through annotations that differ by controller. The reason switching controllers was hard this time was exactly that our settings were tied to ingress-nginx annotations. Traefik works by reading those same ingress-nginx annotations, so even after moving, that structure would remain, and the next time we had to change controllers we'd go through the same thing again.

Gateway API, on the other hand, defines these features as standard fields, so settings within the standard carry over even if you change implementations. That's also why Kubernetes recommends Gateway API as the successor to Ingress and adds new features only there. Rather than moving to Traefik and then to Gateway API someday, going straight to Gateway API was the way to avoid doing the same work twice.

ALB's lower operational burden was appealing, but not enough to justify moving CORS into app code and paying for WAF. So I decided to move straight to Gateway API.

### Choosing a Gateway API Implementation

Gateway API is a specification, so I still had to choose an implementation that actually handles the traffic. Kubernetes doesn't recommend a specific implementation, and the official implementation list only shows conformance test results. So I compared them against our own criteria.

There were three criteria.

- **Tracking new Kubernetes versions**: The implementation must not block cluster upgrades the way ingress-nginx did. I looked at how long each took to support a new Kubernetes version, and whether its support period is defined by policy.
- **Who maintains it**: I wanted to avoid anything maintained by one or two people.
- **The features we use**: Whether rewrites, CORS, timeouts, body size limits, and per-IP request rate limits are supported as standard features or official configuration.

I ruled out Cilium (it would mean replacing our CNI), AWS Load Balancer Controller and Traefik (only partial Gateway API conformance), and Kong (its default image is the paid edition), and compared the remaining four.

| Implementation | Time to support a new version (1.34–1.37) | Support period policy | Maintainers | Drawback |
|---|---|---|---|---|
| Envoy Gateway | 50–162 days, no official 1.37 support at the time | 6 months per minor | Envoy org (CNCF), multiple companies | Had we picked it, our 1.37 upgrade would be blocked right now |
| NGINX Gateway Fabric | 7–56 days (no test record for 1.36) | Not stated | F5 alone | No defined support period |
| kgateway | 44–92 days | A minor about every 3 months | CNCF Sandbox, most maintainers from one company | Per-IP rate limiting needs a separate service |
| Istio | 26–70 days | Until 6 weeks after the N+2 minor | CNCF graduated, multiple companies | Body size limits and per-IP rate limits fall outside standard features (need EnvoyFilter) |

At first, NGINX Gateway Fabric looked like the strongest candidate. It's built on nginx, so body size limits, timeouts, and rate limits behave the same way they did before, and it supported 1.37 within a week. It would change the least during migration, which also looked like the lightest debugging load for someone handling infrastructure alone.

But looking again, two things bothered me.

First, whichever implementation we chose, we'd have to keep upgrading the implementation itself. What mattered, then, was whether it defines how long each version is supported, and NGINX Gateway Fabric doesn't. Given that we had missed the end of support for both EKS and ingress-nginx this time, I thought one with a stated support policy was the better choice.

Second, we were considering adopting a service mesh within about a year. If we went with NGINX Gateway Fabric and later adopted a mesh, we'd have to run the ingress and the mesh separately or migrate the ingress once more. For the same reason I skipped Traefik earlier, I didn't want to do the same work twice.

So I chose Istio. It tracks new versions consistently fast, has a defined support policy, is maintained by multiple companies, and lets us extend the same component to a mesh later. I chose it knowing that, until we actually use it as a mesh, it can be a somewhat heavy choice for just the Gateway features.

What remained were body size limits and per-IP rate limits. Applying either at the gateway in Istio requires EnvoyFilter, which edits Envoy's internal configuration directly, and Istio's own docs warn that it exposes internal implementation details and calls for extreme care during upgrades. So I set one principle: no EnvoyFilter, only standard Gateway API resources. One of the reasons we were leaving ingress-nginx was the pile of non-standard settings like snippets, and I didn't want to repeat that after moving. The two features that can't be expressed in the standard were moved toward being handled in the app instead of at the gateway.

### Separating the Development and Production Gateways

Previously, a single ingress controller handled both development and production traffic. This time, I kept one istiod as the control plane, but split the Gateways that actually receive traffic (Envoy and NLB) into development and production.

![Before: users, CDN, one NLB, and a single ingress-nginx shared by dev and prod, routing to production and dev apps](https://www.dropbox.com/scl/fi/yby2k5s2nktiussd5a5ok/eks-upgrade-p2-ingress-before.en.png?rlkey=29yfdugx26rl88y3amsah9z6c&raw=1)

![After: the CDN splits into a production NLB and a dev NLB, each going through its own Gateway to the apps, with istiod distributing config to both Gateways](https://www.dropbox.com/scl/fi/r1eculszpdcxks960f8nv/eks-upgrade-p2-ingress-after.en.png?rlkey=hxs3wgqnwrv42wm0g3rt844u1&raw=1)

I wanted to keep configuration mistakes on the development side from spreading to production traffic, and when upgrading Istio, we can try it on the development Gateway first. AWS-specific settings (NLB annotations, node placement) are kept in a single ConfigMap per Gateway and not in the HTTPRoutes that define the paths. The idea was to reduce what needs changing if we ever move to another cluster.

## Behavior Differences Found During the Migration

I converted each Ingress file into one HTTPRoute file, one to one. I did the conversion with a script, but finding where the two controllers interpreted the same configuration differently took more time than the conversion itself.

### Moving the Rewrites

In nginx, we were stripping prefixes with `rewrite-target: /$2` on regex paths like `/service(/|$)(.*)`. As mentioned earlier, all of our rewrites were used this way, which gives the same result with a `PathPrefix` match and `ReplacePrefixMatch: /`.

```yaml
- matches:
    - path:
        type: PathPrefix
        value: /service
  filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
```

However, a rule using this filter can only have one `PathPrefix` match, so I had to create a separate rule for each prefix. As a result, some routes went over the 16-rule limit per HTTPRoute, so I split them. Server-side dry-run let me catch this before applying anything.

### Response Comparison Tests

I sent the same 586 requests to nginx and to the new Gateway and compared the responses. To first check whether the comparison itself could be trusted, I sent them to the same nginx twice and confirmed the difference was 0 before starting.

The first comparison showed as many as 442 differences, but most were due to badly designed tests: checking CORS with an origin that wasn't allowed, mixing in hosts that hadn't been migrated yet, or counting header formatting differences that mean the same thing to a browser. After filtering those out, there were two kinds of real behavior differences.

| Difference | nginx | Gateway |
|---|---|---|
| Hosts with at least one regex path | Treats every path on that host as a regex prefix, so `/api` also matches `/apix` | Matches as written |
| Case in regex paths | Ignored | Respected |

In both cases the Gateway was stricter and closer to what was originally intended. This was the first time I learned that nginx's `use-regex` applies to the whole host, not just one path.

For regex paths, though, the Gateway was stricter in a way that needed fixing. Envoy regexes must match the whole path, while nginx only needed the beginning to match. So I appended `.*` to regexes that didn't end with `$`.

There was one CORS issue too. The existing configuration was sending an allowed origin of `*` together with allowing credentials, a combination browsers reject. When moving to the Gateway, I changed it so credentials are turned off where the origin is `*`.

Finally, I ran close to an hour of production access logs against the new Gateway's routes, and there were 0 requests that didn't match.

### istiod Chart Defaults

When I installed istiod, the Helm chart defaults were one pod with a PDB of `minAvailable: 1`. It was the same combination I had identified earlier as blocking node rollouts. I installed it with two pods and node-level anti-affinity instead. Since then, I check the PDB defaults first whenever I install a chart.

### Traffic Cutover Order

The cutover was done per host by changing the origin of the CDN record to the new NLB. I moved the development hosts first and tried logging in and the main API flows myself, and then moved production starting with internal hosts like monitoring.

Once I didn't follow the order. For one host, I changed the DNS before applying the HTTPRoute, and two requests that came in during that one second couldn't find a route and got 404s. After that, I changed DNS only after confirming the route was applied. Connections the CDN had already opened to the old origin continued for about 1 to 2 minutes after changing the record, so during that time I watched the access logs on both sides.

After moving every host, I confirmed there were 0 real requests reaching the old nginx, and removed the controller and the old NLB.

## Argo CD and Node Termination Handler

After moving the ingress, I dealt with the other two components from the list above. I upgraded Argo CD from 2.x to 3.6 in one go. The same Argo CD manages both development and production apps, so an upgrade applies to both at once. So of the defaults that changed in 3.0, I deliberately pinned the resource tracking method, the reconcile interval, and NetworkPolicy creation to their previous behavior, to reduce how much changed at once. Before the upgrade I saved the sync and health status of every app to a file, pulled it again after the upgrade, and compared them: 0 differences. Applying it took 56 seconds, and since Argo CD is on the deployment path, not the request path, there were no service request failures during that time either.

I removed the Node Termination Handler instead of upgrading it. It's a component that receives spot interruption notices and drains the node, but [the README in NTH's official repository](https://github.com/aws/aws-node-termination-handler) says, "If you're using EKS managed node groups, you don't need the aws-node-termination-handler." With managed node groups, EKS [does the same work itself](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html). All of our node groups were managed, and I also confirmed that spot rebalancing was enabled. Checking things for the upgrade, I could see not only what needed upgrading but also what could be removed.

## Why 1.36 and 1.37 Were Done Back to Back

I did 1.36 and 1.37 with the same procedure, back to back on the same day.

I knew it's usually safer to leave a few days between versions and watch. I still decided to finish in one go because of my situation. I handle infrastructure alone while also doing other development, so if I stopped here, I thought it would take quite a while just to get back up to speed on the cluster state and the day's changes the next time I picked it up. I chose to finish while I had the clearest picture, right after sorting out the nodes, the ingress, and Argo CD.

Instead, since I wasn't taking breaks between versions, I decided to verify at every step before moving on. For each version, I upgraded the control plane, rolled the development node group first, and then raised the node group default to roll the production node groups together. During each step, I kept sending requests from outside and watched the failure count. I only moved to production when development had no problems, and when failures appeared, I moved to the next step only after finding and fixing the cause. Problems that don't show up right after an upgrade and only appear days later can't be caught this way, so I left that to monitoring after the work was done.

## The 1.36 Upgrade and Gateway Shutdown Handling

The 1.36 control plane upgrade took about 8 minutes, with 0 request failures. The problems came from the nodes. Now, rolling the nodes would move Gateway pods instead of nginx, and I hadn't measured the Gateway's shutdown handling yet. So before moving to production, I measured it by restarting the development Gateway. To avoid missing even brief failures, from this point I sent requests at shorter intervals.

### Development Gateway Rollout Strategy

The first restart never finished rolling out. There are two development nodes, the two Gateway pods had required anti-affinity to keep them on different nodes, and the default rolling strategy starts one new pod first. The new pod had no node to go to and stayed Pending. The two existing pods kept serving requests, so there were no failures, but I changed the development Gateway to take down one existing pod first (`maxSurge: 0`).

### NLB Health Checks and Pod Ready Timing

After fixing the strategy and rolling out again, 12 out of 459 requests failed this time. There were two causes.

```mermaid
sequenceDiagram
    participant D as Deployment
    participant N as New Gateway pod
    participant L as NLB
    participant O as Old Gateway pod
    D->>N: Create
    N->>D: Container ready (Ready)
    D->>O: Terminate
    Note over L: Before passing 3 health checks at 10 s intervals<br/>the new pod is not yet a target
    L--xO: Keeps forwarding to the terminating pod
```

First, Ready as Kubernetes sees it and healthy as the NLB sees it were different. The NLB considers a new target healthy only after three health checks at 10-second intervals, but Kubernetes saw the new pod as Ready before that and took down the old pod. Second, even after the old pod was removed as a target, the NLB kept sending new connections to it for a while. It was the same kind of problem as the endpoint propagation delay I saw with nginx, this time in the NLB.

I solved the first with the AWS Load Balancer Controller's pod readiness gate.

> What is a pod readiness gate?
> It's a feature that adds one more condition for a pod to become Ready. With the AWS Load Balancer Controller's readiness gate enabled, a container being ready isn't enough; the pod only becomes Ready after it's registered as an NLB target and passes the health checks. Just adding a label to a namespace applies it automatically to the pods in it.

With this, rollouts and PDBs wait based on the NLB rather than Kubernetes. For the second, I increased `terminationDrainDuration` to 30 seconds so Envoy keeps accepting connections after receiving the termination signal. Restarting again gave 0 failures out of 519.

### Production Node Rollout Results

I applied the same settings to the production Gateway and rolled the production nodes to 1.36. The result was 13 failures out of 1,841. I matched each failure time against events.

| Failure | Count | Cause |
|---|---|---|
| 35 to 43 s after a Gateway pod terminated | 6 | The NLB kept sending connections to the terminated pod after 30 s. A 30 s drain wasn't enough |
| While the LBC leader pod was moving | 6 | The controller leader on the same node was moved, and NLB target deregistration stopped for 20 s until a new leader was elected |
| App pod termination | 1 | The app-side propagation delay seen with 1.35 |

I assumed that since development had 0 failures, production would too, but draining production nodes had a condition development didn't: the controller that manages the NLB targets also moves along with the nodes.

So I increased the Envoy drain to 90 seconds to cover both the NLB deregistration delay and the leader handover time, and added a `preStop` to the app pods that waits 15 seconds before shutting down. The 503s on the app path during 1.35 came from the same endpoint propagation delay, and this was the setting I had put off back then. While applying these settings to production, there were 0 failures out of 573.

## 1.37 Upgrade Results

| Step | Time | External request failures |
|---|---|---|
| Control plane 1.36 → 1.37 | about 8 min | 0 of 756 |
| Development node group | 10 min 31 s | Development API down for about 4 min (single-pod development app; accepted since the environment has no users) |
| Production node groups | about 16 min | 6 of 2,405 |

Failures on the Gateway path went to 0. The remaining 6 were clustered within 7 seconds. The requests recorded in the Gateway access logs showed the client disconnecting first while waiting for a response, and the app logs at the same time showed cache server reconnection failures. As the spot node was drained, a cache server pod was moved, and while the app waited to reconnect, responses went over 3 seconds. I had thought a short cache outage was fine since reads can fall back to the DB, but in practice the responses themselves were delayed for the few seconds spent waiting to reconnect. I think whether a cache can be allowed to stop depends on how quickly the app gives up when it can't use the cache. I've left the cache server's PDB and the app's timeout as next work.

Here are the 1.36 and 1.37 production node rollouts side by side, minute by minute.

![Failed requests per minute during the 1.36 and 1.37 production node rollouts. 1.36 had 13 between minutes 5 and 9 from an app pod terminating, Gateway pods terminating, and the LBC leader moving; 1.37 had 6 at minute 8 from a cache server pod moving](https://www.dropbox.com/scl/fi/4snbnu2ucgqwq96nydzwo/eks-upgrade-node-rollout-failures.en.png?rlkey=ktna9e8m03jj0sqi78cdsgx5j&raw=1)

For reference, even after the rollout was completely done and nothing was happening, the same measurement recorded 3 three-second timeouts out of 2,082 requests. That means the measurement path itself has about this much noise, so please read the numbers in the tables above with that margin in mind.

With that, the control plane and all nodes were on 1.37. Standard support for 1.37 runs until December 1, 2027.

![The cluster list in the EKS console showing Kubernetes version 1.37 with standard support until December 1, 2027](https://www.dropbox.com/scl/fi/oz9ey2r2a1o9zzf35ttts/eks-upgrade-eks-console-cluster-1.37.png?rlkey=nif6isskkqsmkyjb5joscqlkz&raw=1)

![The node group list in the EKS console showing all three node groups, dev, on-demand, and spot, on AMI 1.37.1](https://www.dropbox.com/scl/fi/cs9yjqxdlwx3dirikn6k0/eks-upgrade-eks-console-nodegroups-1.37.png?rlkey=hzdgzbvl5zsl9y7qxtcotoy0z&raw=1)

![kubectl showing server version v1.37.1 and kubelet version v1.37.1 on all six nodes](https://www.dropbox.com/scl/fi/ix3chg975hbagalgiink4/eks-upgrade-kubectl-nodes-1.37.png?rlkey=qjkmz2xnfn86ix1t00h1kmava&raw=1)

*The final state as seen in the EKS console and with kubectl: the control plane, all three node groups, and all six nodes are on 1.37.*

## Closing

What I spent the most time on in this work was the difference in timing between when a pod becomes ready and when it's removed. The moment a container was ready, the moment it was removed from the endpoints, and the moment the NLB considered it healthy were all different, and a few requests dropped at each of those gaps. When I read the documentation, I thought I understood it, but until I measured it myself by sending requests, I couldn't tell where requests were being dropped.

This was also the first time I put together the supported ranges for the components we installed ourselves. Since those were what actually blocked the next upgrade, I plan to look at that list first before the next one.

The development environment stopped for a few minutes each time the nodes were moved. That's because it runs a single pod, and I accepted it this time, but I'm still thinking about whether it's right to leave it that way.

Thank you for reading this long post. I hope it's of some help to anyone preparing a similar upgrade or ingress migration.

---

### Reference

- [Amazon EKS: Update a managed node group](https://docs.aws.amazon.com/eks/latest/userguide/update-managed-node-group.html)
- [Amazon EKS managed node groups (Spot capacity rebalancing)](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
- [Kubernetes Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/)
- [Kubernetes: Pod Disruption Budgets](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
- [Kubernetes: Termination of Pods](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)
- [ingress-nginx command line arguments](https://kubernetes.github.io/ingress-nginx/user-guide/cli-arguments/)
- [Ingress NGINX Retirement: What You Need to Know](https://kubernetes.io/blog/2025/11/11/ingress-Nginx-retirement/)
- [Gateway API: HTTPRoute](https://gateway-api.sigs.k8s.io/api-types/httproute/)
- [Istio: Kubernetes Gateway API](https://istio.io/latest/docs/tasks/traffic-management/ingress/gateway-api/)
- [Istio ProxyConfig: terminationDrainDuration](https://istio.io/latest/docs/reference/config/istio.mesh.v1alpha1/#ProxyConfig)
- [AWS Load Balancer Controller: Pod readiness gate](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/deploy/pod_readiness_gate/)
- [Argo CD upgrading 2.14 to 3.0](https://argo-cd.readthedocs.io/en/stable/operator-manual/upgrading/2.14-3.0/)
- [Argo CD tested Kubernetes versions](https://argo-cd.readthedocs.io/en/stable/operator-manual/tested-kubernetes-versions/)
- [AWS Node Termination Handler](https://github.com/aws/aws-node-termination-handler)
