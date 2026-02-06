---
title: "What Happens When You Skip DB Normalization — A Firsthand Experience"
tags:
  - "database"
  - "normalization"
  - "migration"
  - "mysql"
date: '2026-02-06'
---

Everyone knows database normalization is important, but in practice, it seems surprisingly easy to overlook. There are plenty of moments where denormalization wins out for reasons like "one fewer JOIN means better performance" or "it's just easier to store it as text."

I joined my current team in March 2025, and the DB was already in that state when I arrived. At the time, I thought "it's already running this way" and moved on. But after going through the Hwaseong-si district split migration, I learned firsthand what kind of price denormalization can demand.

> Service names, table names, and column names in this article have been changed from the actual ones.

## Hwaseong-si Split Into 4 Districts

I work on a real estate service. It's a service that handles so much address data — apartment info, actual transaction prices, property listings, real estate offices — that it's harder to find a table *without* an address than one with.

On February 1, 2026, Hwaseong-si in Gyeonggi Province was divided into 4 general districts (gu). A city of roughly 1 million people underwent an administrative restructuring — quite a significant event.

| District | Key Areas |
|----------|-----------|
| **Manse-gu** | Ujeong-eup, Hyangnam-eup, Namyang-eup, Mado-myeon, Songsan-myeon, etc. |
| **Hyohaeng-gu** | Bongdam-eup, Maesong-myeon, Bibong-myeon, Jeongnam-myeon, etc. |
| **Byeongjeom-gu** | Jinan-dong, Byeongjeom 1-dong, Byeongjeom 2-dong, Banwol-dong, etc. |
| **Dongtan-gu** | Dongtan 1-dong through Dongtan 9-dong |

This meant the address system changed.

```
Before: Gyeonggi-do Hwaseong-si Jinan-dong 908
After:  Gyeonggi-do Hwaseong-si Byeongjeom-gu Jinan-dong 908

Before: Gyeonggi-do Hwaseong-si Bansong-dong 973
After:  Gyeonggi-do Hwaseong-si Dongtan-gu Bansong-dong 973
```

A new "gu" (district) was inserted right after "Hwaseong-si," and all administrative area codes (`region_code`, `dong_code`) changed as well.

In a real estate service, addresses changing means DB migration. At first, I thought it would be simple — "just update some address data." But when I actually looked at the DB, the situation was anything but simple.

## Where on Earth Are the Addresses?

Our service didn't reference address data through codes in a master table. Instead, address text was stored directly in each table. Some tables had code columns like `region_code` or `dong_code`, but there were far more columns holding raw address strings.

So the first step of the migration was **"finding where addresses are stored"** — and this turned out to be harder than expected.

When I searched the DB using common column names like `addr`, `address`, and `dong_code`, I found 38 tables. I thought that was enough, but as I continued investigating, missed columns started appearing one by one.

| Column Name | Example Data |
|-------------|-------------|
| place1_full_addr | Gyeonggi Hwaseong-si Seokwoo-dong 2-4 |
| complex_address | Gyeonggi-do Hwaseong-si Mokdong Dongtan 2 District |
| jibun_addr | Gyeonggi Hwaseong-si Hyangnam-eup Gumuncheon-ri |

`place1_full_addr`, `complex_address`, `jibun_addr`... every column name was different. Each developer used different names, and in some cases, field names from external APIs were used as-is. Code columns were no different — the same district code was stored under `sigungu_cd`, `arcode`, `stcode`, `sggcode`, and other varying names.

Without a standardized naming convention, searching for `addr` or `address` could never find everything. If there had been a naming rule like `addr_*` for address columns and `region_*` for code columns, we could have identified most of the impact scope from column name patterns alone. This was a moment that reminded me of just how important naming conventions are.

Eventually, I accepted that searching by column name had its limits and changed my approach. I ran `LIKE '%Hwaseong-si%'` against every TEXT/VARCHAR column across every database.

```sql
-- Executed against all text columns across 14 databases
SELECT COUNT(*) FROM some_table WHERE some_column LIKE '%화성시%';
```

It wasn't an efficient method, but it was thorough. And this is where I discovered unexpected false positives.

```
apt_title: "Hwaseongsi-cheong Station Central Park Star Hills Phase 1"
sector_name: "Hwaseongsi-cheong Station Block 2 Seohee Star Hills"
```

Searching for "Hwaseong-si" matched "Hwaseongsi-cheong Station" — an apartment complex name containing the city name as a substring. These had nothing to do with the administrative change and needed to be excluded from migration. In the end, I had to visually inspect sample data for each column.

The final results looked like this:

| Category | Count |
|----------|-------|
| Affected databases | 8 |
| Affected tables | **75** |
| Affected columns | **120+** |
| Records to migrate | **~2.8 million** |

The 38 tables from the initial column-name search grew to 75 after the full scan. **The initial search had only found half.**

## How Do You Migrate 75 Tables?

Identifying the impact scope was just the beginning. Finding 75 tables and 120+ columns didn't mean I could just run UPDATE statements right away.

### Why Simple String Replacement Doesn't Work

My first thought was simple. Just REPLACE "Hwaseong-si" with "Hwaseong-si Byeongjeom-gu," right?

```sql
UPDATE apartment SET addr = REPLACE(addr, '화성시', '화성시 병점구');
```

But this doesn't work. Hwaseong-si was split into **4** districts. Jinan-dong goes to Byeongjeom-gu, Dongtan 1-dong goes to Dongtan-gu, Hyangnam-eup goes to Manse-gu... depending on which dong (neighborhood) the address belongs to, the district is different.

```
Gyeonggi-do Hwaseong-si Jinan-dong 908      → Gyeonggi-do Hwaseong-si Byeongjeom-gu Jinan-dong 908
Gyeonggi-do Hwaseong-si Dongtan 1-dong 123  → Gyeonggi-do Hwaseong-si Dongtan-gu Dongtan 1-dong 123
Gyeonggi-do Hwaseong-si Hyangnam-eup 567    → Gyeonggi-do Hwaseong-si Manse-gu Hyangnam-eup 567
```

So I first built a dong-to-gu mapping table, then used the dong name in the address text to determine which district to insert.

```sql
UPDATE apartment a
JOIN dong_to_gu_mapping m
  ON a.addr LIKE CONCAT('%화성시 ', m.dong_name, '%')
SET a.addr = REPLACE(a.addr, CONCAT('화성시 ', m.dong_name),
                              CONCAT('화성시 ', m.gu_name, ' ', m.dong_name))
WHERE a.addr LIKE '%화성시%'
  AND a.addr NOT LIKE '%화성시청역%';
```

Up to this point, I thought things were reasonably under control. I figured once the mapping table was solid, the rest would be mechanical. But when I actually ran it in the development environment, it wasn't that simple.

### Address Parsing Was Trickier Than Expected

The first thing I hit was that **address formats weren't consistent**.

```
-- Same address, different formats
'경기도 화성시 진안동 908'
'경기 화성시 진안동 908'
'경기도 화성시  진안동 908'   -- double space
```

Some entries used the full province name "Gyeonggi-do," others used the abbreviation "Gyeonggi," and some had double spaces. Since data from external APIs and manually entered data were mixed together, formats were all over the place. `LIKE '%화성시 진안동%'` wouldn't catch the entries with double spaces.

And **road-name addresses don't contain dong names.**

```
'경기도 화성시 병점4로 102'
'경기도 화성시 동탄중심상로 120'
```

Dong-name-based mapping simply couldn't handle road-name addresses. Road-name addresses needed a separate road-to-district mapping, and since Hwaseong-si has hundreds of roads, building that mapping table alone was a significant effort.

In the end, I had to write completely separate scripts for jibun (land-lot) address columns and road-name address columns. On top of that, columns storing only administrative area codes needed yet another code mapping table. Before I could even convert addresses, data cleansing had to come first. It was closer to cleaning up denormalized data than a migration.

### Different Scripts Per Column, Different False Positives Per Table

In summary, at least 4 types of scripts were needed depending on the storage format of each column.

| Storage Format | Approach |
|---------------|----------|
| Full jibun address | Dong-name-based mapping → insert district |
| Road-name address | Road-name-based mapping → insert district |
| District name only | No change (but service logic verification needed) |
| Administrative area code | Code mapping table conversion |

And while these 4 types were the baseline, each table had different false positive conditions. The apartment table had brand names like "Hwaseongsi-cheong Station," the transaction table didn't, and the real estate agent table might have yet another form of false positive. Each table's sample data had to be reviewed, and false positive conditions had to be adjusted per script.

Repeating this for 75 tables and 120 columns meant writing dozens of scripts that were similar but subtly different. I automated what I could, but since each column had different formats and false positive cases, there was no avoiding the one-by-one verification. At this point, I kept thinking, "why was the address stored as plain text in the first place?"

### Validation: An Endless Loop

Even after writing the scripts, I couldn't run them on production right away. With 2.8 million records being changed, a bug in the script would be hard to reverse.

I ran them in the development environment first and compared data before and after the changes.

```sql
-- Pre-change snapshot
CREATE TABLE apartment_backup AS SELECT id, addr FROM apartment WHERE addr LIKE '%화성시%';

-- Compare after script execution
SELECT b.addr AS before_addr, a.addr AS after_addr
FROM apartment a
JOIN apartment_backup b ON a.id = b.id
WHERE a.addr != b.addr
LIMIT 100;
```

Issues I'd missed were discovered during this validation. For example, some dong names were substrings of other dong names.

```
Applying the 'Banwol-dong' mapping → matched both 'Banwol-dong' and 'Banwol 1-dong'
```

Cases requiring adjustments to LIKE pattern matching order and accuracy kept surfacing during validation, and each time I had to fix the script, rerun it, and re-validate.

For each of the 75 tables, I ran the cycle: **snapshot → execute → compare → fix → re-execute**. Honestly, this was the most time-consuming and exhausting part of the entire process.

### Production Deployment

Even after finishing development environment validation, I couldn't relax. The real nerve-wracking part was production deployment.

In development, mistakes can be redone. Production is different. If a script has an error, incorrect addresses are immediately exposed to users. If something like "Gyeonggi-do Hwaseong-si Byeongjeom-gu Byeongjeom-gu Jinan-dong" — a double insertion — occurred, users would notice immediately.

Running UPDATE on 2.8 million records at once could hold table locks for too long, so I executed table by table, with large tables broken into batches. I ran them during low-traffic hours, and after each table, I verified that the changed addresses displayed correctly in the service before moving to the next one. Looking back, this was probably the most nerve-wracking period of the entire process.

The full process looked like this:

1. **Impact scope identification** — column-name-based search + LIKE full scan
2. **Mapping table construction** — dong→district, road-name→district, admin code mappings
3. **False positive filtering** — sample review per table, exclusion conditions for brand names, etc.
4. **Per-column-type script writing** — different logic for jibun addresses, road-name addresses, admin codes
5. **Repeated dev environment validation** — snapshot comparison → error discovery → fix → re-validate loop
6. **Production deployment** — table-by-table, batch processing for large tables, low-traffic hours
7. **Post-deployment verification** — confirming changed addresses display correctly in the service

## If It Had Been Normalized

Full scan, mapping table construction, per-column script writing, repeated validation, production deployment. Throughout this entire process, one thought kept coming to mind. How simple would this have been if the data had been normalized?

What if address data had been managed in a single master table, with each service table referencing only codes?

```sql
-- Master table (Single Source of Truth)
CREATE TABLE area_code (
    region_code VARCHAR(10) PRIMARY KEY,
    sido VARCHAR(20),       -- Province
    sigungu VARCHAR(20),    -- City/District
    dong VARCHAR(20),       -- Neighborhood
    full_address VARCHAR(100)
);

-- Service tables reference only codes
CREATE TABLE apartment (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    region_code VARCHAR(10),  -- FK reference
    FOREIGN KEY (region_code) REFERENCES area_code(region_code)
);
```

With this structure, the Hwaseong-si migration would look like this:

```sql
-- UPDATE ~40 rows in the master table. Done.
UPDATE area_code
SET region_code = '4159551000', sigungu = 'Byeongjeom-gu'
WHERE region_code = '4159052000';
```

Update one master table, and all referencing tables automatically show the changed address. The 7 steps I described earlier — full scan, mapping tables, false positive filtering, per-column scripts, repeated validation, production deployment, post-deployment verification — all replaced by a single UPDATE.

If only it had been this structure from the start — that's the thought that stayed with me.

**One fact should exist in only one place** — the fundamental principle of normalization, Single Source of Truth, isn't just textbook theory. I truly felt this time that ignoring it can come at a steep price.

---

## But Should Everything Be Normalized?

As I mentioned earlier, during the migration I had nothing but frustration toward the denormalized structure. But after the work was done, I thought about it more coolly and realized that the original decision to store text probably had its reasons.

Our service is overwhelmingly read-heavy — property listings, transaction price lookups, and so on. Just the property listing API alone needs to display dozens of addresses at once, and if addresses were normalized, every listing query would need a JOIN to the administrative area master table. If virtually every read API in a high-traffic service gains an additional JOIN, the performance impact would be non-trivial.

The write side has similar challenges. Our service frequently fetches data from external APIs — the Ministry of Land, Infrastructure and Transport, the Ministry of the Interior and Safety, and others — and these API responses already contain complete address text. Something like `"Gyeonggi-do Hwaseong-si Jinan-dong 908"`. Storing that as-is is a single line, but fitting it into a normalized structure means parsing the address, looking up codes for each level (province, city, district, dong), and mapping them. With numerous external API integrations, running this parsing logic every time would have been quite cumbersome.

And over-normalization creates its own problems. This is something I actually felt while thinking, "So how far should I normalize addresses?" Imagine splitting every level — province, city, district, dong, ri, lot number — into separate tables.

```sql
SELECT s.name, sg.name, d.name, r.name, a.bungi
FROM apartment a
JOIN dong d ON a.dong_id = d.id
JOIN sigungu sg ON d.sigungu_id = sg.id
JOIN sido s ON sg.sido_id = s.id
LEFT JOIN ri r ON a.ri_id = r.id
WHERE a.id = 1;
```

Displaying a single address requires JOINing 4–5 tables. For a read-heavy service like ours, this isn't practical. Skip normalization and you end up in migration hell like this time. Over-normalize and you end up in query performance hell. I think it ultimately comes down to where you find the balance.

---

## So Where Is the Right Balance?

After going through this experience, I thought about what I would do if I were designing from scratch.

The conclusion I reached was **code references as the default, with intentional denormalization where performance demands it.**

```sql
-- Default: code reference (normalized)
CREATE TABLE area_code (
    region_code VARCHAR(10) PRIMARY KEY,
    full_address VARCHAR(100)
);

-- Frequently queried tables also store address text (intentional denormalization)
-- But region_code is kept alongside, enabling updates when needed
CREATE TABLE apartment (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    region_code VARCHAR(10),          -- Code reference (normalized)
    cached_address VARCHAR(200),      -- Performance cache (denormalized)
    FOREIGN KEY (region_code) REFERENCES area_code(region_code)
);
```

You might wonder how this differs from the fully denormalized approach. The key difference is this: `region_code` serves as an **anchor point for updates.**

When only text was stored, determining "which dong does this address belong to" required inference through text parsing. With `region_code`, you can map precisely by code. For reads, use `cached_address` directly without JOINs. When administrative areas change, batch-update `cached_address` based on `region_code`.

If this had been the structure, what would the Hwaseong-si migration have looked like? Update the master table, then run a single script to refresh `cached_address` based on `region_code`. No full scan, no false positive filtering, no per-column scripts.

---

## Wrapping Up

The biggest lesson from this experience was that normalization's value isn't visible in normal times. Storing as text makes reads fast and writes easy. The cost of that convenience comes due when data changes — as it did this time. And that cost arrived all at once in the form of a 75-table full scan and 2.8 million records of data cleansing.

That said, I don't think unconditional normalization is the answer either. A structure requiring 5-table JOINs to display a single address, or parsing every external API response into a normalized structure, isn't practical. I think it's ultimately a matter of finding balance between normalization and denormalization.

But one thing became clear after this experience. When choosing to denormalize, the reason shouldn't be "because it's easier." Even when intentionally duplicating text for performance, I think you should keep an update anchor like `region_code` alongside it. That way, when the next change comes, you can respond with a code-based batch update instead of a full scan.

The next time I face a similar design decision, I think the memory of this full scan will stay with me for quite a while.

---

### References

#### Hwaseong-si District Split
- [Administrative District Change Notice (Effective 2026.2.1.) - Ministry of the Interior and Safety](https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000052&nttId=122595)
- [Hwaseong-si confirms establishment of 4 general districts including Dongtan-gu - Hankook Ilbo](https://www.hankookilbo.com/News/Read/A2025082408260002063)
- [Hwaseong-si / Administration / District Split - Namuwiki](https://namu.wiki/w/%ED%99%94%EC%84%B1%EC%8B%9C/%ED%96%89%EC%A0%95/%EB%B6%84%EA%B5%AC%20%EC%B6%94%EC%A7%84)

#### Database Normalization
- [Database Normalization - Wikipedia](https://en.wikipedia.org/wiki/Database_normalization)
