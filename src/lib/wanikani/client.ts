import type {
  Assignment,
  Collection,
  CreateReviewBody,
  CreateReviewResponse,
  Report,
  Resource,
  ReviewStatistic,
  StudyMaterial,
  Subject,
  Summary,
  User,
  UserPreferences,
} from './types';

const BASE_URL = 'https://api.wanikani.com/v2';
const REVISION = '20170710';

/** WaniKani allows 60 requests a minute; a few in flight at once keeps bursts well under that. */
const MAX_CONCURRENT = 4;
const MAX_RATE_LIMIT_RETRIES = 3;

export class WaniKaniError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'WaniKaniError';
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  /** The token is valid but lacks the permission this call needs (e.g. `reviews:create`). */
  get isForbidden() {
    return this.status === 403;
  }
}

// A tiny semaphore so a session start (subjects in chunks, study materials, …) never fires dozens
// of requests at once.
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Query = Record<string, string | number | boolean | (string | number)[] | undefined>;

function buildUrl(path: string, query?: Query) {
  if (path.startsWith('http')) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

export function createClient(token: string) {
  async function request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    { query, body }: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const url = buildUrl(path, query);
    for (let attempt = 0; ; attempt++) {
      await acquire();
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Wanikani-Revision': REVISION,
            ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } finally {
        release();
      }

      if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        // RateLimit-Reset is the epoch second the window resets.
        const reset = Number(res.headers.get('RateLimit-Reset'));
        const waitMs = reset ? Math.max(1000, reset * 1000 - Date.now() + 250) : 5000;
        await sleep(Math.min(waitMs, 60_000));
        continue;
      }

      if (!res.ok) {
        let message = `WaniKani returned ${res.status}`;
        try {
          const json = await res.json();
          if (json?.error) message = String(json.error);
        } catch {
          // Body wasn't JSON; keep the status message.
        }
        throw new WaniKaniError(message, res.status);
      }
      return (await res.json()) as T;
    }
  }

  /** Follows `pages.next_url` until the collection is exhausted. */
  async function getAll<T>(path: string, query?: Query): Promise<Resource<T>[]> {
    const out: Resource<T>[] = [];
    let next: string | null = buildUrl(path, query);
    while (next) {
      const page: Collection<Resource<T>> = await request('GET', next);
      out.push(...page.data);
      next = page.pages.next_url;
    }
    return out;
  }

  /** Fetches a collection filtered by `ids`, split so the URL stays a sane length. */
  async function getByIds<T>(path: string, ids: number[], key = 'ids', query?: Query) {
    const unique = [...new Set(ids)];
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += 250) chunks.push(unique.slice(i, i + 250));
    const pages = await Promise.all(chunks.map((chunk) => getAll<T>(path, { ...query, [key]: chunk })));
    return pages.flat();
  }

  return {
    getUser: () => request<Resource<User, 'user'>>('GET', '/user').then((r) => r.data),

    updatePreferences: (preferences: Partial<UserPreferences>) =>
      request<Resource<User, 'user'>>('PUT', '/user', { body: { user: { preferences } } }).then(
        (r) => r.data,
      ),

    getSummary: () => request<Report<Summary>>('GET', '/summary').then((r) => r.data),

    getAvailableReviews: () =>
      getAll<Assignment>('/assignments', {
        immediately_available_for_review: true,
        hidden: false,
      }) as Promise<Resource<Assignment, 'assignment'>[]>,

    /** One page is enough: only `total_count` is read. */
    countAssignments: (query: Query) =>
      request<Collection<unknown>>('GET', '/assignments', { query }).then((c) => c.total_count),

    getAssignments: (query: Query) =>
      getAll<Assignment>('/assignments', query) as Promise<Resource<Assignment, 'assignment'>[]>,

    getSubjects: (ids: number[]) =>
      getByIds<unknown>('/subjects', ids) as unknown as Promise<Subject[]>,

    getSubjectsByLevel: (level: number, types?: string[]) =>
      getAll<unknown>('/subjects', { levels: level, types, hidden: false }) as unknown as Promise<
        Subject[]
      >,

    getReviewStatistics: (subjectIds: number[]) =>
      getByIds<ReviewStatistic>('/review_statistics', subjectIds, 'subject_ids'),

    getStudyMaterials: (subjectIds: number[]) =>
      getByIds<StudyMaterial>('/study_materials', subjectIds, 'subject_ids'),

    createReview: (review: CreateReviewBody) =>
      request<CreateReviewResponse>('POST', '/reviews', { body: { review } }),
  };
}

export type WaniKaniClient = ReturnType<typeof createClient>;
