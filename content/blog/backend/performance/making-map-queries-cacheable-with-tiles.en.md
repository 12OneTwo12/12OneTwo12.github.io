---
title: "Making a Hard-to-Cache Map Query Cacheable: From Viewport Coordinates to Tiles"
tags:
  - "cache"
  - "redis"
  - "cdn"
  - "map"
  - "api"
  - "performance optimization"
date: '2026-11-25'
draft: true
images:
  - "https://www.dropbox.com/scl/fi/n8ou7mhpqj38i1j2rpt9m/map-tile-cache-cover.jpg?rlkey=8xb06znlkpxvazf7wm1e45b9n&raw=1"
description: "Our map API queried by viewport coordinates, so every request was different and caching was hard. This post covers how we switched the request unit to tiles to enable caching and prefetching, the cache hit rates we saw in production, and our thinking on TTL."
---

![A map with colorful pins stuck in it](https://www.dropbox.com/scl/fi/n8ou7mhpqj38i1j2rpt9m/map-tile-cache-cover.jpg?rlkey=8xb06znlkpxvazf7wm1e45b9n&raw=1)

*Photo: delfi de la Rua on Unsplash*

Hello, I'm Jeong Jeong-il, a backend developer working at a PropTech platform.

This time I'd like to talk about adding a cache to the map query in our service. Our map has an API that looks up the apartment complexes inside the viewport every time the user moves the map. Because this API took the viewport coordinates as they were, every request was different, and it was hard to use a cache. So we changed the unit of the request itself to make caching possible, and I want to write down what I had to think through along the way.

The approach in this post is not new in itself. Splitting map images into tiles has been around for a long time. But applying it to our query API meant deciding quite a few things ourselves, such as the tile size and the cache TTL. So this post focuses on those decisions, up to what we confirmed after rolling it out to production.

---

## Why is it hard to cache a query by viewport coordinates?

On our map, apartment complexes are shown as markers with their size and price.

![The production web map. Apartment complexes around Songpa-gu and Gangnam-gu are shown as markers with size and price](https://www.dropbox.com/scl/fi/5miauy3cm6prv0idzjas1/map-tile-cache-map-markers.jpg?rlkey=8n05prib5ahfng9zawsrlxuuc&raw=1)

*The map screen on our production web.*

Previously, this query used the coordinates of two corners of the viewport. You send the southwest and northeast corners, and the server finds the complexes between them and returns them.

```text
GET /map/complexes?swLat=37.48532&swLng=127.05688&neLat=37.52193&neLng=127.12500
```

I think this is the first design that comes to mind when building a map query API. It queries exactly what is on the screen, so nothing is wasted.

The problem was that **every request is different.**

Even when two users look at the same neighborhood, their screen sizes differ, and moving the map by a single pixel changes the decimals of the coordinates. A cache only helps when the "same request" comes again, and with viewport coordinates the same request almost never came. So even the common case of moving the map a little and coming back went all the way down to the DB every time.

So how long was it actually taking? I measured from the moment of release to the moment the new markers were drawn, five times each in the browser, and ours took about 0.7–1 second. I measured other real-estate map services the same way and they were under 0.2 seconds. This time actually included not only the round trip to the server but also the wait before the query even started, which I'll come back to later.

## Changing the request unit to tiles

I decided that instead of fitting the request to the user's viewport, **we had to send it aligned to predefined cells.**

When map services serve map images, they divide the world into equally sized cells per zoom level and have clients request images by a cell number, `z/x/y`. These cells are called tiles, and we decided to use the same grid for the complex query.

```text
GET /map/complexes/tiles/13/6988/3173
```

The frontend computes which tiles the viewport covers, requests only those, and merges the returned tiles to draw the screen. The server computes the actual range each tile number covers.

![Comparison of viewport-coordinate requests and tile requests. By coordinates the two users' requests differ, but by tile the overlapping tiles become the same request](https://www.dropbox.com/scl/fi/ku3ik8nv68hxxgzl76hza/map-tile-cache-bounds-vs-tiles.en.png?rlkey=qbpx4ul40v884wvwblbpo893r&raw=1)

*Two users looking at roughly the same area.*

With this change, the requests of people looking at the same neighborhood **share the same address for as many tiles as overlap.** Even with a different screen size, or after moving the map a little, the requested tiles stay the same as long as you don't cross a tile boundary.

Of course there are downsides. Since we fetch whole tiles that the viewport touches, we also receive complexes outside the screen, and one request becomes several. So I spent quite some time on how big the tiles should be.

### Deciding the tile size

Smaller tiles mean less off-screen data, but more requests per screen. Larger tiles mean fewer requests but a lot of data nobody looks at. Looking at the cache alone, larger tiles reduce the number of distinct tiles and raise the chance of a cache hit, but that didn't mean we could just make them as large as possible.

Each time the zoom drops by one level, a tile covers four times the area. Using tiles at the same zoom as the map would need four times as many tiles per screen, and going two levels lower would make a single tile cover far more than the screen.

![The same viewport overlaid with tile grids at different zooms: 16 tiles at the map's zoom, 4 tiles one level lower, 1 tile two levels lower](https://www.dropbox.com/scl/fi/w33zv84ris34tz3krff2l/map-tile-cache-tile-zoom-compare.en.png?rlkey=qsk4oa6qaojdpgqjwfzz3vlvt&raw=1)

*The same viewport divided by three tile sizes.*

So at the zoom levels where complex markers are shown, we use **tiles one zoom level lower than the map.** This fills one screen with about 2–6 tiles in most cases, and when a large screen would need more than 12, we don't split into tiles and query by viewport range in one request as before.

```ts
// map zoom 14.3 → tile zoom 13
const tileZoom = clamp(Math.floor(mapZoom) - 1, MIN_TILE_ZOOM, MAX_TILE_ZOOM);
```

The map zoom moves in fractions like 14.3, but we floor the tile zoom to an integer. If a small zoom change made us request different tiles, we would lose the cache hit again.

### Filters and the cache key

Our map has filters such as size, price, and move-in year. Filters are attached as query parameters and included in the cache key as they are, since the response is only the same when the filter combination is the same.

What I paid attention to here was that the number of cache keys grows with the number of filter combinations. Keys could multiply to the number of tiles times the number of filter combinations, so I wondered whether the cache would be split so finely that hits would almost never happen.

We could only confirm this after rolling out to production, and when we looked at the real requests, **90% of them had no filter at all.** There were 151 filter combinations over two days, but most requests were concentrated on the default query without filters. At least in our service, filters didn't seem to fragment the cache much.

## Putting the cache in four places

So where should the cache go? I put it in four places, in order of closeness to the user.

```mermaid
flowchart LR
    A["Map page<br/>in-memory cache<br/>5 min"] --> B["Browser cache<br/>60 s"]
    B --> C["CDN cache<br/>5 min"]
    C --> D["Redis<br/>5 min (+0–30 s)"]
    D --> E[("DB")]
```

- **In-memory cache on the map page**: the page holds the tiles it received for up to 5 minutes. Moving the map a little and coming back ends here, so no request is sent at all.
- **Browser cache**: used when the page is refreshed or reopened. A browser cache can't be purged from the server once it has been delivered, so we keep it for only 60 seconds.
- **CDN cache**: if someone else recently viewed the tile, the CDN answers without reaching our server.
- **Redis**: even when the CDN doesn't have it, the server answers without querying the DB.

The first two only reuse what the same user received, while the last two (CDN and Redis) are shared caches used by many people together.

The TTLs for the browser and the CDN are set by the server through a response header.

```http
Cache-Control: public, max-age=60, s-maxage=300
```

For Redis, we added 0–30 seconds of jitter to the TTL. If caches created at the same moment expire together, queries can pile onto the DB at that instant, which is a cache stampede. And since I thought the map should still work even if Redis has a problem, a failed Redis read or write falls back to reading from the DB.

Turning on the CDN cache also meant looking at the response headers, because the response the CDN gave one person has to be reusable for another. Tile responses are public data that is the same for everyone regardless of login, so we only had to align the headers.

### How late does the data get with several layers?

A cache delays how soon data changes show up. And with several layers, it turned out this delay did not end at 5 minutes.

Here is the worst case. Redis may hold data that is just about to expire, which is up to 5 minutes 30 seconds old. If the CDN picks up that data, it keeps it for another 5 minutes, and the page holds what it received for 5 more. The browser cache counts its 60 seconds including the age the CDN reports, so we didn't add it separately. Adding these up, **in the worst case the data could be 15 minutes 30 seconds late.**

![Cache TTLs per layer laid end to end: Redis 5 min 30 s, CDN 5 min, in-page memory 5 min, adding up to 15 min 30 s](https://www.dropbox.com/scl/fi/jgha7jig4cwujgxoaktnh/map-tile-cache-staleness-stack.en.png?rlkey=bvj2zrt1869jw7w22qsjekrhh&raw=1)

*The worst case, where each layer picks up data that is just about to expire.*

I didn't think the prices shown on map markers need to be accurate to the minute, so I decided to accept this. The detail screen you reach by tapping a complex is queried separately and is not affected by this cache.

## When should the query start?

Switching to tiles made one more thing possible: prefetching the tiles that will be needed next.

When querying by viewport coordinates, we had to know where the user would stop before we could build the request. But tile numbers are fixed, so we can compute in advance which tile is to the right of the current screen, or which tile we'd need after zooming out one level.

Even with data in the cache, starting the query late defeats the purpose, so we also looked at when the query starts. On a map, there are broadly three moments when a query can start.

| When | Upside | Downside |
|---|---|---|
| After the map has fully stopped | The view is final, so no wasted requests | If the idle signal arrives late, the query starts that much later |
| The moment of release | No waiting for the idle signal | If the map keeps moving after release, the view changes |
| While dragging | Data can be ready before release | May fetch data the user never sees |

![The three moments a query can start, on a time axis: prefetching every 0.1 s while dragging, querying on release, and querying after the idle signal that arrives 0.36–0.46 s after release](https://www.dropbox.com/scl/fi/qc5pmpey13bglqi0auq62/map-tile-cache-query-timing.en.png?rlkey=1aos0a7rukr653zulnh4rv2a5&raw=1)

*Release is at 0. The position of the idle signal is what we measured on the map SDK we use.*

We originally used the first approach. But when I measured it, on the map SDK we use the idle signal was **arriving 0.36–0.46 seconds after release.** Even with data already in the cache, we had to wait that long.

Of course, if the map keeps moving after release, waiting for the idle signal is the right thing to do. But when I checked, the map stopped right where it was on release. So I decided there was no need to wait for the idle signal and moved the query to the moment of release.

On top of that, we added the third approach, prefetching. While dragging, every 0.1 seconds we fetch the tiles for the current view and for one viewport ahead in the direction the view is moving. After the map stops and the markers are drawn, we also fetch the area around the view, half a viewport wide, and the tiles for one zoom level out. This is so that wherever the next move goes, it lands inside what we already have.

![Prefetch ranges: while dragging, one viewport ahead in the direction the view is moving; after stopping, half a viewport around the view](https://www.dropbox.com/scl/fi/583rmtsihf3mw00m1alhs/map-tile-cache-prefetch-areas.en.png?rlkey=chycx08sd6ju4v19ahf3ugitk&raw=1)

*The blue outline is the current view, the dashed orange outline is the range we want to prefetch, and the shaded cells are the tiles actually requested. Tiles for one zoom level out are not drawn.*

If we drew prefetched data right away during a drag, markers would flicker on a moving map. That didn't look good, so during a drag we only store what we receive and draw only after release.

### Limits on prefetching

That said, tiles fetched by prefetching may never be seen by the user. It uses more of the user's data and our server resources, so we put a few limits in place.

- At most 6 prefetch requests run at the same time; the rest wait in a queue.
- The queue holds at most 24 requests, and the oldest are dropped first, because if the map has already moved elsewhere the old requests are no longer needed.
- When a request's turn comes, it is skipped if the tile has already been received.
- If the browser is in data-saver mode or on a 2G connection, off-screen tiles are not fetched.

```ts
const isSpeculativePrefetchAllowed = () => {
  const connection = navigator.connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType ?? '');
};
```

## What we saw in production

After the rollout I measured again the same way. The time from release to markers went **from 0.7–1 second to 0.01–0.12 seconds.** It was about 0.01–0.04 seconds for drags of 0.5 seconds or longer, and about 0.06–0.12 seconds for very short drags.

![Time from release to markers before and after the rollout: 0.7–1 s before; after, 0.06–0.12 s for very short drags and 0.01–0.04 s for drags of 0.5 s or longer](https://www.dropbox.com/scl/fi/tuo8dtre0vllw9nfvejmg/map-tile-cache-before-after.en.png?rlkey=0cb2k1xn4rrdkkry74pb6ssc3&raw=1)

*Each bar is the minimum and maximum over several measurements.*

Before the rollout, what I paid the most attention to was the number of requests. One request was now split into several tiles, with prefetching on top. Since one screen usually needs up to 6 tiles, I first assumed requests would grow sixfold with no cache hits at all and calculated whether the server and the DB could take it. Over a whole day there was headroom, but I judged that moments when requests pile up at once could be a burden, and that is why we added the concurrency limit I mentioned above.

Comparing one day three days after the rollout with one day before it, map queries reaching the server grew by only about 17%, and DB CPU usage did not go up. Requests must have grown far more than that from the tile split, so the rest seems to have been absorbed by the in-memory cache on the page.

{{% todo %}}
17% compares one day before with one day after (11-24). Update with a weekly average.
{{% /todo %}}

### Hit rate of the shared caches

The shared caches, however, had a lower hit rate than I expected. Of the tile requests that reached the server, the share answered straight from Redis was **only 2–3%.** The CDN was similar: even the tiles requested most the day before were rarely answered straight from the CDN.

Why was it this low? Looking at the request logs, of the distinct tile-and-filter combinations requested over two days, **nearly half were requested only once.** Even the 20 most requested ones together made up only about 8% of all requests.

![Share of tile+filter combinations by how many times they were requested over two days: once 46.8%, twice 18.6%, 3–5 times 20.7%, 6–10 times 10.0%, 11 or more 4.0%](https://www.dropbox.com/scl/fi/z01to7lep6orkt0lg551t/map-tile-cache-request-distribution.en.png?rlkey=ze07jg88iey5y2221h5ja0vhz&raw=1)

*How many times the same tile-and-filter combination was requested over two days.*

With requests spread this widely, it seems there just weren't many cases where another person requested the same tile within the 5-minute TTL.

The in-page cache, which reuses what the same user already received, seems to have been a different story. A single user looking at the map keeps moving around the same area. I think the time to show markers now comes down to starting the query earlier, the in-memory cache on the page, and prefetching.

The time saved by a cache hit also differed by layer.

| Where the cache hit | Time to response |
|---|---|
| In-page memory | No request |
| CDN (measured by requesting the same tile twice in a row) | 41–60 ms |
| Redis (server processing time) | median 9–10 ms |
| Miss everywhere, DB query (server processing time) | median 22–26 ms |
| Full response when everything misses | 128–268 ms |

The DB query itself is already fast, so answering from Redis only saved about 10 ms. The time to travel to the server and back was far larger, so a hit in a cache closer to the user, like the CDN or the page, made a bigger difference.

## Thinking about TTL

Then how much would the hit rate rise with a longer TTL?

We could calculate this from the real request logs. We lined up two days of tile requests in time order and counted a hit whenever the same tile-and-filter combination came again within the TTL. The first day was used to warm the cache and only the second day was counted. With 5 minutes the result was 2.5%, almost the same as what we observed, so I ran the calculation for other TTLs.

![Estimated hit rate by server-side cache TTL: 5 min 2.5%, 15 min 7.2%, 30 min 10.6%, 1 h 14.7%, 3 h 29.1%, 6 h 39.1%, 12 h 50.7%, 24 h 61.2%](https://www.dropbox.com/scl/fi/ophwyjy62oamkkebfxiu7/map-tile-cache-hit-rate-by-ttl.en.png?rlkey=57o9n1c7wbbm6bhpumvoq0eqz&raw=1)

*Estimated hit rate by TTL, calculated from real request logs (the horizontal axis is not evenly spaced). This is for a cache gathered in one place like Redis; a CDN split by region would likely be lower.*

Even at 1 hour it was about 15%, and **it took a 12-hour TTL for half of the requests to hit.**

"Then why not just make the TTL long?" one might think, but it wasn't that simple.

A longer TTL would reduce the requests reaching the server and the DB, and with more answers coming from the CDN, even places a user visits for the first time would respond faster. But price changes would show up on the map that much later. As we saw earlier, delays add up across layers, so with 6 hours each on Redis and the CDN the worst case would be more than 12 hours late. The time during which a marker on the map and the detail screen show different values would grow just as much.

I think a long TTL needs to come with a way to purge the cache when the data changes. But how purgeable each layer is turned out to differ.

| Cache | Shared with | Purge from the server | Current TTL |
|---|---|---|---|
| In-page memory | The same user | Not possible | 5 min |
| Browser | The same user | Not possible | 60 s |
| CDN | Many users | Needs a separate request | 5 min |
| Redis | Many users | Immediate | 5 min (+0–30 s) |

So I'm thinking that using a different TTL per layer might be an option (this is still just my personal opinion): long for Redis, which the server can purge right away, and short as it is now for the browser, which is hard to purge. But this also depends on how many times a day the data changes and when, so we haven't settled on values yet.

## Closing

That was a look at what I had to think through while switching our map query to tiles.

In this work, I think aligning requests to predefined tiles instead of viewport coordinates was the starting point that made caching possible. Even outside maps, an API that is hard to cache because each request has slightly different values might be able to use a similar approach.

As for the TTL, I plan to adjust it as we collect more request logs.

I hope this post is of some help to those working through similar problems.

Thank you for reading.

### Reference

- [OpenStreetMap Wiki: Slippy map tilenames](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
- [MDN: Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
- [MDN: NetworkInformation.saveData](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData)
- [Toptal: Serve Map Clusters 50x Faster Using Smarter Caching](https://www.toptal.com/api-development/smarter-caching-to-serve-map-clusters)
