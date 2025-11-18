---
title: The Gap Between Clean Code and Reality as I Feel It
tags:
  - "clean code"
date: '2024-12-03'
---

When developing, you encounter the term **"Clean Code"**.

Principles that code should be easy to read, clearly express intent, and be easy to maintain. When I first learned clean code, I felt many things.

I started thinking for the first time that I need to think a lot even when naming one variable.

But when I entered practical work and experienced various projects, reality was more complex than expected.

There were various realistic constraints blocking ideals like deadlines, team priorities, and complexity of already existing codebase.

Especially at the point of **"naming"**, I sometimes felt a gap between ideals and reality. **"Names that reveal intent"** emphasized in Clean Code are obviously important, but there were moments when I had to compromise with ideals.

---

### Ideals of Clean Code

One of the most impressive things while learning Clean Code was **"names that reveal intent"**. I think the principle that you should be able to tell what a class or function does just by looking at its name greatly improves code readability.

For example, the name `OrderManager` allows you to see at a glance that the class "manages orders" while being concise.

```java
public class OrderManager {
    // Logic related to order creation, modification, cancellation
}
```

I think such names are intuitive, easy to read, and helpful in collaboration. I'm also putting a lot of effort into creating such names, and as much as I think and try, my code seems to get cleaner and I feel proud.

---

### Difficulty of Naming

However, I realized it's not always possible to create concise and intuitive names. In complex requirements or collaborative environments, situations arose where names inevitably became long and complex.

Actually, I'll introduce one case that extremely shows the difficulty of naming. In Java's `AspectJ` library, there exists a class like this:

```java
public class HasThisTypePatternTriedToSneakInSomeGenericOrParameterizedTypePatternMatchingStuffAnywhereVisitor extends AbstractPatternNodeVisitor
```

When I first saw this name, I thought "Is this really a class name?" Just from the name, you can tell this class has the role of "visitor that checks if generic or parameterized type pattern matching was attempted", but it's so long and complex that I felt the following problems:

1. **Decreased readability**
   The name gets cut off in IDE, or when it appears in method chains, it seriously harms code readability.

2. **Collaboration inefficiency**
   When discussing code with team members, it takes time even to mention such names. It's likely to be called "that long class name".

3. **Maintenance burden**
   When you need to write or change the name accurately without typos, work time increases due to length and complexity.

---

### Why Are Such Names Created?

The reasons I think such names are born are as follows:

1. **When excessively pursuing clarity**
   Naturally it gets longer when trying to include all information in the name. Especially when roles are complex or dealing with multiple responsibilities, the attempt to explain itself makes names verbose.

2. **Special domain requirements**
   Libraries like AspectJ deal with complex pattern matching related work, so I think there can be cases where names themselves reflect domain complexity.

3. **Product of collaboration and compromise**
   I think when discussing names within teams, agreements can be reached to write specifically to reduce ambiguity. As a result, there seem to be cases where such conventions actually harm readability.

---

### Actual Experience

I've also experienced such dilemmas. While developing payment-related functions, there was a case where I worried about naming like this:

- Initially I named it `PaymentProcessor`.
  I thought naming was good in the sense that this class processes payments.

- As time passed, the class gradually took on various roles.
  As functions like approval, cancellation, refund were added, I felt existing names couldn't explain all roles.

- So I changed to `PaymentApprovalAndRefundHandler`.
  I tried to more clearly reveal roles, but as names got longer, code readability rather decreased. And I started thinking should names get longer each time functions are added...?

- Ultimately changed back to `PaymentHandler` concisely, and supplemented detailed role explanation with comments.


What I felt in this process was that rather than trying to include everything in names, considering code readability and maintainability itself is more important.

---

### Compromise Between Ideals and Reality

Ultimately, I learned that I need to establish standards for compromising with reality while keeping Clean Code principles. The standards I currently think are as follows:

1. **Remember Single Responsibility Principle**
   I think if classes have only one responsibility, names become easy to keep concise. If they have multiple responsibilities, the possibility of difficult naming seems high.

2. **Conciseness first**
   Names should contain only core roles. When specific explanation is needed, supplement with comments.

3. **Consider context**
   Name so it can be sufficiently understood in the domain or project context where code is written.

4. **Team rules first**
   Follow naming rules agreed upon through discussion with team members. I think consistency is important in collaboration.

5. **Code and names evolve together**
   I think names should also change when code changes. Need to lift the burden of deciding perfect names from the start.

---

### Conclusion

I think names like `HasThisTypePatternTriedToSneakInSomeGenericOrParameterizedTypePatternMatchingStuffAnywhereVisitor` show one case of gap between Clean Code and reality. At first I thought "what is this?" but through this I felt again the point that **"naming must always be considered between ideals and reality"**.

I haven't gotten perfect answers yet, but I want to write even slightly better code each time through such considerations. :)
