const CACHE_NAME = "edunesta-v4";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon.svg",
];

const BG_SYNC_TAG = "edunesta-bg-sync-v1";
const QUEUE_DB_NAME = "edunesta-sync-queue";
const QUEUE_STORE_NAME = "requests";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const openQueueDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open queue DB"));
  });

const enqueueRequest = (entry) =>
  openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE_NAME, "readwrite");
        const store = tx.objectStore(QUEUE_STORE_NAME);
        store.add(entry);

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("Failed to enqueue request"));
        };
      })
  );

const getQueuedRequests = () =>
  openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE_NAME, "readonly");
        const store = tx.objectStore(QUEUE_STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          resolve(Array.isArray(req.result) ? req.result : []);
        };
        req.onerror = () => {
          reject(req.error || new Error("Failed to read queued requests"));
        };

        tx.oncomplete = () => db.close();
      })
  );

const deleteQueuedRequest = (id) =>
  openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE_NAME, "readwrite");
        const store = tx.objectStore(QUEUE_STORE_NAME);
        store.delete(id);

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("Failed to delete queued request"));
        };
      })
  );

const clearQueuedRequests = () =>
  openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE_NAME, "readwrite");
        const store = tx.objectStore(QUEUE_STORE_NAME);
        store.clear();

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("Failed to clear queued requests"));
        };
      })
  );

const serializeHeaders = (headers) => {
  const out = {};
  for (const [key, value] of headers.entries()) {
    const lowerKey = String(key).toLowerCase();
    if (lowerKey === "content-length") continue;
    if (lowerKey === "authorization") continue;
    out[key] = value;
  }
  return out;
};

const isSupportedQueueContentType = (request) => {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();

  if (!contentType) return true;

  return (
    contentType.includes("application/json") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("text/plain")
  );
};

const serializeRequest = async (request) => {
  const method = String(request.method || "GET").toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? null : await request.clone().text();

  return {
    url: request.url,
    method,
    headers: serializeHeaders(request.headers),
    body,
    credentials: request.credentials || "include",
    mode: request.mode || "cors",
    createdAt: Date.now(),
  };
};

const isQueueableApiMutation = (request) => {
  const method = String(request.method || "GET").toUpperCase();
  if (!MUTATION_METHODS.has(method)) return false;

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return false;

  // Keep auth/AI and exam submission online-only.
  if (url.pathname.startsWith("/api/auth/")) return false;
  if (url.pathname.startsWith("/api/ai/")) return false;
  if (url.pathname === "/api/submissions/submit") return false;

  // Avoid queueing multipart uploads/files.
  if (!isSupportedQueueContentType(request)) return false;

  return true;
};

const replayQueuedEntry = async (entry) => {
  return fetch(entry.url, {
    method: entry.method,
    headers: entry.headers || {},
    body: entry.body,
    credentials: entry.credentials || "include",
    mode: entry.mode || "cors",
    redirect: "follow",
  });
};

const isPermanentClientFailureStatus = (status) => {
  return [400, 404, 405, 409, 410, 422].includes(Number(status));
};

const isAuthRelatedStatus = (status) => {
  return [401, 403].includes(Number(status));
};

const notifyClients = async (payload) => {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage(payload);
  }
};

const flushQueuedRequests = async () => {
  const queued = await getQueuedRequests();
  if (!queued.length) {
    return { synced: 0, remaining: 0 };
  }

  const ordered = queued.slice().sort((a, b) => a.id - b.id);
  let synced = 0;

  for (const entry of ordered) {
    try {
      const response = await replayQueuedEntry(entry);

      if (response.ok || isPermanentClientFailureStatus(response.status)) {
        await deleteQueuedRequest(entry.id);
        synced += 1;
        continue;
      }

      if (isAuthRelatedStatus(response.status)) {
        await notifyClients({
          type: "EDUNESTA_SYNC_AUTH_REQUIRED",
          status: response.status,
        });
      }

      // Keep queued for transient/server errors.
      break;
    } catch {
      // Still offline or network unstable; keep remaining entries queued.
      break;
    }
  }

  const remaining = (await getQueuedRequests()).length;
  await notifyClients({
    type: "EDUNESTA_SYNC_STATUS",
    synced,
    remaining,
  });

  return { synced, remaining };
};

const scheduleBackgroundSync = async () => {
  if ("sync" in self.registration) {
    try {
      await self.registration.sync.register(BG_SYNC_TAG);
      return;
    } catch {
      // Ignore and fallback to immediate attempt.
    }
  }

  await flushQueuedRequests();
};

const handleMutationRequest = async (request) => {
  try {
    return await fetch(request.clone());
  } catch {
    const serialized = await serializeRequest(request);
    await enqueueRequest(serialized);
    await scheduleBackgroundSync();

    return new Response(
      JSON.stringify({
        queued: true,
        message: "Request queued offline. It will sync automatically.",
      }),
      {
        status: 202,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => flushQueuedRequests().catch(() => {}))
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (isQueueableApiMutation(request)) {
    event.respondWith(handleMutationRequest(request));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Avoid caching API GET responses to prevent leaking user-specific data.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              message: "Offline. Live data requires an internet connection.",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(flushQueuedRequests());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "EDUNESTA_SYNC_NOW") {
    if (typeof event.waitUntil === "function") {
      event.waitUntil(flushQueuedRequests());
    } else {
      void flushQueuedRequests();
    }
    return;
  }

  if (event.data?.type === "EDUNESTA_CLEAR_QUEUE") {
    const clearTask = clearQueuedRequests().then(() =>
      notifyClients({
        type: "EDUNESTA_SYNC_STATUS",
        synced: 0,
        remaining: 0,
      })
    );

    if (typeof event.waitUntil === "function") {
      event.waitUntil(clearTask);
    } else {
      void clearTask;
    }
  }
});

