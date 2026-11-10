---
title: "[EKS Upgrade 1/2] EKS and MySQL After End of Standard Support: Stopping the Extended Support Charges"
tags:
  - "aws"
  - "eks"
  - "kubernetes"
  - "terraform"
  - "rds"
  - "cost"
date: '2026-10-14'
description: "How we traced EKS 1.33 and MySQL 8.0 extended support charges on our AWS bill and stopped them by upgrading the control plane first"
images:
  - "https://www.dropbox.com/scl/fi/gqf0ppjb39xbnxkxl0ri0/eks-upgrade-cover-part1.png?rlkey=sq0q0xrm8w37nnqlwptylv5fk&raw=1"
---

![EKS Upgrade 1/2 cover](https://www.dropbox.com/scl/fi/gqf0ppjb39xbnxkxl0ri0/eks-upgrade-cover-part1.png?rlkey=sq0q0xrm8w37nnqlwptylv5fk&raw=1)

Hello, I'm Jeong Jeong-il, a backend developer working at a PropTech platform.

This time I'd like to talk about upgrading our EKS 1.33 cluster and RDS MySQL 8.0 last September, after their AWS standard support periods had ended. It wasn't planned work. I hadn't kept track of the end-of-support dates, our August server bill came out much higher than expected, and I ended up preparing and doing the work in a hurry.

So this post also starts where the work started for me: the AWS bill. I'll cover how I found the cause of the cost increase, what changes when the versions go up, and how I went about the work.

Before I begin, I should mention that I'm not an infrastructure specialist; at my current company I handle both backend and infrastructure. Rather than presenting this as the right answer, I'd appreciate it if you read it as a record of running into a problem, exploring it, and making decisions that fit our situation.

## The August AWS Cost Increase

In early September, someone from our finance team reached out to our team about the August AWS costs. The charges were higher than usual, and they asked if we could explain why. When I checked right away, the server costs were close to double the average of the previous few months.

My first reaction was, "Huh?" We hadn't scaled up any server resources or added any services in August. Traffic hadn't jumped either, so I figured I needed to look elsewhere.

```
Service          August vs. July
Amazon RDS      +$534.89
Amazon EKS      +$334.80
Tax             (increased in line with the two above)
EC2 - Compute   slightly down
Others (CloudWatch, S3, ELB, VPC ...)    no change
```

Looking at the details, EC2 had actually gone down slightly, and only RDS and EKS had gone up. We hadn't added any instances and the node count was the same, so I concluded the increase wasn't usage-driven.

## Extended Support Charges

When I drilled down to the usage type, line items I had never seen before showed up right away.

```
APN2-ExtendedSupport:Yr1-Yr2:MySQL8.0    $534.24
APN2-AmazonEKS-Hours:extendedSupport     $371.00
```

The item names contained ExtendedSupport, and when I queried them day by day, the same amount was being charged every day starting the day after each version's end of standard support. These were charges that came from the end of the standard support period for specific versions of services we were using.

![Daily extended support charges by usage type in Cost Explorer. EKS charges start July 29 and MySQL charges start August 1 at the same amount every day, disappearing after September 2](https://www.dropbox.com/scl/fi/6zfavxrdlsn1uf59419dc/eks-upgrade-cost-explorer-extended-support.png?rlkey=2wcxkmubw9lpznuteqeuxowfb&raw=1)

*Daily charges by usage type in Cost Explorer. Bars of exactly the same height start on specific dates.*

Nothing about our service setup had changed. The standard support for the versions we were using had ended, and AWS had automatically moved them to extended support.

> What is AWS standard support?
> For services where AWS provides open source software (Kubernetes, MySQL, and so on) as a managed service, like EKS and RDS, each version has a defined support period. During standard support, AWS provides security patches and bug fixes for that version, and you use it at the normal price with no additional charge. When that period ends, the version moves to extended support. Security patches continue during extended support, but an additional charge applies in exchange for giving you more time to upgrade. When extended support also ends, AWS automatically upgrades to a supported version.

![The EKS Kubernetes release calendar in the AWS documentation. Standard support for 1.33 ends July 29, 2026, and for 1.35 on March 27, 2027](https://www.dropbox.com/scl/fi/f0rxdp8elfy99g44z4zm8/eks-upgrade-eks-release-calendar.png?rlkey=98bav2nysz3o1548w1t3bu0ro&raw=1)

*The [EKS Kubernetes release calendar](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html#kubernetes-release-calendar) in the AWS documentation. Standard support for 1.33, which we were running, ended on July 29, 2026.*

AWS sends a notice before standard support ends, and the notice had arrived in our account. However, I couldn't access the mailbox registered as the AWS account contact at the time. That mailbox hadn't been handed over smoothly when the person in charge changed, and since I handle infrastructure alone, checking who was reading that mailbox had been pushed back. Looking back, I realized there was something I had failed to take care of, and it weighed on me. I've since taken over that account and manage it directly.

### What EKS Charges Are Based On

EKS is billed per cluster per hour: $0.10 per hour on a standard support version and $0.60 on an extended support version. Per day, that's an extra $0.50 × 24 hours = $12, and when I checked our cost management, that was exactly the daily amount charged for APN2-AmazonEKS-Hours:extendedSupport.

So, to bring this charge back down to what we used to pay, we needed to upgrade EKS to a version that AWS covers under standard support, and I decided to do it as soon as possible.

After that, I went through researching the upgrade procedure and risks and organizing what work needed to be done. A cluster has a control plane and node groups, and every node group and the control plane in our EKS cluster were on 1.33, which was the standard support version when I set up EKS. Upgrading the node groups as well means replacing every node with the new version, and in the process every pod on those nodes gets moved to another node. So I thought the impact on the service could be significant.

However, while reading the EKS pricing documentation and version support policy documentation, I learned one important point: the EKS extended support charge is calculated based on the version of the cluster, that is, the control plane. The node version had no effect on the charge. This became a major basis for deciding the scope and order of the work.

RDS is billed per instance vCPU, with a minimum of 2 vCPUs. With three 8.0 instances: 3 × 2 vCPU × 24 hours × $0.12 = $17.28 per day. Working through the numbers, I found that our smallest development DB was paying 4.7 times its instance cost in extended support charges. That was quite a lot.

Together that came to about $905 a month (before tax), and the RDS rate doubles from the third year. Since the longer we waited the more it would cost, I decided to deal with it right away.

## Upgrade Scope and Order

### Target Version

The next question was how far to upgrade. Standard support for EKS 1.34 also ends in December 2026, so I judged that stopping at 1.34 would mean going through the same thing again a few months later. So I decided to upgrade to 1.35 (standard support until March 27, 2027).

However, EKS only lets you upgrade one minor version at a time. You can't go from 1.33 straight to 1.35; it has to be done in steps, 1.33 → 1.34 → 1.35.

Then I needed to review what changes each version brings. As Kubernetes versions go up, old APIs get removed, defaults or behaviors change, and support ends for node components like cgroup or the container runtime. That means resources or settings that worked fine on 1.33 could be rejected or behave differently on the new version. So I reviewed the changes in 1.34 and 1.35, split into the control plane side and the node side.

| Version | Control plane / API side | Node side |
|---|---|---|
| 1.34 | DRA GA, consistent reads from cache GA | cgroup driver autodetection GA |
| 1.35 | Job `managedBy` GA, SPDY → WebSocket transition GA | cgroup v1 support removed, kube-proxy IPVS mode deprecated, last version to support containerd 1.x |

On the control plane side, my biggest concern was an API we use being removed in the new version. As mentioned above, Kubernetes removes old APIs as versions go up, and if we were using one of those, deployments could break after the upgrade. The API server records each call to a deprecated API in a metric called `apiserver_requested_deprecated_apis`. Checking it, the only hit was `core/v1 endpoints`, which isn't scheduled for removal, so on the control plane side there was no problem in terms of removed APIs.

The node side was a bit different. In 1.35, the kubelet doesn't start with default settings on nodes using cgroup v1, kube-proxy's IPVS mode is deprecated, and it's the last version to support containerd 1.x. These are changes where, depending on the node's OS settings or runtime, the node itself might not start or network behavior might change, so when upgrading the nodes I needed to check the state of each of our nodes first.

### Why In-Place

After reviewing the changes, I had to decide how to upgrade. Most EKS upgrade stories I found used Blue-Green: create another cluster on the new version and move traffic over. Its advantages are that if something goes wrong you can move traffic back to the old cluster, and you can jump straight from 1.33 to 1.35.

But in our situation the cost was high. Development and production share one cluster, separated by namespaces and node groups, so moving to a new cluster meant moving both together. Not only the applications but also services that keep data on EBS volumes, like the cache, search engine, and monitoring, would need their data moved, and the load balancers and DNS that receive external traffic would all need to switch to the new cluster. In the meantime we'd be paying for two sets of control planes and nodes, with the extended support charge still accruing. Doing this alone, I thought the longer it took to keep the two clusters' configuration in sync, the more room there would be for mistakes. So I chose the in-place approach of upgrading the existing cluster.

### Settings Blocking a Node Rollout

After deciding on in-place, I had to check the service impact I was worried about earlier. The order the EKS documentation recommends is to upgrade the control plane first, bring the nodes to the same version, and then move to the next version. Bringing the nodes to a new version requires a rollout that launches new nodes and moves pods off the old nodes one by one, so I first checked whether the cluster was in a state where the service could stay up and keep handling requests normally during that process.

What needed reviewing here was the PDB (PodDisruptionBudget). A PDB is a setting that puts a condition like "at least this many pods of this service must stay alive" when emptying a node. Whatever is emptying the node can only evict pods as long as that condition isn't violated.

```
NAME            MIN AVAILABLE   ALLOWED DISRUPTIONS
service-a-pdb   1               0
service-b-pdb   1               0
service-c-pdb   1               0
```

All three services had a single pod with `minAvailable: 1`, meaning "at least one must stay alive." With only one pod, the number of pods that could be evicted was 0, which effectively means "never take this down." Updating the node groups as-is would fail with `PodEvictionFailure` because these pods couldn't be moved. On top of that, the ingress controller receiving external traffic was a single pod with no PDB, so the moment the node running it was emptied, all external traffic would be cut off.

These were fixable, but not immediately. The easiest fix would be running two pods, but among the three services there were some that must run as a single instance to prevent duplicate processing, so each service needed its own approach. For the ingress controller, adding a pod wasn't enough either; I had to decide placement so the two pods wouldn't land on the same node and actually verify the transition happened without interruption. Meanwhile, the extended support charges were accruing at about $29 a day.

So I came back to the pricing basis I had read about earlier. If the charge is based on the control plane version, I checked whether it was okay to leave the nodes as they were for a while and upgrade only the control plane. Kubernetes has a version skew policy, and it allows the kubelet running on nodes to be up to three minor versions older than the control plane's kube-apiserver.

| Control plane | Node (kubelet) | Version gap | |
|---|---|---|---|
| 1.34 | 1.33 | 1 | Allowed |
| 1.35 | 1.33 | 2 | Allowed |
| 1.36 | 1.33 | 3 | Allowed, but no further upgrades possible |

### Why Only the Control Plane First

![EKS cluster structure. Only the AWS-managed control plane goes to 1.35 while the dev, spot, and on-demand node groups keep kubelet 1.33. The spot group runs an ingress without a PDB and services with minAvailable 1](https://www.dropbox.com/scl/fi/d4dtevsarplfy3jjq9b4x/eks-upgrade-p1-cluster-structure.en.png?rlkey=akhn9qvjuv8j0ugbkh8epdhv8&raw=1)

*The structure: upgrade only the control plane (the billing basis) first, and leave the node groups, where the ingress and PDBs blocked a rollout, on 1.33*

Even at 1.35, the gap with the nodes would be 2, within the allowed range. So I decided to upgrade only the control plane to 1.35 and leave the nodes at 1.33. A control plane upgrade doesn't touch the nodes, so pods don't restart, and only the standard support charge applies, as before. I decided to upgrade the nodes on a separate schedule after making the ingress redundant and sorting out the PDBs.

Of course, deviating from the recommended order meant accepting some risk. The nodes would stay on the 1.33 AMI, so OS and kernel patches released in the meantime wouldn't get in, and since the version gap was already 2, the nodes would have to be upgraded first before the control plane could keep going to 1.36 and beyond. Still, rather than bundling the work of stopping the charges with work that could interrupt the service like a node rollout, I judged it was right to separate them and do the node rollout after the preparation was done.

## Control Plane Upgrade

### Node Group Version Inheritance in the Terraform Module

With the direction set, it was time to do the work. We manage EKS with Terraform, so changing the cluster version also started with changing the `cluster_version` value in the Terraform code to 1.34. But when I looked at the plan, the change list, which I expected to contain only the control plane, also had the three node groups being upgraded from 1.33 to 1.34.

The cause was the behavior of the `terraform-aws-modules/eks` module (v20.37.2) we use. Unless you give a node group a version explicitly, this module makes it follow the cluster version.

```hcl
# node_groups.tf:304
cluster_version = try(each.value.cluster_version,
                      var.eks_managed_node_group_defaults.cluster_version,
                      time_sleep.this[0].triggers["cluster_version"])
```

Having decided to upgrade only the control plane, if I had skimmed the plan and moved on, the node rollout I meant to avoid would have happened along with it, and I probably would have been caught off guard by something unexpected. So I pinned the version explicitly in the node group defaults.

```hcl
eks_managed_node_group_defaults = {
  cluster_version = "1.33"
}
```

After that, planning again, the changes dropped from 10 to 7, and the three items that dropped out were the node groups.

One more thing came up while reviewing the plan: changes unrelated to EKS were also being picked up. Some settings that I or other developers had changed directly through the console or CLI in the past were still not reflected in the code, so Terraform was trying to revert them to the code's state. Applying as-is would have rolled the production DB engine version back to an old version and deleted security group rules that were in use. So for this work, I created a plan file targeting only the EKS module with the `-target=module.eks` option and applied only that file. I separately cleaned up the places where the code and the actual state had drifted apart.

When upgrading the cluster version, EKS add-ons like coredns, kube-proxy, and vpc-cni also need to be upgraded to match. At first I thought I could just use the default versions AWS sets for each version, but the default coredns version for 1.34 was actually lower than the one we were running. Using the default would have been a downgrade rather than an upgrade. The same was true for 1.35. Since then, I don't leave add-on versions to the defaults; I pick them directly from the compatibility list.

### Upgrade Results

| Step | Time | Result |
|---|---|---|
| 1.33 → 1.34 | about 8 min | 0 pods restarted, 0 unhealthy pods, 0 ingress restarts, nodes stayed at 1.33 |
| 1.34 → 1.35 | similar | same result |

While the control plane is being replaced, requests to the API server can fail briefly. Argo CD, our deployment tool, also talks to the API server constantly, so I paused Argo CD syncs during the upgrade.

### What `supportType` Means

After the control plane upgrade, while checking whether the charge was now calculated at the standard rate, one value was different from what I expected. I checked whether `upgradePolicy.supportType` changed from `EXTENDED` to `STANDARD` after the upgrade, but even after upgrading to 1.34, the value was still `EXTENDED`.

![upgradePolicy queried with aws eks describe-cluster: supportType is EXTENDED](https://www.dropbox.com/scl/fi/916qaas8wh6mvv6ao7xg9/eks-upgrade-term-eks-upgrade-policy.png?rlkey=khxnf95axxo4pb3saob7y57us&raw=1)

It turned out this field isn't a status showing whether the cluster is currently on extended support. It's a policy that decides what happens when standard support ends: with `EXTENDED`, the cluster moves to extended support and you pay for it, and with `STANDARD`, AWS upgrades it automatically. So I confirmed that the charge had stopped using the daily amounts in AWS Cost Explorer, not this value.

Leaving this setting as-is means the charge will come back the same way when standard support for 1.35 ends on March 27, 2027. But switching to `STANDARD` could trigger an automatic upgrade at a time we don't want. So I thought choosing the timing myself was better and kept `EXTENDED`, while documenting separately that the work has to be done before the end of standard support.

### Charges

| | August | September |
|---|---|---|
| EKS extended support | $372.00 | $13.27 |
| MySQL 8.0 extended support | $535.68 | $25.92 |

What remained in September was the charge for the few days before the upgrade, and since October started, the daily amount has stayed at $0.

## MySQL 8.0 → 8.4

With EKS sorted out, what remained was RDS. As shown earlier, MySQL 8.0 was also incurring extended support charges for the same reason.

I set the target version to 8.4. Since 8.0, MySQL changed its release model, splitting into LTS versions that are supported for a long time and Innovation versions whose support ends when the next version comes out. Innovation versions stop getting bug and security fixes when the next version is released, so using one for a production DB means doing a major upgrade again every few months. So I decided to use the LTS version, 8.4, for the production DB. Standard support for 8.4 on RDS runs until July 2029, so we wouldn't have to worry about going through the same thing for a while. As with EKS, I reviewed the changes for the version before starting the work, and here I'll only write about the parts that required a decision.

### `mysql_native_password` Default

My biggest worry was authentication. Each MySQL account has an authentication plugin it uses to connect, and according to the [official MySQL 8.4 documentation](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html), the older `mysql_native_password` method is disabled by default starting in 8.4. Our DB accounts mostly used that method, so according to the documentation, the application would be unable to connect to the DB the moment we upgraded.

However, RDS doesn't use MySQL as-is; it manages its own default parameters. So I directly queried the `mysql8.4` default parameters to see whether RDS really had the same default.

![The mysql8.4 defaults queried with aws rds describe-engine-default-parameters: mysql_native_password is ON and not modifiable](https://www.dropbox.com/scl/fi/bw7miezjtpv0979l814n1/eks-upgrade-term-rds-mysql84-auth.png?rlkey=jybjwb8l2ylaey9oh6tvrfq3r&raw=1)

RDS keeps this plugin enabled and fixed. If I had decided based only on the MySQL documentation, I might have done an unnecessary account migration on the production DB first.

### Option Groups and Major Versions

An RDS major version upgrade can't avoid the DB going down briefly while it runs. Before taking the production DB down, I wanted to know whether anything was missing from the procedure and how long it would actually be down, so I tried it on the development DB first. But the apply failed after 13 seconds.

```
api error InvalidParameterCombination:
Current Option Group (<audit-option-group>-mysql80) is non-default.
You need to explicitly specify a new Option Group in this case (default or custom)
```

Besides parameter groups, RDS has a setting called option groups. It's where you configure add-on features attached to the DB, like the audit log plugin, and like parameter groups, it's tied to the major version. So when doing a major upgrade on a DB that uses a non-default option group, you have to specify an option group for the new version as well. This check happens when AWS actually receives the change request, so it doesn't show up in the Terraform plan and only fails at apply time. So I created a new option group for 8.4, copied over the same settings, and ran the update again.

The production DBs used the same option group, so if I had first hit this in production without a rehearsal, I think the maintenance window we had announced would have been eaten up finding the cause, or the work would have run over.

Every time something like this happens, I feel that setting up the development server in advance last year was a really good decision.

### Measuring Downtime

I also measured the actual downtime during the upgrades: the development DB and one other DB that was upgraded the same way first. I took downtime to be from when the instance was shut down to when it was restarted, according to the RDS events.

| Target | Data | Downtime |
|---|---|---|
| Development DB | the larger one | 2 min 45 s |
| Another DB | about one seventh | 2 min 01 s |

Even though the data was nearly seven times smaller, the downtime didn't drop much. From what I found, a major upgrade doesn't rewrite user data but updates the data dictionary and system tables, which seems to be why. Thanks to this, I could estimate the production DB at around 2 to 3 minutes and schedule accordingly. The application recovered without a separate restart, as the connection pool (HikariCP) discarded the broken connections and established new ones.

## What's Left

The charges are back to what they used to be, but the EKS upgrade is still only half done. The nodes are still on 1.33, and the node AMI is the same one built in March. Managed node groups don't replace the AMI with a new one on their own within the same Kubernetes version, so as long as the nodes aren't replaced, OS and kernel patches don't get in either, which means the upgrade has to happen one way or another.

So the next job is upgrading the nodes. Before that, I also need to make the ingress controller redundant and decide, service by service, how to change the three PDBs that block node rollouts. Standard support for 1.35 ends on March 27, 2027, and so I don't end up doing the work only after the end date again like this time, I plan to sort out the nodes first.

## Closing

This taught me that leaving versions as they are, without upgrading, also adds cost. On-premises, an old version would have remained something like a future security issue, but in the cloud, managed services incur additional charges.

Looking back, the basis for making sound decisions during the work mostly came not from reading documentation but from looking at our situation and querying actual values. That was true of the RDS authentication plugin, and of `supportType` and the node group changes in the Terraform plan too. I plan to approach the next node upgrade the same way, checking carefully as I go.

I hope you don't end up paying unexpected costs by missing a standard support deadline like I did. Thank you for reading, and I hope this is of some help.

### Reference

- [Amazon EKS Kubernetes versions lifecycle](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html)
- [Update existing cluster to new Kubernetes version](https://docs.aws.amazon.com/eks/latest/userguide/update-cluster.html)
- [View cluster upgrade policy](https://docs.aws.amazon.com/eks/latest/userguide/view-upgrade-policy.html)
- [Amazon EKS pricing](https://aws.amazon.com/eks/pricing/)
- [Kubernetes Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/)
- [Kubernetes v1.34 release](https://kubernetes.io/blog/2025/08/27/kubernetes-v1-34-release/)
- [Kubernetes v1.35 release](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/)
- [Kubernetes: Pod Disruption Budgets](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
- [Amazon RDS Extended Support charges](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support-charges.html)
- [MySQL 8.4: Native Pluggable Authentication](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html)
- [Major version upgrades for RDS for MySQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.MySQL.Major.html)
